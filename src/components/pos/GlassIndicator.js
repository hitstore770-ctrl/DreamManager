import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { useSkia } from "../../utils/skiaRuntime";

// The frosted slab that sits behind the active category.
//
// Two implementations of the same object. Skia draws it properly: a blurred,
// colour-bled pane with a light-catching top edge, which is what actually
// reads as glass. Where Skia cannot run, a gradient view stands in — close
// enough that the bar does not look broken, and honest about the difference
// rather than pretending.
//
// Why a runtime probe and not `Platform.OS`: Skia needs CanvasKit's WASM on
// web and a development build on native (it is not in Expo Go). Resolving the
// import proves neither. So the gate is an actual drawing call — if
// `Skia.Paint()` does not come back with an object, the module is half-wired
// and rendering a <Canvas> would crash the screen, not degrade it.
//
// Serving this on web needs one build step this repo does not do for you:
// copy node_modules/canvaskit-wasm/bin/full/canvaskit.wasm to the site root,
// beside index.html. Without it the fetch 404s, the probe fails cleanly and
// the gradient pane takes over — which is why the web preview can look
// "finished" while the real renderer never ran. Native builds bundle their own
// Skia and need none of this.

// The Skia pane.
//
// `x` and `width` are Reanimated shared values handed straight to Skia props.
// That is not a shortcut — Skia types every prop as `T | { value: T }`, so a
// shared value is a first-class animated input, and the whole movement stays
// off the JS thread. The bar keeps up with a fast flick instead of stepping.
function SkiaPane({ mod, x, width, height, color, radius }) {
  const { BlurMask, Canvas, RoundedRect } = mod;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* The colour bleed under the glass — the thing that makes it read as a
          pane over something rather than a white rectangle. */}
      <RoundedRect x={x} y={0} width={width} height={height} r={radius} color={color} opacity={0.18}>
        <BlurMask blur={12} style="normal" />
      </RoundedRect>
      {/* The pane itself, and the light caught along its top edge. */}
      <RoundedRect x={x} y={0} width={width} height={height} r={radius} color="rgba(255,255,255,0.90)" />
      <RoundedRect x={x} y={0} width={width} height={2.5} r={1.25} color="rgba(255,255,255,1)" />
    </Canvas>
  );
}

function GradientPane({ x, width, height, color, radius }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: width.value,
  }));

  return (
    <Animated.View pointerEvents="none" style={[st.fallback, { height, borderRadius: radius }, style]}>
      <LinearGradient
        colors={["rgba(255,255,255,0.96)", "rgba(255,255,255,0.78)"]}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1, borderColor: color + "26" }]} />
    </Animated.View>
  );
}

export default function GlassIndicator({ x, width, height = 44, color = "#7C3AED", radius = 14 }) {
  const mod = useSkia();
  return mod ? (
    <SkiaPane mod={mod} x={x} width={width} height={height} color={color} radius={radius} />
  ) : (
    <GradientPane x={x} width={width} height={height} color={color} radius={radius} />
  );
}

const st = StyleSheet.create({
  fallback: {
    position: "absolute",
    left: 0,
    top: 0,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 7,
    elevation: 3,
  },
});
