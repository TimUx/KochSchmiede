import { NextRequest, NextResponse } from "next/server";

// BACKEND_URL must be a plain (non-NEXT_PUBLIC_) environment variable so that
// it is read from the container environment at runtime.  NEXT_PUBLIC_ variables
// are inlined at build time by the Next.js compiler, so a NEXT_PUBLIC_ var that
// is not set during `next build` will always resolve to `undefined` at runtime,
// regardless of what the container sets.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

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
  const { path } = await context.params;
  const url = `${BACKEND_URL}/api/${path.join("/")}${req.nextUrl.search}`;

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
    const backendRes = await fetch(url, init);

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
    const message = err instanceof Error ? err.message : String(err);
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
