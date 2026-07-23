export function formatAmount(value, type) {
  const formatted = value.toLocaleString("he-IL");
  return type === "money" ? `₪${formatted}` : formatted;
}

export function formatNumber(value, decimals = 2) {
  return Number(value).toLocaleString("he-IL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatShekel(value, decimals = 2) {
  return `₪${formatNumber(value, decimals)}`;
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
