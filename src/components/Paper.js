import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { BEVEL, CARD_SHADOW, GRAD, PASTEL, UI, glow, pastelFor } from "../utils/ui";

// The surfaces every screen is built from.
//
// All of them are the same physical object seen from different angles: a piece
// of paper resting on a desk. One soft shadow lifts it, one hairline separates
// it from the near-white desk behind, and the corners are rounded enough to
// read as friendly but not so much that it stops looking like a page.
//
// The hairline is doing more work than it looks. White paper on a #F3F4F6 desk
// is only a few percent apart in luminance, and a shadow alone leaves the top
// edge of every card invisible — the border is what closes the shape.

// The desk. A very slight vertical wash keeps a full screen of white cards
// from reading as one flat sheet, without ever becoming a visible gradient.
export function Canvas({ children, style, testID }) {
  return (
    <View testID={testID} style={[st.canvas, style]}>
      <LinearGradient colors={GRAD.canvas} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

// A plain white card. This is the default surface for anything that holds
// content: widgets, list rows, panels.
export function Card({ children, style, radius = UI.radius, lifted = true }) {
  return (
    <View
      style={[
        { backgroundColor: UI.surface, borderRadius: radius, ...BEVEL },
        lifted && CARD_SHADOW,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// A sticky note: a pastel stock with its own matching edge, and a slight tilt.
//
// The tilt is what makes a board of these read as notes pinned to a surface
// rather than as coloured rectangles in a grid. It is derived from the seed
// rather than random, so a note does not jump to a new angle every time the
// list re-renders — and it is kept under a degree and a half, because past
// that it stops looking placed and starts looking broken.
export function Note({ children, style, tone, seed, radius = UI.radius, tilt = true, testID }) {
  const stock = tone || pastelFor(seed);
  const angle = tilt ? deterministicTilt(seed) : 0;

  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: stock.bg,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: stock.edge,
          transform: [{ rotate: `${angle}deg` }],
        },
        CARD_SHADOW,
        style,
      ]}
    >
      {children}
    </View>
  );
}

function deterministicTilt(seed) {
  const s = String(seed || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  // -1.4 .. +1.4 degrees, in 0.4 steps.
  return ((h % 8) - 3.5) * 0.4;
}

// A coloured slab, for the few surfaces that are objects rather than paper —
// the money hero, primary buttons. Kept from the previous system because a
// gradient card still belongs on a light desk; only its ramps changed.
export function GradCard({ children, style, colors = GRAD.violet, halo, radius = UI.radius, angle = 1 }) {
  return (
    <View style={[{ borderRadius: radius }, halo ? glow(halo, 0.28) : CARD_SHADOW, style]}>
      <View style={{ borderRadius: radius, overflow: "hidden" }}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: angle, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Specular band across the top third. */}
        <LinearGradient
          colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0)"]}
          locations={[0, 0.55]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {children}
      </View>
    </View>
  );
}

// The torn/folded corner that says "note" faster than any other single cue.
// Two triangles: the shadow the fold casts, and the lighter underside of the
// paper itself.
export function FoldedCorner({ size = 20, tone = PASTEL.white, style }) {
  return (
    <View style={[{ position: "absolute", top: 0, left: 0 }, style]} pointerEvents="none">
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: size,
          borderRightWidth: size,
          borderTopColor: tone.edge,
          borderRightColor: "transparent",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          borderTopWidth: size - 4,
          borderRightWidth: size - 4,
          borderTopColor: "rgba(255,255,255,0.75)",
          borderRightColor: "transparent",
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: UI.bg },
});
