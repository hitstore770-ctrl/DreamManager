import { doc, getDoc, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { db, isFirebaseConfigured } from "../config/firebaseConfig";
import { withTimeout } from "../utils/network";

const AuthContext = createContext(undefined);

const MOCK_USER = {
  uid: "mock-user-id",
  displayName: "יוסף",
  email: "yosef@example.com",
  photoURL: null,
};

// Read the user's saved coin balance from users/{uid}, seeding the doc on
// first sign-in. Falls back to 0 if Firestore is unreachable/unconfigured.
async function loadCoinsFromCloud(uid) {
  if (!isFirebaseConfigured) return 0;
  try {
    const userRef = doc(db, "users", uid);
    const snapshot = await withTimeout(getDoc(userRef));
    if (snapshot.exists() && typeof snapshot.data().coins === "number") {
      return snapshot.data().coins;
    }
    await setDoc(userRef, { coins: 0, email: MOCK_USER.email }, { merge: true });
    return 0;
  } catch {
    return 0;
  }
}

async function persistCoins(uid, coins) {
  if (!isFirebaseConfigured) return;
  try {
    await setDoc(doc(db, "users", uid), { coins }, { merge: true });
  } catch {
    // Best-effort: local state stays authoritative if the write fails.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  // Guards the persist effect so we don't write coins:0 to the cloud before
  // the user's real balance has been fetched.
  const coinsHydrated = useRef(false);

  // Mirror the coin balance up to Firestore whenever it changes.
  useEffect(() => {
    if (user && coinsHydrated.current) {
      persistCoins(user.uid, user.coins);
    }
  }, [user?.coins]);

  // TODO: Replace with real Firebase Google Sign-In once GCP OAuth
  // credentials are configured. For now this simulates a network round
  // trip, signs the user in immediately, then restores their coins from
  // Firestore in the background (so login never blocks on the cloud).
  const signInWithGoogle = () => {
    setIsAuthenticating(true);
    setTimeout(() => {
      coinsHydrated.current = false;
      setUser({ ...MOCK_USER, coins: 0 });
      setIsAuthenticating(false);

      loadCoinsFromCloud(MOCK_USER.uid).then((coins) => {
        setUser((prev) => (prev ? { ...prev, coins } : prev));
        coinsHydrated.current = true;
      });
    }, 1000);
  };

  const logout = () => {
    coinsHydrated.current = false;
    setUser(null);
  };

  const addCoins = (amount) => {
    setUser((prev) => (prev ? { ...prev, coins: prev.coins + amount } : prev));
  };

  const spendCoins = (amount) => {
    if (!user || user.coins < amount) {
      return false;
    }
    setUser((prev) => ({ ...prev, coins: prev.coins - amount }));
    return true;
  };

  const value = useMemo(
    () => ({ user, isAuthenticating, signInWithGoogle, logout, addCoins, spendCoins }),
    [user, isAuthenticating]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
