import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  I18nManager,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import RichText from "../components/RichText";
import { callGemini, isGeminiConfigured } from "../config/geminiConfig";
import { NOA_MAX_OUTPUT_TOKENS, NOA_NAME, buildNoaPrompt } from "../config/noaPersona";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { Canvas } from "../components/Paper";
import { BEVEL, CARD_SHADOW, TYPE, UI } from "../utils/ui";

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
      "Israeli public transit stops early on Fridays and holiday eves. No live timetable is available to you — give ranges and name the app to check.",
  });
}

export default function LiveAiScreen() {
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [place, setPlace] = useState(null);
  const [locState, setLocState] = useState("idle");

  const listRef = useRef(null);
  const abortRef = useRef(null);

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

      if (!isGeminiConfigured) {
        setLoading(false);
        setError("לא הוגדר מפתח Gemini. הוסף EXPO_PUBLIC_GEMINI_API_KEY לקובץ .env.");
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await callGemini(
          {
            systemInstruction: { parts: [{ text: systemPrompt(place) }] },
            contents: next.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
            generationConfig: { temperature: 0.4, maxOutputTokens: NOA_MAX_OUTPUT_TOKENS },
          },
          { signal: controller.signal }
        );

        if (controller.signal.aborted) return;
        setLoading(false);

        if (!res.ok) {
          hapticWarning();
          setError(res.detail || `הבקשה נכשלה (${res.status}).`);
          return;
        }
        const { json } = res;
        const reply =
          json?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") || "";
        if (!reply) {
          hapticWarning();
          setError("המודל החזיר תשובה ריקה. נסה לנסח אחרת.");
          return;
        }
        hapticSuccess();
        // res.model is the id that *answered*, which is not always the id at
        // the head of the list — the fallback chain may have moved on. The
        // badge reports that, so it can never claim a model that was not used.
        setMessages((prev) => [
          ...prev,
          { id: `m-${Date.now()}`, role: "model", text: reply, model: res.model },
        ]);
      } catch (e) {
        if (e?.name === "AbortError") return;
        setLoading(false);
        hapticWarning();
        setError("אין חיבור לרשת. בדוק את האינטרנט ונסה שוב.");
      }
    },
    [draft, loading, messages, place]
  );

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
          <Text style={s.title}>נועה</Text>
          <Text style={s.subtitle} numberOfLines={1}>
            {locState === "ok" && place
              ? `מיקום ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`
              : locState === "asking"
                ? "מאתר מיקום..."
                : locState === "denied"
                  ? "ללא מיקום — כתוב מאיפה אתה יוצא"
                  : "סגנית מנהל תפעול"}
          </Text>
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
                    <Text style={[s.bubbleText, { color: "#FFFFFF" }]} selectable>
                      {item.text}
                    </Text>
                  ) : (
                    // Noa is instructed to write Markdown, so her replies have
                    // to be rendered as Markdown — otherwise the persona makes
                    // the output harder to read than plain prose.
                    <RichText text={item.text} color={UI.ink} size={15} />
                  )}
                </View>
                {item.role === "model" && !!item.model && (
                  <Text testID={`model-badge-${item.id}`} style={s.badge}>
                    {NOA_NAME} • {item.model}
                  </Text>
                )}
              </View>
            </Animated.View>
          )}
          ListEmptyComponent={
            <Animated.View entering={FadeIn.duration(300)} style={s.empty}>
              <View style={s.emptyGlass}>
                <Icon name="navigation" size={30} color={UI.violet} />
              </View>
              <Text style={s.emptyTitle}>מה על הפרק?</Text>
              <Text style={s.emptyBody}>
נועה — סגנית מנהל התפעול שלך. לוגיסטיקה, מספרים, תכנון. המיקום הנוכחי נשלח יחד עם
                השאלה, כדי שהיא לא תצטרך לשאול איפה אתה.
              </Text>
              {!isGeminiConfigured && (
                <View style={s.keyWarning}>
                  <Icon name="key" size={15} color="#8A6D00" />
                  <Text style={s.keyWarningText}>
                    אין מפתח Gemini. הוסף EXPO_PUBLIC_GEMINI_API_KEY לקובץ .env.
                  </Text>
                </View>
              )}
            </Animated.View>
          }
          ListFooterComponent={
            <>
              {loading && (
                <Animated.View entering={FadeIn.duration(200)} style={[s.bubble, s.modelBubble, s.typing]}>
                  <ActivityIndicator size="small" color={UI.violet} />
                  <Text style={s.typingText}>בודק מסלולים...</Text>
                </Animated.View>
              )}
              {!!error && (
                <Animated.View entering={FadeIn.duration(200)} style={s.errorCard}>
                  <Icon name="alert-circle" size={16} color={UI.coral} />
                  <Text style={s.errorText}>{error}</Text>
                </Animated.View>
              )}
            </>
          }
        />

        {/* Quick actions sit directly above the input, as specified. */}
        <View style={s.quickWrap}>
          <FlatList
            horizontal
            inverted={I18nManager.isRTL}
            data={QUICK}
            keyExtractor={(q) => q.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.quickRow}
            renderItem={({ item }) => (
              <Bounce
                testID={`live-${item.key}`}
                style={s.quickChip}
                scaleTo={0.94}
                onPress={() => send(item.q)}
              >
                <Icon name={item.icon} size={15} color={UI.violet} />
                <Text style={s.quickText}>{item.label}</Text>
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
            placeholder="שאל על מסלול, קו או זמן..."
            placeholderTextColor={UI.inkMuted}
            multiline
            textAlign="right"
          />
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
  bubble: { borderRadius: UI.radius, paddingHorizontal: 16, paddingVertical: 12 },
  // Sits under the sheet, not on it: an attribution line is metadata about
  // the note, not part of what the note says.
  badge: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: UI.inkMuted,
    textAlign: "left",
    marginTop: 5,
    marginLeft: 6,
  },
  userBubble: { backgroundColor: UI.violet, borderBottomRightRadius: 8, ...CARD_SHADOW },
  // The assistant's replies are white pages; the user's are violet cards. The
  // squared-off corner on each is what keeps two stacked bubbles from reading
  // as one long sheet.
  modelBubble: {
    backgroundColor: UI.surface,
    ...BEVEL,
    borderBottomLeftRadius: 8,
    ...CARD_SHADOW,
  },
  bubbleText: { fontFamily: FONTS.regular, fontSize: 15, color: UI.ink, textAlign: "right", lineHeight: 23 },

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
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: UI.violet,
    alignItems: "center",
    justifyContent: "center",
  },
});
