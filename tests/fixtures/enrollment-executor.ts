import type { EnrollmentJob } from '../../src/shared/domain';
import type { ExecutorContext, ExecutorPolicy } from '../../src/shared/enrollment-ownership';
import { sampleReview } from './contracts.examples';

export const executorTime = Date.UTC(2025, 0, 1);
export function executorJob(): EnrollmentJob {
  return { id: 'synthetic-executor-job', revision: 0, state: 'armed',
    termId: sampleReview.termId, termLabel: sampleReview.termLabel, selectedSectionIds: [...sampleReview.selectedSectionIds],
    timing: { mode: 'now' }, targetEpochMs: executorTime, expiresAt: executorTime + 2_000,
    createdAt: executorTime, updatedAt: executorTime, submittedAt: null, outcomes: [], executionToken: 'synthetic-executor-token',
    review: { ...structuredClone(sampleReview), target: { ...sampleReview.target, frameId: 3 },
      observedAt: executorTime - 1_000, expiresAt: executorTime + 119_000 } };
}
export function executorPolicy(): ExecutorPolicy {
  return { extensionId: 'synthetic-extension', adapters: [
    { origin: sampleReview.target.origin, adapterVersion: sampleReview.target.adapterVersion },
  ] };
}
export function executorContext(job: EnrollmentJob, expectedRevision: number, command: 'portal.execute' | 'portal.cancel' = 'portal.execute'): ExecutorContext {
  const target = job.review.target;
  const requestId = 'synthetic-outstanding-' + command;
  return {
    sender: { extensionId: 'synthetic-extension', tabId: target.tabId, frameId: target.frameId,
      documentId: target.documentId, origin: target.origin, url: target.origin + '/synthetic-cart',
      documentLifecycle: 'active' },
    pending: { requestId, command, jobId: job.id, executionToken: job.executionToken,
      target: { ...target }, expectedRevision, expiresAt: job.createdAt + 10_000 },
    reply: { protocolVersion: 1, requestId, type: command === 'portal.execute' ? 'portal.completed' : 'portal.cancelled',
      jobId: job.id, executionToken: job.executionToken },
  };
}

/** Complete synthetic wire reply from fixture correlation fields. */
export function executorReply(context: ExecutorContext) {
  const { protocolVersion, requestId, type, jobId, executionToken } = context.reply;
  return { protocolVersion, requestId, type, payload: { jobId, executionToken,
    ...(type === 'portal.completed' ? { submittedAt: executorTime + 100, outcomes: [] } : {}) } };
}
