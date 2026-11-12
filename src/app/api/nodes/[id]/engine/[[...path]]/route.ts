import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiErrorResponse, assertSameOrigin, requireUser } from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import {
  isSensitiveEKuiperPath,
  sanitizeSensitiveEKuiperBody,
} from '@/lib/ekuiper/wire';
import {
  assertProfileRevisionMatch,
  formatUpstreamAuthorization,
  resolveEffectiveEngineFamily,
  resolveEffectiveOperationMode,
} from '@/lib/engines/adapter';
import { evaluateEngineOperationPolicy } from '@/lib/engines/policy';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNodeWithAuthorization } from '@/lib/nodes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const requestHeaders = ['accept', 'content-type', 'content-language', 'range'];
const responseHeaders = [
  'accept-ranges',
  'cache-control',
  'content-disposition',
  'content-language',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
  'location',
];

async function handleNodeEngineRequest(
  request: NextRequest,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  nodeId: string,
  parts: string[],
): Promise<Response> {
  try {
    const user = await requireUser(request);
    const { node, authorization } = await getNodeWithAuthorization(nodeId);
    const family = resolveEffectiveEngineFamily(node);
    const operationMode = resolveEffectiveOperationMode(node);

    let decision;
    try {
      decision = evaluateEngineOperationPolicy({
        family,
        operationMode,
        method,
        parts,
      });
    } catch {
      throw new ApiError(400, 'Invalid engine API path', 'INVALID_PROXY_PATH');
    }

    if (!decision.allowed) {
      throw new ApiError(
        decision.status ?? 403,
        decision.reason ?? 'Operation not allowed',
        decision.code ?? 'OPERATION_NOT_ALLOWED',
      );
    }

    if (decision.sideEffect !== 'read') {
      assertSameOrigin(request);
      assertProfileRevisionMatch(
        node,
        request.headers.get('x-engine-profile-revision'),
      );
    }

    const target = new URL(
      decision.normalizedPath ? `/${decision.normalizedPath}` : '/',
      node.baseUrl,
    );
    target.search = request.nextUrl.search;
    await assertSafeNodeDestination(target);

    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 100 * 1024 * 1024) {
      throw new ApiError(413, 'Request body exceeds 100 MB', 'BODY_TOO_LARGE');
    }

    const headers = new Headers();
    for (const name of requestHeaders) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const formattedAuth = formatUpstreamAuthorization(family, authorization);
    if (formattedAuth) headers.set('authorization', formattedAuth);

    const init: RequestInit & { duplex?: 'half' } = {
      method,
      headers,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(Number(process.env.EKUIPER_API_TIMEOUT ?? 30_000)),
      ]),
    };
    if (method !== 'GET' && request.body) {
      init.body = request.body;
      init.duplex = 'half';
    }

    const upstream = await fetch(target, init);
    if (upstream.status >= 300 && upstream.status < 400) {
      throw new ApiError(502, `Unexpected redirect from ${family}`, 'UPSTREAM_REDIRECT');
    }

    const outgoingHeaders = new Headers();
    for (const name of responseHeaders) {
      const value = upstream.headers.get(name);
      if (value) outgoingHeaders.set(name, value);
    }

    if (decision.sideEffect !== 'read') {
      recordAuditSafely({
        actorId: user.id,
        nodeId: node.id,
        action: `${family}.${method.toLowerCase()}`,
        resourceType: 'engine_api',
        resourceId: `/${decision.normalizedPath}`,
        success: upstream.ok,
        metadata: {
          status: upstream.status,
          family,
          profileId: node.profileId ?? null,
          sideEffect: decision.sideEffect,
        },
      });
    }

    if (isSensitiveEKuiperPath(decision.normalizedPath)) {
      const sanitized = sanitizeSensitiveEKuiperBody(method, await upstream.text());
      outgoingHeaders.delete('content-length');
      if (sanitized.isJson) {
        outgoingHeaders.set('content-type', 'application/json');
      }
      return new Response(upstream.status === 204 ? null : sanitized.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: outgoingHeaders,
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outgoingHeaders,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: { code: 'UPSTREAM_TIMEOUT', message: 'Engine request timed out' } },
        { status: 504 },
      );
    }
    return apiErrorResponse(error);
  }
}

type RouteContext = { params: Promise<{ id: string; path?: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id, path = [] } = await context.params;
  return handleNodeEngineRequest(request, 'GET', id, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id, path = [] } = await context.params;
  return handleNodeEngineRequest(request, 'POST', id, path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id, path = [] } = await context.params;
  return handleNodeEngineRequest(request, 'PUT', id, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, path = [] } = await context.params;
  return handleNodeEngineRequest(request, 'PATCH', id, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id, path = [] } = await context.params;
  return handleNodeEngineRequest(request, 'DELETE', id, path);
}

