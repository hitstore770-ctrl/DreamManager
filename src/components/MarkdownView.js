import { useState } from "react";
import { Image, TouchableOpacity, View } from "react-native";
import AppText from "./AppText";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import { parseBlocks, parseInline } from "../lib/markdown";
import { tokenizeCodeLines } from "../lib/syntaxHighlight";
import TableView from "./TableView";

// Deliberately non-linear: H1 vs. H2 needs to read as a real step down, not
// a 2px nudge, for headings to actually carry hierarchy at a glance.
const HEADING_SCALE = [1.75, 1.35, 1.2, 1.1, 1.0, 0.95];
function headingFontSize(level, baseSize) {
  return Math.round(baseSize * (HEADING_SCALE[level - 1] ?? 1));
}

const CODE_TONE = {
  keyword: "#C6588A",
  string: "#3E8F5C",
  number: "#B0762C",
  comment: "#8A8781",
  literal: "#B0762C",
};

// Rendered view of a note's markdown: headings, blockquotes, fenced code
// (syntax-highlighted, with a copy button), tables, drawings, and
// checklists you can tap to toggle.
export default function MarkdownView({ body, onToggleChecklist, onEditTable, onEditDrawing, theme, fontSize = 16 }) {
  const blocks = parseBlocks(body);
  const lineHeight = Math.round(fontSize * 1.5);

  if (!body?.trim()) {
    return <AppText style={{ color: theme.textMuted, fontSize, lineHeight }}>Nothing here yet.</AppText>;
  }

  return (
    <View>
      {blocks.map((block, idx) => {
        if (block.type === "blank") {
          return <View key={idx} style={{ height: lineHeight * 0.5 }} />;
        }
        if (block.type === "heading") {
          return (
            <AppText
              key={idx}
              style={{
                color: theme.text,
                fontWeight: "700",
                fontSize: headingFontSize(block.level, fontSize),
                marginTop: block.level <= 2 ? 16 : 12,
                marginBottom: 4,
              }}
            >
              {block.text}
            </AppText>
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
              <AppText style={{ color: theme.textMuted, fontStyle: "italic", fontSize, lineHeight }}>
                <InlineText segments={parseInline(block.text)} theme={theme} />
              </AppText>
            </View>
          );
        }
        if (block.type === "code") {
          return <CodeBlock key={idx} lang={block.lang} code={block.code} theme={theme} />;
        }
        if (block.type === "table") {
          return (
            <TableView
              key={idx}
              content={block.content}
              theme={theme}
              fontSize={fontSize}
              onEdit={onEditTable ? () => onEditTable(block) : null}
            />
          );
        }
        if (block.type === "drawing") {
          return (
            <DrawingBlock key={idx} content={block.content} theme={theme} onEdit={onEditDrawing ? () => onEditDrawing(block) : null} />
          );
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
              <AppText
                style={{
                  flex: 1,
                  color: block.checked ? theme.textMuted : theme.text,
                  textDecorationLine: block.checked ? "line-through" : "none",
                  fontSize,
                  lineHeight,
                }}
              >
                <InlineText segments={parseInline(block.text)} theme={theme} />
              </AppText>
            </TouchableOpacity>
          );
        }
        // paragraph
        if (!block.text) return null;
        return (
          <AppText key={idx} style={{ color: theme.text, fontSize, lineHeight, marginVertical: 2 }}>
            <InlineText segments={parseInline(block.text)} theme={theme} />
          </AppText>
        );
      })}
    </View>
  );
}

function InlineText({ segments, theme }) {
  return segments.map((seg, i) => (
    <AppText
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
    </AppText>
  ));
}

function CodeBlock({ lang, code, theme }) {
  const [copied, setCopied] = useState(false);
  const lines = tokenizeCodeLines(code, lang);

  const onCopy = async () => {
    await Clipboard.setStringAsync(code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={{ backgroundColor: theme.codeBg, borderRadius: 10, padding: 12, paddingTop: 10, marginVertical: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <AppText style={{ color: theme.textMuted, fontSize: 11, fontFamily: "monospace" }}>{lang || "code"}</AppText>
        <TouchableOpacity
          testID="copy-code"
          onPress={onCopy}
          hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 3 }}
        >
          <Feather name={copied ? "check" : "copy"} size={12} color={copied ? theme.success : theme.textMuted} />
          <AppText style={{ fontSize: 10.5, color: copied ? theme.success : theme.textMuted, fontWeight: "600" }}>
            {copied ? "Copied" : "Copy"}
          </AppText>
        </TouchableOpacity>
      </View>
      {lines.map((lineTokens, i) => (
        <AppText key={i} style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 19, color: theme.text }}>
          {lineTokens.length === 0
            ? " "
            : lineTokens.map((tok, j) => (
                <AppText key={j} style={{ color: CODE_TONE[tok.kind] }}>
                  {tok.text}
                </AppText>
              ))}
        </AppText>
      ))}
    </View>
  );
}

function DrawingBlock({ content, theme, onEdit }) {
  const uri = content.trim().startsWith("data:") ? content.trim() : `data:image/png;base64,${content.trim()}`;
  const Wrapper = onEdit ? TouchableOpacity : View;
  return (
    <Wrapper
      testID={onEdit ? "edit-drawing" : undefined}
      onPress={onEdit}
      activeOpacity={0.85}
      style={{ borderRadius: 12, overflow: "hidden", marginVertical: 6, ...theme.cardShadow }}
    >
      <Image source={{ uri }} style={{ width: "100%", aspectRatio: 1.4, backgroundColor: "#FFFFFF" }} resizeMode="contain" />
      {!!onEdit && (
        <View style={{ position: "absolute", right: 8, bottom: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Feather name="edit-2" size={12} color={theme.textMuted} />
          <AppText style={{ fontSize: 11, color: theme.textMuted, fontWeight: "600" }}>Edit</AppText>
        </View>
      )}
    </Wrapper>
  );
}
