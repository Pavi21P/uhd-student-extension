import type { EnrollmentJob } from '../shared/domain';
import { parseEnrollmentLifecycleEvent, transitionEnrollmentLifecycle, type LifecycleDecision } from '../shared/enrollment-lifecycle';
import { parseStoredEnrollmentJob } from '../shared/enrollment-records';
import { ContractFault, id, integer, invalid, list, record, revision, version } from '../shared/validation';
import type { KeyValueStorage } from './repository';

export const enrollmentJobsKey = 'uhd.enrollment.jobs';
const maxJobs = 100;
const active = (job: EnrollmentJob) => ['armed', 'preflight', 'executing'].includes(job.state);
interface StoredJobs { schemaVersion: 1; jobs: EnrollmentJob[] }
export interface StoredJobDecision extends Omit<LifecycleDecision, 'job'> { job: EnrollmentJob }

function parseStoredJobs(value: unknown): StoredJobs {
  const row = record(value, ['schemaVersion', 'jobs'], 'enrollmentStore');
  const schemaVersion = version(row.schemaVersion, 'enrollmentStore.schemaVersion');
  const jobs = list(row.jobs, maxJobs, 'enrollmentStore.jobs').map(parseStoredEnrollmentJob);
  if (new Set(jobs.map(job => job.id)).size !== jobs.length || jobs.filter(active).length > 1) invalid('enrollmentStore.jobs');
  return { schemaVersion, jobs };
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
  constructor(private readonly storage: KeyValueStorage, private readonly clock: () => number) {}

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
  private async load(): Promise<StoredJobs> {
    let value: unknown;
    try { value = await this.storage.get(enrollmentJobsKey); }
    catch {
      this.ready = false;
      throw new ContractFault('STORAGE_ERROR', 'Saved jobs could not be read. Recovery is required; nothing was changed.');
    }
    if (value === undefined) return { schemaVersion: 1, jobs: [] };
    try { return parseStoredJobs(value); }
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
      const store = await this.load();
      const now = this.now();
      let changed = false;
      const jobs = store.jobs.map(job => {
        const decision = transitionEnrollmentLifecycle(projection(job), { type: 'recover' }, job.revision, now);
        changed ||= decision.changed;
        return parseStoredEnrollmentJob({ ...job, ...decision.job });
      });
      if (changed) await this.persist({ schemaVersion: 1, jobs });
      this.ready = true;
      return jobs;
    });
  }

  readAll(): Promise<EnrollmentJob[]> {
    return this.serial(async () => {
      this.requireReady();
      return (await this.load()).jobs;
    });
  }

  /** Trusted internal insertion only. Issuing reviews, IDs/tokens and deduplication are separate. */
  create(input: unknown): Promise<EnrollmentJob> {
    const job = parseStoredEnrollmentJob(input); // Snapshot before entering the queue.
    if (job.state !== 'armed' || job.revision !== 0 || job.updatedAt !== job.createdAt
        || job.submittedAt !== null || job.outcomes.length) invalid('job');
    return this.serial(async () => {
      this.requireReady();
      const store = await this.load();
      if (store.jobs.some(saved => saved.id === job.id)) throw new ContractFault('REVISION_CONFLICT', 'This job ID already exists. It was not replaced.');
      if (store.jobs.some(active)) throw new ContractFault('JOB_ALREADY_ACTIVE', 'An enrollment job is already active.');
      if (store.jobs.length === maxJobs) throw new ContractFault('STORAGE_ERROR', 'Job history is full. No saved jobs were removed.');
      const now = this.now();
      if (now < job.createdAt || now >= job.review.expiresAt) throw new ContractFault('STALE_REVIEW', 'A current review is required before saving this job.');
      if (now >= job.expiresAt || (job.timing.mode === 'scheduled' && now >= job.targetEpochMs)) {
        throw new ContractFault('INVALID_TIME', 'The job execution time has passed. Nothing was armed.');
      }
      await this.persist({ schemaVersion: 1, jobs: [...store.jobs, job] });
      return job;
    });
  }

  transition(jobId: string, expectedRevision: number, eventInput: unknown): Promise<StoredJobDecision> {
    const validId = id(jobId);
    revision(expectedRevision, 'expectedRevision');
    const event = parseEnrollmentLifecycleEvent(eventInput); // Do not retain caller-owned event objects.
    return this.serial(async () => {
      this.requireReady();
      const store = await this.load();
      const index = store.jobs.findIndex(job => job.id === validId);
      const current = store.jobs[index];
      if (!current) throw new ContractFault('NOT_FOUND', 'The enrollment job was not found.');
      const decision = transitionEnrollmentLifecycle(projection(current), event, expectedRevision, this.now());
      const job = parseStoredEnrollmentJob({ ...current, ...decision.job });
      if (decision.changed) {
        store.jobs[index] = job;
        await this.persist(store);
      }
      return { ...decision, job };
    });
  }
}
