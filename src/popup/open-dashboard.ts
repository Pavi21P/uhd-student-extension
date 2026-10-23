/** Fixed destination only. A failed extension API call must not silently open a fallback tab. */
export async function openDashboard(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    return;
  }
  // Allows the UI to be previewed with Vite before loading it as an extension.
  window.location.assign(new URL('dashboard.html', window.location.href).href);
}
