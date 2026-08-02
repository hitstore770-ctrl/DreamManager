import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "../components/AppText";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";
import { extractMindMapTree, layoutMindMap } from "../lib/mindmap";
import { colorForRoot } from "../lib/tags";
import { t } from "../i18n/strings";
import SwipeBack from "../navigation/SwipeBack";

const BASE_LEVEL_GAP = 190;
const BASE_ROW_GAP = 42;
const NODE_H = 30;
const ZOOM_STEP = 0.2;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.8;

function truncate(str, n) {
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

function nodeWidth(text, scale) {
  return Math.max(60, Math.min(220, text.length * 7.2 * scale + 24));
}

// The Auto Mind-Map Generator: reads the note's nested "- bullet" list
// (see src/lib/mindmap.js for how indentation becomes a tree) and lays it
// out left-to-right as SVG, panned with the same nested-ScrollView trick
// GraphScreen uses. "Zoom" re-runs the layout at a scaled level/row gap
// instead of a CSS transform, so panning never fights a scaled scroll
// area whose content size stopped matching what's drawn.
export default function MindMapScreen({ navigation, route }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const body = route.params?.body || "";
  const title = route.params?.title || "";
  const [scale, setScale] = useState(1);

  const tree = useMemo(() => extractMindMapTree(body), [body]);
  const layout = useMemo(() => {
    if (!tree) return null;
    return layoutMindMap(tree, { levelGap: BASE_LEVEL_GAP * scale, rowGap: BASE_ROW_GAP * scale });
  }, [tree, scale]);

  const s = styles(theme);

  return (
    <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={s.topBar}>
        <TouchableOpacity testID="mindmap-back" style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Feather name="git-branch" size={16} color={theme.textMuted} style={{ marginStart: 6, marginEnd: 6 }} />
        <AppText style={s.topTitle} numberOfLines={1}>
          {title || t("mindMap")}
        </AppText>
        <View style={{ flex: 1 }} />
        <TouchableOpacity testID="mindmap-zoom-out" style={s.zoomBtn} onPress={() => setScale((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))} hitSlop={4}>
          <Feather name="minus" size={16} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity testID="mindmap-zoom-reset" style={s.zoomBtn} onPress={() => setScale(1)} hitSlop={4}>
          <AppText style={{ fontSize: 11, color: theme.text, fontWeight: "700" }}>{Math.round(scale * 100)}%</AppText>
        </TouchableOpacity>
        <TouchableOpacity testID="mindmap-zoom-in" style={s.zoomBtn} onPress={() => setScale((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))} hitSlop={4}>
          <Feather name="plus" size={16} color={theme.text} />
        </TouchableOpacity>
      </View>

      {!layout ? (
        <AppText style={s.empty}>{t("mindMapEmpty")}</AppText>
      ) : (
        <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ padding: 30 }}>
          <ScrollView contentContainerStyle={{ padding: 10 }}>
            <Svg width={layout.width + 60} height={layout.height + NODE_H}>
              {layout.edges.map((e, i) => (
                <Line
                  key={i}
                  x1={e.x1 + nodeWidth(e.text1 || t("mindMap"), scale)}
                  y1={e.y1 + NODE_H / 2}
                  x2={e.x2}
                  y2={e.y2 + NODE_H / 2}
                  stroke={theme.border}
                  strokeWidth={1.6}
                />
              ))}
              {layout.nodes.map((n, i) => {
                const w = nodeWidth(n.text || t("mindMap"), scale);
                const color = n.depth === 0 ? theme.accent : colorForRoot(n.text || `${i}`);
                return (
                  <Rect
                    key={`r-${i}`}
                    x={n.x}
                    y={n.y}
                    width={w}
                    height={NODE_H}
                    rx={NODE_H / 2}
                    fill={n.depth === 0 ? theme.accent : theme.surface}
                    stroke={n.depth === 0 ? theme.accent : color}
                    strokeWidth={1.4}
                  />
                );
              })}
              {layout.nodes.map((n, i) => {
                const w = nodeWidth(n.text || t("mindMap"), scale);
                return (
                  <SvgText
                    key={`t-${i}`}
                    x={n.x + w / 2}
                    y={n.y + NODE_H / 2 + 4}
                    fontSize={12 * scale}
                    fill={n.depth === 0 ? theme.onAccent : theme.text}
                    textAnchor="middle"
                  >
                    {truncate(n.text || t("mindMap"), 22)}
                  </SvgText>
                );
              })}
            </Svg>
          </ScrollView>
        </ScrollView>
      )}
    </SwipeBack>
  );
}

const styles = (t) =>
  StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    topTitle: { fontSize: 16, fontWeight: "700", color: t.text, maxWidth: 140 },
    zoomBtn: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    empty: { color: t.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 60, paddingHorizontal: 30 },
  });
