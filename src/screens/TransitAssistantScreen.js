import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, I18nManager, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { callGemini, isGeminiConfigured } from "../config/geminiConfig";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { shekel } from "../utils/posStore";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { CARD_SHADOW, TYPE, UI } from "../utils/ui";
import { usePersistentState } from "../utils/usePersistentState";
import CustomText from "../components/CustomText";

// עוזר תחב"ץ — a routing assistant for the commute between Beitar Illit and
// the boarding school, plus a Rav-Kav balance you keep by hand.
//
// The Rav-Kav figure is a manual tracker, not a real card reading. Israeli
// Rav-Kav balances are not exposed by any public API — the official app reads
// the card over NFC with credentials that are not available to third parties.
// Calling it "virtual" is doing real work: it is a notebook, and it says so.

const HOME = "ביתר עילית";
const SCHOOL = "הפנימייה";

const QUICK = [
  { key: "home", icon: "home", label: "מסלול הביתה", q: `מה הדרך הכי מהירה מהמיקום שלי ל${HOME} עכשיו?` },
  { key: "school", icon: "book-open", label: "מסלול לפנימייה", q: `מה הדרך הכי מהירה מהמיקום שלי ל${SCHOOL} עכשיו?` },
  { key: "last", icon: "clock", label: "אוטובוס אחרון", q: `מה האוטובוס האחרון היום מ${HOME} לכיוון הפנימייה?` },
  { key: "shabbat", icon: "sunset", label: "לפני שבת", q: "מתי כדאי לצאת ביום שישי כדי להגיע הביתה לפני כניסת שבת?" },
];

const TOP_UPS = [20, 30, 50, 100];

function buildSystemPrompt(place) {
  const where = place
    ? `${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}`
    : "לא ידוע — המשתמש לא שיתף מיקום";
  return [
    "You are an expert Israeli public transit routing assistant.",
    `The user commutes frequently between ${HOME} and their residential boarding school.`,
    `The user's current GPS location is [${where}].`,
    "Provide exact bus line numbers, estimated times, and optimal routes for their query.",
    "",
    "Rules:",
    "- Answer in Hebrew.",
    "- Lead with the line number and where to board. Details after.",
    "- Give times as ranges, not false precision.",
    "- You do not have live timetables. Say so when it matters, and point to",
    "  Moovit or the Egged/Superbus app for the departure actually running now.",
    "- If the location is unknown, ask where they are starting from instead of guessing.",
    "- Remember Friday and holiday-eve services stop early in this area.",
  ].join("\n");
}

export default function TransitAssistantScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [place, setPlace] = useState(null);
  const [locState, setLocState] = useState("idle"); // idle | asking | ok | denied | error
  const [balance, setBalance] = usePersistentState(STORAGE_KEYS.ravKavBalance, 0);
  const [rides, setRides] = usePersistentState(STORAGE_KEYS.ravKavHistory, []);

  const listRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const locate = useCallback(async () => {
    hapticLight();
    setLocState("asking");
    try {
      // Imported lazily so a build without the module still opens the screen —
      // the assistant is useful without GPS, just less specific.
      const Location = await import("expo-location");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocState("denied");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPlace({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setLocState("ok");
      hapticSuccess();
    } catch {
      setLocState("error");
    }
  }, []);

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
            systemInstruction: { parts: [{ text: buildSystemPrompt(place) }] },
            contents: next.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
            generationConfig: { temperature: 0.4, maxOutputTokens: 900 },
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

  const topUp = (amount) => {
    hapticSuccess();
    setBalance((b) => Math.round(((b || 0) + amount) * 100) / 100);
    setRides((r) => [{ at: Date.now(), amount, kind: "topup" }, ...(r || [])].slice(0, 40));
  };

  const logRide = (fare) => {
    if ((balance || 0) < fare) {
      hapticWarning();
      return;
    }
    hapticLight();
    setBalance((b) => Math.round(((b || 0) - fare) * 100) / 100);
    setRides((r) => [{ at: Date.now(), amount: -fare, kind: "ride" }, ...(r || [])].slice(0, 40));
  };

  useEffect(() => {
    if (!messages.length) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages.length, loading]);

  const ridesLeft = Math.floor((balance || 0) / 6);

  return (
    <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={s.header}>
        <Bounce style={s.iconBtn} scaleTo={0.9} onPress={() => navigation?.goBack()}>
          <Icon name={I18nManager.isRTL ? "arrow-right" : "arrow-left"} size={19} color={UI.ink} />
        </Bounce>
        <View style={{ flex: 1 }}>
          <CustomText style={s.title}>עוזר תחב״ץ</CustomText>
          <CustomText style={s.subtitle} numberOfLines={1}>
            {locState === "ok" && place
              ? `מיקום נוכחי ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}`
              : "ביתר עילית · פנימייה"}
          </CustomText>
        </View>
        <Bounce
          testID="transit-locate"
          style={[s.iconBtn, locState === "ok" && { backgroundColor: UI.green + "18" }]}
          scaleTo={0.9}
          onPress={locate}
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
              style={[s.bubbleRow, item.role === "user" ? s.rowMine : s.rowTheirs]}
            >
              <View style={[s.bubble, item.role === "user" ? s.userBubble : s.modelBubble]}>
                <CustomText style={[s.bubbleText, item.role === "user" && { color: "#FFFFFF" }]} selectable>
                  {item.text}
                </CustomText>
              </View>
            </Animated.View>
          )}
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 6 }}>
              {/* Rav-Kav tracker */}
              <View style={s.ravkav}>
                <View style={s.ravkavTop}>
                  <View style={{ flex: 1 }}>
                    <CustomText style={s.ravkavLabel}>רב-קו · מעקב ידני</CustomText>
                    <CustomText testID="ravkav-balance" style={s.ravkavValue}>{shekel(balance || 0)}</CustomText>
                    <CustomText style={s.ravkavHint}>
                      {ridesLeft > 0 ? `בערך ${ridesLeft} נסיעות בתעריף 6 ₪` : "לא מספיק לנסיעה"}
                    </CustomText>
                  </View>
                  <View style={s.ravkavChip}>
                    <Icon name="credit-card" size={22} color={UI.violet} />
                  </View>
                </View>

                <View style={s.topUpRow}>
                  {TOP_UPS.map((amount) => (
                    <Bounce
                      key={amount}
                      testID={`topup-${amount}`}
                      style={s.topUpBtn}
                      scaleTo={0.92}
                      onPress={() => topUp(amount)}
                    >
                      <CustomText style={s.topUpText}>+{amount}</CustomText>
                    </Bounce>
                  ))}
                  <Bounce
                    testID="log-ride"
                    style={[s.topUpBtn, s.rideBtn]}
                    scaleTo={0.92}
                    onPress={() => logRide(6)}
                  >
                    <Icon name="minus" size={14} color="#FFFFFF" />
                    <CustomText style={[s.topUpText, { color: "#FFFFFF" }]}>נסיעה</CustomText>
                  </Bounce>
                </View>

                <CustomText style={s.ravkavNote}>
                  המספר הזה נשמר במכשיר ואינו נקרא מהכרטיס. אין ממשק ציבורי ליתרת רב-קו — האפליקציה
                  הרשמית קוראת אותה ב-NFC. זה פנקס, לא הכרטיס.
                </CustomText>
              </View>

              {/* Quick actions */}
              <View style={s.quickGrid}>
                {QUICK.map((q) => (
                  <Bounce
                    key={q.key}
                    testID={`quick-${q.key}`}
                    style={s.quickBtn}
                    scaleTo={0.95}
                    onPress={() => send(q.q)}
                  >
                    <Icon name={q.icon} size={17} color={UI.violet} />
                    <CustomText style={s.quickText}>{q.label}</CustomText>
                  </Bounce>
                ))}
              </View>

              {locState !== "ok" && (
                <Bounce testID="transit-locate-cta" style={s.locCard} scaleTo={0.97} onPress={locate}>
                  <Icon name="map-pin" size={17} color={UI.violet} />
                  <CustomText style={s.locText}>
                    {locState === "denied"
                      ? "ההרשאה נדחתה — אפשר לכתוב מאיפה יוצאים במקום"
                      : locState === "error"
                        ? "לא הצלחנו לקבל מיקום. נסה שוב או כתוב מאיפה אתה יוצא"
                        : "שתף מיקום כדי לקבל מסלול מדויק מהנקודה שלך"}
                  </CustomText>
                </Bounce>
              )}

              {!isGeminiConfigured && (
                <View style={s.keyWarning}>
                  <Icon name="key" size={15} color="#8A6D00" />
                  <CustomText style={s.keyWarningText}>
                    אין מפתח Gemini. הוסף EXPO_PUBLIC_GEMINI_API_KEY לקובץ .env כדי להפעיל את השיחה.
                  </CustomText>
                </View>
              )}
            </View>
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

        <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Bounce
            testID="transit-send"
            style={[s.sendBtn, (!draft.trim() || loading) && { backgroundColor: UI.inkMuted }]}
            scaleTo={0.9}
            onPress={() => send()}
            disabled={!draft.trim() || loading}
          >
            <Icon name="arrow-up" size={19} color="#FFFFFF" />
          </Bounce>
          <TextInput
            testID="transit-input"
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="לאן נוסעים?"
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
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: UI.surface,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  title: { fontFamily: FONTS.bold, fontSize: TYPE.title, color: UI.ink, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },

  list: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 16, gap: 10 },

  ravkav: {
    backgroundColor: UI.surface,
    borderRadius: UI.radius,
    padding: UI.cardPadding,
    gap: 12,
    ...CARD_SHADOW,
  },
  ravkavTop: { flexDirection: ROW, alignItems: "center", gap: 12 },
  ravkavLabel: { fontFamily: FONTS.semibold, fontSize: 12, color: UI.inkMuted, textAlign: "right" },
  ravkavValue: { fontFamily: FONTS.bold, fontSize: 30, color: UI.ink, textAlign: "right", marginTop: 2 },
  ravkavHint: { fontFamily: FONTS.regular, fontSize: 11.5, color: UI.inkSoft, textAlign: "right", marginTop: 2 },
  ravkavChip: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: UI.violet + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  topUpRow: { flexDirection: "row", gap: 7, flexWrap: "wrap" },
  topUpBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: UI.surfaceAlt,
  },
  rideBtn: { backgroundColor: UI.coral },
  topUpText: { fontFamily: FONTS.bold, fontSize: 13.5, color: UI.inkSoft },
  ravkavNote: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: UI.inkMuted,
    textAlign: "right",
    lineHeight: 17,
  },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickBtn: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.surface,
    ...CARD_SHADOW,
  },
  quickText: { fontFamily: FONTS.semibold, fontSize: 13, color: UI.ink },

  locCard: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 9,
    backgroundColor: UI.violet + "10",
    borderRadius: UI.radiusSm,
    padding: 14,
  },
  locText: { flex: 1, fontFamily: FONTS.medium, fontSize: 12.5, color: UI.violet, textAlign: "right", lineHeight: 19 },

  keyWarning: {
    flexDirection: ROW,
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: UI.amber + "18",
    borderRadius: UI.radiusSm,
    padding: 14,
  },
  keyWarningText: { flex: 1, fontFamily: FONTS.medium, fontSize: 12, color: "#8A6D00", textAlign: "right", lineHeight: 18 },

  bubbleRow: { flexDirection: "row" },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  bubble: { maxWidth: "88%", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12 },
  userBubble: { backgroundColor: UI.violet, borderBottomRightRadius: 8 },
  modelBubble: { backgroundColor: UI.surface, borderBottomLeftRadius: 8, ...CARD_SHADOW },
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

  composer: {
    flexDirection: ROW,
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: UI.surface,
    borderTopLeftRadius: UI.radius,
    borderTopRightRadius: UI.radius,
    ...CARD_SHADOW,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 130,
    backgroundColor: UI.surfaceAlt,
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
