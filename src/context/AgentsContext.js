import { createContext, useContext } from "react";

import { STORAGE_KEYS } from "../utils/storageKeys";
import { usePersistentState } from "../utils/usePersistentState";

// The franchise layer on top of BusinessContext. Kept as its own provider
// rather than folded into BusinessContext: sub-agents are an optional
// upgrade a solo operator never touches, and every existing screen that
// destructures useBusiness() should keep working unchanged whether or not
// this provider is even mounted above it.
//
// Shapes:
//   agent            {id, name, commissionType: 'pct'|'flat', commissionValue,
//                      commissionEarned, commissionAtLastHandover, commissionGoal,
//                      lastHandoverAt, createdAt}
//                      `commissionEarned` is a lifetime running total; the
//                      *shift's* commission (what the Live Commission Bar and
//                      the Close-Shift math show) is always the difference
//                      between it and the snapshot taken at the last handover
//                      — one authoritative number, never recomputed twice.
//   agent inventory  {id, agentId, itemId, name, category, qty, cost, price,
//                      sku, barcode} — one row per (agent, item) pair, the
//                      "virtual backpack." Separate from posInventory so a
//                      transfer never has to touch the main warehouse rows.
//   agent order      {id, agentId, building, floor, room, status:
//                      'pending'|'notified'|'done', createdAt, notifiedAt,
//                      deliveredAt} — a remote delivery task the Admin hands
//                      an agent, addressed the same Building/Floor/Room way
//                      DeliveryScreen.js does.
//   audit log entry  {id, ts, agentId, agentName, action, detail} — append
//                      only, never edited or removed by the app itself.
const AgentsContext = createContext(null);

export function AgentsProvider({ children }) {
  const [agents, setAgents, agentsLoaded] = usePersistentState(STORAGE_KEYS.agents, []);
  const [agentInventory, setAgentInventory, invLoaded] = usePersistentState(STORAGE_KEYS.agentInventory, []);
  const [auditLog, setAuditLog, auditLoaded] = usePersistentState(STORAGE_KEYS.agentAuditLog, []);
  const [agentOrders, setAgentOrders, ordersLoaded] = usePersistentState(STORAGE_KEYS.agentOrders, []);
  // null = the Main Admin is operating the register directly.
  const [activeAgentId, setActiveAgentId, activeLoaded] = usePersistentState(STORAGE_KEYS.activeAgentId, null);

  return (
    <AgentsContext.Provider
      value={{
        agents,
        setAgents,
        agentInventory,
        setAgentInventory,
        auditLog,
        setAuditLog,
        agentOrders,
        setAgentOrders,
        activeAgentId,
        setActiveAgentId,
        loaded: agentsLoaded && invLoaded && auditLoaded && ordersLoaded && activeLoaded,
      }}
    >
      {children}
    </AgentsContext.Provider>
  );
}

export function useAgents() {
  return useContext(AgentsContext);
}
