import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton } from "./ToolKit";

const POMODORO_SECONDS = 25 * 60;

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(minutes)}:${pad(seconds)}`;
}

export default function PomodoroTimer() {
  const [seconds, setSeconds] = useState(POMODORO_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => stopInterval, []);

  const start = () => {
    if (isRunning || seconds === 0) return;
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          stopInterval();
          setIsRunning(false);
          alert("הפומודורו הסתיים! מגיע לך הפסקה 🎉");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pause = () => {
    stopInterval();
    setIsRunning(false);
  };

  const reset = () => {
    stopInterval();
    setIsRunning(false);
    setSeconds(POMODORO_SECONDS);
  };

  const progress = 1 - seconds / POMODORO_SECONDS;

  return (
    <View>
      <View style={styles.clockBox}>
        <Text style={styles.clockText}>{formatClock(seconds)}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
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
  clockBox: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 18,
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 18,
  },
  clockText: {
    color: COLORS.textPrimary,
    fontSize: 56,
    fontFamily: FONTS.bold,
    letterSpacing: 2,
    marginBottom: 16,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(17, 24, 39, 0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  gap: {
    width: 12,
  },
});
