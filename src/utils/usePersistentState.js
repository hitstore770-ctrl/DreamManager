import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";

// Small helper: a useState that transparently loads from and saves to
// AsyncStorage. Used by the local utility tools (the core dream/coin data
// lives in Firestore; these device-side tools persist locally).
export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(initialValue);
  const [loaded, setLoaded] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(key);
        if (stored != null) {
          setValue(JSON.parse(stored));
        }
      } catch {
        // keep initial value
      } finally {
        hydrated.current = true;
        setLoaded(true);
      }
    })();
  }, [key]);

  useEffect(() => {
    if (hydrated.current) {
      AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
    }
  }, [key, value]);

  return [value, setValue, loaded];
}
