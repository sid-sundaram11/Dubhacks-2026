import { loadLocalEnv } from "../server/env";
import { createOrbitApi } from "../server/orbit/api";
import { SEED_ORBIT_ID, SEED_USER_IDS } from "../server/orbit/seed";

loadLocalEnv();

async function main(): Promise<void> {
  const storePath = process.env.ORBIT_STORE_PATH ?? "data/orbit-store.json";
  const api = createOrbitApi({ env: process.env, storePath, persist: true });
  const token = api.issueDevToken(SEED_USER_IDS[0]);
  const response = await api.handle(
    new Request("http://127.0.0.1:8787/api/v1/demo/advance-phase", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ orbitId: SEED_ORBIT_ID }),
    }),
  );
  const payload: unknown = await response.json();
  console.log(JSON.stringify(payload));
  if (!response.ok) process.exitCode = 1;
}

void main();
