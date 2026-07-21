export function formatAmount(value, type) {
  const formatted = value.toLocaleString("he-IL");
  return type === "money" ? `₪${formatted}` : formatted;
}

export function formatDateTime(isoString) {
  return new Date(isoString).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
