import { parseProfileLink, validateInstructor } from '../shared/professor-profile';
export { parseProfileLink, normalizeInstructor, validateInstructor } from '../shared/professor-profile';
import { useState } from 'react';
export interface ProfileLinkDraft { instructorName: string; professorId: string; profileUrl: string }
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