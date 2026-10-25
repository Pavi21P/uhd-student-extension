import { describe, expect, it } from 'vitest';
import { normalizeInstructor, parseProfileLink, validateInstructor } from '../../src/dashboard/professor-preview';
describe('10A manual profile draft boundary', () => {
  it('canonicalizes only supported HTTPS profile URLs and removes query/fragment data', () => {
    expect(parseProfileLink(' https://ratemyprofessors.com/professor/12345/?ref=example#ratings ')).toEqual({ professorId: '12345', profileUrl: 'https://www.ratemyprofessors.com/professor/12345' });
    expect(parseProfileLink('https://www.ratemyprofessors.com:443/professor/12345').professorId).toBe('12345');
  });
  it.each([
    'javascript:alert(1)', 'http://www.ratemyprofessors.com/professor/123',
    'https://www.ratemyprofessors.com.evil.example/professor/123',
    'https://evil.example/?url=https://www.ratemyprofessors.com/professor/123',
    'https://user:pass@www.ratemyprofessors.com/professor/123',
    'https://www.ratemyprofessors.com:444/professor/123',
    'https://www.ratemyprofessors.com/search/professors/123',
    'https://www.ratemyprofessors.com/school/123',
    'https://www.ratemyprofessors.com/professor/0',
    'https://www.ratemyprofessors.com/professor/123/other',
    'https://www.ratemyprofessors.com/professor/%31',
    'https://www.ratemyprofessors.com/professor/12\n3',
    'https://www.ratemyprofessors.com\\@evil.example/professor/123',
    'https://www.ratemyprofessors.com/professor/' + '1'.repeat(2048),
  ])('rejects unsafe or unsupported address %s', value => { expect(() => parseProfileLink(value)).toThrow(); });
  it('preserves accents, hyphens and display case without treating normalization as identity verification', () => {
    expect(normalizeInstructor('  Jose\u0301  Anne-Marie  ')).toBe('José Anne-Marie');
    expect(validateInstructor('  José  Anne-Marie ')).toBe('José Anne-Marie');
  });
  it.each(['', ' '.repeat(10), 'Staff', ' tBa ', 'TBD', 'To be announced', 'To be assigned', 'x'.repeat(201), 'Name\0'])('rejects blank, unassigned or invalid instructor %s', name => { expect(() => validateInstructor(name)).toThrow(); });
});