import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgGrad, Path, Stop } from "react-native-svg";

import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";

// A banknote, built the way a banknote is printed.
//
// A flat coloured rectangle with a number on it reads as a label. What makes
// paper money look like paper money is a stack of specific things, and this
// renders each of them: a two-stop substrate tint, engine-turned guilloche
// (the interference pattern from rotated ellipses that is genuinely how the
// rosettes on real notes are made), a watermark window with a portrait
// silhouette, a metallic security thread, intaglio-style raised numerals,
// microtext rules, and a soft inner shadow so the paper appears to curve
// rather than lie perfectly flat.
//
// The portrait is a deliberate abstract silhouette. Rendering a real likeness
// of the person on the note would make this a facsimile of legal tender, and
// the point here is a beautiful UI control, not a convincing copy.

export const NOTE_SPECS = {
  20: {
    // Series C, as issued: 20 red, 50 green, 100 orange, 200 blue.
    grad: ["#E8654F", "#A32B22"],
    deep: "#7C1D17",
    lite: "#FFC9BC",
    face: "רחל",
    sub: "המשוררת",
  },
  50: {
    grad: ["#46B583", "#12674A"],
    deep: "#0B4632",
    lite: "#B8F0D6",
    face: "טשרניחובסקי",
    sub: "שאול",
  },
  100: {
    grad: ["#EFA83F", "#9A5A1B"],
    deep: "#6F3D0F",
    lite: "#FFE2B0",
    face: "לאה גולדברג",
    sub: "המשוררת",
  },
  200: {
    grad: ["#4B87DA", "#1A3F7E"],
    deep: "#122C58",
    lite: "#C3DBFF",
    face: "נתן אלתרמן",
    sub: "המשורר",
  },
};

// Deterministic per-denomination serial: a number that reshuffles on every
// render would make the note flicker as the list re-renders.
function serialFor(value) {
  const n = (value * 7919 + 104729) % 100000000;
  return `A ${String(n).padStart(8, "0")}`;
}

// Engine turning. Ellipses share a centre and step in rotation; where their
// strokes cross they build the moiré rosette that is the visual signature of
// printed currency.
function Guilloche({ w, h, tint }) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const rings = [];
  const count = 13;
  for (let i = 0; i < count; i += 1) {
    rings.push(
      <Ellipse
        key={`e${i}`}
        cx={cx}
        cy={cy}
        rx={w * 0.44}
        ry={h * 0.2}
        fill="none"
        stroke={tint}
        strokeWidth={0.6}
        opacity={0.5}
        transform={`rotate(${(i * 180) / count} ${cx} ${cy})`}
      />
    );
  }
  // A tighter rosette anchored to the value corner, as on a real note.
  const rcx = w * 0.16;
  const rcy = h * 0.5;
  for (let i = 0; i < 10; i += 1) {
    rings.push(
      <Ellipse
        key={`r${i}`}
        cx={rcx}
        cy={rcy}
        rx={h * 0.3}
        ry={h * 0.12}
        fill="none"
        stroke={tint}
        strokeWidth={0.55}
        opacity={0.55}
        transform={`rotate(${(i * 180) / 10} ${rcx} ${rcy})`}
      />
    );
  }
  return <G>{rings}</G>;
}

function Portrait({ w, h, tint }) {
  // Head, neck, shoulders — enough to read as a person at a glance, and not
  // enough to be anybody in particular.
  const s = Math.min(w, h);
  return (
    <G opacity={0.5}>
      <Circle cx={w * 0.5} cy={h * 0.36} r={s * 0.19} fill={tint} />
      <Path
        d={`M ${w * 0.5 - s * 0.34} ${h} q ${s * 0.06} ${-h * 0.42} ${s * 0.34} ${-h * 0.42} q ${s * 0.28} 0 ${s * 0.34} ${h * 0.42} Z`}
        fill={tint}
      />
    </G>
  );
}

function Banknote({ value = 100, width = 168, height = 92, style }) {
  const spec = NOTE_SPECS[value] || NOTE_SPECS[100];
  const uid = `n${value}${Math.round(width)}`;
  const scale = height / 92; // every measurement below was tuned at 92pt tall

  const portraitW = height * 0.46;
  const portraitH = height * 0.62;

  return (
    <View style={[s.note, { width, height }, style]}>
      <LinearGradient
        colors={spec.grad}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Substrate: guilloche + watermark portrait, printed into the paper. */}
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <SvgGrad id={`${uid}win`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.30" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.06" />
          </SvgGrad>
        </Defs>
        <Guilloche w={width} h={height} tint={spec.lite} />
        <G x={width - portraitW - 10 * scale} y={(height - portraitH) / 2}>
          <Portrait w={portraitW} h={portraitH} tint={spec.lite} />
        </G>
      </Svg>

      {/* Watermark window — a lighter patch of substrate behind the portrait. */}
      <View
        style={[
          s.window,
          {
            width: portraitW + 10 * scale,
            height: portraitH,
            right: 5 * scale,
            top: (height - portraitH) / 2,
            borderRadius: 8 * scale,
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0.26)", "rgba(255,255,255,0.04)"]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Metallic security thread. */}
      <LinearGradient
        colors={["rgba(255,255,255,0.75)", "rgba(255,255,255,0.15)", "rgba(255,255,255,0.7)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[s.thread, { left: width * 0.42, width: Math.max(2, 2.6 * scale) }]}
      />

      {/* Intaglio numeral: dark impression under, light face over. */}
      <View style={[s.valueBlock, { right: undefined, left: 10 * scale, top: 8 * scale }]}>
        <Text style={[s.valueShadow, { fontSize: 30 * scale, color: spec.deep }]}>{value}</Text>
        <Text style={[s.value, { fontSize: 30 * scale }]}>{value}</Text>
        <Text style={[s.currency, { fontSize: 14 * scale }]}>₪</Text>
      </View>

      <Text style={[s.issuer, { fontSize: 8.5 * scale, left: 11 * scale, bottom: 19 * scale }]}>
        בנק ישראל
      </Text>
      <Text style={[s.face, { fontSize: 9.5 * scale, left: 11 * scale, bottom: 7 * scale }]}>
        {spec.face}
      </Text>

      {/* Microtext: at this size the individual glyphs are not legible on real
          money either — what the eye reads is the ruled texture. */}
      <View style={[s.micro, { bottom: 5 * scale, right: 8 * scale }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[s.microRule, { width: (26 - i * 6) * scale }]} />
        ))}
      </View>

      <Text style={[s.serial, { fontSize: 6.5 * scale, top: 7 * scale, right: 9 * scale }]}>
        {serialFor(value)}
      </Text>

      {/* Paper curvature: light along the top fold, shade into the bottom. */}
      <LinearGradient
        colors={["rgba(255,255,255,0.20)", "rgba(255,255,255,0)", "rgba(0,0,0,0.26)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Inner edge shadow — the note sits *in* the surface, not on it. */}
      <View style={s.inner} pointerEvents="none" />
    </View>
  );
}

const s = StyleSheet.create({
  note: {
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  window: { position: "absolute", overflow: "hidden" },
  thread: { position: "absolute", top: 0, bottom: 0, opacity: 0.55 },

  valueBlock: { position: "absolute" },
  valueShadow: {
    position: "absolute",
    top: 1.5,
    left: 1.5,
    fontFamily: FONTS.bold,
    opacity: 0.85,
  },
  value: { fontFamily: FONTS.bold, color: "#FFFFFF" },
  // Sits under the numeral, not across it: on the note itself the currency
  // mark is a separate line of type, and overlapping it turns both into mush.
  currency: {
    position: "absolute",
    top: "100%",
    left: 1,
    fontFamily: FONTS.bold,
    color: "rgba(255,255,255,0.85)",
  },

  issuer: { position: "absolute", fontFamily: FONTS.semibold, color: "rgba(255,255,255,0.9)", letterSpacing: 1.5 },
  face: { position: "absolute", fontFamily: FONTS.medium, color: "rgba(255,255,255,0.78)" },

  micro: { position: "absolute", gap: 2.5, alignItems: "flex-end" },
  microRule: { height: 1.5, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.4)" },

  serial: { position: "absolute", fontFamily: FONTS.medium, color: "rgba(255,255,255,0.72)", letterSpacing: 1 },

  inner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.28)",
  },
});

export default memo(Banknote);
