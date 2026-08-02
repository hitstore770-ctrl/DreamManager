import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { RADIUS, useTheme } from "../theme/ThemeContext";

// A single shimmering placeholder block -- a gentle opacity pulse rather
// than a sweeping gradient, since that needs no extra dependency (no
// linear-gradient library in this project) and reads just as "loading,
// not broken" without drawing more attention than the content it's
// standing in for.
export function Skeleton({ width, height, radius = 6, style }) {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: theme.surfaceAlt, opacity: pulse }, style]}
    />
  );
}

// A stand-in for one note-list card: title bar, two preview lines, a
// meta line -- same footprint as the real card so the list doesn't jump
// when the skeleton rows swap in for real data.
export function SkeletonCard() {
  const theme = useTheme();
  return (
    <View style={[s.card, { backgroundColor: theme.surface, ...theme.cardShadow }]}>
      <Skeleton width="55%" height={15} radius={4} style={{ marginBottom: 10 }} />
      <Skeleton width="90%" height={11} radius={4} style={{ marginBottom: 6 }} />
      <Skeleton width="70%" height={11} radius={4} style={{ marginBottom: 12 }} />
      <Skeleton width={70} height={10} radius={4} />
    </View>
  );
}

export function SkeletonList({ rows = 4 }) {
  return (
    <View style={{ padding: 14 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, padding: 16, marginBottom: 12 },
});
