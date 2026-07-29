import { useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from "expo-audio";

import Icon from "../Icon";
import CustomText from "../CustomText";
import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { isWhisperConfigured, transcribe } from "../../config/whisperConfig";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { parseOrderText } from "../../utils/orderParser";
import { CARD_SHADOW, UI } from "../../utils/ui";

// Dictation for orders and blind stocktakes.
//
// Two input paths behind one button, and which one you get is decided by
// whether a Whisper key is configured — not by a toggle the user has to find:
//
//   with a key    hold to record → Whisper → parsed into the cart
//   without one   the same parser, fed by typed text
//
// The typed path is not a consolation prize. It is the same parser doing the
// same work, and it is the path that runs in this build, because there is no
// key here. What the sheet never does is invent a transcription to make the
// feature look finished.

export default function VoiceOrderButton({ deck, onLines, label = "הכתבת הזמנה", testID = "pos-voice" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        testID={testID}
        activeOpacity={0.85}
        style={st.fab}
        onPress={() => {
          hapticLight();
          setOpen(true);
        }}
      >
        <Icon name="mic" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={st.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={st.sheet} onPress={(e) => e.stopPropagation()}>
            <VoicePanel
              deck={deck}
              label={label}
              onDone={(lines) => {
                onLines(lines);
                setOpen(false);
              }}
              onClose={() => setOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function VoicePanel({ deck, label, onDone, onClose }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const keyed = useRef(isWhisperConfigured).current;

  const parsed = parseOrderText(text, deck);

  const startRecording = async () => {
    setError(null);
    try {
      const granted = await requestRecordingPermissionsAsync();
      if (!granted?.granted) {
        setError("אין הרשאת מיקרופון. אפשר לאשר בהגדרות המכשיר, או פשוט להקליד את ההזמנה.");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      hapticLight();
    } catch (e) {
      setError(`ההקלטה לא התחילה: ${e?.message || e}`);
    }
  };

  const stopRecording = async () => {
    setRecording(false);
    setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("לא נוצר קובץ הקלטה");

      // transcribe() reports failure in its return value rather than by
      // throwing, so an unchecked call would silently append "undefined" to
      // the order line.
      const result = await transcribe(uri);
      if (!result.ok) {
        if (!result.aborted) setError(result.error);
        hapticWarning();
        return;
      }
      setText((prev) => (prev ? `${prev}, ${result.text}` : result.text));
      hapticSuccess();
    } catch (e) {
      setError(`התמלול נכשל: ${e?.message || e}`);
      hapticWarning();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={st.head}>
        <TouchableOpacity style={st.headBtn} onPress={onClose}>
          <Icon name="x" size={18} color={UI.ink} />
        </TouchableOpacity>
        <CustomText style={st.title}>{label}</CustomText>
      </View>

      {keyed ? (
        <TouchableOpacity
          testID="voice-record"
          style={[st.recordBtn, recording && { backgroundColor: UI.red }]}
          onPress={recording ? stopRecording : startRecording}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Icon name={recording ? "square" : "mic"} size={20} color="#FFFFFF" />
              <CustomText style={st.recordText}>{recording ? "עצור ותמלל" : "הקלט הזמנה"}</CustomText>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View style={st.notice}>
          <CustomText style={st.noticeTitle}>הקלטה קולית לא מוגדרת בבילד הזה</CustomText>
          <CustomText style={st.noticeBody}>
            תמלול דורש מפתח של OpenAI במשתנה EXPO_PUBLIC_OPENAI_API_KEY. עד שיוגדר — הכתיבה למטה עוברת בדיוק באותו מנתח,
            והתוצאה זהה.
          </CustomText>
        </View>
      )}

      <TextInput
        testID="voice-text"
        style={st.input}
        value={text}
        onChangeText={setText}
        multiline
        placeholder={'למשל: "שתי פחיות ועוד טוסט, 3 צ׳יפס"'}
        placeholderTextColor={UI.inkMuted}
        textAlign="right"
      />

      {!!error && <CustomText style={st.error}>{error}</CustomText>}

      {parsed.lines.length > 0 && (
        <View style={st.preview}>
          {parsed.lines.map((l) => (
            <View key={l.item.sku} style={st.previewRow}>
              <CustomText style={st.previewQty}>×{l.qty}</CustomText>
              <CustomText style={st.previewName}>{l.item.name}</CustomText>
            </View>
          ))}
        </View>
      )}

      {parsed.unmatched.length > 0 && (
        <CustomText style={st.unmatched}>לא זוהה: {parsed.unmatched.join(" · ")}</CustomText>
      )}

      <TouchableOpacity
        testID="voice-apply"
        style={[st.apply, !parsed.lines.length && { opacity: 0.4 }]}
        disabled={!parsed.lines.length}
        onPress={() => {
          hapticSuccess();
          onDone(parsed.lines);
        }}
      >
        <CustomText style={st.applyText}>
          {parsed.lines.length ? `הוסף ${parsed.lines.length} שורות לעגלה` : "אין שורות מזוהות"}
        </CustomText>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  fab: {
    position: "absolute",
    left: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: UI.coral,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: UI.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 34,
  },
  head: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  headBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: UI.surfaceHi, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: FONTS.bold, fontSize: 17, color: UI.ink, textAlign: "right" },

  recordBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: UI.violet,
  },
  recordText: { fontFamily: FONTS.bold, fontSize: 15, color: "#FFFFFF" },

  notice: { backgroundColor: UI.surfaceHi, borderRadius: 14, padding: 13, gap: 5 },
  noticeTitle: { fontFamily: FONTS.bold, fontSize: 13, color: UI.ink, textAlign: "right" },
  noticeBody: { fontFamily: FONTS.regular, fontSize: 12, color: UI.inkSoft, textAlign: "right", lineHeight: 19 },

  input: {
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: UI.surfaceAlt,
    borderWidth: 1,
    borderColor: UI.hairline,
    padding: 14,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: UI.ink,
    textAlignVertical: "top",
  },
  error: { fontFamily: FONTS.medium, fontSize: 12, color: UI.red, textAlign: "right", lineHeight: 19 },

  preview: { backgroundColor: UI.surfaceAlt, borderRadius: 14, padding: 10, gap: 6 },
  previewRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  previewQty: { fontFamily: FONTS.bold, fontSize: 13, color: UI.violet, minWidth: 30 },
  previewName: { flex: 1, fontFamily: FONTS.medium, fontSize: 13.5, color: UI.ink, textAlign: "right" },
  unmatched: { fontFamily: FONTS.regular, fontSize: 12, color: UI.amber, textAlign: "right" },

  apply: { minHeight: 52, borderRadius: 16, backgroundColor: UI.violet, alignItems: "center", justifyContent: "center" },
  applyText: { fontFamily: FONTS.bold, fontSize: 15, color: "#FFFFFF" },
});
