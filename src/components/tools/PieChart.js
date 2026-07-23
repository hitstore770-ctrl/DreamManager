import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

import { COLORS, FONTS } from "../../utils/theme";

// A small donut/pie chart drawn with react-native-svg. `data` is an array of
// { label, value, color }. Slices with value 0 are skipped.
export default function PieChart({ data, size = 160 }) {
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((sum, d) => sum + d.value, 0);
  const r = size / 2;
  const cx = r;
  const cy = r;

  if (total <= 0) {
    return (
      <View style={[styles.emptyCircle, { width: size, height: size, borderRadius: r }]}>
        <Text style={styles.emptyText}>אין נתונים</Text>
      </View>
    );
  }

  // A single non-zero slice can't be drawn as an arc (start == end), so draw a
  // full filled circle instead.
  if (slices.length === 1) {
    return (
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r - 2} fill={slices[0].color} stroke="#1A1A1A" strokeWidth={2} />
      </Svg>
    );
  }

  let angle = -Math.PI / 2; // start at top
  const paths = slices.map((slice) => {
    const sweep = (slice.value / total) * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + sweep;
    angle = a1;

    const x0 = cx + (r - 2) * Math.cos(a0);
    const y0 = cy + (r - 2) * Math.sin(a0);
    const x1 = cx + (r - 2) * Math.cos(a1);
    const y1 = cy + (r - 2) * Math.sin(a1);
    const largeArc = sweep > Math.PI ? 1 : 0;

    const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r - 2} ${r - 2} 0 ${largeArc} 1 ${x1} ${y1} Z`;
    return { d, color: slice.color, key: slice.label };
  });

  return (
    <Svg width={size} height={size}>
      <G>
        {paths.map((p) => (
          <Path key={p.key} d={p.d} fill={p.color} stroke="#1A1A1A" strokeWidth={2} />
        ))}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  emptyCircle: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
});
