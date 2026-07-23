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
  routine: "@dreammanager/routine",
  calcTape: "@dreammanager/calc-tape",
  calcMemory: "@dreammanager/calc-memory",
  alarms: "@dreammanager/alarms",
  splitterTemplates: "@dreammanager/splitter-templates",
  splitterCurrent: "@dreammanager/splitter-current",
  snippets: "@dreammanager/snippets",
};
