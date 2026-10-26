import { parseProfessorLookup, type UnconfiguredProfessorResult } from '../../shared/professor-lookup';
/** 10B fallback only. No permitted live source is configured: no fetch, cache or guessed matches. */
export const rmpProvider = Object.freeze({
  mode: 'link-only' as const,
  lookup(input: unknown): UnconfiguredProfessorResult {
    parseProfessorLookup(input);
    return { status: 'unavailable', reason: 'provider-unconfigured' };
  },
});
