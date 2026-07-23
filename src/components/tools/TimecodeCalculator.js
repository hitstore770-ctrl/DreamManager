import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ToolButton, ToolField, ToolResult, ToolResultCard } from "./ToolKit";

// Parse "MM:SS" (seconds must be 0-59). Returns total seconds or null.
function parseTimecode(input) {
  const parts = input.split(":").map((part) => part.trim());
  if (parts.length !== 2) return null;
  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);
  if (
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    minutes < 0 ||
    seconds < 0 ||
    seconds >= 60
  ) {
    return null;
  }
  return minutes * 60 + seconds;
}

function formatTimecode(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export default function TimecodeCalculator() {
  const [track1, setTrack1] = useState("");
  const [track2, setTrack2] = useState("");
  const [result, setResult] = useState(null);

  const compute = (mode) => {
    const first = parseTimecode(track1);
    const second = parseTimecode(track2);
    if (first === null || second === null) {
      setResult(null);
      alert("נא להזין זמנים תקינים בפורמט MM:SS");
      return;
    }
    const total = mode === "add" ? first + second : first - second;
    setResult(formatTimecode(total));
  };

  return (
    <View>
      <ToolField
        label="רצועה 1 (MM:SS)"
        value={track1}
        onChangeText={setTrack1}
        placeholder="03:45"
        keyboardType="default"
      />
      <ToolField
        label="רצועה 2 (MM:SS)"
        value={track2}
        onChangeText={setTrack2}
        placeholder="01:30"
        keyboardType="default"
      />

      <View style={styles.buttonRow}>
        <ToolButton label="חיבור +" onPress={() => compute("add")} color="#1E9E58" />
        <View style={styles.gap} />
        <ToolButton label="חיסור −" onPress={() => compute("subtract")} color="#E07C1D" />
      </View>

      {result && (
        <ToolResultCard>
          <ToolResult label="אורך כולל" value={result} highlight />
        </ToolResultCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  gap: {
    width: 12,
  },
});
