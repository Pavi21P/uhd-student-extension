/** Format validation only: does not verify profile existence, identity or school. */
const hasControl = (value: string, includeSpace = false) => [...value].some(char => char.charCodeAt(0) < (includeSpace ? 33 : 32) || char.charCodeAt(0) === 127);
export function parseProfileLink(value: string): { professorId: string; profileUrl: string } {
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
