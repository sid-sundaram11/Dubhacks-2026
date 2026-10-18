import { existsSync } from "node:fs";
import { catalogHas } from "./catalog";
import { cometPrompt, fetchGrokImaginePng } from "./comet";
import { createOrbitHttp } from "./http";
import { OrbitRepository, type OrbitRepositoryOptions } from "./repository";
import { readOrbitSnapshot, writeOrbitSnapshot } from "./storeFile";
import type { OrbitDb } from "./types";
import { emptyOrbitDb } from "./types";

export interface CreateOrbitApiOptions {
  snapshot?: OrbitDb;
  storePath?: string;
  persist?: boolean;
  now?: () => Date;
  env?: { [key: string]: string | undefined };
  fetchImpl?: typeof fetch;
  generateComet?: (weekKey: string) => Promise<Buffer>;
  onCometStored?: (weekKey: string) => void;
  catalogHas?: (id: number) => boolean;
  devSecret?: string;
  tokenTtlSec?: number;
  mediaTtlSec?: number;
}

function defaultGenerate(
  env: { [key: string]: string | undefined },
  fetchImpl: typeof fetch,
): (weekKey: string) => Promise<Buffer> {
  return async (weekKey: string) => {
    const apiKey = env.XAI_API_KEY?.trim();
    if (!apiKey) throw new Error("no_key");
    return fetchGrokImaginePng({
      apiKey,
      model: env.XAI_IMAGE_MODEL?.trim() || "grok-2-image",
      prompt: cometPrompt(weekKey),
      fetchImpl,
    });
  };
}

export function createOrbitApi(options: CreateOrbitApiOptions = {}) {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date());
  const fetchImpl = options.fetchImpl ?? fetch;
  const devSecret = options.devSecret ?? (env.ORBIT_DEV_JWT_SECRET?.trim() || "dev-orbit-secret");
  let snapshot = options.snapshot;
  if (!snapshot && options.storePath && existsSync(options.storePath)) snapshot = readOrbitSnapshot(options.storePath);

  const repositoryOptions: OrbitRepositoryOptions = {
    now,
    catalogHas: options.catalogHas ?? catalogHas,
    generateComet: options.generateComet ?? defaultGenerate(env, fetchImpl),
    onCometStored: options.onCometStored,
  };
  let repository!: OrbitRepository;
  repositoryOptions.onChange = () => {
    if (options.persist && options.storePath) writeOrbitSnapshot(options.storePath, repository.snapshot());
  };
  repository = OrbitRepository.create(repositoryOptions, snapshot ?? emptyOrbitDb());
  const http = createOrbitHttp({
    repository,
    devSecret,
    supabaseSecret: env.SUPABASE_JWT_SECRET?.trim(),
    supabaseUrl: env.SUPABASE_URL?.trim(),
    supabaseAnonKey: env.SUPABASE_ANON_KEY?.trim(),
    fetchImpl,
    now,
    tokenTtlSec: options.tokenTtlSec ?? 60 * 60 * 24 * 14,
    mediaTtlSec: options.mediaTtlSec ?? 60 * 60 * 24 * 7,
  });

  return {
    handle: http.handle,
    issueDevToken: http.issue,
    repository,
  };
}

export type OrbitApi = ReturnType<typeof createOrbitApi>;
