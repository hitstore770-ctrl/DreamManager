import { Linking } from "react-native";

// Auto-detection of links and Israeli phone numbers inside note text. The
// editor surfaces them as tappable chips (a TextInput can't render live
// inline links while staying editable).

const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]{2,})/g;
const PHONE_RE = /0\d{1,2}[- ]?\d{3}[- ]?\d{4}\b/g;

export function extractLinks(text) {
  const out = [];
  const seen = new Set();
  for (const m of (text || "").matchAll(URL_RE)) {
    const raw = m[0].replace(/[.,;:!?)]+$/, "");
    if (!seen.has(raw)) {
      seen.add(raw);
      out.push({ type: "url", label: raw, value: raw });
    }
  }
  for (const m of (text || "").matchAll(PHONE_RE)) {
    const raw = m[0];
    if (!seen.has(raw)) {
      seen.add(raw);
      out.push({ type: "phone", label: raw, value: raw.replace(/[- ]/g, "") });
    }
  }
  return out.slice(0, 6);
}

export function openLink(item) {
  const target =
    item.type === "phone"
      ? `tel:${item.value}`
      : item.value.startsWith("http")
        ? item.value
        : `https://${item.value}`;
  Linking.openURL(target).catch(() => {});
}
