import { I18nManager, StyleSheet, View } from "react-native";

import { parseInline } from "../utils/markdownLite";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { UI } from "../utils/ui";
import CustomText from "../components/CustomText";

// Block-level Markdown for chat replies.
//
// Noa's persona instructs her to use headings, bold and bullets. Without this
// the answers arrive as literal "## " and "**" in the middle of Hebrew
// sentences — the persona would be actively making the output worse to read
// than plain prose would be.
//
// Deliberately small: headings, bullets, numbered items, rules and paragraphs.
// Inline styling reuses parseInline from markdownLite rather than adding a
// second, subtly different bold parser to the codebase. Anything unrecognised
// falls through as a paragraph, so an unsupported construct degrades to plain
// text instead of vanishing.

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

function Inline({ text, style }) {
  const segs = parseInline(text);
  return (
    <CustomText style={style} selectable>
      {segs.map((seg, i) => (
        <CustomText
          key={i}
          style={[
            seg.bold && st.bold,
            seg.italic && st.italic,
            seg.underline && st.underline,
            seg.highlight && st.highlight,
          ]}
        >
          {seg.text}
        </CustomText>
      ))}
    </CustomText>
  );
}

export default function RichText({ text, color = UI.ink, size = 15 }) {
  const lines = String(text || "").split("\n");
  const blocks = [];

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push({ kind: "gap", key: `g${i}` });
      return;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: "rule", key: `r${i}` });
      return;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "h", level: heading[1].length, text: heading[2], key: `h${i}` });
      return;
    }
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      blocks.push({ kind: "li", text: bullet[1], key: `l${i}` });
      return;
    }
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      blocks.push({ kind: "li", marker: `${numbered[1]}.`, text: numbered[2], key: `n${i}` });
      return;
    }
    blocks.push({ kind: "p", text: trimmed, key: `p${i}` });
  });

  return (
    <View>
      {blocks.map((b, i) => {
        if (b.kind === "gap") {
          // A blank line between two blocks is spacing; a run of them, or one
          // at either end, is nothing. Rendering each as a gap would make the
          // reply drift apart.
          const prev = blocks[i - 1];
          const next = blocks[i + 1];
          if (!prev || !next || prev.kind === "gap") return null;
          return <View key={b.key} style={st.gap} />;
        }
        if (b.kind === "rule") return <View key={b.key} style={st.rule} />;

        if (b.kind === "h") {
          return (
            <Inline
              key={b.key}
              text={b.text}
              style={[
                st.base,
                { color, fontFamily: FONTS.bold },
                b.level <= 2 ? { fontSize: size + 3 } : { fontSize: size + 1 },
                i > 0 && st.headingSpaced,
              ]}
            />
          );
        }
        if (b.kind === "li") {
          return (
            <View key={b.key} style={st.liRow}>
              <CustomText style={[st.marker, { color, fontSize: size - 1 }]}>{b.marker || "•"}</CustomText>
              <Inline text={b.text} style={[st.base, st.liText, { color, fontSize: size }]} />
            </View>
          );
        }
        return (
          <Inline key={b.key} text={b.text} style={[st.base, { color, fontSize: size }]} />
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  base: {
    fontFamily: FONTS.regular,
    textAlign: "right",
    lineHeight: 23,
    writingDirection: "rtl",
  },
  bold: { fontFamily: FONTS.bold },
  italic: { fontStyle: "italic" },
  underline: { textDecorationLine: "underline" },
  highlight: { backgroundColor: "rgba(217,119,6,0.18)" },

  headingSpaced: { marginTop: 10 },
  gap: { height: 8 },
  rule: { height: 1, backgroundColor: UI.hairline, marginVertical: 10 },

  liRow: { flexDirection: ROW, alignItems: "flex-start", gap: 7, marginTop: 3 },
  // Fixed width so wrapped bullet text lines up under itself rather than
  // under the marker.
  marker: { fontFamily: FONTS.bold, lineHeight: 23, minWidth: 14, textAlign: "right" },
  liText: { flex: 1 },
});
