import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────
// 👉 PASTE YOUR FIREBASE CREDENTIALS HERE
//
// Firebase Console → Project Settings (gear icon) → "General" tab →
// "Your apps" → Web app → "SDK setup and configuration" → "Config".
// Copy each value from that snippet into the matching field below,
// replacing the "YOUR_..." placeholder strings.
//
// You also need to enable Cloud Firestore:
//   Firebase Console → Build → Firestore Database → "Create database".
// ─────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// True once real credentials are pasted above. While this is false the app
// runs on in-memory defaults (no cloud sync) instead of hanging on a
// Firestore connection that can never succeed.
export const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export default app;
