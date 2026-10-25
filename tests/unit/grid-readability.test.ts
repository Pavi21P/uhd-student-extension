import { describe, expect, it } from 'vitest';
import { dayColumnWidths, positionMeetings } from '../../src/dashboard/grid-layout';
import type { Meeting } from '../../src/shared/domain';
const view = { visibleDays: [1, 2] as Meeting['dayOfWeek'][], startMinute: 420, endMinute: 1320 };
const row = (id: string, startMinute: number, endMinute: number, dayOfWeek: Meeting['dayOfWeek'] = 1): Meeting => ({ id, courseId: id, startMinute, endMinute, dayOfWeek });
describe('readable overlap columns', () => {
  it('reserves readable space for every concurrent lane without widening uncrowded days', () => {
    const positions = positionMeetings([row('a', 540, 660), row('b', 550, 610), row('c', 560, 620), row('d', 600, 660, 2)], view);
    const widths = dayColumnWidths(positions, view.visibleDays);
    expect(widths).toEqual([552, 184]);
    for (const position of positions) expect(widths[position.meeting.dayOfWeek - 1]! / position.lanes).toBeGreaterThanOrEqual(184);
  });
  it('reuses width across disjoint groups, excludes hidden meetings and retains exact minute heights', () => {
    const positions = positionMeetings([row('a', 547, 623), row('b', 623, 624), row('c', 600, 630, 7), row('d', 300, 420)], view);
    expect(dayColumnWidths(positions, view.visibleDays)).toEqual([184, 184]);
    expect(positions.map(position => position.height)).toEqual([91.2, 1.2]);
    expect(dayColumnWidths([], [1, 7])).toEqual([184, 184]);
  });
});