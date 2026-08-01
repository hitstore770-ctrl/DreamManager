import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";
import SwipeBack from "../navigation/SwipeBack";
import { listNotes } from "../db/notesRepo";
import { buildGraph, computeLayout } from "../lib/graph";
import { colorForRoot, tagRoot } from "../lib/tags";

const NODE_RADIUS = 16;

function truncate(str, n) {
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

// Notes as nodes, shared tags and [[wiki links]] as edges. Pannable (nested
// horizontal/vertical ScrollViews) since a real note collection won't fit
// one screen; tapping a node opens that note.
export default function GraphScreen({ navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { width, height } = useWindowDimensions();
  const [notes, setNotes] = useState([]);

  const load = useCallback(() => {
    listNotes(db, {}).then(setNotes);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const canvasW = Math.max(width * 1.6, 800);
  const canvasH = Math.max(height * 1.6, 800);

  const { nodes, edges } = useMemo(() => buildGraph(notes), [notes]);
  const laidOut = useMemo(
    () => computeLayout(nodes, edges, { width: canvasW, height: canvasH, iterations: 140 }),
    [nodes, edges, canvasW, canvasH]
  );
  const posById = useMemo(() => Object.fromEntries(laidOut.map((n) => [n.id, n])), [laidOut]);

  const s = styles(theme);

  const colorForNode = (n) => (n.tags?.[0] ? colorForRoot(tagRoot(n.tags[0])) : theme.accent);

  return (
    <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={s.topBar}>
        <TouchableOpacity testID="graph-back" style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Feather name="share-2" size={16} color={theme.textMuted} style={{ marginStart: 6, marginEnd: 6 }} />
        <Text style={s.topTitle}>Knowledge Graph</Text>
      </View>

      {nodes.length === 0 ? (
        <Text style={s.empty}>
          No notes yet. The graph fills in as you write — tag notes with #shared-tags, or link them directly with
          [[Note Title]].
        </Text>
      ) : (
        <ScrollView horizontal style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }}>
            <Svg width={canvasW} height={canvasH}>
              {edges.map((e, i) => {
                const a = posById[e.source];
                const b = posById[e.target];
                if (!a || !b) return null;
                const isLink = e.kinds.includes("link");
                return (
                  <Line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={isLink ? theme.accent : theme.border}
                    strokeWidth={isLink ? 1.6 : 1}
                    strokeOpacity={0.55}
                  />
                );
              })}
              {laidOut.map((n) => (
                <Circle
                  key={`c-${n.id}`}
                  testID="graph-node"
                  cx={n.x}
                  cy={n.y}
                  r={NODE_RADIUS}
                  fill={colorForNode(n)}
                  stroke={theme.bg}
                  strokeWidth={2}
                  onPress={() => navigation.navigate("Editor", { noteId: n.id })}
                />
              ))}
              {laidOut.map((n) => (
                <SvgText
                  key={`t-${n.id}`}
                  x={n.x}
                  y={n.y + NODE_RADIUS + 14}
                  fontSize={11}
                  fill={theme.textMuted}
                  textAnchor="middle"
                >
                  {truncate(n.label || "Untitled", 16)}
                </SvgText>
              ))}
            </Svg>
          </ScrollView>
        </ScrollView>
      )}
    </SwipeBack>
  );
}

const styles = (t) =>
  StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    topTitle: { fontSize: 17, fontWeight: "700", color: t.text },
    empty: { color: t.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 60, paddingHorizontal: 30 },
  });
