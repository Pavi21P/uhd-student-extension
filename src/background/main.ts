import { FoundationRepository } from '../storage/repository';
import { createMessageHandler } from './handler';

// Register the listener synchronously; each command waits for access restriction to finish.
const storageReady = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).then(() => true, () => false);
const repository = new FoundationRepository({
  async get(key) {
    const values = await chrome.storage.local.get(key);
    return Object.hasOwn(values, key) ? values[key] : undefined;
  },
  async set(key, value) { await chrome.storage.local.set({ [key]: value }); },
}, event => {
  // Metadata only, after persistence. No listeners is normal before the editor is implemented.
  void chrome.runtime.sendMessage(event).catch(() => undefined);
});
const handle = createMessageHandler(repository, chrome.runtime.id, storageReady);
chrome.runtime.onMessage.addListener((input: unknown, sender, sendResponse) => {
  void handle(input, sender).then(sendResponse);
  return true; // Callback form also supports our Chrome 120 minimum.
});
