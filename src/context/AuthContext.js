import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { STORAGE_KEYS } from "../utils/storageKeys";

const AuthContext = createContext(undefined);

async function loadPersistedCoins() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.coins);
    return stored != null ? Number(stored) || 0 : 0;
  } catch {
    return 0;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Persist the coin balance whenever it changes so it survives app restarts.
  // (Coins live on the user object; the effect only runs while signed in.)
  useEffect(() => {
    if (user) {
      AsyncStorage.setItem(STORAGE_KEYS.coins, String(user.coins)).catch(() => {});
    }
  }, [user?.coins]);

  // TODO: Replace with real Firebase Google Sign-In once GCP OAuth
  // credentials are configured. For now this simulates a network round
  // trip and signs in a mock user, seeding the coin balance from storage.
  const signInWithGoogle = () => {
    setIsAuthenticating(true);
    setTimeout(async () => {
      const coins = await loadPersistedCoins();
      setUser({
        uid: "mock-user-id",
        displayName: "יוסף",
        email: "yosef@example.com",
        photoURL: null,
        coins,
      });
      setIsAuthenticating(false);
    }, 1000);
  };

  const logout = () => {
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
