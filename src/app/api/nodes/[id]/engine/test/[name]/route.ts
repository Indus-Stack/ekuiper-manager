import { NextRequest } from 'next/server';
import { ApiError, apiErrorResponse, requireUser } from '@/lib/api';
import {
  formatUpstreamAuthorization,
  resolveEffectiveEngineFamily,
  resolveEffectiveOperationMode,
} from '@/lib/engines/adapter';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNodeWithAuthorization } from '@/lib/nodes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; name: string }> },
): Promise<Response> {
  try {
    await requireUser(request);
    const { id: nodeId, name } = await context.params;
    const { node, authorization } = await getNodeWithAuthorization(nodeId);
    const family = resolveEffectiveEngineFamily(node);
    const mode = resolveEffectiveOperationMode(node);

    if (family !== 'rekuiper') {
      throw new ApiError(
        501,
        'Same-origin rule-test SSE relay is not qualified for eKuiper separate-port trials',
        'UNSUPPORTED_ENGINE',
      );
    }
    if (mode === 'declarative') {
      throw new ApiError(
        403,
        'Manager-managed rule trials are disabled in declarative mode because DELETE cleanup is blocked',
        'DECLARATIVE_MODE_ACTIVE',
      );
    }

    const target = new URL(`/test/${encodeURIComponent(name)}`, node.baseUrl);
    await assertSafeNodeDestination(target);

    const headers = new Headers({ Accept: 'text/event-stream' });
    const formattedAuth = formatUpstreamAuthorization(family, authorization);
    if (formattedAuth) headers.set('Authorization', formattedAuth);

    const upstream = await fetch(target, {
      headers,
      cache: 'no-store',
      redirect: 'manual',
      signal: request.signal,
    });

    if (!upstream.ok || !upstream.body) {
      throw new ApiError(
        upstream.status || 502,
        `Upstream rule-test stream failed (${upstream.status})`,
        'UPSTREAM_STREAM_ERROR',
      );
    }

    return new Response(upstream.body, {
      status: 200,
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

