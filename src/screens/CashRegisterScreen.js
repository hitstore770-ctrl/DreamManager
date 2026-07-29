import { useMemo, useState } from "react";
import { I18nManager, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import CategoryTabBar from "../components/pos/CategoryTabBar";
import Icon from "../components/Icon";
import CustomText from "../components/CustomText";
import KitchenTab from "../components/pos/KitchenTab";
import PosRegisterTab from "../components/pos/PosRegisterTab";
import { BusinessProvider } from "../context/BusinessContext";
import { POS_CATEGORIES, posCategory } from "../utils/posCatalog";
import { resolveTarget } from "../components/pos/posRegistry";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { BEVEL, CARD_SHADOW, TYPE, UI, tint } from "../utils/ui";

// הקופה — the micro-operations hub.
//
// This is not the cashflow screen. Cashflow answers "is the business working";
// this answers "what do I press right now". Eight zones, one horizontal
// switcher, and every zone opens something real.
//
// Two presentation modes, decided by the catalogue entry rather than by the
// screen: calculator-sized tools open in a sheet you dismiss back onto the
// register, and full modules open full-screen because they own their own
// scrolling. Mixing those up is how a warehouse ends up in a 480pt window
// with two nested scrollbars.

// The catalogue promises; the registry delivers. Checking the two against each
// other here means a mismatch shows up as a visible strip at the top of the
// category during development, rather than as a tile that does nothing when a
// user finally taps it.
const UNRESOLVED = POS_CATEGORIES.flatMap((cat) =>
  cat.tools.filter((t) => !resolveTarget(t.target)).map((t) => `${cat.label}/${t.name}`)
);

export default function CashRegisterScreen({ navigation }) {
  return (
    <BusinessProvider>
      <RegisterShell navigation={navigation} />
    </BusinessProvider>
  );
}

function RegisterShell({ navigation }) {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState("pos");
  const [sheetTool, setSheetTool] = useState(null);
  const [fullTool, setFullTool] = useState(null);

  const category = posCategory(active);
  const SheetBody = useMemo(() => resolveTarget(sheetTool?.target), [sheetTool]);
  const FullBody = useMemo(() => resolveTarget(fullTool?.target), [fullTool]);

  const openTool = (tool) => {
    if (tool.target.kind === "screen") setFullTool(tool);
    else setSheetTool(tool);
  };

  return (
    <View style={[st.screen, { paddingTop: insets.top + 6 }]}>
      <View style={st.header}>
        <Bounce style={st.iconBtn} scaleTo={0.9} onPress={() => navigation?.goBack()}>
          <Icon name={I18nManager.isRTL ? "arrow-right" : "arrow-left"} size={19} color={UI.ink} />
        </Bounce>
        <View style={{ flex: 1 }}>
          <CustomText style={st.title}>הקופה</CustomText>
          <CustomText style={st.subtitle}>{category.hint}</CustomText>
        </View>
        <View style={[st.badge, { backgroundColor: tint(category.color, 0.12) }]}>
          <Icon name={category.icon} size={20} color={category.color} />
        </View>
      </View>

      <CategoryTabBar active={active} onChange={setActive} />

      {UNRESOLVED.length > 0 && (
        <View style={st.warn}>
          <CustomText style={st.warnText}>כלים שאין מאחוריהם קוד: {UNRESOLVED.join(", ")}</CustomText>
        </View>
      )}

      {active === "pos" ? (
        <PosRegisterTab bottomInset={insets.bottom} />
      ) : active === "kitchen" ? (
        // The kitchen is a live queue, not a tool launcher. Its three
        // calculators are still reachable from the sheet below via the
        // catalogue; what the tab itself shows is the board.
        <KitchenTab bottomInset={insets.bottom} />
      ) : (
        <ToolList key={active} category={category} onOpen={openTool} bottomInset={insets.bottom} />
      )}

      {/* Calculator-sized tools: a sheet over the register. */}
      <Modal visible={!!sheetTool} transparent animationType="slide" onRequestClose={() => setSheetTool(null)}>
        <Pressable style={st.backdrop} onPress={() => setSheetTool(null)}>
          <Pressable style={[st.sheet, { paddingBottom: insets.bottom + 18 }]} onPress={(e) => e.stopPropagation()}>
            <View style={st.sheetHead}>
              <Bounce style={st.sheetBtn} scaleTo={0.9} onPress={() => setSheetTool(null)}>
                <Icon name="x" size={18} color={UI.ink} />
              </Bounce>
              <CustomText style={st.sheetTitle} numberOfLines={1}>
                {sheetTool?.name}
              </CustomText>
            </View>
            <ScrollView
              style={{ maxHeight: 520 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {SheetBody ? <SheetBody /> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full modules: full-screen, with their own scrolling left intact. */}
      <Modal visible={!!fullTool} animationType="slide" onRequestClose={() => setFullTool(null)}>
        <View style={[st.full, { paddingTop: insets.top + 6 }]}>
          <View style={st.header}>
            <Bounce style={st.iconBtn} scaleTo={0.9} onPress={() => setFullTool(null)}>
              <Icon name={I18nManager.isRTL ? "arrow-right" : "arrow-left"} size={19} color={UI.ink} />
            </Bounce>
            <CustomText style={[st.title, { flex: 1 }]}>{fullTool?.name}</CustomText>
          </View>
          <View style={{ flex: 1 }}>{FullBody ? <FullBody /> : null}</View>
        </View>
      </Modal>
    </View>
  );
}

// FlashList, not a mapped ScrollView. The lists themselves are short, but the
// eight of them share one recycling pool — switching category swaps the data
// and reuses the cells instead of mounting a fresh set every time, which is
// what keeps the tab change feeling instant rather than merely fast.
function ToolList({ category, onOpen, bottomInset }) {
  return (
    <FlashList
      testID={`pos-list-${category.key}`}
      data={category.tools}
      keyExtractor={(t) => t.id}
      contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 6, paddingBottom: bottomInset + 96 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <Animated.View entering={FadeIn.duration(180)} style={st.listHead}>
          <CustomText style={st.listHeadText}>
            {category.tools.length} כלים · {category.label}
          </CustomText>
        </Animated.View>
      }
      renderItem={({ item, index }) => (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).springify().damping(15)}>
          <TouchableOpacity
            testID={`pos-tool-${item.id}`}
            activeOpacity={0.85}
            style={st.card}
            onPress={() => onOpen(item)}
          >
            <View style={[st.cardBadge, { backgroundColor: tint(category.color, 0.11) }]}>
              <Icon name={item.icon} size={19} color={category.color} />
            </View>
            <View style={{ flex: 1 }}>
              <CustomText style={st.cardTitle}>{item.name}</CustomText>
              <CustomText style={st.cardHint}>{item.hint}</CustomText>
            </View>
            {item.target.kind === "screen" && (
              <View style={st.fullTag}>
                <CustomText style={st.fullTagText}>מסך מלא</CustomText>
              </View>
            )}
            <Icon name={I18nManager.isRTL ? "chevron-left" : "chevron-right"} size={17} color={UI.inkMuted} />
          </TouchableOpacity>
        </Animated.View>
      )}
    />
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },
  full: { flex: 1, backgroundColor: UI.bg },

  header: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
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
  badge: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: FONTS.bold, fontSize: TYPE.title, color: UI.ink, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },

  warn: { marginHorizontal: 14, marginBottom: 6, backgroundColor: tint(UI.red, 0.1), borderRadius: 10, padding: 9 },
  warnText: { fontFamily: FONTS.semibold, fontSize: 11.5, color: UI.red, textAlign: "right" },

  listHead: { paddingVertical: 8 },
  listHeadText: { fontFamily: FONTS.semibold, fontSize: 12, color: UI.inkMuted, textAlign: "right" },

  card: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: UI.surface,
    borderRadius: UI.radius,
    paddingHorizontal: 14,
    minHeight: 76,
    marginBottom: 10,
    ...BEVEL,
    ...CARD_SHADOW,
  },
  cardBadge: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: FONTS.bold, fontSize: 14.5, color: UI.ink, textAlign: "right" },
  cardHint: { fontFamily: FONTS.regular, fontSize: 11.5, color: UI.inkMuted, textAlign: "right", marginTop: 3, lineHeight: 17 },
  fullTag: { backgroundColor: UI.surfaceHi, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  fullTagText: { fontFamily: FONTS.semibold, fontSize: 9.5, color: UI.inkMuted },

  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: UI.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  sheetHead: { flexDirection: I18nManager.isRTL ? "row" : "row-reverse", alignItems: "center", gap: 10, marginBottom: 12 },
  sheetBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: UI.surfaceHi, alignItems: "center", justifyContent: "center" },
  sheetTitle: { flex: 1, fontFamily: FONTS.bold, fontSize: 17, color: UI.ink, textAlign: "right" },
});
