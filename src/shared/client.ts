import type { DashboardRpc, RequestFor, ResponseFor } from './messages';
import type { FoundationMethod } from './foundation-rpc';
import { parseFoundationRequest, parseFoundationResponse } from './foundation-rpc';
import { ContractFault } from './validation';

export type RpcTransport = (request: unknown) => Promise<unknown>;
const timeoutMs = 10_000;

/** Dashboard-only bridge. No automatic retries, including after ambiguous timeouts. */
export function createFoundationClient(transport: RpcTransport = request => chrome.runtime.sendMessage(request)) {
  return async <K extends FoundationMethod>(type: K, payload: DashboardRpc[K]['input']): Promise<ResponseFor<K>> => {
    const request: RequestFor<K> = { protocolVersion: 1, requestId: crypto.randomUUID(), type, payload };
    const validated = parseFoundationRequest(request);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const raw = await Promise.race([
        Promise.resolve().then(() => transport(validated)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new ContractFault('TRANSPORT_ERROR', 'No reply arrived. The operation may have completed; read saved state before trying again.')), timeoutMs);
        }),
      ]);
      // The parser verifies method, request ID, discriminant and the matching data schema.
      return parseFoundationResponse(raw, validated) as ResponseFor<K>;
    } catch (error) {
      if (error instanceof ContractFault) throw error;
      throw new ContractFault('TRANSPORT_ERROR', 'The connection closed without a confirmed reply. Read saved state before trying again.');
    } finally { clearTimeout(timer); }
  };
}
