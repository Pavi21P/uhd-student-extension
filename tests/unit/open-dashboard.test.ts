import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDashboard } from '../../src/popup/open-dashboard';

afterEach(() => vi.unstubAllGlobals());

describe('workspace launcher', () => {
  it('opens a fixed extension URL without requesting browsing permissions', async () => {
    const create = vi.fn().mockResolvedValue({});
    vi.stubGlobal('chrome', { runtime: { id: 'test-extension', getURL: (path: string) => 'chrome-extension://test-extension/' + path }, tabs: { create } });
    await openDashboard();
    expect(create).toHaveBeenCalledExactlyOnceWith({ url: 'chrome-extension://test-extension/dashboard.html' });
  });

  it('propagates a failed tab creation so the popup can show recovery', async () => {
    const error = new Error('Tab creation failed');
    const assign = vi.fn();
    vi.stubGlobal('chrome', { runtime: { id: 'test-extension', getURL: () => 'chrome-extension://test-extension/dashboard.html' }, tabs: { create: vi.fn().mockRejectedValue(error) } });
    vi.stubGlobal('window', { location: { href: 'chrome-extension://test-extension/popup.html', assign } });
    await expect(openDashboard()).rejects.toBe(error);
    expect(assign).not.toHaveBeenCalled();
  });

  it('uses a relative dashboard URL for a browser preview with no extension runtime', async () => {
    const assign = vi.fn();
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('window', { location: { href: 'http://localhost:5173/popup.html', assign } });
    await openDashboard();
    expect(assign).toHaveBeenCalledExactlyOnceWith('http://localhost:5173/dashboard.html');
  });

  it('does not mistake a normal Chrome page for an installed extension', async () => {
    const assign = vi.fn();
    vi.stubGlobal('chrome', { runtime: {} });
    vi.stubGlobal('window', { location: { href: 'http://localhost:5173/preview/popup.html', assign } });
    await openDashboard();
    expect(assign).toHaveBeenCalledExactlyOnceWith('http://localhost:5173/preview/dashboard.html');
  });
});
