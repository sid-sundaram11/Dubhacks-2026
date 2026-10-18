import { z } from "zod";
import {
  advancePhaseRequestSchema,
  advancePhaseResponseSchema,
  anonymousAuthSchema,
  checkRingRequestSchema,
  checkRingResponseSchema,
  cometRevealSchema,
  createOrbitRequestSchema,
  createOrbitResponseSchema,
  currentCycleSchema,
  currentOrbitSchema,
  finalizeRequestSchema,
  finalizeResponseSchema,
  inviteRequestSchema,
  inviteResponseSchema,
  joinRequestSchema,
  joinResponseSchema,
  placeRequestSchema,
  boardSchema,
  revealRequestSchema,
  type FinalizeRequest,
} from "./orbitSchemas";

export class OrbitRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export interface OrbitClientOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export function createOrbitClient(options: OrbitClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;

  async function call<T>(method: string, path: string, schema: z.ZodType<T>, body?: unknown, token = options.token): Promise<T> {
    const headers = new Headers({ accept: "application/json" });
    if (body !== undefined) headers.set("content-type", "application/json");
    if (token) headers.set("authorization", `Bearer ${token}`);
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      throw new OrbitRequestError(response.status, "invalid_response");
    }
    if (!response.ok) {
      const code =
        typeof payload === "object" && payload !== null && "error" in payload
          ? String((payload as { error: unknown }).error)
          : "orbit_failed";
      throw new OrbitRequestError(response.status, code);
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw new OrbitRequestError(response.status, "invalid_response");
    return parsed.data;
  }

  return {
    createOrbit(name: string) {
      return call("POST", "/api/v1/orbits", createOrbitResponseSchema, createOrbitRequestSchema.parse({ name }));
    },
    invite(orbitId?: string) {
      return call(
        "POST",
        "/api/v1/orbits/invite",
        inviteResponseSchema,
        inviteRequestSchema.parse(orbitId ? { orbitId } : {}),
      );
    },
    join(code: string) {
      return call("POST", "/api/v1/orbits/join", joinResponseSchema, joinRequestSchema.parse({ code }));
    },
    currentOrbit() {
      return call("GET", "/api/v1/orbits/current", currentOrbitSchema);
    },
    currentCycle() {
      return call("GET", "/api/v1/cycles/current", currentCycleSchema);
    },
    revealComet(orbitId?: string) {
      return call(
        "POST",
        "/api/v1/comet/reveal",
        cometRevealSchema,
        revealRequestSchema.parse(orbitId ? { orbitId } : {}),
      );
    },
    finalize(body: FinalizeRequest) {
      return call("POST", "/api/v1/submissions/finalize", finalizeResponseSchema, finalizeRequestSchema.parse(body));
    },
    place(submissionId: string, ring: number, position: number) {
      return call("POST", "/api/v1/solve/place", boardSchema, placeRequestSchema.parse({ submissionId, ring, position }));
    },
    checkRing(cycleId: string, ring: number) {
      return call("POST", "/api/v1/solve/check-ring", checkRingResponseSchema, checkRingRequestSchema.parse({ cycleId, ring }));
    },
    advancePhase(orbitId?: string) {
      return call(
        "POST",
        "/api/v1/demo/advance-phase",
        advancePhaseResponseSchema,
        advancePhaseRequestSchema.parse(orbitId ? { orbitId } : {}),
      );
    },
  };
}

export async function signInAnonymously(options: OrbitClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${baseUrl}/api/v1/auth/anonymous`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: "{}",
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const code =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String((payload as { error: unknown }).error)
        : "orbit_failed";
    throw new OrbitRequestError(response.status, code);
  }
  const session = anonymousAuthSchema.parse(payload);
  return { session, client: createOrbitClient({ ...options, token: session.accessToken }) };
}
