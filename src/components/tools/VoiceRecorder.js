import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { formatDateTime } from "../../utils/format";
import { usePersistentState } from "../../utils/usePersistentState";
import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton } from "./ToolKit";

export default function VoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const player = useAudioPlayer();
  const [recordings, setRecordings] = usePersistentState("@dreammanager/recordings", []);

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        alert("נדרשת הרשאת מיקרופון כדי להקליט");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      alert("שגיאה בפתיחת המיקרופון");
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      if (recorder.uri) {
        setRecordings((prev) => [
          { id: Date.now().toString(), uri: recorder.uri, date: new Date().toISOString() },
          ...prev,
        ]);
      }
    } catch {
      alert("שגיאה בסיום ההקלטה");
    }
  };

  const playRecording = (uri) => {
    try {
      player.replace({ uri });
      player.play();
    } catch {
      alert("שגיאה בהשמעת ההקלטה");
    }
  };

  const removeRecording = (id) =>
    setRecordings((prev) => prev.filter((r) => r.id !== id));

  const isRecording = recorderState?.isRecording;

  return (
    <View>
      <View style={styles.statusBox}>
        <Text style={styles.statusEmoji}>{isRecording ? "🔴" : "🎙️"}</Text>
        <Text style={styles.statusText}>{isRecording ? "מקליט..." : "מוכן להקלטה"}</Text>
      </View>

      {isRecording ? (
        <ToolButton label="עצור הקלטה" onPress={stopRecording} color="#D14343" />
      ) : (
        <ToolButton label="התחל הקלטה" onPress={startRecording} color="#1E9E58" />
      )}

      <Text style={styles.listTitle}>הקלטות שמורות</Text>
      {recordings.length === 0 ? (
        <Text style={styles.empty}>אין הקלטות עדיין</Text>
      ) : (
        recordings.map((rec) => (
          <View key={rec.id} style={styles.row}>
            <TouchableOpacity onPress={() => removeRecording(rec.id)} style={styles.delete}>
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.play} onPress={() => playRecording(rec.uri)}>
              <Text style={styles.playText}>▶︎</Text>
            </TouchableOpacity>
            <Text style={styles.date}>{formatDateTime(rec.date)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  statusBox: { alignItems: "center", marginBottom: 18 },
  statusEmoji: { fontSize: 40, marginBottom: 8 },
  statusText: { color: COLORS.textSecondary, fontSize: 15, fontFamily: FONTS.medium },
  listTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginTop: 22,
    marginBottom: 12,
  },
  empty: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(45, 42, 50, 0.04)",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  delete: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(45, 42, 50, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: COLORS.textSecondary, fontSize: 11, fontFamily: FONTS.bold },
  play: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
  },
  playText: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold, marginStart: 2 },
  date: { flex: 1, color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.regular, textAlign: "right" },
});
