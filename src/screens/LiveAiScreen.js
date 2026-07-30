import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, I18nManager, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import RichText from "../components/RichText";
import { NOA_TOOLS, callGeminiWithTools, isGeminiConfigured } from "../config/geminiConfig";
import { NOA_MAX_OUTPUT_TOKENS, NOA_NAME, buildNoaPrompt } from "../config/noaPersona";
import { isWhisperConfigured, transcribe } from "../config/whisperConfig";
import { DEFAULT_SHORTCUTS, suggestShortcuts } from "../utils/noaShortcuts";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { Canvas } from "../components/Paper";
import { BEVEL, BUBBLE_SHADOW, CARD_SHADOW, TYPE, UI, tint } from "../utils/ui";
import CustomText from "../components/CustomText";

// Zone 1 — Noa, the assistant. Every bubble is a small sheet of paper, quick
// actions above the input, and a GPS fix taken quietly in the background.
//
// "Silently" means without a modal or a spinner in the way, not without asking:
// the OS permission prompt is not ours to skip, and a location grabbed with no
// prompt at all is not something the platform allows or a user should accept.
// The request goes out once on mount and the screen stays usable if it is
// refused — the prompt then says the location is unknown so the model asks
// instead of guessing.

const HOME = "ביתר עילית";

const QUICK = [
  { key: "school", icon: "book-open", label: "מסלול לפנימייה", q: "מה הדרך הכי מהירה מהמיקום שלי לפנימייה עכשיו? קווים וזמנים." },
  { key: "home", icon: "home", label: "מסלול הביתה", q: `מה הדרך הכי מהירה מהמיקום שלי ל${HOME} עכשיו? קווים וזמנים.` },
  { key: "last", icon: "clock", label: "אוטובוס אחרון", q: "מה האוטובוס האחרון היום בכיוון הזה, ומאיזו תחנה?" },
  { key: "near", icon: "map-pin", label: "תחנות קרובות", q: "אילו תחנות אוטובוס קרובות למיקום שלי ואילו קווים עוצרים בהן?" },
];

// Noa's persona, plus the facts this screen actually holds.
//
// The persona tells her to cross-reference physical location and to interrogate
// rather than guess when data is missing. Handing her the GPS the phone is
// already reporting is therefore part of the brief, not a deviation from it —
// withholding it would have her demand a location the app already knows.
function systemPrompt(place) {
  return buildNoaPrompt({
    "Current GPS": place ? `${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}` : null,
    "Home base": HOME,
    "Weekday base": "residential boarding school (פנימייה)",
    "Local time": new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
    "Known constraint":
      "Israeli public transit stops early on Fridays and holiday eves — factor that into planning, but the live feed is authoritative on actual departures.",
  });
}

export default function LiveAiScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [pendingImage, setPendingImage] = useState(null);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [place, setPlace] = useState(null);
  const [locState, setLocState] = useState("idle");

  // Quick actions are re-derived after every exchange, so they follow the
  // conversation instead of sitting there as four fixed buttons.
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const listRef = useRef(null);
  const abortRef = useRef(null);
  const recorderRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const locate = useCallback(async (quiet) => {
    if (!quiet) hapticLight();
    setLocState("asking");
    try {
      // Lazy import so a build without the module still opens the screen.
      const Location = await import("expo-location");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocState("denied");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPlace({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setLocState("ok");
    } catch {
      setLocState("error");
    }
  }, []);

  // Quiet fix on mount, so the first quick action already has coordinates.
  useEffect(() => {
    locate(true);
  }, [locate]);

  const send = useCallback(
    async (text) => {
      const clean = (text ?? draft).trim();
      if (!clean || loading) return;

      hapticLight();
      setError(null);
      setDraft("");

      const next = [...messages, { id: `u-${Date.now()}`, role: "user", text: clean }];
      setMessages(next);
      setLoading(true);

      if (!isGeminiConfigured()) {
        setLoading(false);
        setError("לא הוגדר מפתח Gemini. אפשר להזין אותו במסך ההגדרות.");
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // The toolkit is offered, never forced. Most turns come back as prose
        // having touched nothing; the runner only round-trips a function when
        // the model actually asks for one, and hands back the finished text
        // either way. The screen does not branch on it.
        const res = await callGeminiWithTools(
          {
            systemInstruction: { parts: [{ text: systemPrompt(place) }] },
            contents: next.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
            generationConfig: { temperature: 0.4, maxOutputTokens: NOA_MAX_OUTPUT_TOKENS },
          },
          { tools: NOA_TOOLS, signal: controller.signal }
        );

        if (controller.signal.aborted) return;
        setLoading(false);

        if (!res.ok) {
          hapticWarning();
          setError(res.detail || `הבקשה נכשלה (${res.status}).`);
          return;
        }
        const reply = res.text || "";
        if (!reply) {
          hapticWarning();
          setError("המודל החזיר תשובה ריקה. נסה לנסח אחרת.");
          return;
        }
        hapticSuccess();

        // Detached on purpose: the shortcuts are a nicety, and the chat must
        // never wait on — or fail because of — a second request.
        const turn = [...next, { role: "model", text: reply }];
        suggestShortcuts(turn, shortcuts)
          .then((fresh) => { if (fresh) setShortcuts(fresh); })
          .catch(() => {});

        // res.model is the id that *answered*, which is not always the id at
        // the head of the list — the fallback chain may have moved on. The
        // badge reports that, so it can never claim a model that was not used.
        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}`,
            role: "model",
            text: reply,
            model: res.model,
            tools: res.toolsUsed,
          },
        ]);
      } catch (e) {
        if (e?.name === "AbortError") return;
        setLoading(false);
        hapticWarning();
        setError("אין חיבור לרשת. בדוק את האינטרנט ונסה שוב.");
      }
    },
    [draft, loading, messages, place, shortcuts]
  );

  // Hold to talk. expo-audio records, Whisper transcribes, and the text lands
  // in the composer rather than sending itself — a mis-heard word should be
  // fixable before it is asked.
  const startRecording = useCallback(async () => {
    if (recording || transcribing) return;
    if (!isWhisperConfigured()) {
      setError("לא הוגדר מפתח OpenAI. אפשר להזין אותו במסך ההגדרות.");
      return;
    }
    try {
      const Audio = await import("expo-audio");
      const granted = await Audio.requestRecordingPermissionsAsync?.();
      if (granted && granted.granted === false) {
        setError("צריך הרשאת מיקרופון כדי להקליט.");
        return;
      }
      hapticLight();
      const recorder = new Audio.AudioRecorder(Audio.RecordingPresets?.HIGH_QUALITY);
      await recorder.prepareToRecordAsync();
      recorder.record();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("לא הצלחתי להתחיל הקלטה במכשיר הזה.");
    }
  }, [recording, transcribing]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setRecording(false);
    setTranscribing(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      recorderRef.current = null;
      const res = await transcribe(uri);
      if (res.ok) {
        hapticSuccess();
        setDraft((d) => (d ? `${d} ${res.text}` : res.text));
      } else if (res.error) {
        hapticWarning();
        setError(res.error);
      }
    } catch {
      hapticWarning();
      setError("התמלול נכשל.");
    } finally {
      setTranscribing(false);
    }
  }, []);

  const openCamera = useCallback(() => {
    hapticLight();
    navigation?.navigate("VisionCamera", {
      onCaptured: (photo) => {
        // The image is handed to the next turn as context. Recognition itself
        // is the Vision API's job and is not wired yet — see the note in the
        // final report rather than a fake result here.
        setDraft((d) => (d ? `${d} [תמונה צורפה]` : "תסתכלי על התמונה הזו ותגידי לי מה זה. [תמונה צורפה]"));
        setPendingImage(photo?.base64 ? { base64: photo.base64 } : null);
      },
    });
  }, [navigation]);

  useEffect(() => {
    if (!messages.length) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages.length, loading]);

  return (
    <Canvas aurora testID="ai-screen" style={{ paddingTop: insets.top + 10 }}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <CustomText style={s.title}>נועה</CustomText>
          <CustomText style={s.subtitle} numberOfLines={1}>
            {locState === "ok" && place
              ? `מיקום ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`
              : locState === "asking"
                ? "מאתר מיקום..."
                : locState === "denied"
                  ? "ללא מיקום — כתוב מאיפה אתה יוצא"
                  : "סגנית מנהל תפעול"}
          </CustomText>
        </View>
        <Bounce
          testID="live-locate"
          style={[s.glassBtn, locState === "ok" && { backgroundColor: UI.green + "1A" }]}
          scaleTo={0.9}
          onPress={() => locate(false)}
        >
          {locState === "asking" ? (
            <ActivityIndicator size="small" color={UI.violet} />
          ) : (
            <Icon name="map-pin" size={18} color={locState === "ok" ? UI.green : UI.inkSoft} />
          )}
        </Bounce>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeInDown.delay(Math.min(index * 40, 240)).springify().damping(15)}
              style={[s.row, item.role === "user" ? s.rowMine : s.rowTheirs]}
            >
              <View style={{ maxWidth: "88%" }}>
                <View style={[s.bubble, item.role === "user" ? s.userBubble : s.modelBubble]}>
                  {item.role === "user" ? (
                    <CustomText style={[s.bubbleText, s.bubbleTextMine]} selectable>
                      {item.text}
                    </CustomText>
                  ) : (
                    // Noa is instructed to write Markdown, so her replies have
                    // to be rendered as Markdown — otherwise the persona makes
                    // the output harder to read than plain prose.
                    <RichText text={item.text} color={UI.ink} size={15} />
                  )}
                </View>
                {item.role === "model" && !!item.model && (
                  <View style={s.badgeRow}>
                    <CustomText testID={`model-badge-${item.id}`} style={s.badge}>
                      {NOA_NAME} • {item.model}
                    </CustomText>
                    {!!item.tools?.length && (
                      <View testID={`tool-chip-${item.id}`} style={s.toolChip}>
                        <Icon name="database" size={9} color={UI.cyan} />
                        <CustomText style={s.toolChipText}>{item.tools.join(" · ")}</CustomText>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </Animated.View>
          )}
          ListEmptyComponent={
            <Animated.View entering={FadeIn.duration(300)} style={s.empty}>
              <View style={s.emptyGlass}>
                <Icon name="navigation" size={30} color={UI.violet} />
              </View>
              <CustomText style={s.emptyTitle}>מה על הפרק?</CustomText>
              <CustomText style={s.emptyBody}>
נועה — סגנית מנהל התפעול שלך. לוגיסטיקה, מספרים, תכנון. המיקום הנוכחי נשלח יחד עם
                השאלה, כדי שהיא לא תצטרך לשאול איפה אתה.
              </CustomText>
              {!isGeminiConfigured() && (
                <View style={s.keyWarning}>
                  <Icon name="key" size={15} color="#8A6D00" />
                  <CustomText style={s.keyWarningText}>
                    אין מפתח Gemini. אפשר להזין אותו במסך ההגדרות.
                  </CustomText>
                </View>
              )}
            </Animated.View>
          }
          ListFooterComponent={
            <>
              {loading && (
                <Animated.View entering={FadeIn.duration(200)} style={[s.bubble, s.modelBubble, s.typing]}>
                  <ActivityIndicator size="small" color={UI.violet} />
                  <CustomText style={s.typingText}>בודק מסלולים...</CustomText>
                </Animated.View>
              )}
              {!!error && (
                <Animated.View entering={FadeIn.duration(200)} style={s.errorCard}>
                  <Icon name="alert-circle" size={16} color={UI.coral} />
                  <CustomText style={s.errorText}>{error}</CustomText>
                </Animated.View>
              )}
            </>
          }
        />

        {/* Three buttons, re-derived after every exchange. They sit directly
            above the input so the next move is under the thumb already on the
            keyboard. */}
        <View style={s.quickWrap}>
          <FlatList
            horizontal
            inverted={I18nManager.isRTL}
            data={shortcuts}
            keyExtractor={(q, i) => `${q.label}-${i}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.quickRow}
            renderItem={({ item, index }) => (
              <Bounce
                testID={`live-shortcut-${index}`}
                style={s.quickChip}
                scaleTo={0.94}
                onPress={() => (item.action === "scan" ? openCamera() : send(item.prompt))}
              >
                <Icon name={item.action === "scan" ? "camera" : "zap"} size={15} color={UI.violet} />
                <CustomText style={s.quickText}>{item.label}</CustomText>
              </Bounce>
            )}
          />
        </View>

        <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 10) + 84 }]}>
          <Bounce
            testID="live-send"
            style={[s.sendBtn, (!draft.trim() || loading) && { backgroundColor: UI.inkMuted }]}
            scaleTo={0.9}
            onPress={() => send()}
            disabled={!draft.trim() || loading}
          >
            <Icon name="arrow-up" size={19} color="#FFFFFF" />
          </Bounce>
          <TextInput
            testID="live-input"
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={recording ? "מקליט..." : "כתוב, דבר, או צלם..."}
            placeholderTextColor={UI.inkMuted}
            multiline
            textAlign="right"
          />
          {/* Hold to talk — press and hold rather than a toggle, so letting go
              is always the way out and a forgotten recording cannot run on. */}
          <Bounce
            testID="live-mic"
            style={[s.iconBtn, recording && s.iconBtnHot]}
            scaleTo={0.9}
            onPressIn={startRecording}
            onPressOut={stopRecording}
            disabled={transcribing}
          >
            {transcribing ? (
              <ActivityIndicator size="small" color={UI.violet} />
            ) : (
              <Icon name="mic" size={18} color={recording ? "#FFFFFF" : UI.inkSoft} />
            )}
          </Bounce>
          <Bounce testID="live-camera" style={s.iconBtn} scaleTo={0.9} onPress={openCamera}>
            <Icon name="camera" size={18} color={pendingImage ? UI.violet : UI.inkSoft} />
          </Bounce>
        </View>
      </KeyboardAvoidingView>
    </Canvas>
  );
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({

  header: { flexDirection: ROW, alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  title: { fontFamily: FONTS.bold, fontSize: TYPE.hero, color: UI.ink, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: UI.hairline,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },

  list: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 12, gap: 10 },

  row: { flexDirection: "row" },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  // Sleek and premium rather than paper-textured: a soft shadow and rounded,
  // symmetric corners instead of the sticky-note tilt used for Notes.
  bubble: { borderRadius: 20, paddingHorizontal: 17, paddingVertical: 13, ...BUBBLE_SHADOW },
  // Sits under the sheet, not on it: an attribution line is metadata about
  // the note, not part of what the note says.
  badgeRow: { flexDirection: ROW, alignItems: "center", gap: 6, flexWrap: "wrap" },
  // Only appears when a tool genuinely ran, so its presence is information
  // rather than chrome: it marks the answers built on looked-up data.
  toolChip: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: tint(UI.cyan, 0.12),
    marginTop: 5,
  },
  toolChipText: { fontFamily: FONTS.medium, fontSize: 9, color: UI.cyan },
  badge: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: UI.inkMuted,
    textAlign: "left",
    marginTop: 5,
    marginLeft: 6,
  },
  // The user's own words, in the deep royal blue that replaced this app's
  // flat "informational" cyan. Noa's replies stay on the page itself: warm
  // surface, a hairline touched with gold. The squared-off corner on each is
  // what keeps two stacked bubbles from reading as one long sheet.
  userBubble: { backgroundColor: UI.cyan, borderBottomRightRadius: 7 },
  modelBubble: {
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: tint(UI.gold, 0.25),
    borderBottomLeftRadius: 7,
  },
  bubbleText: { fontFamily: FONTS.medium, fontSize: 15, color: UI.ink, textAlign: "right", lineHeight: 23 },
  bubbleTextMine: { color: "#FFFFFF" },

  typing: { flexDirection: ROW, alignItems: "center", gap: 9, alignSelf: "flex-start" },
  typingText: { fontFamily: FONTS.medium, fontSize: 13.5, color: UI.inkSoft },

  errorCard: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 9,
    backgroundColor: UI.coral + "12",
    borderRadius: 18,
    padding: 14,
    marginTop: 6,
  },
  errorText: { flex: 1, fontFamily: FONTS.medium, fontSize: 13, color: UI.coral, textAlign: "right", lineHeight: 20 },

  empty: { alignItems: "center", paddingTop: 34, paddingHorizontal: 22, gap: 11 },
  emptyGlass: {
    width: 76,
    height: 76,
    borderRadius: UI.radiusLg,
    backgroundColor: UI.surface,
    ...BEVEL,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: TYPE.title, color: UI.ink },
  emptyBody: { fontFamily: FONTS.regular, fontSize: TYPE.body, color: UI.inkSoft, textAlign: "center", lineHeight: 22 },
  keyWarning: {
    flexDirection: ROW,
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: UI.amber + "18",
    borderRadius: 18,
    padding: 14,
    marginTop: 4,
  },
  keyWarningText: { flex: 1, fontFamily: FONTS.medium, fontSize: 12, color: UI.amber, textAlign: "right", lineHeight: 18 },

  quickWrap: { paddingBottom: 8 },
  quickRow: { paddingHorizontal: 14, gap: 8 },
  quickChip: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: UI.surface,
    ...BEVEL,
    ...CARD_SHADOW,
  },
  quickText: { fontFamily: FONTS.semibold, fontSize: 13, color: UI.ink },

  composer: {
    flexDirection: ROW,
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: UI.surface,
    borderTopLeftRadius: UI.radiusLg,
    borderTopRightRadius: UI.radiusLg,
    borderTopWidth: 1,
    borderColor: UI.hairline,
    ...CARD_SHADOW,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 130,
    backgroundColor: UI.surfaceAlt,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: UI.hairline,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: UI.ink,
    ...(Platform.OS === "web" ? { outlineStyle: "none", outlineWidth: 0 } : {}),
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: UI.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    ...BEVEL,
  },
  iconBtnHot: { backgroundColor: UI.coral },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: UI.violet,
    alignItems: "center",
    justifyContent: "center",
  },
});
