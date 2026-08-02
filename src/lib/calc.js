// The $CALC$ pricing block's content is plain "key: value" lines rather
// than JSON, so a hand-written block still round-trips fine, and so the
// raw markdown stays readable outside the app. Values are kept as strings
// end-to-end (only coerced to Number at compute time) so a field like
// "12." doesn't get silently snapped to "12" while someone is still typing
// the decimal part.
export function parseCalcContent(content) {
  const data = {};
  for (const line of (content || "").split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) data[m[1]] = m[2];
  }
  return {
    label: data.label ?? "",
    qty: data.qty ?? "1",
    price: data.price ?? "0",
    margin: data.margin ?? "0",
  };
}

export function serializeCalcContent({ label, qty, price, margin }) {
  return `label: ${label}\nqty: ${qty}\nprice: ${price}\nmargin: ${margin}`;
}

export function computeCalcTotal({ qty, price, margin }) {
  const subtotal = (Number(qty) || 0) * (Number(price) || 0);
  return { subtotal, total: subtotal * (1 + (Number(margin) || 0) / 100) };
}

export const DEFAULT_CALC_CONTENT = "label: New Item\nqty: 1\nprice: 0\nmargin: 20";
