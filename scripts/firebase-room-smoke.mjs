import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

const projectId = "demo-constellation-room-test";
const app = initializeApp({
  apiKey: "demo-api-key",
  appId: "1:123456789:web:room-test",
  authDomain: `${projectId}.firebaseapp.com`,
  messagingSenderId: "123456789",
  projectId,
  storageBucket: `${projectId}.appspot.com`,
});

const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const firestore = getFirestore(app);
connectFirestoreEmulator(firestore, "127.0.0.1", 8080);

try {
  const credential = await signInAnonymously(auth);
  const roomCode = "QA1234";
  const roomRef = doc(firestore, "rooms", roomCode);
  const memberRef = doc(firestore, "rooms", roomCode, "members", credential.user.uid);

  await runTransaction(firestore, async (transaction) => {
    const existing = await transaction.get(roomRef);
    if (existing.exists()) throw new Error("room_exists");
    transaction.set(roomRef, {
      version: 1,
      hostUid: credential.user.uid,
      createdAt: serverTimestamp(),
    });
    transaction.set(memberRef, {
      version: 1,
      uid: credential.user.uid,
      label: "Diagnostic Explorer",
      joinedAt: serverTimestamp(),
    });
  });

  console.log("EMULATOR_ROOM_TRANSACTION_OK");
  process.exit(0);
} catch (error) {
  console.error("EMULATOR_ROOM_TRANSACTION_FAILED", error);
  process.exit(1);
}
