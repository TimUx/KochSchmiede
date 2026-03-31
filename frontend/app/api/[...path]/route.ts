import { NextRequest, NextResponse } from "next/server";

// BACKEND_URL must be a plain (non-NEXT_PUBLIC_) environment variable so that
// it is read from the container environment at runtime.  NEXT_PUBLIC_ variables
// are inlined at build time by the Next.js compiler, so a NEXT_PUBLIC_ var that
// is not set during `next build` will always resolve to `undefined` at runtime,
// regardless of what the container sets.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

type Context = { params: Promise<{ path: string[] }> };

async function proxyRequest(req: NextRequest, context: Context): Promise<NextResponse> {
  const { path } = await context.params;
  const url = `${BACKEND_URL}/api/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

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
  }

  try {
    const backendRes = await fetch(url, init);

    const responseHeaders = new Headers(backendRes.headers);
    // Remove hop-by-hop headers that should not be forwarded
    responseHeaders.delete("connection");
    responseHeaders.delete("transfer-encoding");

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: responseHeaders,
    });
  } catch {
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
