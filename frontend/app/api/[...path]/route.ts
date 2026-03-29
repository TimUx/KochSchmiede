import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

type Context = { params: Promise<{ path: string[] }> };

// RequestInit does not include `duplex` in the TypeScript types yet,
// but it is required by the Fetch spec when streaming a request body.
interface RequestInitWithDuplex extends RequestInit {
  duplex?: "half";
}

async function proxyRequest(req: NextRequest, context: Context): Promise<NextResponse> {
  const { path } = await context.params;
  const url = `${BACKEND_URL}/api/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const init: RequestInitWithDuplex = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half";
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
