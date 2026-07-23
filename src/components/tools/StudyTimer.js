import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton } from "./ToolKit";

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(minutes)}:${pad(seconds)}`;
}

export default function StudyTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Always clear the interval when the tool unmounts (e.g. modal closes).
  useEffect(() => stopInterval, []);

  const start = () => {
    if (isRunning) return;
    setIsRunning(true);
    intervalRef.current = setInterval(() => setSeconds((prev) => prev + 1), 1000);
  };

  const pause = () => {
    stopInterval();
    setIsRunning(false);
  };

  const reset = () => {
    stopInterval();
    setIsRunning(false);
    setSeconds(0);
  };

  return (
    <View>
      <View style={styles.clockBox}>
        <Text style={styles.clockText}>{formatClock(seconds)}</Text>
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
    borderRadius: 18,
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 18,
  },
  clockText: {
    color: COLORS.textPrimary,
    fontSize: 52,
    fontFamily: FONTS.bold,
    letterSpacing: 2,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  gap: {
    width: 12,
  },
});
