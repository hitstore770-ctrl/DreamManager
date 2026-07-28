import { useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";

import { hapticLight } from "../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import CustomText from "../../components/CustomText";

// A slider built on React Native's own PanResponder — no slider package is
// installed and adding a native one risks the build, so this stays pure RN.

const CARD = "#F4F6F9";
const INK = "#111827";
const INK_SOFT = "#6B7280";
const BLUE = "#7C3AED";

export default function Slider({ label, value, min = 0, max = 100, step = 1, onChange, format }) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const lastStep = useRef(value);

  const clampToStep = (raw) => {
    const stepped = Math.round(raw / step) * step;
    const clamped = Math.max(min, Math.min(max, stepped));
    // Avoid float dust like 0.30000000000000004 from step arithmetic.
    return Math.round(clamped * 1000) / 1000;
  };

  const setFromX = (x) => {
    const w = widthRef.current;
    if (!w) return;
    const ratio = Math.max(0, Math.min(1, x / w));
    const next = clampToStep(min + ratio * (max - min));
    if (next !== lastStep.current) {
      lastStep.current = next;
      hapticLight();
      onChange(next);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e, g) => {
        // locationX is unreliable mid-drag on web; derive from the track origin.
        setFromX(g.moveX - trackX.current);
      },
    })
  ).current;

  const trackX = useRef(0);
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <CustomText style={s.value}>{format ? format(value) : value}</CustomText>
        <CustomText style={s.label}>{label}</CustomText>
      </View>
      <View
        testID={`slider-${label}`}
        style={s.trackHit}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
          widthRef.current = e.nativeEvent.layout.width;
        }}
        // Measure the track's page offset so drag math works on web.
        ref={(node) => {
          if (node && node.measure) {
            node.measure((fx, fy, w, h, px) => {
              trackX.current = px || 0;
            });
          }
        }}
        {...pan.panHandlers}
      >
        <View style={s.track}>
          <View style={[s.fill, { width: `${pct}%` }]} />
        </View>
        {/* Inset the thumb by its own width so it stays fully on-screen at
            both ends instead of hanging half-way off the track. */}
        <View style={[s.thumb, { left: (pct / 100) * Math.max(0, width - 26) }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  label: { fontFamily: FONTS.semibold, fontSize: 13, color: INK_SOFT },
  value: { fontFamily: FONTS.bold, fontSize: 15, color: BLUE },
  trackHit: { height: 44, justifyContent: "center" },
  track: { height: 8, borderRadius: 4, backgroundColor: CARD, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: BLUE, borderRadius: 4 },
  thumb: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: BLUE,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
});
