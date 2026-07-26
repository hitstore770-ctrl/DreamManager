import { createContext, useContext, useEffect } from "react";

import { STORAGE_KEYS } from "../utils/storageKeys";
import { usePersistentState } from "../utils/usePersistentState";

// Starter promo bundles, seeded once on first run (store starts as null).
// Seeding happens here — not in the Promos screen — so the POS shows the
// gold promo chips even if the Promos module was never opened.
export const DEFAULT_PROMOS = [
  { id: "promo-night", name: "מארז לילה: 2 חטיפים + פחית", price: 20, emoji: "🌙", active: true },
  { id: "promo-sixpack", name: "מארז 6 פחיות + חטיף", price: 35, emoji: "📦", active: true },
];

// Single source of truth for the business data while the "My Business" tab is
// mounted. All sub-modules (POS, Warehouse, Z-report, tools sheet) read and
// write through this one pair of hooks — separate usePersistentState instances
// per module would silently desync while several modules stay mounted.
const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const [sales, setSales, salesLoaded] = usePersistentState(STORAGE_KEYS.posSales, []);
  const [inventory, setInventory, invLoaded] = usePersistentState(STORAGE_KEYS.posInventory, []);
  // Customer credit tabs (הקפות) — legacy shape {id, name, owed, paid}.
  const [debts, setDebts, debtsLoaded] = usePersistentState(STORAGE_KEYS.posDebts, []);
  // Register-close archive: [{id, day, ts, revenue, txCount, units, topItem}].
  const [closes, setCloses, closesLoaded] = usePersistentState(STORAGE_KEYS.posRegisterCloses, []);
  // Promo bundles: [{id, name, price, emoji, active}]. null until first seed.
  const [promos, setPromos, promosLoaded] = usePersistentState(STORAGE_KEYS.posPromos, null);
  useEffect(() => {
    if (promosLoaded && promos === null) setPromos(DEFAULT_PROMOS);
  }, [promosLoaded, promos]);

  return (
    <BusinessContext.Provider
      value={{
        sales,
        setSales,
        inventory,
        setInventory,
        debts,
        setDebts,
        closes,
        setCloses,
        promos,
        setPromos,
        loaded: salesLoaded && invLoaded && debtsLoaded && closesLoaded && promosLoaded,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  return useContext(BusinessContext);
}
