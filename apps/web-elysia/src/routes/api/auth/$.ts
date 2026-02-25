import { createFileRoute } from "@tanstack/react-router";
import { API_URL } from "@/lib/constants";

/**
 * Proxy handler: forwards auth requests to server-elysia.
 * Rewrites Set-Cookie headers to remove the backend domain,
 * so cookies are set on the web-elysia domain instead.
 */
async function proxyToBackend(request: Request): Promise<Response> {
  const url = new URL(request.url);
  console.log("url", url);
  const targetUrl = `${API_URL}${url.pathname}${url.search}`;
  console.log("targetUrl", targetUrl);

  const headers = new Headers();
  headers.set("cookie", request.headers.get("cookie") ?? "");
  headers.set("content-type", request.headers.get("content-type") ?? "application/json");
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

  const origin = request.headers.get("origin");
  if (origin) headers.set("origin", origin);
  const referer = request.headers.get("referer");
  if (referer) headers.set("referer", referer);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    // @ts-expect-error - duplex needed for streaming body
    duplex: hasBody ? "half" : undefined,
  });

  const responseHeaders = new Headers(response.headers);

  // Rewrite Set-Cookie: remove domain so browser assigns to web-elysia's domain
  const setCookies = response.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    responseHeaders.delete("set-cookie");
    for (const cookie of setCookies) {
      const rewritten = cookie.replace(/;\s*domain=[^;]*/gi, "");
      responseHeaders.append("set-cookie", rewritten);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => proxyToBackend(request),
      POST: async ({ request }) => proxyToBackend(request),
      PUT: async ({ request }) => proxyToBackend(request),
      PATCH: async ({ request }) => proxyToBackend(request),
      DELETE: async ({ request }) => proxyToBackend(request),
    },
  },
});
