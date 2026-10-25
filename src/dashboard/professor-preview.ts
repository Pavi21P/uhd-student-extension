import { useState } from 'react';
export interface ProfileLinkDraft { instructorName: string; professorId: string; profileUrl: string }
const hasControl = (value: string, includeSpace = false) => [...value].some(char => char.charCodeAt(0) < (includeSpace ? 33 : 32) || char.charCodeAt(0) === 127);
export function parseProfileLink(value: string): Pick<ProfileLinkDraft, 'professorId' | 'profileUrl'> {
  const input = value.trim();
  if (input.length > 2048 || (hasControl(input, true) || input.includes('\\'))) throw Error('Use a complete HTTPS RateMyProfessors professor link without spaces.');
  let url: URL;
  try { url = new URL(input); } catch { throw Error('Enter a complete RateMyProfessors professor link.'); }
  const match = /^\/professor\/([1-9][0-9]*)\/?$/.exec(url.pathname);
  if (url.protocol !== 'https:' || !['www.ratemyprofessors.com', 'ratemyprofessors.com'].includes(url.hostname) || url.username || url.password || url.port || !match) {
    throw Error('Use https://www.ratemyprofessors.com/professor/ followed by the profile number.');
  }
  return { professorId: match[1]!, profileUrl: 'https://www.ratemyprofessors.com/professor/' + match[1] };
}
export function normalizeInstructor(value: string): string { return value.normalize('NFC').trim().replace(/\s+/gu, ' '); }
export function validateInstructor(value: string): string {
  const name = normalizeInstructor(value);
  if (!name || name.length > 200 || hasControl(name)) throw Error('Enter one professor name, up to 200 characters.');
  if (/^(staff|tba|tbd|to be (announced|assigned))$/iu.test(name)) throw Error('Unassigned instructor. Wait for a professor name before linking a profile.');
  return name;
}
export const sampleStates = ['unavailable', 'loading', 'available', 'ambiguous', 'no-match', 'no-reviews', 'stale'] as const;
export type SampleState = typeof sampleStates[number];
export const sampleCandidates = [
  { id: 'sample-computing', name: 'Alex Sample', department: 'Computer Science' },
  { id: 'sample-math', name: 'Alex Sample', department: 'Mathematics' },
] as const;
export function useProfessorPreview() {
  const [name, setName] = useState(''); const [url, setUrl] = useState('');
  const [review, setReview] = useState<ProfileLinkDraft | null>(null);
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
  const [sample, setSample] = useState<SampleState>('unavailable'); const [chosen, setChosen] = useState('');
  function change(field: 'name' | 'url', value: string) {
    (field === 'name' ? setName : setUrl)(value); setReview(null); setErrors(current => ({ ...current, [field]: undefined }));
  }
  function submit(): 'name' | 'url' | null {
    const next: typeof errors = {}; let instructorName = ''; let link: ReturnType<typeof parseProfileLink> | undefined;
    try { instructorName = validateInstructor(name); } catch (error) { next.name = (error as Error).message; }
    try { link = parseProfileLink(url); } catch (error) { next.url = (error as Error).message; }
    setErrors(next); setReview(link && !next.name ? { instructorName, ...link } : null);
    return next.name ? 'name' : next.url ? 'url' : null;
  }
  function clear() { setName(''); setUrl(''); setReview(null); setErrors({}); }
  function selectSample(value: SampleState) { setSample(value); setChosen(''); }
  return { name, url, review, errors, change, submit, clear, sample, selectSample, chosen, setChosen };
}
export type ProfessorPreview = ReturnType<typeof useProfessorPreview>;