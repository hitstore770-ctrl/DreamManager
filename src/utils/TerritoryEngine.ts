// TerritoryEngine — the enriched Zone → Building → Floor → Room data tree
// for tactical micro-logistics. Replaces the plain building/floor/room
// strings AssignOrderModal (AgentsScreen.js) and agentOrders have used so
// far with an actual tree of nodes, each carrying operational metadata a
// dispatcher would want to know about a specific stop before sending an
// agent there.
//
// This is an enrichment layer, not a hard dependency: an order with no
// matching node in the tree still works exactly as before (findNodeByPath
// returns null, evaluateRouteConditions treats a null destination as "no
// restrictions"). Nothing here gates the existing flat building/floor/room
// entry — it only adds meaning when a matching node happens to exist.
//
// Persistence follows the same convention as every other piece of app state
// (see usePersistentState.js): a plain AsyncStorage-backed array, broadcast
// to every mounted holder. There is no separate global outside React — the
// "global tree state" is this hook, exactly like droneSaved or posInventory
// are "global" without a dedicated Context wrapping the app.

import { usePersistentState } from "./usePersistentState";
import { uid } from "./posStore";

export type NodeKind = "zone" | "building" | "floor" | "room";

// A plain string union rather than a TS `enum`: same closed set of values,
// no extra runtime object emitted, and it's what dropoffProtocol is compared
// against everywhere below anyway.
export type DropoffProtocol = "DOORSTEP" | "LOBBY" | "CALL_ONLY";

export interface TerritoryMetadata {
  // 1 (flat) – 10 (steep): how hard this stop is on a scooter's battery.
  elevationScore: number;
  // Free-text tags — "בור בכביש", "רמפה שבורה" — anything that jams a
  // vehicle or a route plan, not a fixed vocabulary.
  hazardFlags: string[];
  // True forces the POS to treat this stop as offline: sales still write to
  // local storage first (the app already does this for every sale — see
  // completeSale in PosRegisterTab.js) and the cloud push is understood to
  // be deferred rather than guaranteed, not a separate caching system.
  cellularDeadZone: boolean;
  // "HH:MM-HH:MM", wrapping past midnight allowed (e.g. "22:00-06:00").
  // Empty string = no curfew. Blocks *new* remote orders during that
  // window; it does not recall an order already in an agent's queue.
  curfewHours: string;
  // Gate/keypad code shown to an active agent en route. IMPORTANT: this is
  // stored as plain text in AsyncStorage, the same as every other field
  // here — there is no encryption at rest in this app. Treat this field as
  // sensitive-but-unencrypted, not as a secrets vault.
  gateCodes: string;
  // 1 = no surge. >1 = distance/difficulty tax, e.g. 1.15 = +15% on the
  // amount evaluateRouteConditions is asked to price against.
  surgeMultiplier: number;
  // A rival vendor is known to be active in this node's area.
  competitorPresence: boolean;
  // wa.me / chat.whatsapp.com community/broadcast link for this area.
  whatsAppCommunityLink: string;
  dropoffProtocol: DropoffProtocol;
  // Flags an open balcony/rooftop as viable for a future autonomous drone
  // drop. No drone integration exists yet — this is a data flag only.
  droneDropZone: boolean;
}

export interface TerritoryNode {
  id: string;
  kind: NodeKind;
  name: string;
  metadata: TerritoryMetadata;
  children: TerritoryNode[];
}

export const DEFAULT_METADATA: TerritoryMetadata = {
  elevationScore: 1,
  hazardFlags: [],
  cellularDeadZone: false,
  curfewHours: "",
  gateCodes: "",
  surgeMultiplier: 1,
  competitorPresence: false,
  whatsAppCommunityLink: "",
  dropoffProtocol: "DOORSTEP",
  droneDropZone: false,
};

export function makeNode(kind: NodeKind, name: string, metadata: Partial<TerritoryMetadata> = {}): TerritoryNode {
  return {
    id: `${kind}-${uid()}`,
    kind,
    name,
    metadata: { ...DEFAULT_METADATA, ...metadata },
    children: [],
  };
}

export function createZone(name: string, metadata?: Partial<TerritoryMetadata>): TerritoryNode {
  return makeNode("zone", name, metadata);
}
export function createBuilding(name: string, metadata?: Partial<TerritoryMetadata>): TerritoryNode {
  return makeNode("building", name, metadata);
}
export function createFloor(name: string, metadata?: Partial<TerritoryMetadata>): TerritoryNode {
  return makeNode("floor", name, metadata);
}
export function createRoom(name: string, metadata?: Partial<TerritoryMetadata>): TerritoryNode {
  return makeNode("room", name, metadata);
}

// Immutable insert — every branch on the path down to parentId is a new
// object, everything else keeps its old reference, the same shape every
// other piece of state in this app already updates in (setState never
// mutates in place, so usePersistentState's cross-hook broadcast always
// sees an actual new value).
export function addChild(tree: TerritoryNode[], parentId: string | null, child: TerritoryNode): TerritoryNode[] {
  if (parentId === null) return [...tree, child];
  return tree.map((node) => insertUnder(node, parentId, child));
}

function insertUnder(node: TerritoryNode, parentId: string, child: TerritoryNode): TerritoryNode {
  if (node.id === parentId) return { ...node, children: [...node.children, child] };
  if (node.children.length === 0) return node;
  return { ...node, children: node.children.map((c) => insertUnder(c, parentId, child)) };
}

export function updateNodeMetadata(
  tree: TerritoryNode[],
  nodeId: string,
  patch: Partial<TerritoryMetadata>
): TerritoryNode[] {
  return tree.map((node) => {
    if (node.id === nodeId) return { ...node, metadata: { ...node.metadata, ...patch } };
    if (node.children.length === 0) return node;
    return { ...node, children: updateNodeMetadata(node.children, nodeId, patch) };
  });
}

export function removeNode(tree: TerritoryNode[], nodeId: string): TerritoryNode[] {
  return tree
    .filter((node) => node.id !== nodeId)
    .map((node) => (node.children.length === 0 ? node : { ...node, children: removeNode(node.children, nodeId) }));
}

export function findNode(tree: TerritoryNode[], nodeId: string): TerritoryNode | null {
  for (const node of tree) {
    if (node.id === nodeId) return node;
    const found = findNode(node.children, nodeId);
    if (found) return found;
  }
  return null;
}

const norm = (s?: string | null): string => String(s ?? "").trim().toLowerCase();

// Bridges the plain building/floor/room strings AssignOrderModal has always
// collected to a tree node, by name, wherever in the tree a building with
// that name happens to sit — best-effort, not a foreign key. A miss (no
// building of that name anywhere in the tree yet) is the expected common
// case until territory data actually gets authored, and returns null rather
// than throwing.
export function findNodeByPath(
  tree: TerritoryNode[],
  building?: string,
  floor?: string,
  room?: string
): TerritoryNode | null {
  const buildingNode = findByName(tree, "building", building);
  if (!buildingNode) return null;
  if (!floor) return buildingNode;
  const floorNode = findByName(buildingNode.children, "floor", floor);
  if (!floorNode) return buildingNode;
  if (!room) return floorNode;
  const roomNode = findByName(floorNode.children, "room", room);
  return roomNode || floorNode;
}

function findByName(nodes: TerritoryNode[], kind: NodeKind, name?: string): TerritoryNode | null {
  const target = norm(name);
  if (!target) return null;
  for (const node of nodes) {
    if (node.kind === kind && norm(node.name) === target) return node;
    const nested = findByName(node.children, kind, name);
    if (nested) return nested;
  }
  return null;
}

// "HH:MM-HH:MM", wrapping past midnight (22:00-06:00 means active from
// 22:00 through 05:59 the next day). Malformed or empty input is "no
// curfew" rather than a thrown error — a typo in this field should degrade
// to "unrestricted," not brick order intake.
export function isCurfewActiveNow(curfewHours: string, at: Date = new Date()): boolean {
  const raw = (curfewHours || "").trim();
  if (!raw) return false;
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) return false;
  const startMin = Number(m[1]) * 60 + Number(m[2]);
  const endMin = Number(m[3]) * 60 + Number(m[4]);
  const nowMin = at.getHours() * 60 + at.getMinutes();
  if (startMin === endMin) return false;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
  // Wraps past midnight.
  return nowMin >= startMin || nowMin < endMin;
}

export interface RouteEvaluation {
  blocked: boolean;
  reason: string | null;
  surgeMultiplier: number;
  surgeAmount: number;
  surgeLabel: string | null;
}

// Fires when a new remote order is received (called from AssignOrderModal
// the moment the Admin hands a stop to an agent). `baseAmount` is whatever
// the surge tax should be computed against — omit it (or pass 0) to get
// just the multiplier and label back without a priced line item yet.
export function evaluateRouteConditions(
  destinationNode: TerritoryNode | null | undefined,
  baseAmount: number = 0
): RouteEvaluation {
  if (!destinationNode) {
    return { blocked: false, reason: null, surgeMultiplier: 1, surgeAmount: 0, surgeLabel: null };
  }
  const meta = destinationNode.metadata;

  if (isCurfewActiveNow(meta.curfewHours)) {
    return {
      blocked: true,
      reason: `משלוחים חסומים כרגע עקב שעות עוצר באזור (${meta.curfewHours})`,
      surgeMultiplier: 1,
      surgeAmount: 0,
      surgeLabel: null,
    };
  }

  const multiplier = Number(meta.surgeMultiplier) || 1;
  if (multiplier > 1) {
    const surgeAmount = baseAmount > 0 ? Math.round(baseAmount * (multiplier - 1) * 100) / 100 : 0;
    return {
      blocked: false,
      reason: null,
      surgeMultiplier: multiplier,
      surgeAmount,
      surgeLabel: `תוספת מרחק/קושי (×${multiplier})`,
    };
  }

  return { blocked: false, reason: null, surgeMultiplier: 1, surgeAmount: 0, surgeLabel: null };
}

// Never render a gate code verbatim in a place meant for a screenshot or a
// shared receipt (WhatsApp text, printed Z-report) — this is a display
// guard, not encryption; the underlying value in storage is still plain
// text.
export function redactGateCode(code?: string | null): string {
  const v = (code || "").trim();
  if (!v) return "";
  if (v.length <= 2) return "••";
  return `${v.slice(0, 1)}${"•".repeat(v.length - 2)}${v.slice(-1)}`;
}

const TERRITORY_STORAGE_KEY = "@dreammanager/territory-tree";

// The "global tree state" — every component calling this shares the same
// live value via usePersistentState's broadcast registry, no Context
// provider required (same pattern droneSaved/posInventory already use).
export function useTerritoryTree() {
  const [tree, setTree, loaded] = usePersistentState(TERRITORY_STORAGE_KEY, [] as TerritoryNode[]);
  return { tree: tree as TerritoryNode[], setTree, loaded };
}
