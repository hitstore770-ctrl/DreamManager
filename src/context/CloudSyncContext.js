import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { NOTES_KEY } from "../utils/notesStore";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { pushSummary, useCloudCollection } from "../utils/cloudSync";
import { useAuth } from "./AuthContext";
import { usePersistentState } from "../utils/usePersistentState";

// The one place the cloud listeners live.
//
// Mounted once, above the navigator. That is deliberate: the collections it
// syncs are read by several screens, and a listener per screen would mean two
// snapshots racing to write the same key, plus a duplicate Firestore read
// charge every time a tab was visited.
//
// It renders nothing and owns no UI state. Screens keep reading the same
// AsyncStorage keys they always did, and never learn that any of this is here
// — which is the point. Cloud sync should be invisible until the network is
// gone, and then still invisible.

const CloudSyncContext = createContext({ status: "off", uid: null, lastSyncAt: null });

export function CloudSyncProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [lastSyncAt, setLastSyncAt] = useState(null);

  // Written out one per line rather than mapped over a list. A loop would work
  // today because the list is a module constant, but it makes the hook count
  // depend on an array — and the day someone filters that array, the hooks
  // change order and React starts handing one listener's state to another.
  useCloudCollection({ uid, name: "financial_logs", storageKey: STORAGE_KEYS.cashFlow });
  useCloudCollection({ uid, name: "sales", storageKey: STORAGE_KEYS.posSales });
  useCloudCollection({ uid, name: "notes", storageKey: NOTES_KEY });

  // The rolled-up totals. Derived here rather than in the dashboard so the
  // figure written to the cloud is the same one the screen shows, and so a
  // screen that is not mounted does not stop the summary being current.
  const [sales] = usePersistentState(STORAGE_KEYS.posSales, []);
  const [entries] = usePersistentState(STORAGE_KEYS.cashFlow, []);
  const lastWritten = useRef(null);

  useEffect(() => {
    if (!uid) return;

    const posSales = (sales || []).filter((r) => r.kind === "sale");
    const revenue = posSales.reduce((n, r) => n + (Number(r.total) || 0), 0);
    const cost = posSales.reduce((n, r) => n + (Number(r.cost) || 0) * (Number(r.qty) || 0), 0);
    const manualIncome = (entries || [])
      .filter((e) => e.kind === "income")
      .reduce((n, e) => n + (Number(e.amount) || 0), 0);
    const manualExpense = (entries || [])
      .filter((e) => e.kind === "expense")
      .reduce((n, e) => n + (Number(e.amount) || 0), 0);

    const totals = {
      revenue: revenue + manualIncome,
      cost: cost + manualExpense,
      netProfit: revenue + manualIncome - cost - manualExpense,
      saleCount: posSales.length,
      entryCount: (entries || []).length,
    };

    // Skip identical writes. Without this, every unrelated re-render bills a
    // Firestore write for a number that did not move.
    const signature = JSON.stringify(totals);
    if (signature === lastWritten.current) return;
    lastWritten.current = signature;

    pushSummary(uid, "financial_logs", "_totals", totals).then((ok) => {
      if (ok) setLastSyncAt(Date.now());
    });
  }, [uid, sales, entries]);

  const value = useMemo(
    () => ({ uid, status: uid ? "on" : "off", lastSyncAt }),
    [uid, lastSyncAt]
  );

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}

export function useCloudSync() {
  return useContext(CloudSyncContext);
}
