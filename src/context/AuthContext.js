import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { auth, db, isFirebaseConfigured } from "../config/firebaseConfig";
import { withTimeout } from "../utils/network";

const AuthContext = createContext(undefined);

// How long to wait for Firebase Auth before opening the app anyway.
//
// Auth is the one cloud call the entire UI is gated on, and it is a *listener*,
// not a promise — withTimeout() (utils/network.js) guards the Firestore reads
// below, but there is nothing here for it to wrap. When the backend is
// unreachable onAuthStateChanged can simply never fire, and signInAnonymously
// needs a live round-trip on every first launch, so it can stay pending
// forever without ever rejecting. AppNavigator holds a splash while authLoading
// is true, so "never answers" renders as a permanent spinner: the app looks
// dead rather than merely offline, and nothing reaches the console to say why.
//
// Deliberately shorter than withTimeout's 8s. Deciding early costs almost
// nothing — if auth turns up afterwards the listener still swaps in the real
// session — while every extra second is a blank screen someone is staring at
// on launch, at a counter, with a customer waiting.
const AUTH_TIMEOUT_MS = 6000;

// The session handed out when auth times out.
//
// uid is null rather than a fabricated id, and that is the important part:
// every cloud-sync call site is already guarded on user?.uid, so a session
// without one leaves the whole app usable against local storage while writing
// nothing to the cloud under an identity that does not exist. A made-up uid
// would file this device's sales under a junk document and split the ledger
// the moment real auth came back.
const OFFLINE_USER = {
  uid: null,
  displayName: "\u05de\u05e6\u05d1 \u05dc\u05d0 \u05de\u05e7\u05d5\u05d5\u05df",
  isAnonymous: true,
  email: null,
  photoURL: null,
  coins: 0,
  isOffline: true,
};

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
    isAnonymous: !!fbUser.isAnonymous,
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
  // Whether auth has reached a verdict yet — a real session, or the offline
  // fallback. Keeps the watchdog below from stepping on a session that landed
  // while it was still counting down.
  const settled = useRef(false);
  // Whether the session on screen is the offline placeholder rather than a real
  // one. Read by the listener so a late "nobody is signed in" callback cannot
  // evict someone who is already working.
  const offlineFallback = useRef(false);

  // --- The session listener: the single source of truth for "who is in" ---
  useEffect(() => {
    // Open the app on a local session rather than sit on the splash forever.
    // Reached whenever auth never produces an answer — see AUTH_TIMEOUT_MS.
    const failOpen = () => {
      if (settled.current) return;
      settled.current = true;
      offlineFallback.current = true;
      setUser((prev) => prev || OFFLINE_USER);
      setIsAuthenticating(false);
      setAuthLoading(false);
    };

    // The watchdog. Nothing below is guaranteed to call back at all, so this is
    // the only thing that makes the splash finite in every case.
    const watchdog = setTimeout(failOpen, AUTH_TIMEOUT_MS);

    const unsub = onAuthStateChanged(
      auth,
      async (fbUser) => {
        if (!fbUser) {
          coinsHydrated.current = false;
          // Nobody signed in — get an anonymous session going immediately
          // rather than showing a login wall. This fires once; the listener
          // runs again with the new user and takes the branch below.
          //
          // Offline this promise can hang rather than reject, so the catch is a
          // courtesy and the watchdog above is the actual guarantee.
          signInAnonymously(auth).catch(failOpen);
          return;
        }
        // A real session always wins — including one that arrives after the
        // watchdog already opened the app offline. This replaces that
        // placeholder and cloud sync resumes on its own, with no reload.
        settled.current = true;
        offlineFallback.current = false;
        clearTimeout(watchdog);
        // Show the app immediately; the balance arrives from Firestore after.
        setUser(shapeUser(fbUser));
        setAuthLoading(false);
        setIsAuthenticating(false);
        const coins = await loadCoinsFromCloud(fbUser.uid, fbUser.email);
        setUser((prev) => (prev ? { ...prev, coins } : prev));
        coinsHydrated.current = true;
      },
      // Listener error channel — auth answered, with a failure. Same verdict.
      failOpen
    );

    return () => {
      clearTimeout(watchdog);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (__DEV__ && !authLoading) {
      console.log("[startup] 3/3 auth settled", offlineFallback.current ? "(offline session)" : "(live session)");
    }
  }, [authLoading]);

  // Mirror the coin balance up to Firestore whenever it changes.
  useEffect(() => {
    if (user && coinsHydrated.current) {
      persistCoins(user.uid, user.coins);
    }
  }, [user?.coins]);

  // Sign in silently, with no screen and no decision to make.
  //
  // An anonymous account is still a real Firebase uid, so Firestore rules can
  // scope data to it and cloud backup works from the first launch. The cost is
  // worth stating plainly: the account lives in this install only. Clear the
  // app data or move to a new phone and that uid — and the cloud data behind
  // it — is gone. Firebase can later upgrade the same uid to a real credential
  // with linkWithCredential, which keeps everything already written.
  const signInAnon = useCallback(async () => {
    if (!isFirebaseConfigured) return;
    setAuthError(null);
    setIsAuthenticating(true);
    try {
      await signInAnonymously(auth);
      // onAuthStateChanged takes it from here.
    } catch (err) {
      setIsAuthenticating(false);
      setAuthError(describeAuthError(err));
    }
  }, []);

  const logout = useCallback(async () => {
    coinsHydrated.current = false;
    // Leaving offline mode deliberately, so the listener above is free to hand
    // this session back to a signed-out state. Cleared before the network call:
    // signing out has to work with the cloud unreachable too.
    offlineFallback.current = false;
    setUser(null);
    try {
      await signOut(auth);
    } catch {
      // The local session is already dropped above; nothing more to undo.
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
      signInAnon,
      logout,
      addCoins,
      spendCoins,
    }),
    [user, isAuthenticating, authLoading, authError, signInAnon, logout, addCoins, spendCoins]
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
