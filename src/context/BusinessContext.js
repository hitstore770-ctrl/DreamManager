import { createContext, useContext } from "react";

import { STORAGE_KEYS } from "../utils/storageKeys";
import { usePersistentState } from "../utils/usePersistentState";

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
        loaded: salesLoaded && invLoaded && debtsLoaded && closesLoaded,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  return useContext(BusinessContext);
}
