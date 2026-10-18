import { loadLocalEnv } from "../server/env";
import { demoSnapshot, SEED_INVITE_CODE, SEED_ORBIT_ID, SEED_USER_IDS } from "../server/orbit/seed";
import { writeOrbitSnapshot } from "../server/orbit/storeFile";
import { signJwt } from "../server/orbit/tokens";

loadLocalEnv();

const storePath = process.env.ORBIT_STORE_PATH ?? "data/orbit-store.json";
const secret = process.env.ORBIT_DEV_JWT_SECRET?.trim() || "dev-orbit-secret";
const nowSec = Math.floor(Date.now() / 1000);
writeOrbitSnapshot(storePath, demoSnapshot());

console.log(`Seeded orbit ${SEED_ORBIT_ID}`);
console.log(`Invite ${SEED_INVITE_CODE}`);
console.log(`Store ${storePath}`);
console.log("Phase solving. One shared theme, three hidden threads, nine memories, a solve board, and one archived chapter.");
SEED_USER_IDS.forEach((userId, index) => {
  console.log(`User ${index + 1} ${userId}`);
  console.log(`Bearer ${signJwt(userId, secret, nowSec, 60 * 60 * 24 * 14)}`);
});
