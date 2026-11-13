import { NextRequest } from 'next/server';
import { ApiError, apiErrorResponse, requireUser } from '@/lib/api';
import {
  formatUpstreamAuthorization,
  resolveEffectiveEngineFamily,
  resolveEffectiveOperationMode,
} from '@/lib/engines/adapter';
import {
  acquireTapLease,
  MAX_INSPECTION_SAMPLES,
  releaseTapLease,
} from '@/lib/engines/tap-leases';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNodeWithAuthorization } from '@/lib/nodes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireUser(request);
    const { id: nodeId } = await context.params;
    const { node, authorization } = await getNodeWithAuthorization(nodeId);
    const family = resolveEffectiveEngineFamily(node);
    const mode = resolveEffectiveOperationMode(node);

    if (family !== 'rekuiper') {
      throw new ApiError(501, 'Wire-tap SSE relay is only supported on reKuiper targets', 'UNSUPPORTED_ENGINE');
    }
    if (mode === 'declarative') {
      throw new ApiError(403, 'Wire-tap operations are blocked in declarative mode', 'DECLARATIVE_MODE_ACTIVE');
    }

    const ruleId = request.nextUrl.searchParams.get('ruleId')?.trim() || '*';
    const tapNodeId = request.nextUrl.searchParams.get('tapNodeId')?.trim() || '*';

    const leaseResult = acquireTapLease({
      userId: user.id,
      nodeId: node.id,
      ruleId,
      tapNodeId,
    });
    if (!leaseResult.ok) {
      throw new ApiError(429, leaseResult.message, leaseResult.code);
    }

    const wsUrl = new URL('/comms', node.baseUrl);
    await assertSafeNodeDestination(wsUrl);
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';

    const authHeader = formatUpstreamAuthorization(family, authorization);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let closed = false;
        let forwarded = 0;
        let dropped = 0;

        const sendEvent = (event: string, data: unknown) => {
          if (closed) return;
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        const cleanup = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          releaseTapLease(leaseResult.lease.leaseId);
          try {
            ws?.close();
          } catch {
            // ignore
          }
          try {
            controller.close();
          } catch {
            // ignore
          }
        };

        const heartbeat = setInterval(() => {
          sendEvent('heartbeat', { ts: Date.now(), dropped });
        }, 15_000);

        request.signal.addEventListener('abort', cleanup);

        // Node 22+ global WebSocket
        const WsCtor = globalThis.WebSocket as unknown as {
          new (url: string, options?: { headers?: Record<string, string> }): WebSocket;
        };
        let ws: WebSocket | null = null;
        try {
          ws = new WsCtor(
            wsUrl.toString(),
            authHeader ? { headers: { Authorization: authHeader } } : undefined,
          );
        } catch (err) {
          sendEvent('error', { message: err instanceof Error ? err.message : 'WebSocket failed' });
          cleanup();
          return;
        }

        ws.addEventListener('open', () => {
          sendEvent('connected', { nodeId: node.id, ruleId, tapNodeId });
        });

        ws.addEventListener('message', (msg) => {
          try {
            const parsed = JSON.parse(String(msg.data)) as Record<string, unknown>;
            const msgRule = String(parsed.ruleId ?? parsed.rule ?? '');
            if (ruleId !== '*' && msgRule && msgRule !== ruleId) {
              return; // Filter out other rules on shared /comms bus
            }
            if (forwarded >= MAX_INSPECTION_SAMPLES) {
              dropped += 1;
              if (dropped === 1 || dropped % 50 === 0) {
                sendEvent('dropped_samples', { dropped });
              }
              return;
            }
            forwarded += 1;
            sendEvent('tap_sample', parsed);
          } catch {
            // Ignore malformed non-JSON frame
          }
        });

        ws.addEventListener('error', () => {
          sendEvent('error', { message: 'Upstream /comms WebSocket error' });
          cleanup();
        });

        ws.addEventListener('close', () => {
          cleanup();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

