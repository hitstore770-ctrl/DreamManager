import { useMemo, useRef, useState } from "react";
import {
  I18nManager,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  FadeInUp,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";


import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { FLUID, SCREEN_IN, listEntry } from "../utils/motion";
import ToolRenderer from "../components/tools/ToolRenderer";
import { useSettings } from "../context/SettingsContext";
import { hapticLight, hapticSuccess } from "../utils/haptics";
import { ALL_TOOLS, TOOL_CATEGORIES, TOOL_COUNT, toolById } from "../utils/toolsCatalog";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { usePersistentState } from "../utils/usePersistentState";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";

// כלים — four collapsible category accordions over a fixed search and a
// pinned favourites row, with a swipe-to-dismiss sheet hosting the tool.
// Long-press any tool to favourite it.
//
// Every tile in the grid opens something. The hub used to carry ~90 catalogue
// entries with no code behind them, which meant most taps produced a "coming
// soon" toast; those entries are gone, and with them the ready/pending
// distinction the UI used to draw.

const WHITE = "#FFFFFF";
const BG = "#F4F6F9";
const INK = "#111827";
const INK_SOFT = "#6B7280";
const INK_MUTED = "#9CA3AF";
const BLUE = "#7C3AED";
const GOLD = "#06B6D4";

export default function ToolsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { compactMode: compact } = useSettings();
  const [query, setQuery] = useState("");
  // All four sections start open: at 43 tools the whole hub fits in a scroll,
  // and hiding three quarters of it behind taps helps nobody.
  const [openSections, setOpenSections] = useState(() =>
    TOOL_CATEGORIES.reduce((acc, c) => ({ ...acc, [c.key]: true }), {})
  );
  const [activeTool, setActiveTool] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Favorites persist across launches.
  const [favorites, setFavorites] = usePersistentState(STORAGE_KEYS.toolFavorites, []);
  const favSet = useMemo(() => new Set(favorites || []), [favorites]);
  // Resolve ids through the catalog so tools removed in a refactor simply
  // disappear from favorites instead of rendering as blanks.
  const favTools = useMemo(
    () => (favorites || []).map(toolById).filter(Boolean),
    [favorites]
  );

  const q = query.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!q) return null;
    return ALL_TOOLS.filter(
      (t) => t.name.toLowerCase().includes(q) || t.categoryLabel.toLowerCase().includes(q)
    );
  }, [q]);

  const toggleSection = (key) => {
    hapticLight();
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const flash = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  // Sheet drag-to-dismiss. The handlers live on the grabber strip only, so
  // taps on the header buttons and scrolling inside the tool still work.
  const dragY = useSharedValue(0);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  const dismissSheet = () => {
    dragY.value = 0;
    setActiveTool(null);
  };

  const dragPan = useRef(
    PanResponder.create({
      // Claim on touch-start: the TouchableWithoutFeedback wrapping the sheet
      // takes the responder otherwise, and the move events never arrive here.
      // Safe because this strip holds only the grabber — no buttons.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        dragY.value = Math.max(0, g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 110 || g.vy > 0.9) {
          hapticLight();
          dragY.value = withTiming(700, { duration: 180 }, (finished) => {
            if (finished) runOnJS(dismissSheet)();
          });
        } else {
          dragY.value = withTiming(0, { duration: 160 });
        }
      },
      onPanResponderTerminate: () => {
        dragY.value = withTiming(0, { duration: 160 });
      },
    })
  ).current;

  const openTool = (tool) => {
    hapticLight();
    dragY.value = 0;
    setActiveTool(tool);
  };

  const toggleFavorite = (tool) => {
    const isFav = favSet.has(tool.id);
    if (isFav) {
      hapticLight();
      setFavorites((prev) => (prev || []).filter((id) => id !== tool.id));
      flash("הוסר מהמועדפים");
    } else {
      hapticSuccess();
      setFavorites((prev) => [...(prev || []), tool.id]);
      flash(`${tool.name} נוסף למועדפים`);
    }
  };

  return (
    <Animated.View entering={SCREEN_IN} style={{ flex: 1, backgroundColor: BG }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Icon name="grid" size={20} color={BLUE} />
            <Text style={s.title}>כלים</Text>
          </View>
          <Text style={s.subtitle}>
            {searchResults
              ? `${searchResults.length} תוצאות`
              : `${TOOL_COUNT} כלים ב-${TOOL_CATEGORIES.length} קטגוריות`}
          </Text>
        </View>
        <View style={s.readyPill}>
          <Text style={s.readyPillText}>{TOOL_CATEGORIES.length} קטגוריות</Text>
        </View>
      </View>

      {/* עוזר תחב"ץ sits above the grid rather than inside it: it is a
          conversation, not a calculator, and burying it in a category would
          make the one tool with a live assistant the hardest to find. */}
      <Bounce
        testID="open-transit"
        style={s.transitCard}
        scaleTo={0.97}
        onPress={() => { hapticLight(); navigation?.navigate("TransitAssistant"); }}
      >
        <Icon name="chevron-left" size={18} color={WHITE} />
        <View style={{ flex: 1 }}>
          <Text style={s.transitTitle}>עוזר תחב״ץ</Text>
          <Text style={s.transitSub}>מסלולים בין ביתר לפנימייה · מעקב רב-קו</Text>
        </View>
        <View style={s.transitBadge}>
          <Icon name="navigation" size={20} color={WHITE} />
        </View>
      </Bounce>

      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder="חיפוש כלי..."
          placeholderTextColor={INK_MUTED}
          textAlign="right"
          autoCapitalize="none"
        />
        {!!query && (
          <TouchableOpacity style={s.clearBtn} onPress={() => { hapticLight(); setQuery(""); }} activeOpacity={0.7}>
            <Icon name="x" size={14} color={INK_MUTED} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: compact ? 6 : 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {searchResults ? (
          searchResults.length === 0 ? (
            <Animated.View entering={FadeInUp.duration(260)} style={s.empty}>
              <Icon name="search" size={38} color={INK_MUTED} />
              <Text style={s.emptyText}>לא נמצא כלי בשם הזה</Text>
            </Animated.View>
          ) : (
            <View style={s.grid}>
              {searchResults.map((tool, i) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  index={i}
                  fav={favSet.has(tool.id)}
                  onPress={() => openTool(tool)}
                  onLongPress={() => toggleFavorite(tool)}
                  showCategory
                />
              ))}
            </View>
          )
        ) : (
          <>
            {/* Favorites */}
            {favTools.length > 0 && (
              <Animated.View layout={FLUID} style={s.section}>
                <View style={[s.sectionHead, { backgroundColor: GOLD + "12", borderWidth: 1, borderColor: GOLD + "44" }]}>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={s.sectionLabel}>מועדפים</Text>
                    <Text style={s.sectionMeta}>{favTools.length} כלים · לחיצה ארוכה להסרה</Text>
                  </View>
                  <View style={[s.sectionBadge, { backgroundColor: GOLD + "24" }]}>
                    <Icon name="star" size={20} color={GOLD} />
                  </View>
                </View>
                <View style={s.grid}>
                  {favTools.map((tool, i) => (
                    <ToolCard
                      key={`fav-${tool.id}`}
                      tool={tool}
                      index={i}
                      fav
                      onPress={() => openTool(tool)}
                      onLongPress={() => toggleFavorite(tool)}
                    />
                  ))}
                </View>
              </Animated.View>
            )}

            {TOOL_CATEGORIES.map((cat) => {
              const isOpen = !!openSections[cat.key];

              return (
                <Animated.View key={cat.key} layout={FLUID} style={s.section}>
                  <Bounce style={s.sectionHead} onPress={() => toggleSection(cat.key)} scaleTo={0.98}>
                    <Text style={[s.chevron, isOpen && { transform: [{ rotate: "90deg" }] }]}>›</Text>
                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                      <Text style={s.sectionLabel}>{cat.label}</Text>
                      <Text style={s.sectionMeta}>{cat.tools.length} כלים</Text>
                    </View>
                    <View style={[s.sectionBadge, { backgroundColor: cat.color + "16" }]}>
                      <Icon name={cat.icon} size={20} color={cat.color} />
                    </View>
                  </Bounce>

                  {isOpen && (
                    <View style={s.grid}>
                      {cat.tools.map((tool, i) => (
                        <ToolCard
                          key={tool.id}
                          tool={{ ...tool, color: cat.color }}
                          index={i}
                          fav={favSet.has(tool.id)}
                          onPress={() => openTool(tool)}
                          onLongPress={() => toggleFavorite({ ...tool, color: cat.color })}
                        />
                      ))}
                    </View>
                  )}
                </Animated.View>
              );
            })}
          </>
        )}
      </ScrollView>

      {toast && (
        <Animated.View entering={FadeInUp.duration(200)} style={[s.toast, { bottom: insets.bottom + 90 }]}>
          <Text style={s.toastText}>{toast}</Text>
        </Animated.View>
      )}

      <Modal visible={!!activeTool} transparent animationType="slide" onRequestClose={dismissSheet}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={dismissSheet}>
            <View style={s.backdrop}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 16 }, sheetStyle]}>
                  <View testID="sheet-grabber" style={s.grabZone} {...dragPan.panHandlers}>
                    <View style={s.grabber} />
                  </View>
                  <View style={s.sheetHead}>
                    <TouchableOpacity style={s.closeBtn} onPress={dismissSheet} activeOpacity={0.7}>
                      <Icon name="x" size={17} color={INK_SOFT} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.favBtn}
                      onPress={() => activeTool && toggleFavorite(activeTool)}
                      activeOpacity={0.7}
                    >
                      <Icon name="star" size={18} color={activeTool && favSet.has(activeTool.id) ? GOLD : INK_MUTED} />
                    </TouchableOpacity>
                    <Text style={s.sheetTitle} numberOfLines={1}>
                      {activeTool?.name}
                    </Text>
                  </View>
                  <ToolRenderer toolId={activeTool?.id} tool={activeTool} />
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </Animated.View>
  );
}

function ToolCard({ tool, index, fav, onPress, onLongPress, showCategory }) {
  return (
    <Animated.View entering={listEntry(index)} style={s.cardWrap}>
      <Bounce
        style={[s.card, fav && { borderWidth: 1, borderColor: GOLD + "55" }]}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={320}
      >
        {fav && <View style={s.favStar}><Icon name="star" size={11} color={GOLD} /></View>}
        <View style={[s.cardIcon, { backgroundColor: (tool.color || BLUE) + "14" }]}>
          <Icon name={tool.icon || "circle"} size={21} color={tool.color || BLUE} />
        </View>
        <Text style={s.cardName} numberOfLines={2}>{tool.name}</Text>
        {showCategory && <Text style={s.cardCat} numberOfLines={1}>{tool.categoryLabel}</Text>}
      </Bounce>
    </Animated.View>
  );
}

const SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 18,
  elevation: 2,
};

const s = StyleSheet.create({
  titleRow: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    flexShrink: 0,
  },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, gap: 10 },
  title: { fontFamily: FONTS.bold, fontSize: 22, color: INK, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, textAlign: "right", marginTop: 2 },
  readyPill: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  readyPillText: { fontFamily: FONTS.bold, fontSize: 12, color: "#0E7490" },

  transitCard: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: BLUE,
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  transitTitle: { fontFamily: FONTS.bold, fontSize: 16, color: WHITE, textAlign: "right" },
  transitSub: { fontFamily: FONTS.regular, fontSize: 11.5, color: "rgba(255,255,255,0.85)", textAlign: "right", marginTop: 2 },
  transitBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  searchWrap: { paddingHorizontal: 12, marginBottom: 10, justifyContent: "center" },
  search: {
    backgroundColor: WHITE,
    borderRadius: 24,
    minHeight: 52,
    paddingHorizontal: 18,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: INK,
    borderWidth: 1,
    borderColor: "#EEF1F6",
    ...SHADOW,
  },
  clearBtn: {
    position: "absolute",
    left: 24,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: { fontFamily: FONTS.bold, fontSize: 13, color: INK_MUTED },

  section: { marginBottom: 10 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: WHITE,
    borderRadius: 24,
    padding: 14,
    minHeight: 68,
    ...SHADOW,
  },
  sectionBadge: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sectionLabel: { fontFamily: FONTS.bold, fontSize: 15, color: INK },
  sectionMeta: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, marginTop: 2 },
  chevron: { fontFamily: FONTS.bold, fontSize: 20, color: INK_MUTED, width: 18, textAlign: "center" },

  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  cardWrap: { width: "33.33%", padding: 5 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 24,
    paddingVertical: 15,
    paddingHorizontal: 8,
    alignItems: "center",
    minHeight: 112,
    ...SHADOW,
  },
  cardIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  cardName: { fontFamily: FONTS.semibold, fontSize: 11, color: INK, textAlign: "center", lineHeight: 15 },
  cardCat: { fontFamily: FONTS.regular, fontSize: 9, color: INK_MUTED, textAlign: "center", marginTop: 3 },
  favStar: { position: "absolute", top: 6, right: 7, fontSize: 11 },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 14, color: INK_MUTED },

  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: INK,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 11,
    maxWidth: "88%",
  },
  toastText: { fontFamily: FONTS.semibold, fontSize: 13, color: WHITE, textAlign: "center" },

  backdrop: { flex: 1, backgroundColor: "rgba(16,20,26,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: WHITE, borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingHorizontal: 16, paddingTop: 8 },
  // A tall-enough strip so the swipe-down gesture is easy to grab by thumb.
  grabZone: { paddingTop: 8, paddingBottom: 14, alignItems: "center" },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: "#D8DDE3" },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sheetTitle: { flex: 1, fontFamily: FONTS.bold, fontSize: 17, color: INK, textAlign: "right" },
  closeBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  closeBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: INK_SOFT },
  favBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
});
