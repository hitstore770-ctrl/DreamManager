// Holds the derived Vault AES key in memory only -- never written to disk,
// never put in AsyncStorage, gone the moment the app backgrounds or the
// process restarts. Every screen that needs to read/write vault notes reads
// the key from here rather than re-deriving it or threading a PIN prop
// around.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

const VaultContext = createContext(null);

export function VaultProvider({ children }) {
  const [key, setKey] = useState(null);
  const keyRef = useRef(null);
  keyRef.current = key;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      // Backgrounding the app clears the in-memory key -- returning to it
      // always requires the PIN again, the same way a locked phone would.
      if (state !== "active" && keyRef.current) setKey(null);
    });
    return () => sub.remove();
  }, []);

  const value = useMemo(
    () => ({
      key,
      unlocked: key != null,
      unlock: (k) => setKey(k),
      lock: () => setKey(null),
    }),
    [key]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within a VaultProvider");
  return ctx;
}
