import { NextRequest, NextResponse } from "next/server";
import { Agent } from "undici";

// Node.js built-in fetch is powered by undici, which enforces its own
// bodyTimeout / headersTimeout independently of the AbortController.
// The defaults are 300,000 ms (5 minutes), so requests that take longer
// (e.g. AI inference on CPU-only hardware) silently fail with "fetch failed"
// and produce a spurious 502 before our 10-minute AbortController fires.
// Using a custom Agent with higher timeouts prevents that.
const PROXY_TIMEOUT_MS = 660_000; // 11 min – must exceed AbortController timeout (10 min)
const backendAgent = new Agent({
  bodyTimeout: PROXY_TIMEOUT_MS,
  headersTimeout: PROXY_TIMEOUT_MS,
  connectTimeout: 10_000,
});

// Hop-by-hop headers must not be forwarded by a proxy (RFC 7230 §6.1).
// Forwarding them can confuse the upstream server or cause undici (Node.js
// built-in fetch) to throw on conflicting header combinations.
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

type Context = { params: Promise<{ path: string[] }> };

async function proxyRequest(req: NextRequest, context: Context): Promise<NextResponse> {
  // Read BACKEND_URL inside the handler so it is always resolved from the live
  // container environment at request time.  A module-level constant would be
  // evaluated once when the module is first loaded; if the Next.js bundler
  // evaluated that during the build (before the container sets the variable),
  // the value would be frozen as "undefined" and the fallback would always win.
  // Reading it here guarantees the runtime value is used regardless of how the
  // module was compiled.  NEXT_PUBLIC_ variables must never be used for this
  // purpose: they are inlined at build time by the Next.js compiler.
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
  const { path } = await context.params;
  const url = `${backendUrl}/api/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  // Copy only non-hop-by-hop, non-host headers to the forwarded request.
  req.headers.forEach((value, key) => {
    if (key !== "host" && !HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    // Buffer the entire body before forwarding to avoid conflicts between the
    // forwarded Content-Length header and chunked transfer encoding that can
    // occur when streaming the body with duplex: "half".
    const body = await req.arrayBuffer();
    init.body = body;
    headers.set("content-length", String(body.byteLength));
  } else {
    // GET/HEAD requests must not carry a body.  Remove any Content-Length or
    // Content-Type header that the client or an upstream proxy may have added.
    headers.delete("content-length");
    headers.delete("content-type");
  }

  try {
    // Use an explicit timeout so slow AI inference (local LLM on CPU-only
    // hardware) has enough time to finish.  The value intentionally exceeds
    // the backend AI_TIMEOUT default (300 s) to give the backend enough room
    // to complete its own timeout handling and still return a structured error.
    const controller = new AbortController();
    const timeoutMs = 600_000; // 10 minutes
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let backendRes: Response;
    try {
      // `dispatcher` is a Node.js/undici extension to the WhatWG RequestInit
      // type.  The cast makes the intent explicit while avoiding a bare `any`.
      backendRes = await fetch(url, {
        ...init,
        signal: controller.signal,
        dispatcher: backendAgent,
      } as RequestInit & { dispatcher: Agent });
    } finally {
      clearTimeout(timeoutId);
    }

    const responseHeaders = new Headers();
    // Copy only non-hop-by-hop response headers.
    backendRes.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const message = err instanceof Error ? err.message : String(err);
    if (isTimeout) {
      console.error(`[proxy] Request to ${url} timed out after 10 minutes`);
      return NextResponse.json({ detail: "Request timed out" }, { status: 504 });
    }
    console.error(`[proxy] Failed to reach backend at ${url}: ${message}`);
    return NextResponse.json(
      { detail: "Backend unreachable" },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
