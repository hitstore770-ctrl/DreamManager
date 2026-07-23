import { useEffect, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton } from "./ToolKit";

const PEN_COLORS = ["#2D2A32", "#3B5BDB", "#D14343", "#1E9E58", "#E07C1D"];

export default function DrawPad() {
  const [paths, setPaths] = useState([]);
  const [current, setCurrent] = useState("");
  const [color, setColor] = useState(PEN_COLORS[0]);

  const currentRef = useRef("");
  const colorRef = useRef(color);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentRef.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setCurrent(currentRef.current);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentRef.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setCurrent(currentRef.current);
      },
      onPanResponderRelease: () => {
        if (currentRef.current) {
          const finished = { d: currentRef.current, color: colorRef.current };
          setPaths((prev) => [...prev, finished]);
        }
        currentRef.current = "";
        setCurrent("");
      },
    })
  ).current;

  const undo = () => setPaths((prev) => prev.slice(0, -1));
  const clearAll = () => {
    setPaths([]);
    setCurrent("");
    currentRef.current = "";
  };

  return (
    <View>
      <View style={styles.canvas} {...pan.panHandlers}>
        <Svg style={StyleSheet.absoluteFill}>
          {paths.map((p, i) => (
            <Path key={i} d={p.d} stroke={p.color} strokeWidth={3} fill="none" strokeLinecap="round" />
          ))}
          {current ? (
            <Path d={current} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
          ) : null}
        </Svg>
        {paths.length === 0 && !current && <Text style={styles.placeholder}>ציירו כאן ✍️</Text>}
      </View>

      <View style={styles.colorRow}>
        {PEN_COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
            onPress={() => setColor(c)}
            activeOpacity={0.8}
          />
        ))}
      </View>

      <View style={styles.buttonRow}>
        <ToolButton label="בטל" onPress={undo} color={COLORS.textMuted} />
        <View style={styles.gap} />
        <ToolButton label="נקה הכל" onPress={clearAll} color="#D14343" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    height: 300,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  placeholder: { color: COLORS.textMuted, fontSize: 16, fontFamily: FONTS.regular },
  colorRow: { flexDirection: "row", gap: 12, justifyContent: "center", marginBottom: 16 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "transparent" },
  swatchActive: { borderColor: COLORS.textPrimary },
  buttonRow: { flexDirection: "row", alignItems: "center" },
  gap: { width: 12 },
});
