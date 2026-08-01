import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";
import SwipeBack from "../navigation/SwipeBack";
import { paginate } from "../lib/pagination";
import { buildPrintHtml, PAGE_SIZES } from "../lib/printHtml";

// A structural preview -- it shows exactly where page breaks fall and the
// header/footer/page-number chrome that will print, but (deliberately) does
// not attempt pixel-perfect text reflow, since React Native has no offline
// text-layout engine to measure that with. The actual exported PDF *is*
// pixel-accurate: it's real HTML rendered by the OS's own print engine via
// expo-print, this preview is just a fast approximation of it.
function blockPreviewText(block) {
  switch (block.type) {
    case "heading":
      return block.text.toUpperCase();
    case "checklist":
      return `${block.checked ? "☑" : "☐"} ${block.text}`;
    case "code":
      return block.code;
    case "table":
      return "▦ Table";
    case "drawing":
      return "▨ Drawing";
    case "quote":
      return `“${block.text}”`;
    case "blank":
      return "";
    default:
      return block.text || "";
  }
}

export default function PrintPreviewScreen({ navigation, route }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const title = route.params?.title || "Untitled";
  const body = route.params?.body || "";

  const [paperSize, setPaperSize] = useState("A5");
  const [exporting, setExporting] = useState(false);

  const linesPerPage = paperSize === "A5" ? 34 : 46;
  const charsPerLine = paperSize === "A5" ? 60 : 82;
  const pages = useMemo(() => paginate(body, { linesPerPage, charsPerLine }), [body, linesPerPage, charsPerLine]);

  const { width: pw, height: ph } = PAGE_SIZES[paperSize];
  const frameWidth = Math.min(width - 40, 340);
  const frameHeight = frameWidth * (ph / pw);

  const onExport = async () => {
    setExporting(true);
    try {
      const html = buildPrintHtml(title, pages, paperSize);
      const { uri } = await Print.printToFileAsync({ html, width: pw, height: ph });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: title });
    } finally {
      setExporting(false);
    }
  };

  const s = styles(theme);

  return (
    <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={s.topBar}>
        <TouchableOpacity testID="print-back" style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={s.title}>Print Preview</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity testID="paper-a5" style={[s.sizeBtn, paperSize === "A5" && s.sizeBtnActive]} onPress={() => setPaperSize("A5")}>
          <Text style={[s.sizeBtnText, paperSize === "A5" && s.sizeBtnTextActive]}>A5</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="paper-a4" style={[s.sizeBtn, paperSize === "A4" && s.sizeBtnActive]} onPress={() => setPaperSize("A4")}>
          <Text style={[s.sizeBtnText, paperSize === "A4" && s.sizeBtnTextActive]}>A4</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.pageCount}>
        {pages.length} page{pages.length === 1 ? "" : "s"} at {paperSize}
      </Text>

      <ScrollView contentContainerStyle={{ padding: 20, alignItems: "center", gap: 20, paddingBottom: insets.bottom + 110 }}>
        {pages.map((blocks, i) => (
          <View key={i} style={[s.page, { width: frameWidth, height: frameHeight }]}>
            <View style={s.pageHeader}>
              <Text style={s.pageHeaderText} numberOfLines={1}>
                {title}
              </Text>
              <Text style={s.pageHeaderText}>Second Brain</Text>
            </View>
            <View style={{ flex: 1, overflow: "hidden" }}>
              {blocks.map((block, bi) => (
                <Text
                  key={bi}
                  numberOfLines={block.type === "code" ? 6 : 3}
                  style={[
                    s.pageBlockText,
                    block.type === "heading" && s.pageHeadingText,
                    block.type === "code" && s.pageCodeText,
                  ]}
                >
                  {blockPreviewText(block)}
                </Text>
              ))}
            </View>
            <View style={s.pageFooter}>
              <Text style={s.pageFooterText}>
                Page {i + 1} of {pages.length}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        testID="export-pdf"
        style={[s.exportBtn, { bottom: insets.bottom + 20 }]}
        onPress={onExport}
        disabled={exporting}
        activeOpacity={0.85}
      >
        <Feather name="download" size={17} color={theme.onAccent} />
        <Text style={s.exportBtnText}>{exporting ? "Preparing PDF…" : "Export PDF"}</Text>
      </TouchableOpacity>
    </SwipeBack>
  );
}

const styles = (t) =>
  StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    title: { fontSize: 16, fontWeight: "700", color: t.text, marginStart: 4 },
    sizeBtn: { width: 40, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    sizeBtnActive: { backgroundColor: t.accent },
    sizeBtnText: { fontSize: 12, fontWeight: "700", color: t.textSecondary },
    sizeBtnTextActive: { color: t.onAccent },
    pageCount: { textAlign: "center", fontSize: 12, color: t.textMuted, marginBottom: 4 },
    page: {
      backgroundColor: "#FFFFFF",
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    pageHeader: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#E5E3DC", paddingBottom: 4, marginBottom: 8 },
    pageHeaderText: { fontSize: 8, color: "#999" },
    pageFooter: { borderTopWidth: 1, borderTopColor: "#E5E3DC", paddingTop: 4, marginTop: 6, alignItems: "center" },
    pageFooterText: { fontSize: 8, color: "#999" },
    pageBlockText: { fontSize: 9.5, color: "#2A2A28", lineHeight: 13, marginBottom: 2 },
    pageHeadingText: { fontWeight: "800", fontSize: 11 },
    pageCodeText: { fontFamily: "monospace", fontSize: 8.5, backgroundColor: "#F3F1EA" },
    exportBtn: {
      position: "absolute",
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: t.accent,
      borderRadius: 26,
      paddingHorizontal: 22,
      height: 50,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 6,
    },
    exportBtnText: { color: t.onAccent, fontWeight: "700", fontSize: 14.5 },
  });
