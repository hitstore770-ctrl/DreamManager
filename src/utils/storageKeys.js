// AsyncStorage keys for the local business/POS toolkit. Core app data (dreams,
// tasks, notes, coins) lives in Cloud Firestore — see firebaseConfig.js.
// All nine tools share this small set of keys so they interoperate (a sale in
// the POS deducts from the same inventory the Profit Analyzer reads, etc.).
export const STORAGE_KEYS = {
  posInventory: "@dreammanager/pos-inventory",
  posSales: "@dreammanager/pos-sales",
  posDebts: "@dreammanager/pos-debts",
  posSuppliers: "@dreammanager/pos-suppliers",
  posSavings: "@dreammanager/pos-savings",
  posEvents: "@dreammanager/pos-events",
  posLockedDays: "@dreammanager/pos-locked-days",
  posRegisterCloses: "@dreammanager/pos-register-closes",
};
