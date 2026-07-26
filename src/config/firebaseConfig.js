import { Platform } from "react-native";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase web SDK. Chosen over @react-native-firebase because it runs in the
// Expo web preview and in a plain APK without a custom dev client.
//
// These values are not secrets — a Firebase web config is public by design and
// ships inside every client bundle. What actually protects the data is the
// Firestore security rules on the project, which must be locked to
// `request.auth.uid` before this holds real customer data.

const firebaseConfig = {
  apiKey: "AIzaSyDjVNEV0W6ejuHN-aXUu6NjpyUUnjPfGxM",
  authDomain: "givad-ceced.firebaseapp.com",
  databaseURL: "https://givad-ceced-default-rtdb.firebaseio.com",
  projectId: "givad-ceced",
  storageBucket: "givad-ceced.firebasestorage.app",
  messagingSenderId: "860004540516",
  appId: "1:860004540516:web:aa13789edd08e6811d3f71",
  measurementId: "G-HD3SVYBT2N",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const isFirebaseConfigured = true;

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
