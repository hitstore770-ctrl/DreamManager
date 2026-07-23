import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton } from "./ToolKit";

const PRESETS = [1, 3, 5, 10, 25];

function formatClock(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function VisualHourglass() {
  const [totalSeconds, setTotalSeconds] = useState(5 * 60);
  const [remaining, setRemaining] = useState(5 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => stop, []);

  const start = () => {
    if (isRunning || remaining === 0) return;
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          stop();
          setIsRunning(false);
          alert("הזמן נגמר! ⏳");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pause = () => {
    stop();
    setIsRunning(false);
  };

  const reset = () => {
    stop();
    setIsRunning(false);
    setRemaining(totalSeconds);
  };

  const choosePreset = (minutes) => {
    stop();
    setIsRunning(false);
    setTotalSeconds(minutes * 60);
    setRemaining(minutes * 60);
  };

  // Sand that has fallen (bottom bulb) grows as time passes.
  const fallen = totalSeconds > 0 ? 1 - remaining / totalSeconds : 0;

  return (
    <View>
      <View style={styles.glass}>
        <View style={styles.bulb}>
          <View style={[styles.sandTop, { flex: Math.max(0.0001, 1 - fallen) }]} />
          <View style={styles.emptyTop} />
        </View>
        <Text style={styles.neck}>⏳</Text>
        <View style={styles.bulb}>
          <View style={styles.emptyBottom} />
          <View style={[styles.sandBottom, { flex: Math.max(0.0001, fallen) }]} />
        </View>
      </View>

      <Text style={styles.clock}>{formatClock(remaining)}</Text>

      <View style={styles.presetRow}>
        {PRESETS.map((minutes) => (
          <TouchableOpacity
            key={minutes}
            style={[styles.preset, totalSeconds === minutes * 60 && styles.presetActive]}
            onPress={() => choosePreset(minutes)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.presetText,
                totalSeconds === minutes * 60 && styles.presetTextActive,
              ]}
            >
              {minutes}′
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.buttonRow}>
        {isRunning ? (
          <ToolButton label="השהה" onPress={pause} color="#E07C1D" />
        ) : (
          <ToolButton label="התחל" onPress={start} color="#1E9E58" />
        )}
        <View style={styles.gap} />
        <ToolButton label="איפוס" onPress={reset} color={COLORS.textMuted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    alignItems: "center",
    marginBottom: 8,
  },
  bulb: {
    width: 120,
    height: 90,
    overflow: "hidden",
  },
  sandTop: {
    backgroundColor: "#F2C879",
    width: "100%",
  },
  emptyTop: { flex: 0 },
  emptyBottom: { flex: 1 },
  sandBottom: {
    backgroundColor: "#F2C879",
    width: "100%",
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },
  neck: {
    fontSize: 26,
    marginVertical: -6,
  },
  clock: {
    color: COLORS.textPrimary,
    fontSize: 44,
    fontFamily: FONTS.bold,
    textAlign: "center",
    marginVertical: 12,
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  preset: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(45, 42, 50, 0.05)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  presetActive: {
    backgroundColor: "rgba(59, 91, 219, 0.12)",
    borderColor: COLORS.accent,
  },
  presetText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
  presetTextActive: {
    color: COLORS.accent,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  gap: {
    width: 12,
  },
});
