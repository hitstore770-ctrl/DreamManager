import { shekel, todayKey } from "./posStore";

// Daily aggregation for the Z-report. "Closing the register" archives a close
// record with a timestamp; everything here aggregates only records AFTER the
// last close of the day, so the live view resets to zero on close while the
// underlying sales ledger stays intact.

// Timestamp of the most recent register close today (0 if none).
export function lastCloseTs(closes, d = new Date()) {
  const day = todayKey(d);
  return (closes || []).reduce((m, c) => (c.day === day && c.ts > m ? c.ts : m), 0);
}

export function aggregateDay(sales, d = new Date(), sinceTs = 0) {
  const day = todayKey(d);
  const todays = (sales || []).filter((r) => r.day === day && (r.ts || 0) > sinceTs);
  const sold = todays.filter((r) => r.kind !== "damage");
  const damages = todays.filter((r) => r.kind === "damage");

  const revenue = sold.reduce((s, r) => s + (r.total || 0), 0);
  const txCount = new Set(sold.map((r) => r.eventId || r.id)).size;

  // Discount lines are negative — they count toward revenue but are excluded
  // from unit counts and the top-seller ranking.
  const positive = sold.filter((r) => (r.total || 0) >= 0);
  const units = positive.reduce((s, r) => s + (r.qty || 0), 0);
  const byName = new Map();
  for (const r of positive) {
    const cur = byName.get(r.name) || { qty: 0, total: 0 };
    byName.set(r.name, { qty: cur.qty + r.qty, total: cur.total + r.total });
  }
  const top = [...byName.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, v]) => ({ name, ...v }));

  const dmgUnits = damages.reduce((s, r) => s + (r.qty || 0), 0);
  return { revenue, txCount, units, top, dmgUnits };
}

// WhatsApp-friendly shareable summary (emoji headers, short lines).
export function buildZReportText(sales, d = new Date(), sinceTs = 0) {
  const { revenue, txCount, units, top, dmgUnits } = aggregateDay(sales, d, sinceTs);

  const lines = [
    `🧾 דוח Z — ${d.toLocaleDateString("he-IL")}`,
    "━━━━━━━━━━━━━━",
    `💰 פדיון היום: ${shekel(revenue)}`,
    `🧺 עסקאות: ${txCount}`,
    `📦 פריטים שנמכרו: ${units}`,
  ];
  const topLines = top
    .slice(0, 5)
    .map((t) => `  • ${t.name} ×${t.qty} — ${shekel(t.total)}`)
    .join("\n");
  if (topLines) lines.push("", "מובילים:", topLines);
  if (dmgUnits > 0) lines.push("", `⚠️ פחת/נזק: ${dmgUnits} יח׳`);
  lines.push("", "הופק מ-DreamManager 💼");
  return lines.join("\n");
}
