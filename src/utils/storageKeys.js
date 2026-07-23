// AsyncStorage keys for the local-only tools. Core app data (dreams, tasks,
// notes, coins) now lives in Cloud Firestore — see src/config/firebaseConfig.js.
export const STORAGE_KEYS = {
  receipts: "@dreammanager/receipts",
  shifts: "@dreammanager/shifts",
  money: "@dreammanager/money-entries",
  debts: "@dreammanager/debts",
  onTheWay: "@dreammanager/on-the-way",
  warehouse: "@dreammanager/warehouse",
  focusSettings: "@dreammanager/focus-settings",
  focusLog: "@dreammanager/focus-log",
};
