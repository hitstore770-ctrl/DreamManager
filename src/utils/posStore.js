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

// Cost-plus retail suggestion for the Add/Edit Product form. `pct` is applied
// as markup on the landed cost (cost + shipping), not margin on the eventual
// price — "+40%" reads as "cost plus 40%," and this app already has a
// dedicated tool (MarkupVsMargin) built around keeping those two numbers from
// being silently swapped, so the quick-suggestion buttons stay consistent
// with it rather than inventing a second convention.
export function suggestRetailPrice(costBasis, pct) {
  const c = Number(costBasis) || 0;
  if (c <= 0) return 0;
  return Math.round(c * (1 + pct / 100) * 100) / 100;
}

// Cross-sell hints: name-based rather than sku-based, so the same pairing
// logic covers a deck tile, a scanned barcode, and a hand-typed inventory
// item alike — none of which share an id scheme with each other.
const CROSS_SELL_HINTS = [
  { match: /פאוור בנק|power ?bank/i, suggestion: "כבל טעינה", icon: "zap" },
  { match: /אוזניות|earbuds|buds/i, suggestion: "מטען מהיר", icon: "zap" },
  { match: /עכבר|mouse/i, suggestion: "מפצל USB", icon: "share-2" },
  { match: /כיסוי|case/i, suggestion: "מגן מסך", icon: "shield" },
  { match: /טלפון|phone/i, suggestion: "מעמד לטלפון", icon: "smartphone" },
];

// Returns a suggestion object for `itemName`, or null — and null also when
// the suggested product is already sitting in the cart, so the toast never
// nags for something the customer is already buying.
export function crossSellSuggestion(itemName, cartItemNames = []) {
  const hint = CROSS_SELL_HINTS.find((h) => h.match.test(itemName));
  if (!hint) return null;
  const already = cartItemNames.some((n) => n.includes(hint.suggestion));
  if (already) return null;
  return hint;
}

// A clean, WhatsApp-ready text catalog of everything currently in stock.
// Out-of-stock lines are left out on purpose — a customer tapping "is this
// available?" on a sold-out line is the exact friction this exists to avoid.
export function buildCatalogText(inventory) {
  const inStock = (inventory || []).filter((i) => (i.qty || 0) > 0);
  if (inStock.length === 0) return "";
  const lines = inStock.map((i) => `🔥 ${i.name} - ${shekel(i.price || 0)}`).join("\n");
  return `📦 הקטלוג שלנו\n\n${lines}\n\nלהזמנות, כתבו לנו כאן! 📩`;
}
