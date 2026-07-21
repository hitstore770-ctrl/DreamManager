import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // TODO: Replace with real Firebase Google Sign-In once GCP OAuth
  // credentials are configured. For now this simulates a network round
  // trip and signs in a mock user.
  const signInWithGoogle = () => {
    setIsAuthenticating(true);
    setTimeout(() => {
      setUser({
        uid: "mock-user-id",
        displayName: "יוסף",
        email: "yosef@example.com",
        photoURL: null,
        coins: 0,
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
