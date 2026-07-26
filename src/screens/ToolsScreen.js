import { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
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
import Animated, { FadeInDown, FadeInUp, LinearTransition } from "react-native-reanimated";

import { MINI_APPS } from "../components/tools/MiniApps";
import { hapticLight, hapticWarning } from "../utils/haptics";
import { ALL_TOOLS, IMPLEMENTED, TOOL_CATEGORIES, TOOL_COUNT } from "../utils/toolsCatalog";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";

// כלים — a 120-utility directory: fixed search on top, eight collapsible
// category accordions, and a sheet that hosts the fully-built mini-apps.

const WHITE = "#FFFFFF";
const BG = "#F4F5F7";
const INK = "#1A1D21";
const INK_SOFT = "#5A6470";
const INK_MUTED = "#9AA4B0";
const BLUE = "#003366";
const GOLD = "#D4AF37";

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [openSections, setOpenSections] = useState({ logistics: true });
  const [activeTool, setActiveTool] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const q = query.trim().toLowerCase();

  // While searching, show a single flat result list instead of accordions —
  // collapsing sections would hide matches behind another tap.
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

  const openTool = (tool) => {
    if (IMPLEMENTED.has(tool.id)) {
      hapticLight();
      setActiveTool(tool);
      return;
    }
    // Not built yet — say so instead of opening an empty screen.
    hapticWarning();
    flash(`${tool.emoji} ${tool.name} — בקרוב 🚧`);
  };

  const ActiveMini = activeTool ? MINI_APPS[activeTool.id] : null;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>🧰 כלים</Text>
          <Text style={s.subtitle}>
            {searchResults ? `${searchResults.length} תוצאות` : `${TOOL_COUNT} כלים ב-${TOOL_CATEGORIES.length} קטגוריות`}
          </Text>
        </View>
        <View style={s.readyPill}>
          <Text style={s.readyPillText}>✓ {IMPLEMENTED.size} פעילים</Text>
        </View>
      </View>

      {/* Fixed search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder="🔎 חיפוש כלי..."
          placeholderTextColor={INK_MUTED}
          textAlign="right"
          autoCapitalize="none"
        />
        {!!query && (
          <TouchableOpacity style={s.clearBtn} onPress={() => { hapticLight(); setQuery(""); }} activeOpacity={0.7}>
            <Text style={s.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {searchResults ? (
          searchResults.length === 0 ? (
            <Animated.View entering={FadeInUp.duration(260)} style={s.empty}>
              <Text style={{ fontSize: 38 }}>🔍</Text>
              <Text style={s.emptyText}>לא נמצא כלי בשם הזה</Text>
            </Animated.View>
          ) : (
            <View style={s.grid}>
              {searchResults.map((tool, i) => (
                <ToolCard key={tool.id} tool={tool} index={i} onPress={() => openTool(tool)} showCategory />
              ))}
            </View>
          )
        ) : (
          TOOL_CATEGORIES.map((cat) => {
            const isOpen = !!openSections[cat.key];
            const ready = cat.tools.filter((t) => IMPLEMENTED.has(t.id)).length;
            return (
              <Animated.View key={cat.key} layout={LinearTransition.springify()} style={s.section}>
                <TouchableOpacity style={s.sectionHead} onPress={() => toggleSection(cat.key)} activeOpacity={0.75}>
                  <Text style={[s.chevron, isOpen && { transform: [{ rotate: "90deg" }] }]}>›</Text>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={s.sectionLabel}>{cat.label}</Text>
                    <Text style={s.sectionMeta}>
                      {cat.tools.length} כלים{ready ? ` · ${ready} פעילים` : ""}
                    </Text>
                  </View>
                  <View style={[s.sectionBadge, { backgroundColor: cat.color + "16" }]}>
                    <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                  </View>
                </TouchableOpacity>

                {isOpen && (
                  <View style={s.grid}>
                    {cat.tools.map((tool, i) => (
                      <ToolCard
                        key={tool.id}
                        tool={{ ...tool, color: cat.color }}
                        index={i}
                        onPress={() => openTool(tool)}
                      />
                    ))}
                  </View>
                )}
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {toast && (
        <Animated.View entering={FadeInUp.duration(200)} style={[s.toast, { bottom: insets.bottom + 90 }]}>
          <Text style={s.toastText}>{toast}</Text>
        </Animated.View>
      )}

      {/* Mini-app sheet */}
      <Modal visible={!!activeTool} transparent animationType="slide" onRequestClose={() => setActiveTool(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={() => setActiveTool(null)}>
            <View style={s.backdrop}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
                  <View style={s.grabber} />
                  <View style={s.sheetHead}>
                    <TouchableOpacity style={s.closeBtn} onPress={() => setActiveTool(null)} activeOpacity={0.7}>
                      <Text style={s.closeBtnText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={s.sheetTitle} numberOfLines={1}>
                      {activeTool?.emoji} {activeTool?.name}
                    </Text>
                  </View>
                  <ScrollView
                    style={{ maxHeight: 480 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 100 }}
                  >
                    {ActiveMini && <ActiveMini />}
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function ToolCard({ tool, index, onPress, showCategory }) {
  const ready = IMPLEMENTED.has(tool.id);
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 22, 260)).duration(240)} style={s.cardWrap}>
      <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
        {ready && (
          <View style={s.readyDot}>
            <Text style={s.readyDotText}>✓</Text>
          </View>
        )}
        <View style={[s.cardIcon, { backgroundColor: (tool.color || BLUE) + "14" }]}>
          <Text style={{ fontSize: 21 }}>{tool.emoji}</Text>
        </View>
        <Text style={s.cardName} numberOfLines={2}>{tool.name}</Text>
        {showCategory && <Text style={s.cardCat} numberOfLines={1}>{tool.categoryLabel}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}

const SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 3,
  elevation: 2,
};

const s = StyleSheet.create({
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
  readyPillText: { fontFamily: FONTS.bold, fontSize: 12, color: "#8A6D14" },

  searchWrap: { paddingHorizontal: 12, marginBottom: 10, justifyContent: "center" },
  search: {
    backgroundColor: WHITE,
    borderRadius: 16,
    minHeight: 52,
    paddingHorizontal: 18,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: INK,
    borderWidth: 1,
    borderColor: "#EAEAEA",
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
    borderRadius: 16,
    padding: 12,
    minHeight: 64,
    ...SHADOW,
  },
  sectionBadge: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sectionLabel: { fontFamily: FONTS.bold, fontSize: 15, color: INK },
  sectionMeta: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, marginTop: 2 },
  chevron: { fontFamily: FONTS.bold, fontSize: 20, color: INK_MUTED, width: 18, textAlign: "center" },

  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  cardWrap: { width: "33.33%", padding: 4 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    minHeight: 104,
    ...SHADOW,
  },
  cardIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  cardName: { fontFamily: FONTS.semibold, fontSize: 11, color: INK, textAlign: "center", lineHeight: 15 },
  cardCat: { fontFamily: FONTS.regular, fontSize: 9, color: INK_MUTED, textAlign: "center", marginTop: 3 },
  readyDot: {
    position: "absolute",
    top: 7,
    left: 7,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  readyDotText: { fontFamily: FONTS.bold, fontSize: 10, color: "#3A2E08" },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 14, color: INK_MUTED },

  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: INK,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 11,
    maxWidth: "88%",
  },
  toastText: { fontFamily: FONTS.semibold, fontSize: 13, color: WHITE, textAlign: "center" },

  backdrop: { flex: 1, backgroundColor: "rgba(16,20,26,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: WHITE, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#E3E6EA", marginBottom: 10 },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sheetTitle: { flex: 1, fontFamily: FONTS.bold, fontSize: 18, color: INK, textAlign: "right" },
  closeBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  closeBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: INK_SOFT },
});
