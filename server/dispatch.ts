import { handleGenerateConstellation } from "./handler";

export async function dispatchRequest(
  request: Request,
  deps: {
    orbit: { handle(request: Request): Promise<Response> };
    generate?: (request: Request) => Promise<Response>;
  },
): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (request.method === "GET" && pathname === "/health") {
    return Response.json(
      { ok: true },
      { headers: { "content-type": "application/json", "cache-control": "no-store" } },
    );
  }
  if (pathname === "/api/generate-constellation") return (deps.generate ?? handleGenerateConstellation)(request);
  if (pathname.startsWith("/api/v1/")) return deps.orbit.handle(request);
  return new Response(null, { status: 404 });
}
