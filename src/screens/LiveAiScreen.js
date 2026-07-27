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
import { GEMINI_API_KEY, GEMINI_ENDPOINT, isGeminiConfigured } from "../config/geminiConfig";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { CARD_SHADOW, TYPE, UI } from "../utils/ui";

// Zone 1 — the live assistant. Glass surfaces, quick actions above the input,
// and a GPS fix taken quietly in the background.
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

function systemPrompt(place) {
  const where = place ? `${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}` : "לא ידוע";
  return [
    "You are an expert Israeli public transit routing assistant.",
    `The user commutes frequently between ${HOME} and their residential boarding school.`,
    `The user's current GPS location is [${where}].`,
    "Provide exact bus line numbers, estimated times, and optimal routes for their query.",
    "",
    "Rules:",
    "- Answer in Hebrew.",
    "- Lead with the line number and the boarding stop. Details after.",
    "- Give times as ranges. You do not have live timetables — say so when it matters",
    "  and point to Moovit or the operator's app for the departure running now.",
    "- If the location is unknown, ask where they are starting from rather than guessing.",
    "- Friday and holiday-eve services stop early in this area. Mention it when relevant.",
  ].join("\n");
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
        const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt(place) }] },
            contents: next.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
            generationConfig: { temperature: 0.4, maxOutputTokens: 900 },
          }),
        });

        const raw = await res.text();
        let json = null;
        try {
          json = JSON.parse(raw);
        } catch {
          /* handled below */
        }
        if (controller.signal.aborted) return;
        setLoading(false);

        if (!res.ok) {
          hapticWarning();
          setError(json?.error?.message || `הבקשה נכשלה (${res.status}).`);
          return;
        }
        const reply =
          json?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") || "";
        if (!reply) {
          hapticWarning();
          setError("המודל החזיר תשובה ריקה. נסה לנסח אחרת.");
          return;
        }
        hapticSuccess();
        setMessages((prev) => [...prev, { id: `m-${Date.now()}`, role: "model", text: reply }]);
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
    <View style={[s.screen, { paddingTop: insets.top + 10 }]}>
      {/* Glass header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>עוזר חכם</Text>
          <Text style={s.subtitle} numberOfLines={1}>
            {locState === "ok" && place
              ? `מיקום ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`
              : locState === "asking"
                ? "מאתר מיקום..."
                : locState === "denied"
                  ? "ללא מיקום — כתוב מאיפה אתה יוצא"
                  : "ביתר עילית · פנימייה"}
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
              <View style={[s.bubble, item.role === "user" ? s.userBubble : s.modelBubble]}>
                <Text style={[s.bubbleText, item.role === "user" && { color: "#FFFFFF" }]} selectable>
                  {item.text}
                </Text>
              </View>
            </Animated.View>
          )}
          ListEmptyComponent={
            <Animated.View entering={FadeIn.duration(300)} style={s.empty}>
              <View style={s.emptyGlass}>
                <Icon name="navigation" size={30} color={UI.violet} />
              </View>
              <Text style={s.emptyTitle}>לאן נוסעים?</Text>
              <Text style={s.emptyBody}>
                בחר פעולה מהירה למטה או כתוב שאלה. המיקום הנוכחי נשלח יחד עם השאלה כדי לקבל קווים
                מהתחנה שקרובה אליך.
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
    </View>
  );
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },

  header: { flexDirection: ROW, alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  title: { fontFamily: FONTS.bold, fontSize: TYPE.hero, color: UI.ink, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },

  list: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 12, gap: 10 },

  row: { flexDirection: "row" },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  bubble: { maxWidth: "88%", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12 },
  userBubble: { backgroundColor: UI.violet, borderBottomRightRadius: 8 },
  modelBubble: {
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
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
    borderRadius: 28,
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
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
  keyWarningText: { flex: 1, fontFamily: FONTS.medium, fontSize: 12, color: "#8A6D00", textAlign: "right", lineHeight: 18 },

  quickWrap: { paddingBottom: 8 },
  quickRow: { paddingHorizontal: 14, gap: 8 },
  quickChip: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    ...CARD_SHADOW,
  },
  quickText: { fontFamily: FONTS.semibold, fontSize: 13, color: UI.ink },

  composer: {
    flexDirection: ROW,
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: UI.glass,
    borderTopLeftRadius: UI.radius,
    borderTopRightRadius: UI.radius,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    ...CARD_SHADOW,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 130,
    backgroundColor: UI.surface,
    borderRadius: 22,
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
