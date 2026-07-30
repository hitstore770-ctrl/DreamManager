import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { BEVEL, CARD_SHADOW, GRAD, PASTEL, SHADOW_AMBIENT, SHADOW_CONTACT, STICKY_SHADOW, UI, glow, pastelFor, tiltFor } from "../utils/ui";

// The surfaces every screen is built from.
//
// All of them are one object: a white plane, separated from the plane behind
// it by a single hairline. The shadow is almost nothing on purpose — if a card
// cannot be found without it, the spacing is wrong and no amount of blur will
// fix that.

// The page. Flat white, and that is the whole design.
//
// `aurora` used to swap in a drifting three-colour Skia bloom behind the hero
// screens. It is accepted and ignored now rather than removed from the call
// sites, because a soft coloured glow behind a balance is the exact thing this
// theme exists to get rid of.
export function Canvas({ children, style, testID, aurora = false }) {
  return (
    <View testID={testID} style={[st.canvas, style]}>
      {children}
    </View>
  );
}

// A plain white card. This is the default surface for anything that holds
// content: widgets, list rows, panels.
export function Card({ children, style, radius = UI.radius, lifted = true }) {
  // Two nested views so two shadows can stack: a wide ambient pool on the
  // outside, a tight contact shadow on the inside. One view can only carry one
  // shadow, and a single shadow can be soft or defined, never both.
  const face = (
    <View
      style={[
        { backgroundColor: UI.surface, borderRadius: radius, ...BEVEL },
        lifted && SHADOW_CONTACT,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!lifted) return face;
  return <View style={[{ borderRadius: radius }, SHADOW_AMBIENT]}>{face}</View>;
}

// A sticky note: a pastel stock with its own matching edge, a slight tilt,
// and a shadow distinct enough to read as paper lifted off the surface
// behind it — this is the one surface in the app that is meant to look
// physical rather than flat.
//
// The tilt is what makes a board of these read as notes pinned to a surface
// rather than as coloured rectangles in a grid. It is derived from the seed
// rather than random, so a note does not jump to a new angle every time the
// list re-renders — and it is kept under a degree and a half, because past
// that it stops looking placed and starts looking broken.
export function Note({ children, style, tone, seed, radius = UI.radius, tilt = true, testID }) {
  const stock = tone || pastelFor(seed);
  const angle = tilt ? tiltFor(seed) : 0;

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
        STICKY_SHADOW,
        style,
      ]}
    >
      {children}
    </View>
  );
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
