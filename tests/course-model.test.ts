import { describe, expect, it } from 'vitest';
import { changeCourse, emptySchedule } from '../src/dashboard/course-model';

const populated = () => ({ ...emptySchedule(), revision: 9, termLabel: 'Synthetic term',
  courses: [{ id: 'one', title: 'Same name' }, { id: 'two', title: 'Same name' }],
  meetings: [{ id: 'm1', courseId: 'one', dayOfWeek: 1 as const, startMinute: 600, endMinute: 660 },
    { id: 'm2', courseId: 'one', dayOfWeek: 3 as const, startMinute: 600, endMinute: 660 },
    { id: 'm3', courseId: 'two', dayOfWeek: 1 as const, startMinute: 660, endMinute: 720 }],
});
describe('course editor transactions', () => {
  it('creates a genuinely blank card and normalizes optional text without persisting placeholders', () => {
    const next = changeCourse(emptySchedule(), { kind: 'add', course: { id: 'blank' } });
    expect(next.courses).toEqual([{ id: 'blank' }]);
    expect(changeCourse(next, { kind: 'edit', course: { id: 'blank', title: '  ', professorName: '  Synthetic Professor  ' } }).courses)
      .toEqual([{ id: 'blank', professorName: 'Synthetic Professor' }]);
  });
  it('edits by ID, preserves meetings, other cards, labels, and revision, without mutating the input', () => {
    const before = populated(); const snapshot = structuredClone(before);
    const after = changeCourse(before, { kind: 'edit', course: { id: 'one', room: 'Test 101', color: '#21675a' } });
    expect(after.courses).toEqual([{ id: 'one', room: 'Test 101', color: '#21675a' }, before.courses[1]]);
    expect(after.meetings).toEqual(before.meetings); expect(after.revision).toBe(9); expect(after.termLabel).toBe('Synthetic term');
    expect(before).toEqual(snapshot);
  });
  it('deletes a course and all its occurrences atomically while preserving other occurrences', () => {
    const before = populated(); const after = changeCourse(before, { kind: 'delete', courseId: 'one' });
    expect(after.courses).toEqual([before.courses[1]]); expect(after.meetings).toEqual([before.meetings[2]]);
    expect(before.courses).toHaveLength(2); expect(before.meetings).toHaveLength(3);
  });
  it('cannot silently recreate deleted courses or insert duplicate IDs', () => {
    expect(() => changeCourse(emptySchedule(), { kind: 'edit', course: { id: 'missing' } })).toThrow();
    expect(() => changeCourse(emptySchedule(), { kind: 'delete', courseId: 'missing' })).toThrow();
    expect(() => changeCourse(populated(), { kind: 'add', course: { id: 'one' } })).toThrow();
  });
  it('rejects invalid edits and oversized schedules without changing saved input', () => {
    const before = populated();
    expect(() => changeCourse(before, { kind: 'edit', course: { id: 'one', title: 'x'.repeat(201) } })).toThrow();
    expect(() => changeCourse(before, { kind: 'edit', course: { id: 'one', color: 'red' } })).toThrow();
    const full = { ...emptySchedule(), courses: Array.from({ length: 250 }, (_, index) => ({ id: String(index) })) };
    expect(() => changeCourse(full, { kind: 'add', course: { id: 'extra' } })).toThrow();
    expect(full.courses).toHaveLength(250); expect(before.courses[0]?.title).toBe('Same name');
  });
});
