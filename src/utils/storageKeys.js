// AsyncStorage keys for the local-only tools. Core app data (dreams, tasks,
// notes, coins) now lives in Cloud Firestore — see src/config/firebaseConfig.js.
export const STORAGE_KEYS = {
  receipts: "@dreammanager/receipts",
  shifts: "@dreammanager/shifts",
};
