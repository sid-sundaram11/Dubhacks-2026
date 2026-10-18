import {
  advancePhaseRequestSchema,
  checkRingRequestSchema,
  createOrbitRequestSchema,
  finalizeRequestSchema,
  inviteRequestSchema,
  joinRequestSchema,
  placeRequestSchema,
  revealRequestSchema,
} from "../../src/features/orbit/orbitSchemas";
import { OrbitError } from "./errors";
import type { OrbitRepository } from "./repository";
import { requestAnonymousSession } from "./supabaseAuth";
import { signJwt, signMediaToken, verifyAnyJwt, verifyMediaToken } from "./tokens";

const MAX_BODY = 2_000_000;

export interface OrbitHttpOptions {
  repository: OrbitRepository;
  devSecret: string;
  supabaseSecret?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  fetchImpl?: typeof fetch;
  now: () => Date;
  tokenTtlSec: number;
  mediaTtlSec: number;
}

function cors(): HeadersInit {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, accept",
    "cache-control": "no-store",
  };
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: cors() });
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new OrbitError("payload_too_large", 413);
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new OrbitError("invalid_request", 400);
  }
}

function parse<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new OrbitError("invalid_request", 400);
  return parsed.data;
}

export function createOrbitHttp(options: OrbitHttpOptions) {
  const secrets = [options.devSecret, options.supabaseSecret ?? ""];

  function nowSec(): number {
    return Math.floor(options.now().getTime() / 1000);
  }

  function userIdFrom(request: Request): string {
    const token = bearer(request);
    if (!token) throw new OrbitError("unauthorized", 401);
    const userId = verifyAnyJwt(token, secrets, nowSec());
    if (!userId) throw new OrbitError("unauthorized", 401);
    options.repository.ensureUser(userId);
    return userId;
  }

  function issue(userId: string): string {
    return signJwt(userId, options.devSecret, nowSec(), options.tokenTtlSec);
  }

  async function handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/v1/")) return new Response(null, { status: 204, headers: cors() });
      if (request.method === "POST" && url.pathname === "/api/v1/auth/anonymous") {
        if (options.supabaseUrl && options.supabaseAnonKey) {
          try {
            const session = await requestAnonymousSession({
              supabaseUrl: options.supabaseUrl,
              anonKey: options.supabaseAnonKey,
              fetchImpl: options.fetchImpl ?? fetch,
            });
            options.repository.ensureUser(session.userId);
            return json({ userId: session.userId, accessToken: session.accessToken, tokenType: "bearer" });
          } catch {
            return json({ error: "auth_unavailable" }, 503);
          }
        }
        const userId = options.repository.anonymousUser();
        return json({ userId, accessToken: issue(userId), tokenType: "bearer" });
      }
      if (request.method === "GET" && url.pathname.startsWith("/api/v1/media/")) {
        const token = decodeURIComponent(url.pathname.slice("/api/v1/media/".length));
        const path = verifyMediaToken(token, options.devSecret, nowSec());
        if (!path) return json({ error: "unauthorized" }, 401);
        const media = options.repository.readMedia(path);
        if (!media) return json({ error: "not_found" }, 404);
        return new Response(new Uint8Array(media.bytes), {
          status: 200,
          headers: { ...cors(), "content-type": media.contentType },
        });
      }

      const userId = userIdFrom(request);
      if (request.method === "POST" && url.pathname === "/api/v1/orbits") {
        const body = parse(createOrbitRequestSchema, await readJson(request));
        return json(options.repository.createOrbit(userId, body.name));
      }
      if (request.method === "POST" && url.pathname === "/api/v1/orbits/invite") {
        const body = parse(inviteRequestSchema, await readJson(request));
        return json(options.repository.invite(userId, body.orbitId));
      }
      if (request.method === "POST" && url.pathname === "/api/v1/orbits/join") {
        const body = parse(joinRequestSchema, await readJson(request));
        return json(options.repository.join(userId, body.code));
      }
      if (request.method === "GET" && url.pathname === "/api/v1/orbits/current") return json(options.repository.currentOrbit(userId));
      if (request.method === "GET" && url.pathname === "/api/v1/cycles/current") return json(options.repository.currentCycle(userId));
      if (request.method === "POST" && url.pathname === "/api/v1/comet/reveal") {
        const body = parse(revealRequestSchema, await readJson(request));
        const revealed = await options.repository.reveal(userId, url.origin, body.orbitId);
        const token = signMediaToken(revealed.path, options.devSecret, nowSec() + options.mediaTtlSec);
        return json({
          weekKey: revealed.weekKey,
          cached: revealed.cached,
          source: revealed.source,
          media: [{ kind: "image", url: `${url.origin}/api/v1/media/${token}`, contentType: "image/png" }],
          haptics: revealed.haptics,
        });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/submissions/finalize") {
        const body = parse(finalizeRequestSchema, await readJson(request));
        return json(await options.repository.finalize(userId, body));
      }
      if (request.method === "POST" && url.pathname === "/api/v1/solve/place") {
        const body = parse(placeRequestSchema, await readJson(request));
        return json(await options.repository.place(userId, body));
      }
      if (request.method === "POST" && url.pathname === "/api/v1/solve/check-ring") {
        const body = parse(checkRingRequestSchema, await readJson(request));
        return json(await options.repository.checkRing(userId, body.cycleId, body.ring));
      }
      if (request.method === "POST" && url.pathname === "/api/v1/demo/advance-phase") {
        const body = parse(advancePhaseRequestSchema, await readJson(request));
        return json(await options.repository.advance(userId, body.orbitId));
      }
      return json({ error: "not_found" }, 404);
    } catch (error) {
      if (error instanceof OrbitError) return json({ error: error.code }, error.status);
      return json({ error: "orbit_failed" }, 500);
    }
  }

  return { handle, issue };
}
