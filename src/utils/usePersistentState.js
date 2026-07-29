import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

// A useState that transparently loads from and saves to AsyncStorage — and
// that every other holder of the same key hears about.
//
// The shared registry is not a nicety. Two things depend on it:
//
//   • A Firestore snapshot arriving from another device has to reach screens
//     that are already mounted. Writing to AsyncStorage alone would leave the
//     open screen showing yesterday's numbers until it happened to remount.
//   • Two components on one key used to drift. The register and the money
//     dashboard both read the sales list; before this, each held a private
//     copy and a sale rung up on one tab did not appear on the other.
//
// The registry keeps them in step without pushing this data into a context
// that every screen would then have to be wrapped in.

const listeners = new Map(); // key -> Set<fn>
const cache = new Map(); // key -> last known value

function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key)?.delete(fn);
}

function broadcast(key, value, exclude) {
  cache.set(key, value);
  listeners.get(key)?.forEach((fn) => {
    if (fn !== exclude) fn(value);
  });
}

/**
 * Write a key from outside React — the path a cloud snapshot takes in.
 *
 * Persists and notifies every mounted hook on that key, so remote changes
 * land on screen without a remount.
 */
export async function writePersistent(key, value) {
  cache.set(key, value);
  broadcast(key, value);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local state stays authoritative if the disk write fails.
  }
}

export async function readPersistent(key, fallback = null) {
  if (cache.has(key)) return cache.get(key);
  try {
    const stored = await AsyncStorage.getItem(key);
    const value = stored != null ? JSON.parse(stored) : fallback;
    cache.set(key, value);
    return value;
  } catch {
    return fallback;
  }
}

export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => (cache.has(key) ? cache.get(key) : initialValue));
  const [loaded, setLoaded] = useState(cache.has(key));
  const hydrated = useRef(cache.has(key));
  const selfRef = useRef(null);

  useEffect(() => {
    let alive = true;

    // Hearing our own broadcast would re-set state we just set, so the
    // listener identity is excluded from its own notifications.
    const onExternal = (next) => {
      if (!alive) return;
      hydrated.current = true;
      setValue(next);
    };
    selfRef.current = onExternal;
    const unsub = subscribe(key, onExternal);

    (async () => {
      if (cache.has(key)) {
        hydrated.current = true;
        setLoaded(true);
        return;
      }
      try {
        const stored = await AsyncStorage.getItem(key);
        if (alive && stored != null) {
          const parsed = JSON.parse(stored);
          cache.set(key, parsed);
          setValue(parsed);
        }
      } catch {
        // keep initial value
      } finally {
        if (alive) {
          hydrated.current = true;
          setLoaded(true);
        }
      }
    })();

    return () => {
      alive = false;
      unsub();
    };
  }, [key]);

  // Wrapped so a local update persists *and* reaches the other holders. The
  // updater form has to be resolved here rather than passed on, since the
  // other holders need the resulting value, not the function.
  const set = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (hydrated.current) {
          cache.set(key, resolved);
          broadcast(key, resolved, selfRef.current);
          AsyncStorage.setItem(key, JSON.stringify(resolved)).catch(() => {});
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, set, loaded];
}
