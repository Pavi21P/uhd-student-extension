import { describe, expect, it, vi } from 'vitest';
import { createRefreshQueue } from '../../src/dashboard/refresh-queue';

const drain = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };

describe('cross-view refresh coordination', () => {
  it('coalesces events during a write and waits for the committed UI state', async () => {
    let busy = true; const read = vi.fn(async () => {}); const settled = vi.fn();
    const queue = createRefreshQueue(read, () => busy, settled);
    queue.request(); queue.request(); queue.request(); await drain(); expect(read).not.toHaveBeenCalled();
    busy = false; queue.wake(); await drain(); expect(read).toHaveBeenCalledTimes(1); expect(settled).toHaveBeenCalledTimes(1);
    queue.wake(); await drain(); expect(read).toHaveBeenCalledTimes(1);
  });
  it('retains an invalidation that arrives during a read without overlapping reads', async () => {
    const first = deferred(); const read = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const queue = createRefreshQueue(read, () => false, () => {});
    queue.request(); await drain(); queue.request(); queue.request(); queue.wake(); await drain(); expect(read).toHaveBeenCalledTimes(1);
    first.resolve(); await drain(); expect(read).toHaveBeenCalledTimes(1);
    queue.wake(); await drain(); expect(read).toHaveBeenCalledTimes(2);
  });
  it('keeps queued work paused during recovery until deliberate recovery completes', async () => {
    let recovery = true; const read = vi.fn(async () => {}); const queue = createRefreshQueue(read, () => recovery, () => {});
    queue.request(); queue.wake(); await drain(); expect(read).not.toHaveBeenCalled();
    recovery = false; queue.wake(); await drain(); expect(read).toHaveBeenCalledTimes(1);
  });
  it('does not retry a failed read without another invalidation', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('Synthetic read failure')).mockResolvedValue(undefined);
    const queue = createRefreshQueue(read, () => false, () => {});
    queue.request(); await drain(); queue.wake(); await drain(); expect(read).toHaveBeenCalledTimes(1);
    queue.request(); await drain(); expect(read).toHaveBeenCalledTimes(2);
  });
  it('ignores queued and future events after unmount', async () => {
    const read = vi.fn(async () => {}); const queue = createRefreshQueue(read, () => true, () => {});
    queue.request(); queue.dispose(); queue.wake(); queue.request(); await drain(); expect(read).not.toHaveBeenCalled();
  });
  it('cancels a scheduled read if the view unmounts before it starts', async () => {
    const read = vi.fn(async () => {}); const settled = vi.fn();
    const queue = createRefreshQueue(read, () => false, settled);
    queue.request(); queue.dispose(); await drain();
    expect(read).not.toHaveBeenCalled(); expect(settled).not.toHaveBeenCalled();
  });
  it('does not notify a disposed UI when an in-flight read settles', async () => {
    const first = deferred(); const settled = vi.fn(); const queue = createRefreshQueue(() => first.promise, () => false, settled);
    queue.request(); await drain(); queue.dispose(); first.resolve(); await drain(); expect(settled).not.toHaveBeenCalled();
  });
});
