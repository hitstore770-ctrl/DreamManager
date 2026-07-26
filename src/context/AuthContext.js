import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { auth, db, isFirebaseConfigured } from "../config/firebaseConfig";
import { withTimeout } from "../utils/network";

const AuthContext = createContext(undefined);

// Read the user's saved coin balance from users/{uid}, seeding the doc on
// first sign-in. Falls back to 0 if Firestore is unreachable/unconfigured.
async function loadCoinsFromCloud(uid, email) {
  if (!isFirebaseConfigured) return 0;
  try {
    const userRef = doc(db, "users", uid);
    const snapshot = await withTimeout(getDoc(userRef));
    if (snapshot.exists() && typeof snapshot.data().coins === "number") {
      return snapshot.data().coins;
    }
    await withTimeout(setDoc(userRef, { coins: 0, email: email || null }, { merge: true }));
    return 0;
  } catch {
    return 0;
  }
}

async function persistCoins(uid, coins) {
  if (!isFirebaseConfigured) return;
  try {
    await withTimeout(setDoc(doc(db, "users", uid), { coins }, { merge: true }));
  } catch {
    // Best-effort: local state stays authoritative if the write fails.
  }
}

// Firebase user -> the shape the app screens already expect.
function shapeUser(fbUser, coins = 0) {
  return {
    uid: fbUser.uid,
    displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "משתמש",
    email: fbUser.email || null,
    photoURL: fbUser.photoURL || null,
    coins,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  // True until the first onAuthStateChanged fires, so the app can hold the
  // splash instead of flashing the login screen at an already-signed-in user.
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  // Guards the persist effect so we don't write coins:0 to the cloud before
  // the user's real balance has been fetched.
  const coinsHydrated = useRef(false);

  // --- The session listener: the single source of truth for "who is in" ---
  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      async (fbUser) => {
        if (!fbUser) {
          coinsHydrated.current = false;
          setUser(null);
          setAuthLoading(false);
          return;
        }
        // Show the app immediately; the balance arrives from Firestore after.
        setUser(shapeUser(fbUser));
        setAuthLoading(false);
        setIsAuthenticating(false);
        const coins = await loadCoinsFromCloud(fbUser.uid, fbUser.email);
        setUser((prev) => (prev ? { ...prev, coins } : prev));
        coinsHydrated.current = true;
      },
      () => setAuthLoading(false)
    );
    return unsub;
  }, []);

  // Mirror the coin balance up to Firestore whenever it changes.
  useEffect(() => {
    if (user && coinsHydrated.current) {
      persistCoins(user.uid, user.coins);
    }
  }, [user?.coins]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setIsAuthenticating(true);

    // The Firebase JS SDK's OAuth popup/redirect flows are browser-only — in
    // React Native there is no window to open. A native build needs an OAuth
    // client id and expo-auth-session, feeding the id token into
    // signInWithCredential; until that exists, say so instead of failing
    // silently.
    if (Platform.OS !== "web") {
      setIsAuthenticating(false);
      setAuthError(
        "כניסה עם Google זמינה כרגע בגרסת הדפדפן בלבד. לבנייה נייטיב צריך מזהה OAuth ו-expo-auth-session."
      );
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      // onAuthStateChanged takes it from here.
    } catch (err) {
      setIsAuthenticating(false);
      setAuthError(describeAuthError(err));
    }
  }, []);

  const logout = useCallback(async () => {
    coinsHydrated.current = false;
    try {
      await signOut(auth);
    } catch {
      // Even if the network call fails, drop the local session.
      setUser(null);
    }
  }, []);

  const addCoins = useCallback((amount) => {
    setUser((prev) => (prev ? { ...prev, coins: prev.coins + amount } : prev));
  }, []);

  const spendCoins = useCallback(
    (amount) => {
      if (!user || user.coins < amount) return false;
      setUser((prev) => ({ ...prev, coins: prev.coins - amount }));
      return true;
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticating,
      authLoading,
      authError,
      clearAuthError: () => setAuthError(null),
      signInWithGoogle,
      logout,
      addCoins,
      spendCoins,
    }),
    [user, isAuthenticating, authLoading, authError, signInWithGoogle, logout, addCoins, spendCoins]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Firebase error codes are not something to show a shop owner.
function describeAuthError(err) {
  const code = err?.code || "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "החלון נסגר לפני שהכניסה הושלמה.";
  }
  if (code === "auth/popup-blocked") {
    return "הדפדפן חסם את חלון הכניסה. אשר חלונות קופצים ונסה שוב.";
  }
  if (code === "auth/network-request-failed") {
    return "אין חיבור לרשת. בדוק את האינטרנט ונסה שוב.";
  }
  if (code === "auth/unauthorized-domain") {
    return "הדומיין הזה לא מורשה בפרויקט Firebase. הוסף אותו ב-Authentication → Settings → Authorized domains.";
  }
  if (code === "auth/operation-not-allowed") {
    return "כניסת Google לא מופעלת בפרויקט. הפעל אותה ב-Firebase → Authentication → Sign-in method.";
  }
  return `הכניסה נכשלה${code ? ` (${code})` : ""}. נסה שוב.`;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
