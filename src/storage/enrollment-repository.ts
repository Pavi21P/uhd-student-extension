import type { EnrollmentJob } from '../shared/domain';
import { parseActivationPayload, payloadForJob, sameActivationPayload, type ActivationPayload } from '../shared/enrollment-activation';
import { parseEnrollmentLifecycleEvent, transitionEnrollmentLifecycle, type LifecycleDecision, type LifecycleEvent } from '../shared/enrollment-lifecycle';
import { parseStoredEnrollmentJob } from '../shared/enrollment-records';
import { ContractFault, id, integer, invalid, list, record, revision } from '../shared/validation';
import { parseExecutorRegistration, parseExecutorRequests, type ExecutorRequestRecord } from '../shared/enrollment-requests';
import { deriveExecutorReport, parseExecutorReply, type ExecutorReply } from '../shared/enrollment-replies';
import { finalizeExecutorResult } from '../shared/enrollment-results';
import type { KeyValueStorage } from './repository';
import { assertExecutorAdapter, assertExecutorSource, parseExecutorPending, isExecutorEvent, parseExecutorSender, parseExecutorPolicy, type ExecutorContext, type ExecutorPolicy } from '../shared/enrollment-ownership';

export const enrollmentJobsKey = 'uhd.enrollment.jobs';
const maxJobs = 100;
const active = (job: EnrollmentJob) => ['armed', 'preflight', 'executing'].includes(job.state);
interface ActivationRecord { requestId: string; jobId: string; payload: ActivationPayload }
interface StoredJobs { schemaVersion: 3; jobs: EnrollmentJob[]; activations: ActivationRecord[]; legacyJobIds: string[]; executorRequests: ExecutorRequestRecord[] }
interface LoadedJobs { store: StoredJobs; needsMigration: boolean }
export interface StoredJobDecision extends Omit<LifecycleDecision, 'job'> { job: EnrollmentJob }
export interface ActivationDecision { job: EnrollmentJob; created: boolean }

function parseStoredJobs(value: unknown): LoadedJobs {
  const row = record(value, ['schemaVersion', 'jobs', 'activations', 'legacyJobIds', 'executorRequests'], 'enrollmentStore');
  const schemaVersion = integer(row.schemaVersion, 1, Number.MAX_SAFE_INTEGER, 'enrollmentStore.schemaVersion');
  if (schemaVersion !== 1 && schemaVersion !== 2 && schemaVersion !== 3) throw new ContractFault('UNSUPPORTED_VERSION', 'This saved job version is not supported. Data was left intact.');
  if (schemaVersion === 1) record(row, ['schemaVersion', 'jobs'], 'enrollmentStore');
  if (schemaVersion === 2) record(row, ['schemaVersion', 'jobs', 'activations', 'legacyJobIds'], 'enrollmentStore');
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
  const executorRequests = schemaVersion === 3 ? parseExecutorRequests(row.executorRequests, jobs) : [];
  return { store: { schemaVersion: 3, jobs, activations, legacyJobIds, executorRequests }, needsMigration: schemaVersion !== 3 };
}
function projection(job: EnrollmentJob) {
  const { id, revision, state, targetEpochMs, expiresAt, updatedAt, submittedAt } = job;
  return { id, revision, state, targetEpochMs, expiresAt, updatedAt, submittedAt };
}

function consumedExecution(store: StoredJobs, job: EnrollmentJob): ExecutorRequestRecord | undefined {
  return store.executorRequests.find(entry => entry.state === 'consumed' && entry.pending.command === 'portal.execute'
    && entry.pending.jobId === job.id && entry.pending.expectedRevision === job.revision - 1);
}
function reconcileSavedResult(job: EnrollmentJob, request: ExecutorRequestRecord, now: number): EnrollmentJob {
  if (job.revision === Number.MAX_SAFE_INTEGER) throw new ContractFault('REVISION_CONFLICT', 'The job revision cannot advance safely.');
  const uncertain = now < job.updatedAt || job.submittedAt === null || job.submittedAt < request.createdAt
    || job.updatedAt >= request.pending.expiresAt;
  return finalizeExecutorResult({ ...job, revision: job.revision + 1,
    updatedAt: Math.max(now, job.updatedAt), state: uncertain ? 'unknown' : job.state });
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
    if (value === undefined) return { store: { schemaVersion: 3, jobs: [], activations: [], legacyJobIds: [], executorRequests: [] }, needsMigration: false };
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
        const evidence = consumedExecution(store, job);
        if (job.state === 'executing' && job.submittedAt !== null && evidence) {
          changed = true;
          return reconcileSavedResult(job, evidence, now);
        }
        const decision = transitionEnrollmentLifecycle(projection(job), { type: 'recover' }, job.revision, now);
        changed ||= decision.changed;
        return parseStoredEnrollmentJob({ ...job, ...decision.job });
      });
      for (const request of store.executorRequests) {
        if (request.state === 'pending') { request.state = 'abandoned'; changed = true; }
      }
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

  /**
   * Internal coordinator only: persist correlation before sending a command.
   * Registration is never a dispatch grant; every ID and job/command pair is single-use.
   */
  registerExecutorRequest(jobId: string, expectedRevision: number, input: unknown): Promise<ExecutorContext['pending']> {
    const validId = id(jobId);
    revision(expectedRevision, 'expectedRevision');
    const registration = parseExecutorRegistration(input);
    return this.serial(async () => {
      this.requireReady();
      const { store } = await this.load();
      if (store.executorRequests.some(entry => entry.pending.requestId === registration.requestId
          || (entry.pending.jobId === validId && entry.pending.command === registration.command))) {
        throw new ContractFault('REQUEST_ID_REUSED', 'This executor request or job command was already registered. It cannot be reissued.');
      }
      const job = store.jobs.find(job => job.id === validId);
      if (!job) throw new ContractFault('NOT_FOUND', 'The enrollment job was not found.');
      if (job.revision !== expectedRevision) throw new ContractFault('REVISION_CONFLICT', 'The job changed before request registration.');
      assertExecutorAdapter(job.review.target, this.executorPolicy);
      if (job.state !== 'executing' || job.submittedAt !== null) invalid('executorRegistration.job');
      const now = this.now();
      if (now < job.updatedAt || store.executorRequests.some(entry => entry.pending.jobId === job.id && now < entry.createdAt)
          || now >= registration.expiresAt
          || (registration.command === 'portal.execute' && (now < job.targetEpochMs || now >= job.expiresAt))) {
        throw new ContractFault('INVALID_TIME', 'The executor request cannot be registered at this time.');
      }
      if (registration.command === 'portal.cancel' && !store.executorRequests.some(entry =>
        entry.pending.jobId === validId && entry.pending.command === 'portal.execute' && entry.state === 'pending')) {
        invalid('executorRegistration.command');
      }
      const pending = parseExecutorPending({ ...registration, jobId: job.id,
        executionToken: job.executionToken, target: { ...job.review.target }, expectedRevision });
      store.executorRequests.push({ pending, createdAt: now, state: 'pending' });
      await this.persist(store);
      return pending;
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

  /**
   * Reconcile evidence saved by an older worker without resubmitting. Terminal jobs
   * stay terminal. A consumed execute request must prove where the evidence came from.
   */
  reconcileExecutorResult(jobId: string, expectedRevision: number): Promise<StoredJobDecision> {
    const validId = id(jobId);
    revision(expectedRevision, 'expectedRevision');
    return this.serial(async () => {
      this.requireReady();
      const { store } = await this.load();
      const index = store.jobs.findIndex(job => job.id === validId);
      const current = store.jobs[index];
      if (!current) throw new ContractFault('NOT_FOUND', 'The enrollment job was not found.');
      if (current.revision !== expectedRevision) throw new ContractFault('REVISION_CONFLICT', 'The job changed before result reconciliation.');
      if (current.state !== 'executing') return { job: current, changed: false, cancellation: 'none' };
      const evidence = consumedExecution(store, current);
      if (current.submittedAt === null || !evidence) {
        throw new ContractFault('UNAUTHORIZED_SENDER', 'No consumed execution reply supports reconciling this job.');
      }
      const job = reconcileSavedResult(current, evidence, this.now());
      store.jobs[index] = job;
      for (const request of store.executorRequests) {
        if (request.pending.jobId === job.id && request.state === 'pending') request.state = 'abandoned';
      }
      await this.persist(store);
      return { job, changed: true, cancellation: 'none' };
    });
  }

  /** Full reply only. Browser sender metadata remains a trusted bridge input. */
  acceptExecutorReply(senderInput: unknown, replyInput: unknown): Promise<StoredJobDecision> {
    const sender = parseExecutorSender(senderInput);
    const reply = parseExecutorReply(replyInput);
    return this.applyTransition(undefined, undefined, undefined, { sender, reply });
  }

  private applyTransition(validId: string | undefined, expectedRevision: number | undefined, event: LifecycleEvent | undefined,
    report?: { sender: ExecutorContext['sender']; reply: ExecutorReply }): Promise<StoredJobDecision> {
    return this.serial(async () => {
      this.requireReady();
      const { store } = await this.load();
      const request = report ? store.executorRequests.find(entry => entry.pending.requestId === report.reply.requestId) : undefined;
      if (report && (!request || request.state !== 'pending')) {
        throw new ContractFault('REQUEST_ID_REUSED', 'No outstanding executor request is available for this reply.');
      }
      const index = store.jobs.findIndex(job => job.id === (request?.pending.jobId ?? validId));
      const current = store.jobs[index];
      if (!current) throw new ContractFault('NOT_FOUND', 'The enrollment job was not found.');
      const now = this.now();
      let outcomes: EnrollmentJob['outcomes'] | undefined;
      if (report && request) {
        assertExecutorSource(current, request.pending, report.sender, this.executorPolicy, now);
        const derived = deriveExecutorReport(current, request.pending, report.reply);
        event = derived.event;
        outcomes = derived.outcomes;
        expectedRevision = request.pending.expectedRevision;
      }
      if (!event || expectedRevision === undefined) invalid('transition');
      const decision = transitionEnrollmentLifecycle(projection(current), event, expectedRevision, now);
      // A backwards clock stops the job before recording new dispatch evidence.
      let job = parseStoredEnrollmentJob({ ...current, ...decision.job,
        ...(outcomes !== undefined && decision.job.submittedAt !== null ? { outcomes } : {}) });
      if (report?.reply.type === 'portal.completed') {
        if (request && job.submittedAt !== null && job.submittedAt < request.createdAt) job = { ...job, state: 'unknown' };
        job = finalizeExecutorResult(job);
      }
      if (request) request.state = 'consumed';
      if (decision.changed || request) {
        store.jobs[index] = job;
        for (const other of store.executorRequests) {
          if (other.state === 'pending' && other.pending.jobId === job.id) other.state = 'abandoned';
        }
        await this.persist(store);
      }
      return { ...decision, job };
    });
  }
}
