export const sections = [
  { id: 'timetable', label: 'Timetable' },
  { id: 'professors', label: 'Professors' },
  { id: 'planner', label: 'Planner' },
  { id: 'enrollment', label: 'Enrollment' },
  { id: 'settings', label: 'Settings' },
] as const;
export type SectionId = typeof sections[number]['id'];
export const plannerUrl = 'https://uhd-course-planner.pages.dev/';

export function sectionFromHash(hash: string): SectionId {
  return sections.find(section => '#' + section.id === hash)?.id ?? 'timetable';
}
