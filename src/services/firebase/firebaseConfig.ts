import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { reactNativeAuthPersistence } from "./reactNativeAuthPersistence";

export interface PublicFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export type FirebaseInitResult =
  | { ok: true; app: FirebaseApp; auth: Auth; firestore: Firestore }
  | { ok: false; reason: "unconfigured" | "init_failed"; message: string };

let cached: FirebaseInitResult | null = null;

export function readPublicFirebaseConfig(): PublicFirebaseConfig | null {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  const messagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID?.trim();
  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null;
  }
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
}

function getOrCreateApp(config: PublicFirebaseConfig): FirebaseApp {
  if (getApps().length > 0) return getApp();
  return initializeApp(config);
}

function getOrCreateAuth(app: FirebaseApp): Auth {
  try {
    return initializeAuth(app, {
      persistence: reactNativeAuthPersistence(),
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
    if (code === "auth/already-initialized") return getAuth(app);
    throw error;
  }
}

export function initFirebase(): FirebaseInitResult {
  if (cached) return cached;
  const config = readPublicFirebaseConfig();
  if (!config) {
    cached = { ok: false, reason: "unconfigured", message: "Firebase environment variables are not set." };
    return cached;
  }
  try {
    const app = getOrCreateApp(config);
    const auth = getOrCreateAuth(app);
    const firestore = getFirestore(app);
    cached = { ok: true, app, auth, firestore };
    return cached;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Firebase failed to initialize.";
    cached = { ok: false, reason: "init_failed", message };
    return cached;
  }
}

export function resetFirebaseCacheForTests(): void {
  cached = null;
}

function waitForAuthHydration(auth: Auth): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function ensureAnonymousUser(): Promise<{ user: User; auth: Auth; firestore: Firestore } | null> {
  const init = initFirebase();
  if (!init.ok) return null;
  const { auth, firestore } = init;
  let user = await waitForAuthHydration(auth);
  if (!user) {
    const credential = await signInAnonymously(auth);
    user = credential.user;
  }
  return { user, auth, firestore };
}
