import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Persistence } from "firebase/auth";

type PersistenceFactory = (storage: typeof AsyncStorage) => Persistence;

export function reactNativeAuthPersistence(): Persistence {
  const authModule = require("firebase/auth") as { getReactNativePersistence?: PersistenceFactory };
  const factory = authModule.getReactNativePersistence;
  if (!factory) {
    throw new Error("Firebase Auth React Native persistence is unavailable in this runtime.");
  }
  return factory(AsyncStorage);
}
