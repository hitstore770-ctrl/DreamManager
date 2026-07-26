// Shared data helpers for the 9-tool business/POS suite. Every tool reads and
// writes the same AsyncStorage keys (via usePersistentState), so a sale rung up
// in the POS deducts from the same master inventory the Inventory, Profit
// Analyzer and Z-Report tools see. Since only one tool sheet is open at a time,
// persistence keeps them all in sync.

export const CATEGORIES = [
  { key: "electronics", label: "אלקטרוניקה", color: "#1B3A6B" },
  { key: "snacks", label: "חטיפים", color: "#F4B400" },
  { key: "print", label: "חומרי הדפסה", color: "#10B981" },
];

// Below this quantity an item is flagged low-stock (red border).
export const LOW_STOCK = 5;

export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function catOf(key) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[0];
}

// Local (not UTC) YYYY-MM-DD so day boundaries match the user's clock.
export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthKey(d = new Date()) {
  return todayKey(d).slice(0, 7);
}

// Currency symbol shown by shekel(). Driven by the Settings screen through
// SettingsProvider — a module flag rather than context, because shekel() is a
// plain function called from dozens of render paths.
let CURRENCY = "₪";

export function setCurrencySymbol(symbol) {
  CURRENCY = symbol || "₪";
}

export function currencySymbol() {
  return CURRENCY;
}

export function shekel(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const [int, dec] = String(Math.abs(v)).split(".");
  const sep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${v < 0 ? "-" : ""}${CURRENCY}${dec ? `${sep}.${dec}` : sep}`;
}

// Build a sale record from an inventory item.
export function makeSale(item, qty, price, kind = "sale", eventId = null) {
  const cost = Number(item.cost) || 0;
  const p = Number(price) || 0;
  return {
    id: uid(),
    ts: Date.now(),
    day: todayKey(),
    month: monthKey(),
    itemId: item.id,
    name: item.name,
    category: item.category,
    qty,
    price: p,
    cost,
    total: p * qty,
    profit: (p - cost) * qty,
    kind, // 'sale' | 'damage'
    eventId,
  };
}

// Deduct a sold quantity from inventory and return the updated array + sale.
export function applySale(inventory, itemId, qty, price, kind = "sale", eventId = null) {
  const item = inventory.find((i) => i.id === itemId);
  if (!item) return { inventory, sale: null };
  const updated = inventory.map((i) =>
    i.id === itemId ? { ...i, qty: Math.max(0, i.qty - qty), sold: (i.sold || 0) + qty } : i
  );
  return { inventory: updated, sale: makeSale(item, qty, price, kind, eventId) };
}

// Mark units as damaged/lost: deduct from stock, log a zero-revenue loss.
export function applyDamage(inventory, itemId, qty = 1) {
  const item = inventory.find((i) => i.id === itemId);
  if (!item) return { inventory, sale: null };
  const updated = inventory.map((i) =>
    i.id === itemId ? { ...i, qty: Math.max(0, i.qty - qty), damaged: (i.damaged || 0) + qty } : i
  );
  const sale = makeSale(item, qty, 0, "damage");
  return { inventory: updated, sale };
}

export function isLocked(lockedDays, day = todayKey()) {
  return Array.isArray(lockedDays) && lockedDays.includes(day);
}
