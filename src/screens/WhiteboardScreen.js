import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Image as SvgImage, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeContext";
import SwipeBack from "../navigation/SwipeBack";

// Matches the aspectRatio used to display a saved drawing inline in
// MarkdownView, so a save round-trips without letterboxing.
const CANVAS_W = 1800;
const CANVAS_H = Math.round(CANVAS_W / 1.4);
const ERASE_RADIUS = 20;
const COLORS = ["#1A1A19", "#C0392B", "#2F6F62", "#2F6FA8", "#B0762C", "#7C6FE0"];
const WIDTHS = [3, 6, 11];

function pathFromPoints(points) {
  if (!points.length) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function strokeIsNear(stroke, x, y) {
  return stroke.points.some((p) => Math.hypot(p.x - x, p.y - y) < ERASE_RADIUS);
}

function toDataUri(content) {
  const trimmed = (content || "").trim();
  if (!trimmed) return null;
  return trimmed.startsWith("data:") ? trimmed : `data:image/png;base64,${trimmed}`;
}

// Freehand drawing on a large scrollable canvas, built directly on
// react-native-svg + gesture-handler's Gesture API in runOnJS mode (same
// technique as the Kanban board, no Reanimated needed). Editing an existing
// drawing loads it as a background <Image> *inside* the SVG document (not a
// separate RN <Image> layered on top) so the final `toDataURL()` snapshot
// captures the old drawing and the new strokes flattened together.
export default function WhiteboardScreen({ navigation, route }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const initialUri = toDataUri(route.params?.initialContent);
  const onSave = route.params?.onSave;

  const [strokes, setStrokes] = useState([]);
  const [current, setCurrent] = useState(null);
  const [tool, setTool] = useState("pen"); // pen | eraser | pan
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const svgRef = useRef(null);

  const eraseAt = (x, y) => {
    setStrokes((prev) => prev.filter((s) => !strokeIsNear(s, x, y)));
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(tool !== "pan")
    .onStart((e) => {
      if (tool === "pen") setCurrent({ points: [{ x: e.x, y: e.y }], color, width });
      else if (tool === "eraser") eraseAt(e.x, e.y);
    })
    .onUpdate((e) => {
      if (tool === "pen") setCurrent((c) => (c ? { ...c, points: [...c.points, { x: e.x, y: e.y }] } : c));
      else if (tool === "eraser") eraseAt(e.x, e.y);
    })
    .onEnd(() => {
      setCurrent((c) => {
        if (tool === "pen" && c && c.points.length > 1) setStrokes((prev) => [...prev, c]);
        return null;
      });
    });

  const undo = () => setStrokes((prev) => prev.slice(0, -1));
  const clearAll = () => setStrokes([]);

  const save = () => {
    svgRef.current?.toDataURL((base64) => {
      onSave?.(base64);
      navigation.goBack();
    });
  };

  const s = styles(theme);

  return (
    <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={s.topBar}>
        <TouchableOpacity testID="whiteboard-back" style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Feather name="edit-3" size={16} color={theme.textMuted} style={{ marginStart: 6, marginEnd: 6 }} />
        <Text style={s.topTitle}>Whiteboard</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity testID="whiteboard-save" style={[s.iconBtn, { backgroundColor: theme.accent }]} onPress={save} hitSlop={8}>
          <Feather name="check" size={19} color={theme.onAccent} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.toolbar}>
        <ToolBtn testID="tool-pen" active={tool === "pen"} icon="edit-2" onPress={() => setTool("pen")} theme={theme} />
        <ToolBtn testID="tool-eraser" active={tool === "eraser"} icon="x-square" onPress={() => setTool("eraser")} theme={theme} />
        <ToolBtn testID="tool-pan" active={tool === "pan"} icon="move" onPress={() => setTool("pan")} theme={theme} />
        <View style={s.sep} />
        <ToolBtn testID="undo-stroke" icon="corner-up-left" onPress={undo} theme={theme} />
        <ToolBtn testID="clear-all" icon="trash-2" onPress={clearAll} theme={theme} />
        <View style={s.sep} />
        {COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            testID="pen-color"
            onPress={() => setColor(c)}
            style={[s.swatch, { backgroundColor: c }, color === c && { borderColor: theme.accent }]}
          />
        ))}
        <View style={s.sep} />
        {WIDTHS.map((w) => (
          <TouchableOpacity
            key={w}
            testID="pen-width"
            onPress={() => setWidth(w)}
            style={[s.widthBtn, width === w && { backgroundColor: theme.accent }]}
          >
            <View style={{ width: w + 3, height: w + 3, borderRadius: 99, backgroundColor: width === w ? theme.onAccent : theme.text }} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={s.hint}>{tool === "pan" ? "Panning — switch to Pen to draw" : "Draw with your finger or stylus"}</Text>

      <ScrollView horizontal scrollEnabled={tool === "pan"} style={{ flex: 1 }}>
        <ScrollView scrollEnabled={tool === "pan"} style={{ flex: 1 }}>
          <GestureDetector gesture={pan}>
            <View style={{ width: CANVAS_W, height: CANVAS_H, backgroundColor: "#FFFFFF" }}>
              <Svg ref={svgRef} width={CANVAS_W} height={CANVAS_H}>
                {!!initialUri && <SvgImage href={{ uri: initialUri }} x={0} y={0} width={CANVAS_W} height={CANVAS_H} preserveAspectRatio="xMidYMid slice" />}
                {strokes.map((st, i) => (
                  <Path key={i} d={pathFromPoints(st.points)} stroke={st.color} strokeWidth={st.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                ))}
                {current && (
                  <Path d={pathFromPoints(current.points)} stroke={current.color} strokeWidth={current.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </Svg>
            </View>
          </GestureDetector>
        </ScrollView>
      </ScrollView>
    </SwipeBack>
  );
}

function ToolBtn({ testID, icon, active, onPress, theme }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={[toolBtn(theme), active && { backgroundColor: theme.accent }]} hitSlop={4}>
      <Feather name={icon} size={16} color={active ? theme.onAccent : theme.text} />
    </TouchableOpacity>
  );
}

const toolBtn = (t) => ({
  width: 34,
  height: 34,
  borderRadius: 9,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: t.surfaceAlt,
  marginEnd: 6,
});

const styles = (t) =>
  StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    topTitle: { fontSize: 17, fontWeight: "700", color: t.text },
    toolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingBottom: 8 },
    sep: { width: 1, height: 22, backgroundColor: t.border, marginEnd: 6 },
    swatch: { width: 26, height: 26, borderRadius: 13, marginEnd: 6, borderWidth: 2, borderColor: "transparent" },
    widthBtn: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt, marginEnd: 6 },
    hint: { fontSize: 11.5, color: t.textMuted, textAlign: "center", marginBottom: 4 },
  });
