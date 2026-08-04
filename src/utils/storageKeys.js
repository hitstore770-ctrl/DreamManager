// AsyncStorage keys for the local business/POS toolkit. Core app data (dreams,
// tasks, notes, coins) lives in Cloud Firestore — see firebaseConfig.js.
// All nine tools share this small set of keys so they interoperate (a sale in
// the POS deducts from the same inventory the Profit Analyzer reads, etc.).
export const STORAGE_KEYS = {
  noaShortcuts: "@noa_shortcuts",
  cashFlow: "@cash_flow_entries",
  posInventory: "@dreammanager/pos-inventory",
  posSales: "@dreammanager/pos-sales",
  posDebts: "@dreammanager/pos-debts",
  posSuppliers: "@dreammanager/pos-suppliers",
  posSavings: "@dreammanager/pos-savings",
  posEvents: "@dreammanager/pos-events",
  posLockedDays: "@dreammanager/pos-locked-days",
  posRegisterCloses: "@dreammanager/pos-register-closes",
  posPromos: "@dreammanager/pos-promos",
  deliveryStops: "@dreammanager/delivery-stops",
  toolFavorites: "@dreammanager/tool-favorites",
  savingsBalance: "@dreammanager/savings-balance",
  savingsGoal: "@dreammanager/savings-goal",
  savingsHistory: "@dreammanager/savings-history",
  ravKavBalance: "@dreammanager/ravkav-balance",
  ravKavHistory: "@dreammanager/ravkav-history",
  moneyPiggy: "@dreammanager/money-piggy",
  moneyWallet: "@dreammanager/money-wallet",
  moneyLiquid: "@dreammanager/money-liquid",
  moneyDeposits: "@dreammanager/money-deposits",
  moneyLedger: "@dreammanager/money-ledger",
  // Same key text MoneyDashboardScreen.js already used inline — named here so
  // completeSale (PosRegisterTab.js) can write to the exact goal the
  // dashboard reads, without either file guessing the other's string.
  droneGoal: "@dreammanager/drone-goal",
  droneSaved: "@dreammanager/drone-saved",
  // How much of today's profit auto-swept to the goal already, so the
  // dashboard's manual allocation card offers what's left rather than
  // double-counting. Resets on day change, same convention as dailyAlloc.
  droneAutoDaily: "@dreammanager/drone-auto-daily",
  loyaltyCustomers: "@dreammanager/loyalty-customers",
  // Sub-agent franchise ecosystem: profiles, their isolated "virtual backpack"
  // inventory subset, the immutable sensitive-action log, and which agent (if
  // any) is currently operating the register.
  agents: "@dreammanager/agents",
  agentInventory: "@dreammanager/agent-inventory",
  agentAuditLog: "@dreammanager/agent-audit-log",
  activeAgentId: "@dreammanager/active-agent-id",
  // Remote delivery tasks the Admin hands an agent — Building/Floor/Room, not
  // a street address, same micro-local unit DeliveryScreen.js uses.
  agentOrders: "@dreammanager/agent-orders",
};
