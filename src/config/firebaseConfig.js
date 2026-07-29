import { Platform } from "react-native";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// Firebase web SDK. Chosen over @react-native-firebase because it runs in the
// Expo web preview and in a plain APK without a custom dev client.
//
// CONFIG, AND WHY IT IS NOT A SECRET
// ----------------------------------
// Read from EXPO_PUBLIC_FIREBASE_* so the project can be swapped without
// editing code. Be clear about what that does and does not buy: a Firebase
// web config is public by design and ships inside every client bundle, so
// moving it to the environment is a portability win, not a security one.
// Anyone with the APK can read these values either way.
//
// What actually protects the data is the Firestore rules, and they matter
// more now that this app writes real sales. Everything below is stored under
// users/{uid}/…, so the rule that enforces it is:
//
//   match /users/{uid}/{document=**} {
//     allow read, write: if request.auth != null && request.auth.uid == uid;
//   }
//
// Without that rule every anonymous session can read every other one's books.
//
// The literals are kept as fallbacks so an existing install keeps working
// with no .env file. Set the variables to point at a different project.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDjVNEV0W6ejuHN-aXUu6NjpyUUnjPfGxM",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "givad-ceced.firebaseapp.com",
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || "https://givad-ceced-default-rtdb.firebaseio.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "givad-ceced",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "givad-ceced.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "860004540516",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:860004540516:web:aa13789edd08e6811d3f71",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-HD3SVYBT2N",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// OFFLINE
// -------
// Two different stories, and conflating them would be a lie about what the
// app does on a phone with no signal.
//
// On **web**, Firestore has a real persistent cache backed by IndexedDB.
// persistentMultipleTabManager is what lets two open tabs share one cache
// instead of the second failing to acquire the lock.
//
// On **React Native**, it does not. The Firebase JS SDK's persistent cache
// requires IndexedDB, which React Native has no implementation of — the SDK
// falls back to a memory cache that is emptied when the process dies. That is
// not a bug to work around here; it is the documented limit of this SDK on
// this platform.
//
// So offline durability on the phone does not come from Firestore. It comes
// from the app being local-first: every screen reads and writes AsyncStorage,
// which is the source of truth the UI renders, and Firestore is a mirror that
// catches up when a connection exists. Unplug the network and nothing degrades
// — the register still rings up sales, the notes still save — because none of
// those paths were waiting on the network to begin with. See utils/cloudSync.
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache:
        Platform.OS === "web"
          ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
          : memoryLocalCache(),
    });
  } catch {
    // initializeFirestore throws if Firestore was already initialised for this
    // app (a second import, or a fast refresh). Falling back to the existing
    // instance is correct — the settings from the first call still apply.
    return getFirestore(app);
  }
})();

export const isFirebaseConfigured = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

// Analytics is a browser-only product: it reaches for window/document and
// throws on native. Load it lazily, on web, and only where the environment
// supports it — a failure here must never block sign-in.
export let analytics = null;

if (Platform.OS === "web") {
  import("firebase/analytics")
    .then(({ getAnalytics, isSupported }) =>
      isSupported().then((ok) => {
        if (ok) analytics = getAnalytics(app);
      })
    )
    .catch(() => {
      /* analytics unavailable — not worth surfacing */
    });
}
