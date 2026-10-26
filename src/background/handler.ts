import { rmpProvider } from '../adapters/rmp/provider';
import type { FoundationRepository } from '../storage/repository';
import type { FoundationResponse, RpcRejection } from '../shared/foundation-rpc';
import { parseEnvelope, parseFoundationRequest } from '../shared/foundation-rpc';
import { ContractFault } from '../shared/validation';

export interface SenderIdentity {
  id?: string;
  url?: string;
  origin?: string;
  frameId?: number;
  documentLifecycle?: string;
}
export function isDashboardSender(sender: SenderIdentity, extensionId: string): boolean {
  if (sender.id !== extensionId || !sender.url || (sender.frameId !== undefined && sender.frameId !== 0)) return false;
  if (sender.documentLifecycle !== undefined && sender.documentLifecycle !== 'active') return false;
  const origin = 'chrome-extension://' + extensionId;
  if (sender.origin !== undefined && sender.origin !== origin) return false;
  // Hash navigation is reserved for future dashboard tabs. Queries and other documents are not allowed.
  return sender.url.split('#')[0] === origin + '/dashboard.html';
}

export function createMessageHandler(repository: FoundationRepository, extensionId: string, storageReady: Promise<boolean> = Promise.resolve(true)) {
  return async (input: unknown, sender: SenderIdentity): Promise<FoundationResponse | RpcRejection> => {
    let requestId: string | null = null;
    let type: string | null = null;
    try {
      const envelope = parseEnvelope(input);
      requestId = envelope.requestId;
      type = envelope.type;
      if (!isDashboardSender(sender, extensionId)) throw new ContractFault('UNAUTHORIZED_SENDER', 'Only this extension dashboard may use these commands.');
      const request = parseFoundationRequest(input);
      if (!await storageReady) throw new ContractFault('STORAGE_ERROR', 'Local storage access could not be initialized. Nothing was changed.');
      const base = { protocolVersion: 1 as const, requestId: request.requestId, ok: true as const };
      switch (request.type) {
        case 'professor.lookup': return { ...base, type: request.type, data: rmpProvider.lookup(request.payload) };
        case 'schedule.read': return { ...base, type: request.type, data: await repository.readSchedule(request.payload.scheduleId) };
        case 'schedule.save': return { ...base, type: request.type, data: await repository.saveSchedule(request.payload.schedule, request.payload.expectedRevision) };
        case 'schedule.import': return { ...base, type: request.type, data: await repository.importSchedule(request.payload.targetScheduleId, request.payload.expectedRevision, request.payload.mode, request.payload.backup) };
        case 'settings.read': return { ...base, type: request.type, data: await repository.readSettings() };
        case 'settings.save': return { ...base, type: request.type, data: await repository.saveSettings(request.payload.settings, request.payload.expectedRevision) };
      }
    } catch (error) {
      return { protocolVersion: 1, requestId, type, ok: false,
        error: error instanceof ContractFault ? error.detail : { code: 'STORAGE_ERROR', message: 'The operation could not be confirmed. Read saved state before trying again.' } };
    }
  };
}
