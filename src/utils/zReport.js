import { shekel, todayKey } from "./posStore";

// Build the shareable end-of-day Z-report text (WhatsApp-friendly: emoji
// headers, short lines, no markdown). Used by the Pro Tools sheet and the
// דוח Z business module.
export function buildZReportText(sales, d = new Date()) {
  const day = todayKey(d);
  const todays = (sales || []).filter((r) => r.day === day);
  const sold = todays.filter((r) => r.kind !== "damage");
  const damages = todays.filter((r) => r.kind === "damage");

  const revenue = sold.reduce((s, r) => s + (r.total || 0), 0);
  const txCount = new Set(sold.map((r) => r.eventId || r.id)).size;
  const units = sold.reduce((s, r) => s + (r.qty || 0), 0);

  // Aggregate by product name, top 5 by revenue.
  const byName = new Map();
  for (const r of sold) {
    const cur = byName.get(r.name) || { qty: 0, total: 0 };
    byName.set(r.name, { qty: cur.qty + r.qty, total: cur.total + r.total });
  }
  const top = [...byName.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([name, v]) => `  • ${name} ×${v.qty} — ${shekel(v.total)}`)
    .join("\n");

  const lines = [
    `🧾 דוח Z — ${d.toLocaleDateString("he-IL")}`,
    "━━━━━━━━━━━━━━",
    `💰 פדיון היום: ${shekel(revenue)}`,
    `🧺 עסקאות: ${txCount}`,
    `📦 פריטים שנמכרו: ${units}`,
  ];
  if (top) lines.push("", "מובילים:", top);
  if (damages.length) {
    const dmgUnits = damages.reduce((s, r) => s + (r.qty || 0), 0);
    lines.push("", `⚠️ פחת/נזק: ${dmgUnits} יח׳`);
  }
  lines.push("", "הופק מ-DreamManager 💼");
  return lines.join("\n");
}
