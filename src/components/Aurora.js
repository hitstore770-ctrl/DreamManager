import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useDerivedValue, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";

import { GRAD, UI } from "../utils/ui";
import { useSkia } from "../utils/skiaRuntime";

// A slow, living wash behind the hero screens.
//
// Skia draws it where Skia exists: three radial blooms drifting against each
// other on the GPU, which is the one way to get a mesh gradient that actually
// moves without repainting the tree every frame.
//
// Availability is a *runtime* question, not an import question, and getting
// that wrong crashes the screen.
//
// On web the module imports perfectly happily while its CanvasKit WASM backend
// is absent; the first <Canvas> to render then throws "CanvasKit is not
// defined" and the error boundary eats the whole page. So importing
// successfully proves nothing. Skia is only used once the backend has actually
// reported ready — on native that is immediate, on web only after
// LoadSkiaWeb() resolves against the wasm served from /canvaskit.wasm.
//
// If it never resolves (wasm not deployed, blocked, old browser) the screen
// stays on a static SVG wash that reads close enough that most people would
// not notice. Degrading is the design, not an afterthought.
//
// The loading itself lives in utils/skiaRuntime, shared with the register's
// glass tab indicator. It used to live here, requiring the module at import
// time and only then fetching the wasm — which meant `Skia.Skia` was captured
// as undefined before CanvasKit existed and the animated path never once ran
// on web. The order is load-then-require, and there is one loader so it cannot
// drift back apart.

const BLOOMS = [
  { key: "a", color: "#8B5CF6", r: 0.62, cx: 0.86, cy: 0.06, drift: 0.06, ms: 14000 },
  { key: "b", color: "#22D3EE", r: 0.58, cx: 0.08, cy: 0.92, drift: 0.05, ms: 18000 },
  { key: "c", color: "#F0ABFC", r: 0.44, cx: 0.5, cy: 0.46, drift: 0.08, ms: 22000 },
];

// Opacity is deliberately low. On a #F3F4F6 desk anything stronger stops being
// atmosphere and starts being a background image that the white cards have to
// fight.
const PEAK = 0.2;

// One bloom per component, so each owns its own hooks. Calling
// useDerivedValue inside a .map would work only for as long as BLOOMS never
// changes length — a rule of hooks violation waiting for someone to add a
// fourth colour.
function SkiaBloom({ skia, bloom, index, width, height, t }) {
  const { Circle: SkCircle, RadialGradient: SkRadial, vec, BlurMask } = skia;
  const r = Math.max(width, height) * bloom.r;

  // Each bloom drifts on its own phase, so the three never line up and the
  // field never visibly loops.
  const cx = useDerivedValue(() => {
    const phase = index % 2 === 0 ? t.value : 1 - t.value;
    return (bloom.cx + (phase - 0.5) * bloom.drift) * width;
  });
  const cy = useDerivedValue(() => {
    const phase = index === 1 ? t.value : 1 - t.value;
    return (bloom.cy + (phase - 0.5) * bloom.drift) * height;
  });

  return (
    <SkCircle cx={cx} cy={cy} r={r} opacity={PEAK}>
      <SkRadial c={vec(0, 0)} r={r} colors={[bloom.color, `${bloom.color}00`]} origin={vec(0, 0)} />
      <BlurMask blur={60} style="normal" />
    </SkCircle>
  );
}

function SkiaAurora({ skia, width, height }) {
  const { Canvas, Fill } = skia;
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill color={UI.bg} />
      {BLOOMS.map((b, i) => (
        <SkiaBloom key={b.key} skia={skia} bloom={b} index={i} width={width} height={height} t={t} />
      ))}
    </Canvas>
  );
}

// The fallback: the same three blooms, static, in SVG. Radial falloff matters
// more than motion — a hard-edged circle at 20% reads as a drawn shape rather
// than as light, and that is the difference people actually see.
function SvgAurora({ width, height }) {
  const r = Math.max(width, height) * 0.6;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {BLOOMS.map((b) => (
          <RadialGradient key={b.key} id={`au-${b.key}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={b.color} stopOpacity={PEAK * 1.4} />
            <Stop offset="0.5" stopColor={b.color} stopOpacity={PEAK * 0.4} />
            <Stop offset="1" stopColor={b.color} stopOpacity="0" />
          </RadialGradient>
        ))}
      </Defs>
      {BLOOMS.map((b) => (
        <Circle key={b.key} cx={b.cx * width} cy={b.cy * height} r={r * (b.r / 0.6)} fill={`url(#au-${b.key})`} />
      ))}
    </Svg>
  );
}

export default function Aurora({ style }) {
  const [size, setSize] = useState(null);
  const skia = useSkia();

  return (
    <View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) =>
          prev && prev.width === width && prev.height === height ? prev : { width, height }
        );
      }}
    >
      <LinearGradient colors={GRAD.canvas} style={StyleSheet.absoluteFill} />
      {!!size && (skia ? <SkiaAurora skia={skia} {...size} /> : <SvgAurora {...size} />)}
    </View>
  );
}
