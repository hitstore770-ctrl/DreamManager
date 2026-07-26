import { StyleSheet, View } from "react-native";

// Gradients without expo-linear-gradient: a stack of thin bands whose opacity
// ramps down the card. Adding a native gradient module risks the build, and at
// 16 bands the steps are invisible at card size while staying pure Views.

const BANDS = 16;

// Dark scrim so white text stays readable over any cover. Opacity eases in
// quadratically, so the top stays clear and the bottom carries the weight.
export function Scrim({ from = "#000", style, strength = 0.78 }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {Array.from({ length: BANDS }, (_, i) => {
        const t = i / (BANDS - 1);
        return (
          <View
            key={i}
            style={{ flex: 1, backgroundColor: from, opacity: t * t * strength }}
          />
        );
      })}
    </View>
  );
}

// Two-tone cover for dreams without a photo: the lighter shade fades into the
// darker one from top to bottom.
export function CoverGradient({ colors }) {
  const [light, dark] = colors;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: dark }]}>
      {Array.from({ length: BANDS }, (_, i) => {
        const t = i / (BANDS - 1);
        return (
          <View key={i} style={{ flex: 1, backgroundColor: light, opacity: 1 - t }} />
        );
      })}
    </View>
  );
}
