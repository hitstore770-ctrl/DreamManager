import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { parseBlocks, parseInline, tokenizeCodeLine } from "../lib/markdown";

const CODE_TONE = {
  keyword: "#C6588A",
  string: "#3E8F5C",
  number: "#B0762C",
  comment: "#8A8781",
};

// Rendered view of a note's markdown: headings, blockquotes, fenced code
// (lightly syntax-highlighted), and checklists you can tap to toggle.
export default function MarkdownView({ body, onToggleChecklist, theme, fontSize = 16 }) {
  const blocks = parseBlocks(body);
  const lineHeight = Math.round(fontSize * 1.5);

  if (!body?.trim()) {
    return <Text style={{ color: theme.textMuted, fontSize, lineHeight }}>Nothing here yet.</Text>;
  }

  return (
    <View>
      {blocks.map((block, idx) => {
        if (block.type === "blank") {
          return <View key={idx} style={{ height: lineHeight * 0.5 }} />;
        }
        if (block.type === "heading") {
          return (
            <Text
              key={idx}
              style={{
                color: theme.text,
                fontWeight: "700",
                fontSize: fontSize + Math.max(0, 6 - block.level) * 2,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              {block.text}
            </Text>
          );
        }
        if (block.type === "quote") {
          return (
            <View
              key={idx}
              style={{
                borderStartWidth: 3,
                borderStartColor: theme.quoteBorder,
                paddingStart: 12,
                marginVertical: 6,
              }}
            >
              <Text style={{ color: theme.textMuted, fontStyle: "italic", fontSize, lineHeight }}>
                <InlineText segments={parseInline(block.text)} theme={theme} />
              </Text>
            </View>
          );
        }
        if (block.type === "code") {
          return <CodeBlock key={idx} lang={block.lang} code={block.code} theme={theme} />;
        }
        if (block.type === "checklist") {
          return (
            <TouchableOpacity
              key={idx}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 4 }}
              onPress={() => onToggleChecklist?.(block.lineIndex)}
              activeOpacity={0.7}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  marginTop: Math.round((lineHeight - 20) / 2),
                  borderRadius: 5,
                  borderWidth: 2,
                  borderColor: block.checked ? theme.accent : theme.border,
                  backgroundColor: block.checked ? theme.accent : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {block.checked && <Feather name="check" size={13} color={theme.onAccent} />}
              </View>
              <Text
                style={{
                  flex: 1,
                  color: block.checked ? theme.textMuted : theme.text,
                  textDecorationLine: block.checked ? "line-through" : "none",
                  fontSize,
                  lineHeight,
                }}
              >
                <InlineText segments={parseInline(block.text)} theme={theme} />
              </Text>
            </TouchableOpacity>
          );
        }
        // paragraph
        return (
          <Text key={idx} style={{ color: theme.text, fontSize, lineHeight, marginVertical: 2 }}>
            <InlineText segments={parseInline(block.text)} theme={theme} />
          </Text>
        );
      })}
    </View>
  );
}

function InlineText({ segments, theme }) {
  return segments.map((seg, i) => (
    <Text
      key={i}
      style={[
        seg.bold && { fontWeight: "700" },
        seg.italic && { fontStyle: "italic" },
        seg.code && {
          fontFamily: "monospace",
          backgroundColor: theme.codeBg,
          color: theme.accent,
        },
      ]}
    >
      {seg.text}
    </Text>
  ));
}

function CodeBlock({ lang, code, theme }) {
  const lines = code.split("\n");
  return (
    <View style={{ backgroundColor: theme.codeBg, borderRadius: 10, padding: 12, marginVertical: 6 }}>
      {!!lang && (
        <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 6, fontFamily: "monospace" }}>
          {lang}
        </Text>
      )}
      {lines.map((line, i) => (
        <Text key={i} style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 19, color: theme.text }}>
          {line === "" ? " " : tokenizeCodeLine(line).map((tok, j) => (
            <Text key={j} style={{ color: CODE_TONE[tok.kind] }}>
              {tok.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}
