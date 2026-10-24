import { describe, expect, it } from 'vitest';
import type { Meeting, Schedule } from '../../src/shared/domain';
import { proposePlacement, stagePlacement } from '../../src/dashboard/placement-model';
import { draftMeeting, parseMeetingDrafts } from '../../src/dashboard/meeting-model';
import { recurringSchedule } from '../fixtures/contracts.examples';
const source: Meeting = { id: 'sample-mon', courseId: 'sample-course', dayOfWeek: 1, startMinute: 547, endMinute: 623 };
const schedule = (): Schedule => ({ ...structuredClone(recurringSchedule), meetings: [source, ...recurringSchedule.meetings.slice(1)] });
const blank: Meeting = { id: 'new-occurrence', courseId: 'sample-blank-course', dayOfWeek: 1, startMinute: 0, endMinute: 60 };
describe('07A placement proposals', () => {
  it.each([[547,540,600],[548,555,615],[1439,1425,1440],[-50,0,60]])('snaps new placement at %s with a clipped day-end default', (minute,start,end) => {
    expect(proposePlacement('place',blank,7,minute)).toMatchObject({dayOfWeek:7,startMinute:start,endMinute:end});
  });
  it('preserves exact duration and identity when moving one recurring occurrence', () => {
    const before=schedule(); const proposed=proposePlacement('move',source,2,607);
    const after=stagePlacement(before,before.revision,'move',proposed);
    expect(proposed).toEqual({...source,dayOfWeek:2,startMinute:600,endMinute:676});
    expect(after.meetings.slice(1)).toEqual(before.meetings.slice(1)); expect(after.courses).toEqual(before.courses);
    expect(before.meetings[0]).toEqual(source); expect(after.revision).toBe(before.revision);
  });
  it('keeps all snapped moves within the day without changing duration', () => {
    for (const duration of [1,16,76,1439,1440]) for(let minute=-30;minute<=1470;minute+=7){
      const moved=proposePlacement('move',{...source,startMinute:0,endMinute:duration},3,minute);
      expect(moved.startMinute%15).toBe(0); expect(moved.startMinute).toBeGreaterThanOrEqual(0);
      expect(moved.endMinute).toBeLessThanOrEqual(1440); expect(moved.endMinute-moved.startMinute).toBe(duration);
    }
  });
  it('resizes the end only and clamps above an exact unsnapped start', () => {
    expect(proposePlacement('resize',source,1,500)).toEqual({...source,endMinute:555});
    expect(proposePlacement('resize',source,1,678)).toEqual({...source,endMinute:675});
    expect(proposePlacement('resize',source,1,1500).endMinute).toBe(1440);
  });
  it('rejects resizing into another day', () => { expect(()=>proposePlacement('resize',source,2,700)).toThrow('same day'); });
  it.each([NaN,Infinity,-Infinity])('rejects non-finite pointer time %s', minute=>{expect(()=>proposePlacement('move',source,1,minute)).toThrow();});
  it('preserves exact minute values for a keyboard day change and form round trip', () => {
    const moved=proposePlacement('move',source,4,source.startMinute,false);
    expect(moved).toEqual({...source,dayOfWeek:4});
    expect(parseMeetingDrafts(source.courseId,[draftMeeting(moved)])).toEqual({ok:true,meetings:[moved]});
  });
  it('creates only one new meeting for an unscheduled card without mutating the input', () => {
    const before=schedule();const after=stagePlacement(before,before.revision,'place',proposePlacement('place',blank,5,800));
    expect(after.meetings.filter(m=>m.courseId===blank.courseId)).toHaveLength(1);expect(before.meetings).toHaveLength(3);
  });
  it('rejects a changed revision, missing course, removed occurrence and wrong owner', () => {
    const before=schedule(); expect(()=>stagePlacement(before,0,'move',source)).toThrow('changed');
    expect(()=>stagePlacement(before,1,'move',{...source,courseId:'gone'})).toThrow();
    expect(()=>stagePlacement(before,1,'move',{...source,id:'gone'})).toThrow();
    expect(()=>stagePlacement(before,1,'move',{...source,courseId:blank.courseId})).toThrow();
  });
  it('rejects exact duplicate occurrences and placement onto an already scheduled card', () => {
    const before=schedule(); expect(()=>stagePlacement(before,1,'move',{...before.meetings[1]!,id:source.id})).toThrow();
    expect(()=>stagePlacement(before,1,'place',{...source,id:'extra'})).toThrow();
  });
  it('allows a valid overlap without modifying the other meeting', () => {
    const before=schedule(); const other=before.meetings[1]!;
    const after=stagePlacement(before,1,'move',{...source,dayOfWeek:other.dayOfWeek,startMinute:other.startMinute+15,endMinute:other.endMinute+16});
    expect(after.meetings[1]).toEqual(other); expect(after.meetings).toHaveLength(3);
  });
});
