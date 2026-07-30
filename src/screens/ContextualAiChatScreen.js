import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, I18nManager, Image, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { isGeminiConfigured } from "../config/geminiConfig";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { BUBBLE_SHADOW, CARD_SHADOW, TYPE, UI, tint } from "../utils/ui";
import { askGemini, clearThread, loadThread, parseImageReply, saveThread } from "../utils/aiThread";
import CustomText from "../components/CustomText";

// A per-item AI co-pilot. One screen, one thread, one item.
//
// The thread is keyed by the item's id, so every dream and every project keeps
// its own conversation and its own memory. Coming back to a dream a month later
// picks the conversation up where it stopped, and the model is re-briefed with
// the item's *current* data on every send — so if the dream has progressed
// since, the advice reflects that rather than the numbers from last time.
//
// ---------------------------------------------------------------------------
// USAGE — opening this from a details screen
// ---------------------------------------------------------------------------
//
// Register it once in the root stack (already done in AppNavigator):
//
//   <RootStack.Screen name="ContextualAiChat" component={ContextualAiChatScreen} />
//
// Then, from a hypothetical DreamDetailsScreen, pass the item's id and its
// data. The id is what makes the thread persistent and item-specific:
//
//   function DreamDetailsScreen({ route, navigation }) {
//     const { dream } = route.params;
//
//     return (
//       <Bounce
//         onPress={() =>
//           navigation.navigate("ContextualAiChat", {
//             threadId: dream.id,                    // <- the thread's identity
//             title: dream.title,                    // shown in the header
//             itemData: {                            // object or JSON string
//               title: dream.title,
//               why: dream.why,
//               target: dream.target,
//               saved: dream.saved,
//               progress: `${Math.round((dream.saved / dream.target) * 100)}%`,
//               targetDate: dream.targetDate,
//               milestones: dream.milestones?.map((m) => ({
//                 title: m.title,
//                 done: m.done,
//               })),
//               obstacles: dream.obstacles,
//             },
//           })
//         }
//       >
//         <CustomText>שאל את הקו-פיילוט על החלום הזה</CustomText>
//       </Bounce>
//     );
//   }
//
// The same screen serves a business project — only the params change:
//
//   navigation.navigate("ContextualAiChat", {
//     threadId: `machine-${machine.id}`,
//     title: machine.name,
//     itemData: { location: machine.location, monthlyRevenue: machine.revenue },
//   });
//
// Prefixing ids by kind (`machine-`, `dream-`) keeps two different item types
// from colliding on the same key if their ids ever overlap.

const SUGGESTIONS = [
  "מה הצעד הבא שכדאי לי לעשות?",
  "מה מעכב אותי כאן?",
  "בנה לי תוכנית לשבוע הקרוב",
  "צור תמונת השראה",
];

export default function ContextualAiChatScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const params = route?.params || {};
  const { threadId, itemData, title } = params;

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState(null);

  const listRef = useRef(null);
  const abortRef = useRef(null);

  // A screen opened without an id has no thread to be, and silently writing to
  // a key of "undefined" would merge every such visit into one shared history.
  const missingId = !threadId;

  // --- load this thread's history -----------------------------------------
  useEffect(() => {
    let alive = true;
    if (missingId) {
      setHydrated(true);
      return () => {};
    }
    (async () => {
      const stored = await loadThread(threadId);
      if (!alive) return;
      setMessages(stored);
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, [threadId, missingId]);

  // --- persist on every change, once the initial load has finished ---------
  useEffect(() => {
    // Without the hydrated guard the empty initial state would overwrite the
    // stored history in the moment between mount and load.
    if (!hydrated || missingId) return;
    saveThread(threadId, messages);
  }, [messages, hydrated, threadId, missingId]);

  // Cancel any request in flight when the screen goes away, so a late reply
  // cannot call setState on an unmounted screen.
  useEffect(() => () => abortRef.current?.abort(), []);

  const itemSummary = useMemo(() => {
    let data = itemData;
    if (typeof itemData === "string") {
      try {
        data = JSON.parse(itemData);
      } catch {
        return null;
      }
    }
    if (!data || typeof data !== "object") return null;
    const keys = Object.keys(data).filter((k) => data[k] !== null && data[k] !== undefined);
    return keys.length ? `${keys.length} שדות נתונים מוזנים לשיחה` : null;
  }, [itemData]);

  const send = useCallback(
    async (text) => {
      const clean = (text ?? draft).trim();
      if (!clean || loading || missingId) return;

      hapticLight();
      setError(null);
      setDraft("");

      const userMessage = { id: `u-${Date.now()}`, role: "user", text: clean, at: Date.now() };
      // Capture the history including this turn, so the request and the stored
      // thread agree on what was actually said.
      const next = [...messages, userMessage];
      setMessages(next);
      setLoading(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const result = await askGemini({
        messages: next,
        itemData,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;
      setLoading(false);

      if (!result.ok) {
        if (result.reason === "aborted") return;
        hapticWarning();
        setError(result.error);
        return;
      }

      hapticSuccess();
      setMessages((prev) => [
        ...prev,
        { id: `m-${Date.now()}`, role: "model", text: result.text, at: Date.now() },
      ]);
    },
    [draft, loading, messages, itemData, missingId]
  );

  const reset = useCallback(async () => {
    hapticWarning();
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    if (!missingId) await clearThread(threadId);
  }, [threadId, missingId]);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    if (!messages.length) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages.length, loading]);

  return (
    <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={s.header}>
        <Bounce style={s.iconBtn} scaleTo={0.9} onPress={() => navigation?.goBack()}>
          <Icon name={I18nManager.isRTL ? "arrow-right" : "arrow-left"} size={19} color={UI.ink} />
        </Bounce>
        <View style={{ flex: 1 }}>
          <CustomText style={s.title} numberOfLines={1}>{title || "קו-פיילוט"}</CustomText>
          <CustomText style={s.subtitle} numberOfLines={1}>
            {itemSummary || "שיחה ייעודית לפריט הזה"}
          </CustomText>
        </View>
        {messages.length > 0 && (
          <Bounce testID="ai-reset" style={s.iconBtn} scaleTo={0.9} onPress={reset}>
            <Icon name="rotate-ccw" size={17} color={UI.inkSoft} />
          </Bounce>
        )}
      </View>

      {missingId ? (
        <Notice
          icon="alert-triangle"
          tone={UI.coral}
          title="לא הועבר מזהה פריט"
          body="המסך נפתח בלי threadId, ולכן אין שיחה לשמור. פתח אותו מתוך פריט קיים."
        />
      ) : (
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
            renderItem={({ item, index }) => <Bubble message={item} index={index} />}
            ListEmptyComponent={
              hydrated ? (
                <Empty configured={isGeminiConfigured()} onPick={(q) => send(q)} />
              ) : null
            }
            ListFooterComponent={
              <>
                {loading && (
                  <Animated.View entering={FadeIn.duration(200)} style={[s.bubble, s.modelBubble, s.typing]}>
                    <ActivityIndicator size="small" color={UI.violet} />
                    <CustomText style={s.typingText}>חושב...</CustomText>
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

          {/* Composer */}
          <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <Bounce
              testID="ai-send"
              style={[s.sendBtn, (!draft.trim() || loading) && { backgroundColor: UI.inkMuted }]}
              scaleTo={0.9}
              onPress={() => send()}
              disabled={!draft.trim() || loading}
            >
              <Icon name="arrow-up" size={19} color="#FFFFFF" />
            </Bounce>
            <TextInput
              testID="ai-input"
              style={s.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="שאל על הפריט הזה..."
              placeholderTextColor={UI.inkMuted}
              multiline
              textAlign="right"
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------

function Bubble({ message, index }) {
  const mine = message.role === "user";
  // Only model replies can carry an image tag; a user typing the literal
  // "[IMAGE: ...]" should see their own text back, not a generated picture.
  const parsed = mine ? { hasImage: false, text: message.text } : parseImageReply(message.text);
  const [failed, setFailed] = useState(false);

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 40, 240)).springify().damping(15)}
      style={[s.bubbleRow, mine ? s.rowMine : s.rowTheirs]}
    >
      <View style={[s.bubble, mine ? s.userBubble : s.modelBubble]}>
        {!!parsed.text && (
          <CustomText style={[s.bubbleText, mine && s.bubbleTextMine]} selectable>
            {parsed.text}
          </CustomText>
        )}

        {parsed.hasImage && (
          <View style={[s.imageWrap, !!parsed.text && { marginTop: 10 }]}>
            {failed ? (
              <View style={s.imageFallback}>
                <Icon name="wifi-off" size={22} color={UI.inkMuted} />
                <CustomText style={s.imageFallbackText}>לא ניתן לטעון את התמונה</CustomText>
                <CustomText style={s.imagePrompt} numberOfLines={2}>{parsed.prompt}</CustomText>
              </View>
            ) : (
              <Image
                testID="ai-generated-image"
                source={{ uri: parsed.url }}
                style={s.image}
                resizeMode="cover"
                onError={() => setFailed(true)}
              />
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function Empty({ configured, onPick }) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={s.empty}>
      <View style={s.emptyBadge}>
        <Icon name="message-circle" size={30} color={UI.violet} />
      </View>
      <CustomText style={s.emptyTitle}>קו-פיילוט לפריט הזה</CustomText>
      <CustomText style={s.emptyBody}>
        השיחה נשמרת רק לפריט הזה, והנתונים שלו נטענים לכל תשובה. אפשר לחזור לכאן מתי שרוצים והשיחה
        תמשיך מאיפה שהפסקת.
      </CustomText>

      {!configured && (
        <View style={s.keyWarning}>
          <Icon name="key" size={15} color="#8A6D00" />
          <CustomText style={s.keyWarningText}>
            עדיין לא הוגדר מפתח Gemini. הדבק מפתח ב-src/config/geminiConfig.js כדי להפעיל את השיחה.
          </CustomText>
        </View>
      )}

      <View style={s.chips}>
        {SUGGESTIONS.map((q) => (
          <Bounce key={q} style={s.chip} scaleTo={0.95} onPress={() => onPick(q)}>
            <CustomText style={s.chipText}>{q}</CustomText>
          </Bounce>
        ))}
      </View>
    </Animated.View>
  );
}

function Notice({ icon, tone, title, body }) {
  return (
    <View style={s.notice}>
      <View style={[s.noticeBadge, { backgroundColor: tone + "16" }]}>
        <Icon name={icon} size={26} color={tone} />
      </View>
      <CustomText style={s.noticeTitle}>{title}</CustomText>
      <CustomText style={s.noticeBody}>{body}</CustomText>
    </View>
  );
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },

  header: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
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
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.caption,
    color: UI.inkMuted,
    textAlign: "right",
    marginTop: 2,
  },

  list: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 16, gap: 10 },

  bubbleRow: { flexDirection: "row" },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  // Sleek and premium rather than paper-textured: a soft shadow and a
  // rounded, symmetric bubble instead of the sticky-note tilt used for Notes.
  bubble: { maxWidth: "86%", borderRadius: 20, paddingHorizontal: 17, paddingVertical: 13, ...BUBBLE_SHADOW },
  // The user's own words, in the deep royal blue that replaced this app's
  // flat "informational" cyan — solid, so white text sits confidently on it.
  userBubble: { backgroundColor: UI.cyan, borderBottomRightRadius: 7 },
  // Noa's replies stay on the page itself: warm surface, a hairline touched
  // with gold rather than a flat border.
  modelBubble: {
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: tint(UI.gold, 0.25),
    borderBottomLeftRadius: 7,
  },
  bubbleText: { fontFamily: FONTS.medium, fontSize: 15, color: UI.ink, textAlign: "right", lineHeight: 23 },
  bubbleTextMine: { color: "#FFFFFF" },

  imageWrap: { borderRadius: 18, overflow: "hidden" },
  image: { width: 232, height: 232, borderRadius: 18 },
  imageFallback: {
    width: 232,
    height: 232,
    borderRadius: 18,
    backgroundColor: UI.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  imageFallbackText: { fontFamily: FONTS.semibold, fontSize: 13, color: UI.inkSoft },
  imagePrompt: { fontFamily: FONTS.regular, fontSize: 11, color: UI.inkMuted, textAlign: "center" },

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
    paddingTop: 13,
    paddingBottom: 13,
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

  empty: { alignItems: "center", paddingTop: 40, paddingHorizontal: 8, gap: 12 },
  emptyBadge: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: UI.violet + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: TYPE.title, color: UI.ink },
  emptyBody: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.body,
    color: UI.inkSoft,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  keyWarning: {
    flexDirection: ROW,
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: UI.amber + "18",
    borderRadius: 18,
    padding: 14,
    marginTop: 4,
  },
  keyWarningText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 12.5,
    color: "#8A6D00",
    textAlign: "right",
    lineHeight: 19,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 6 },
  chip: {
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 21,
    backgroundColor: UI.surface,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  chipText: { fontFamily: FONTS.semibold, fontSize: 13, color: UI.inkSoft },

  notice: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32, gap: 10 },
  noticeBadge: { width: 68, height: 68, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  noticeTitle: { fontFamily: FONTS.bold, fontSize: TYPE.title, color: UI.ink, textAlign: "center" },
  noticeBody: { fontFamily: FONTS.regular, fontSize: TYPE.body, color: UI.inkSoft, textAlign: "center", lineHeight: 21 },
});
