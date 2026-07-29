import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { forms, normalize } from "./orderParser";

// What things cost to buy — the COGS ledger Noa writes to.
//
// She fills this in conversationally: "the cables cost me 4.20 each" becomes a
// saveItemCost call, and the register reads it back at checkout to work out
// what a sale actually earned. That is the whole point of the loop — a price
// list without costs can only ever report revenue, and revenue is the number
// that feels good rather than the one that matters.
//
// Two consumers with different needs, which is why this is a module and not a
// hook: NoaTools writes from outside React entirely, and the cart reads inside
// it. The in-memory cache plus listeners is what closes that gap — a cost Noa
// saves mid-conversation shows up in an already-open cart without a reload.

const KEY = "@dreammanager/item-costs";

let cache = null;
let loading = null;
const listeners = new Set();

function announce() {
  listeners.forEach((fn) => fn(cache));
}

export async function loadCosts() {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        cache = raw ? JSON.parse(raw) : {};
      } catch {
        cache = {};
      }
      return cache;
    })();
  }
  return loading;
}

/**
 * Record what one item costs to acquire.
 *
 * Keyed on the normalised name rather than the raw string, so "כבלים",
 * "כבל" and "כבל " all land on one entry instead of three that each look
 * right on their own. The original spelling is kept alongside for display.
 */
export async function saveCost(name, cost) {
  const clean = String(name || "").trim();
  const value = Number(cost);

  if (!clean) return { ok: false, error: "NO_NAME", message: "An item name is required." };
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: "BAD_COST", message: `"${cost}" is not a usable cost. Give a non-negative number.` };
  }

  await loadCosts();
  const key = normalize(clean).toLowerCase();
  const previous = cache[key]?.cost ?? null;

  cache = { ...cache, [key]: { name: clean, cost: value, at: Date.now() } };

  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    return { ok: false, error: "WRITE_FAILED", message: String(e?.message || e) };
  }

  announce();
  return { ok: true, name: clean, cost: value, previousCost: previous, stored: Object.keys(cache).length };
}

export async function allCosts() {
  return { ...(await loadCosts()) };
}

/**
 * The cost recorded for an item name, or null.
 *
 * Null is deliberately distinct from zero. "I have never been told what this
 * costs" and "this costs nothing" produce very different profit figures, and
 * collapsing them would make an unpriced cart look like pure margin.
 */
// Product names are phrases, not words — "כבל USB-C", "מטען מהיר 20W" — so
// matching has to happen per word. Comparing the whole string means a cost
// saved against "כבל USB-C" is never found by a cart line reading "כבלים",
// which is the single most likely way for a cost to be entered and then not
// used.
function wordForms(text) {
  return String(text || "")
    .split(/\s+/)
    .map((w) => w.replace(/[^֐-׿a-zA-Z0-9]/g, ""))
    .filter((w) => w.length > 1)
    .map(forms);
}

const shares = (a, b) => {
  for (const f of a) if (b.has(f)) return true;
  return false;
};

export function costFor(costs, name) {
  if (!costs || !name) return null;

  const key = normalize(String(name)).toLowerCase();
  if (costs[key]) return costs[key].cost;

  // Otherwise the best word-overlap wins, using the same Hebrew form matching
  // the order parser uses. Best rather than first: with "כבל" and "כבל USB-C"
  // both on file, whichever happened to be stored earlier should not decide.
  const want = wordForms(name);
  if (!want.length) return null;

  let best = null;
  let bestHits = 0;
  for (const entry of Object.values(costs)) {
    const have = wordForms(entry.name);
    const hits = want.filter((w) => have.some((h) => shares(w, h))).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = entry;
    }
  }
  return best ? best.cost : null;
}

// The costs, kept current. Re-renders when Noa writes a new one.
export function useItemCosts() {
  const [costs, setCosts] = useState(cache || {});

  useEffect(() => {
    let alive = true;
    const fn = (next) => alive && setCosts({ ...next });
    listeners.add(fn);
    loadCosts().then((loaded) => alive && setCosts({ ...loaded }));
    return () => {
      alive = false;
      listeners.delete(fn);
    };
  }, []);

  return costs;
}
