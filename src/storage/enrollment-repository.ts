import type { EnrollmentJob } from '../shared/domain';
import { parseActivationPayload, payloadForJob, sameActivationPayload, type ActivationPayload } from '../shared/enrollment-activation';
import { parseEnrollmentLifecycleEvent, transitionEnrollmentLifecycle, type LifecycleDecision, type LifecycleEvent } from '../shared/enrollment-lifecycle';
import { parseStoredEnrollmentJob } from '../shared/enrollment-records';
import { ContractFault, id, integer, invalid, list, record, revision } from '../shared/validation';
import type { KeyValueStorage } from './repository';
import { assertExecutorOwnership, isExecutorEvent, parseExecutorContext, parseExecutorPolicy, type ExecutorContext, type ExecutorPolicy } from '../shared/enrollment-ownership';

export const enrollmentJobsKey = 'uhd.enrollment.jobs';
const maxJobs = 100;
const active = (job: EnrollmentJob) => ['armed', 'preflight', 'executing'].includes(job.state);
interface ActivationRecord { requestId: string; jobId: string; payload: ActivationPayload }
interface StoredJobs { schemaVersion: 2; jobs: EnrollmentJob[]; activations: ActivationRecord[]; legacyJobIds: string[] }
interface LoadedJobs { store: StoredJobs; needsMigration: boolean }
export interface StoredJobDecision extends Omit<LifecycleDecision, 'job'> { job: EnrollmentJob }
export interface ActivationDecision { job: EnrollmentJob; created: boolean }

function parseStoredJobs(value: unknown): LoadedJobs {
  const row = record(value, ['schemaVersion', 'jobs', 'activations', 'legacyJobIds'], 'enrollmentStore');
  const schemaVersion = integer(row.schemaVersion, 1, Number.MAX_SAFE_INTEGER, 'enrollmentStore.schemaVersion');
  if (schemaVersion !== 1 && schemaVersion !== 2) throw new ContractFault('UNSUPPORTED_VERSION', 'This saved job version is not supported. Data was left intact.');
  if (schemaVersion === 1) record(row, ['schemaVersion', 'jobs'], 'enrollmentStore');
  const jobs = list(row.jobs, maxJobs, 'enrollmentStore.jobs').map(parseStoredEnrollmentJob);
  const byId = new Map(jobs.map(job => [job.id, job]));
  if (byId.size !== jobs.length || jobs.filter(active).length > 1) invalid('enrollmentStore.jobs');
  const activations = schemaVersion === 1 ? [] : list(row.activations, maxJobs, 'enrollmentStore.activations').map(value => {
    const entry = record(value, ['requestId', 'jobId', 'payload'], 'activationRecord');
    const requestId = id(entry.requestId, 'activationRecord.requestId');
    const jobId = id(entry.jobId, 'activationRecord.jobId');
    const payload = parseActivationPayload(entry.payload);
    const job = byId.get(jobId);
    if (!job || !sameActivationPayload(payload, payloadForJob(job))) invalid('activationRecord');
    return { requestId, jobId, payload };
  });
  if (new Set(activations.map(entry => entry.requestId)).size !== activations.length
      || new Set(activations.map(entry => entry.jobId)).size !== activations.length) invalid('enrollmentStore.activations');
  const legacyJobIds = schemaVersion === 1 ? jobs.map(job => job.id)
    : list(row.legacyJobIds, maxJobs, 'enrollmentStore.legacyJobIds').map(value => id(value, 'legacyJobId'));
  const associated = new Set(activations.map(entry => entry.jobId));
  const legacy = new Set(legacyJobIds);
  if (legacy.size !== legacyJobIds.length || legacyJobIds.some(jobId => !byId.has(jobId) || associated.has(jobId))
      || jobs.some(job => !associated.has(job.id) && !legacy.has(job.id))) invalid('enrollmentStore.legacyJobIds');
  return { store: { schemaVersion: 2, jobs, activations, legacyJobIds }, needsMigration: schemaVersion === 1 };
}
function projection(job: EnrollmentJob) {
  const { id, revision, state, targetEpochMs, expiresAt, updatedAt, submittedAt } = job;
  return { id, revision, state, targetEpochMs, expiresAt, updatedAt, submittedAt };
}

/**
 * Internal single-writer repository. The future worker must own exactly one instance
 * and await recover() before using it. This is not a distributed lock or executor.
 * Methods return internal records with tokens; never send them to dashboard clients.
 */
export class EnrollmentJobRepository {
  private tail: Promise<unknown> = Promise.resolve();
  private ready = false;
  private readonly executorPolicy: ExecutorPolicy | undefined;
  constructor(private readonly storage: KeyValueStorage, private readonly clock: () => number, executorPolicy?: unknown) {
    this.executorPolicy = executorPolicy === undefined ? undefined : parseExecutorPolicy(executorPolicy);
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.tail.then(operation);
    this.tail = next.catch(() => undefined);
    return next;
  }
  private now(): number {
    return integer(this.clock(), -8_640_000_000_000_000, 8_640_000_000_000_000, 'nowEpochMs');
  }
  private requireReady(): void {
    if (!this.ready) throw new ContractFault('STORAGE_ERROR', 'Job storage requires explicit recovery before use. No execution is authorized.');
  }
  private async load(): Promise<LoadedJobs> {
    let value: unknown;
    try { value = await this.storage.get(enrollmentJobsKey); }
    catch {
      this.ready = false;
      throw new ContractFault('STORAGE_ERROR', 'Saved jobs could not be read. Recovery is required; nothing was changed.');
    }
    if (value === undefined) return { store: { schemaVersion: 2, jobs: [], activations: [], legacyJobIds: [] }, needsMigration: false };
    try {
      const loaded = parseStoredJobs(value);
      if (loaded.needsMigration && this.ready) throw new ContractFault('STORAGE_ERROR', 'Explicit recovery is required for older job data.');
      return loaded;
    }
    catch (error) {
      this.ready = false;
      if (error instanceof ContractFault && error.detail.code === 'UNSUPPORTED_VERSION') throw error;
      throw new ContractFault('STORAGE_ERROR', 'Saved jobs are invalid and were left intact. Recovery cannot continue.');
    }
  }
  private async persist(store: StoredJobs): Promise<void> {
    try { await this.storage.set(enrollmentJobsKey, structuredClone(store)); }
    catch {
      this.ready = false;
      throw new ContractFault('STORAGE_ERROR', 'The job write could not be confirmed. Do not dispatch or retry; explicit recovery is required.');
    }
  }

  /** Explicit startup/error recovery: one write for all changes, never re-arms a job. */
  recover(): Promise<EnrollmentJob[]> {
    return this.serial(async () => {
      this.ready = false;
      const { store, needsMigration } = await this.load();
      const now = this.now();
      let changed = false;
      const jobs = store.jobs.map(job => {
        const decision = transitionEnrollmentLifecycle(projection(job), { type: 'recover' }, job.revision, now);
        changed ||= decision.changed;
        return parseStoredEnrollmentJob({ ...job, ...decision.job });
      });
      if (changed || needsMigration) await this.persist({ ...store, jobs });
      this.ready = true;
      return jobs;
    });
  }

  readAll(): Promise<EnrollmentJob[]> {
    return this.serial(async () => {
      this.requireReady();
      return (await this.load()).store.jobs;
    });
  }

  /**
   * Trusted internal activation storage, not a public command or dispatch permission.
   * Omit input to resolve a replay without constructing another candidate job.
   */
  createForActivation(requestId: string, payloadInput: unknown, input?: unknown): Promise<ActivationDecision> {
    const validRequestId = id(requestId, 'activation.requestId');
    const payload = parseActivationPayload(payloadInput);
    const candidate = input === undefined ? undefined : parseStoredEnrollmentJob(input);
    return this.serial(async () => {
      this.requireReady();
      const { store } = await this.load();
      const existing = store.activations.find(entry => entry.requestId === validRequestId);
      if (existing) {
        if (!sameActivationPayload(existing.payload, payload)) {
          throw new ContractFault('REQUEST_ID_REUSED', 'This activation request ID was already used with different input.');
        }
        // load() validated the link. Returning current state never repeats dispatch or re-arms.
        return { job: store.jobs.find(job => job.id === existing.jobId)!, created: false };
      }
      if (!candidate) throw new ContractFault('NOT_FOUND', 'No saved activation matches this request ID.');
      const job = candidate;
      if (job.state !== 'armed' || job.revision !== 0 || job.updatedAt !== job.createdAt
          || job.submittedAt !== null || job.outcomes.length || !sameActivationPayload(payload, payloadForJob(job))) invalid('job');
      if (store.jobs.some(saved => saved.id === job.id)) throw new ContractFault('REVISION_CONFLICT', 'This job ID already exists. It was not replaced.');
      if (store.jobs.some(active)) throw new ContractFault('JOB_ALREADY_ACTIVE', 'An enrollment job is already active.');
      if (store.jobs.length === maxJobs) throw new ContractFault('STORAGE_ERROR', 'Job history is full. No saved jobs were removed.');
      const now = this.now();
      if (now < job.createdAt || now >= job.review.expiresAt) throw new ContractFault('STALE_REVIEW', 'A current review is required before saving this job.');
      if (now >= job.expiresAt || (job.timing.mode === 'scheduled' && now >= job.targetEpochMs)) {
        throw new ContractFault('INVALID_TIME', 'The job execution time has passed. Nothing was armed.');
      }
      await this.persist({ ...store, jobs: [...store.jobs, job],
        activations: [...store.activations, { requestId: validRequestId, jobId: job.id, payload }] });
      return { job, created: true };
    });
  }

  /** Trusted background decisions only. Executor acknowledgments use the guarded entrypoint. */
  transition(jobId: string, expectedRevision: number, eventInput: unknown): Promise<StoredJobDecision> {
    const validId = id(jobId);
    revision(expectedRevision, 'expectedRevision');
    const event = parseEnrollmentLifecycleEvent(eventInput);
    if (isExecutorEvent(event)) throw new ContractFault('UNAUTHORIZED_SENDER', 'Executor reports require a verified document and outstanding request.');
    return this.applyTransition(validId, expectedRevision, event);
  }

  /** Internal bridge entrypoint; not connected to runtime messages or website postMessage. */
  transitionFromExecutor(jobId: string, expectedRevision: number, eventInput: unknown, contextInput: unknown): Promise<StoredJobDecision> {
    const validId = id(jobId);
    revision(expectedRevision, 'expectedRevision');
    const event = parseEnrollmentLifecycleEvent(eventInput);
    if (!isExecutorEvent(event)) invalid('executor.event');
    const context = parseExecutorContext(contextInput);
    return this.applyTransition(validId, expectedRevision, event, context);
  }

  private applyTransition(validId: string, expectedRevision: number, event: LifecycleEvent, context?: ExecutorContext): Promise<StoredJobDecision> {
    return this.serial(async () => {
      this.requireReady();
      const { store } = await this.load();
      const index = store.jobs.findIndex(job => job.id === validId);
      const current = store.jobs[index];
      if (!current) throw new ContractFault('NOT_FOUND', 'The enrollment job was not found.');
      const now = this.now();
      if (context) {
        if (!isExecutorEvent(event)) invalid('executor.event');
        assertExecutorOwnership(current, expectedRevision, event, context, this.executorPolicy, now);
      }
      const decision = transitionEnrollmentLifecycle(projection(current), event, expectedRevision, now);
      const job = parseStoredEnrollmentJob({ ...current, ...decision.job });
      if (decision.changed) {
        store.jobs[index] = job;
        await this.persist(store);
      }
      return { ...decision, job };
    });
  }
}
