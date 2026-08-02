// Detects a leading emoji -- including ZWJ-joined compound sequences like
// "family: man, woman, girl" and an optional variation selector -- at the
// very start of a string, so the note list can pull it out and show it as
// a distinct icon instead of leaving it stuck in the title text.
const VARIATION_SELECTOR = "️";
const ZWJ = "‍";
const LEADING_EMOJI_RE = new RegExp(
  `^(\\p{Extended_Pictographic}(?:${VARIATION_SELECTOR})?(?:${ZWJ}\\p{Extended_Pictographic}(?:${VARIATION_SELECTOR})?)*)\\s*`,
  "u"
);

export function extractLeadingEmoji(text) {
  if (!text) return null;
  const m = LEADING_EMOJI_RE.exec(text);
  if (!m) return null;
  return { emoji: m[1], rest: text.slice(m[0].length) };
}
