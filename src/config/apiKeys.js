import { Platform } from "react-native";

// API keys entered in Settings, held in the device keystore.
//
// WHY THIS EXISTS AT ALL
// ----------------------
// The EXPO_PUBLIC_* variables are inlined into the JavaScript bundle at build
// time, which means they ship inside the APK where anyone can read them. A key
// typed into Settings instead is strictly better: it never enters the bundle,
// it can be rotated without a rebuild, and on a device that has one it lands
// in hardware-backed storage.
//
// HOW SECURE, EXACTLY
// -------------------
// expo-secure-store is the iOS Keychain and Android EncryptedSharedPreferences
// (Keystore-backed). That protects the key at rest from other apps and from
// someone reading the filesystem — it does not protect it from someone who has
// the unlocked phone and can open this screen, and it does not stop the key
// being sent to Google or OpenAI in a request, which is the whole point of
// having it. It is not a vault; it is the right drawer.
//
// On **web** there is no keystore. expo-secure-store falls back to
// localStorage, which is plaintext and readable by any script on the origin.
// The UI says so rather than showing the same lock icon on both platforms.
//
// Resolution order, highest first:
//   1. A key saved in Settings (this store)
//   2. EXPO_PUBLIC_* from the build
//   3. Nothing — the feature reports itself unconfigured
//
// The cache is what makes this usable from a plain function: callGemini is not
// a hook and cannot await a keystore read on every request, so the values are
// loaded once at startup and kept in memory.

let SecureStore = null;
try {
  // eslint-disable-next-line global-require
  SecureStore = require("expo-secure-store");
} catch {
  SecureStore = null;
}

// expo-secure-store ships no web implementation at all — its web module is an
// empty object, so calling setItemAsync/getItemAsync/deleteItemAsync there
// throws rather than degrading. The store used below is what "falls back to
// localStorage on web" actually requires: a real localStorage-backed
// implementation on web, and the true keystore everywhere else.
const store =
  Platform.OS === "web"
    ? {
        getItemAsync: async (k) => {
          try {
            return window.localStorage.getItem(k);
          } catch {
            return null;
          }
        },
        setItemAsync: async (k, v) => {
          window.localStorage.setItem(k, v);
        },
        deleteItemAsync: async (k) => {
          window.localStorage.removeItem(k);
        },
      }
    : SecureStore;

export const KEY_SLOTS = {
  gemini: {
    id: "gemini",
    storeKey: "dm_key_gemini",
    label: "Gemini",
    hint: "נועה, הצ׳אט והתובנות",
    env: process.env.EXPO_PUBLIC_GEMINI_API_KEY || "",
    placeholder: "AIza…",
  },
  openai: {
    id: "openai",
    storeKey: "dm_key_openai",
    label: "OpenAI Whisper",
    hint: "הכתבה קולית",
    env: process.env.EXPO_PUBLIC_OPENAI_API_KEY || "",
    placeholder: "sk-…",
  },
  google: {
    id: "google",
    storeKey: "dm_key_google",
    label: "Google Maps",
    hint: "מסלולים, תחבורה ומקומות",
    env: process.env.EXPO_PUBLIC_GOOGLE_SERVICES_KEY || "",
    placeholder: "AIza…",
  },
};

const overrides = {};
let loading = null;
const listeners = new Set();

// Placeholders the .env carried before anything was set. Treated as absent, so
// a stale "YOUR_..." never counts as a configured key.
const isPlaceholder = (v) => !v || /^YOUR_/i.test(v.trim());

export async function loadApiKeys() {
  if (!loading) {
    loading = (async () => {
      if (!store) return overrides;
      await Promise.all(
        Object.values(KEY_SLOTS).map(async (slot) => {
          try {
            const v = await store.getItemAsync(slot.storeKey);
            if (v) overrides[slot.id] = v;
          } catch {
            // No keystore on this platform/build. The env value still applies.
          }
        })
      );
      return overrides;
    })();
  }
  return loading;
}

/**
 * The key to use for a slot right now, or "" if there is none.
 *
 * Synchronous on purpose — every caller is a plain request function, and an
 * async read per request would put a keystore round-trip on the hot path.
 */
export function apiKey(id) {
  const slot = KEY_SLOTS[id];
  if (!slot) return "";
  const saved = overrides[id];
  if (!isPlaceholder(saved)) return saved.trim();
  return isPlaceholder(slot.env) ? "" : slot.env.trim();
}

export function hasApiKey(id) {
  return apiKey(id).length > 0;
}

/** Where the active key came from, for the Settings row to report honestly. */
export function keySource(id) {
  const slot = KEY_SLOTS[id];
  if (!slot) return "none";
  if (!isPlaceholder(overrides[id])) return "saved";
  if (!isPlaceholder(slot.env)) return "env";
  return "none";
}

export async function saveApiKey(id, value) {
  const slot = KEY_SLOTS[id];
  if (!slot) return { ok: false, error: "unknown-slot" };

  const clean = String(value || "").trim();
  await loadApiKeys();

  try {
    if (!clean) {
      delete overrides[id];
      if (store) await store.deleteItemAsync(slot.storeKey);
    } else {
      overrides[id] = clean;
      if (store) await store.setItemAsync(slot.storeKey, clean);
    }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }

  listeners.forEach((fn) => fn());
  return { ok: true, source: keySource(id) };
}

export function onApiKeysChanged(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Never render a key in full. Enough characters to recognise which key is
// installed, not enough to copy it off a shoulder or a screenshot.
export function maskKey(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (v.length <= 8) return "•".repeat(v.length);
  return `${v.slice(0, 4)}${"•".repeat(Math.min(12, v.length - 8))}${v.slice(-4)}`;
}

// True where the store is a real keystore rather than localStorage.
export const SECURE_STORE_AVAILABLE = !!SecureStore && Platform.OS !== "web";
