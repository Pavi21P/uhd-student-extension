import { describe, expect, it } from 'vitest';
import { backupByteLimit, buildImport, parseBackup, parseBackupText, serializeBackup } from '../../src/shared/timetable-backup';
import { FoundationRepository, scheduleKey } from '../../src/storage/repository';
import { createMessageHandler } from '../../src/background/handler';
import { createFoundationClient } from '../../src/shared/client';
import { parseFoundationRequest, parseFoundationResponse } from '../../src/shared/foundation-rpc';
import { blankSchedule, recurringSchedule, timetableBackup } from '../fixtures/contracts.examples';
const setup=()=>{const values=new Map<string,unknown>();let writes=0;let fail=false;const repo=new FoundationRepository({get:async key=>structuredClone(values.get(key)),set:async(key,value)=>{if(fail)throw Error('Synthetic failure');values.set(key,structuredClone(value));writes++;}});return {repo,values,get writes(){return writes;},fail:()=>{fail=true;}};};
const sender={id:'test-extension',url:'chrome-extension://test-extension/dashboard.html',origin:'chrome-extension://test-extension',frameId:0};
const request={protocolVersion:1 as const,requestId:'import-test',type:'schedule.import' as const,payload:{targetScheduleId:'local-target',expectedRevision:null,mode:'replace' as const,backup:timetableBackup}};
describe('07B backup validation and planning',()=>{
  it('round trips blank fields, recurring meetings and exact times through timetable-only JSON',()=>{
    const text=serializeBackup(recurringSchedule,1234);const parsed=parseBackupText(text);
    expect(parsed).toEqual({...timetableBackup,exportedAt:1234});expect(Object.keys(parsed)).toEqual(['kind','schemaVersion','exportedAt','schedule']);
    expect(parseBackupText(serializeBackup(blankSchedule)).schedule.courses[0]).toEqual({id:'sample-blank-course'});
  });
  it.each([{...timetableBackup,kind:'other'},{...timetableBackup,schemaVersion:2},{...timetableBackup,exportedAt:NaN},{...timetableBackup,enrollment:{token:'synthetic'}},{...timetableBackup,schedule:{...recurringSchedule,credentials:'synthetic'}}])('rejects unsupported or extra backup fields %#',value=>{expect(()=>parseBackup(value)).toThrow();});
  it('rejects malformed JSON, prototype keys and oversized UTF-8 input before parsing',()=>{
    expect(()=>parseBackupText('{')).toThrow('valid JSON');expect(()=>parseBackupText('{"__proto__":{}}')).toThrow();
    expect(()=>parseBackupText(' '.repeat(backupByteLimit+1))).toThrow('1 MiB');expect(()=>parseBackupText('é'.repeat(backupByteLimit/2+1))).toThrow('1 MiB');
  });
  it('rejects dangling references and exact duplicate occurrences',()=>{
    expect(()=>parseBackup({...timetableBackup,schedule:{...recurringSchedule,meetings:[{...recurringSchedule.meetings[0],courseId:'missing'}]}})).toThrow();
    expect(()=>parseBackup({...timetableBackup,schedule:{...recurringSchedule,meetings:[recurringSchedule.meetings[0],{...recurringSchedule.meetings[0],id:'other'}]}})).toThrow();
  });
  it('does not invoke a getter supplied at the backup boundary',()=>{let called=false;const value={...timetableBackup};Object.defineProperty(value,'schedule',{get(){called=true;throw Error();},enumerable:true});expect(()=>parseBackup(value)).toThrow();expect(called).toBe(false);});
  it('replacement adopts content and zone while retaining local identity and revision',()=>{
    const local={...blankSchedule,id:'local',revision:9};const backup={...timetableBackup,schedule:{...recurringSchedule,id:'foreign',revision:100,timezone:'Europe/London'}};
    expect(buildImport(local,'local','replace',backup)).toEqual({...backup.schedule,id:'local',revision:9});expect(local.courses).toHaveLength(1);
  });
  it('merge remaps all colliding IDs together and retains local labels/zone',()=>{
    let n=0;const merged=buildImport(recurringSchedule,recurringSchedule.id,'merge',timetableBackup,()=>++n===1?'sample-course':'fresh-'+n);
    expect(merged.courses.slice(0,2)).toEqual(recurringSchedule.courses);expect(merged.meetings.slice(0,3)).toEqual(recurringSchedule.meetings);
    const added=merged.courses.slice(2);expect(added.every(c=>c.id.startsWith('fresh-'))).toBe(true);
    expect(merged.meetings.slice(3).every(m=>added.some(c=>c.id===m.courseId))).toBe(true);expect(merged.label).toBe(recurringSchedule.label);
  });
  it('fails safely if a broken ID generator cannot produce a unique ID',()=>{expect(()=>buildImport(recurringSchedule,recurringSchedule.id,'merge',timetableBackup,()=> 'sample-course')).toThrow('unique');});
  it('repeated merges create independent copies rather than silently deduplicating titles',()=>{
    const first=buildImport(recurringSchedule,recurringSchedule.id,'merge',timetableBackup);const second=buildImport(first,first.id,'merge',timetableBackup);
    expect(second.courses).toHaveLength(6);expect(new Set(second.meetings.map(m=>m.id)).size).toBe(9);
  });
  it('rejects mixed-zone merge and combined size overflow',()=>{
    expect(()=>buildImport({...recurringSchedule,timezone:'Europe/London'},recurringSchedule.id,'merge',timetableBackup)).toThrow('timezones');
    const large={...blankSchedule,courses:Array.from({length:250},(_,i)=>({id:'c'+i}))};expect(()=>buildImport(large,large.id,'merge',timetableBackup)).toThrow('250 courses');
  });
  it('supports a fresh target in either mode without trusting the source identity or revision',()=>{
    for(const mode of ['merge','replace'] as const){const result=buildImport(null,'fresh-target',mode,timetableBackup);expect(result.id).toBe('fresh-target');expect(result.revision).toBe(0);expect(result.meetings).toHaveLength(3);}
  });
});
describe('07B serialized import boundary',()=>{
  it('creates only on null revision and replaces atomically with one increment',async()=>{
    const s=setup();const first=await s.repo.importSchedule('local',null,'replace',timetableBackup);expect(first.revision).toBe(0);
    const next=await s.repo.importSchedule('local',0,'replace',{...timetableBackup,schedule:{...blankSchedule,revision:999}});expect(next.revision).toBe(1);expect(next.courses).toHaveLength(1);expect(s.writes).toBe(2);
    await expect(s.repo.importSchedule('local',null,'replace',timetableBackup)).rejects.toThrow('another view');expect(s.writes).toBe(2);
  });
  it('allows one winner for concurrent confirmation of the same revision',async()=>{
    const s=setup();await s.repo.saveSchedule(recurringSchedule,null);const results=await Promise.allSettled([s.repo.importSchedule(recurringSchedule.id,0,'merge',timetableBackup),s.repo.importSchedule(recurringSchedule.id,0,'replace',timetableBackup)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(s.writes).toBe(2);expect((await s.repo.readSchedule(recurringSchedule.id)).courses).toHaveLength(4);
  });
  it('preserves existing data after a malformed import or failed write',async()=>{
    const s=setup();const saved=await s.repo.saveSchedule(recurringSchedule,null);
    expect(()=>s.repo.importSchedule(saved.id,0,'replace',{bad:true})).toThrow();s.fail();await expect(s.repo.importSchedule(saved.id,0,'merge',timetableBackup)).rejects.toThrow('confirmed');
    expect(await s.repo.readSchedule(saved.id)).toEqual(saved);expect(s.writes).toBe(1);
  });
  it('does not overwrite a corrupt target even with a valid replacement file',async()=>{
    const s=setup();const bad={schemaVersion:99};s.values.set(scheduleKey('local'),bad);await expect(s.repo.importSchedule('local',null,'replace',timetableBackup)).rejects.toThrow();expect(s.values.get(scheduleKey('local'))).toEqual(bad);expect(s.writes).toBe(0);
  });
  it('uses the authenticated typed client and validates target identity in the response',async()=>{
    const s=setup();const handle=createMessageHandler(s.repo,'test-extension');const client=createFoundationClient(input=>handle(input,sender));
    expect(await client('schedule.import',request.payload)).toMatchObject({ok:true,data:{id:'local-target',revision:0}});
    expect(await handle(request,{...sender,id:'foreign'})).toMatchObject({ok:false,error:{code:'UNAUTHORIZED_SENDER'}});
    const validated=parseFoundationRequest(request);expect(()=>parseFoundationResponse({...request,ok:true,data:recurringSchedule},validated)).toThrow();expect(s.writes).toBe(1);
  });
  it.each([{...request.payload,mode:'erase'},{...request.payload,expectedRevision:-1},{...request.payload,selector:'submit'},{...request.payload,backup:{...timetableBackup,job:{}}}])('rejects malformed RPC payload %# before storage',async payload=>{
    const s=setup();expect(await createMessageHandler(s.repo,'test-extension')({...request,payload},sender)).toMatchObject({ok:false});expect(s.writes).toBe(0);expect(s.values.size).toBe(0);
  });
});
