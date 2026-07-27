import { useMemo, useState } from "react";
import {
  I18nManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { Canvas, Card, GradCard } from "../components/Paper";
import ToolRenderer from "../components/tools/ToolRenderer";
import { hapticLight, hapticSuccess } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { ALL_TOOLS } from "../utils/toolsCatalog";
import { usePersistentState } from "../utils/usePersistentState";
import { BEVEL, GRAD, SOFT_SHADOW_LG, TYPE, UI, glow, tint } from "../utils/ui";

// בית המלאכה — the tools tab, organised as workbenches rather than as a
// flat directory.
//
// The catalogue ships four storage categories; those are how the tools are
// *filed*, not how they are *used*. A workshop groups by discipline: the
// marketing bench, the hardware bench, the studio bench. So the benches below
// re-cut the same 43 tools by the job you came here to do.
//
// Every id is listed explicitly, and anything not claimed by a bench falls
// into the last one. That is deliberate: a hand-written layout over a
// generated catalogue silently loses tools when the catalogue grows, and a
// tool you cannot find is the same as a tool that does not exist.

const BENCHES = [
  {
    key: "marketing",
    label: "שיווק דיגיטלי",
    hint: "קמפיינים, לידים ותוכן",
    icon: "target",
    tone: "#8B5CF6",
    grad: GRAD.violet,
    ids: ["qr-gen", "wa-direct", "ai-image", "roas", "prompt-builder", "discount-calc", "discount-stack"],
  },
  {
    key: "hardware",
    label: "חומרה ומכונות",
    hint: "מכונות שתייה, חשמל ורכב",
    icon: "cpu",
    tone: "#10B981",
    grad: GRAD.green,
    ids: [
      "power-load",
      "ohms-law",
      "coin-float",
      "transit-load",
      "route-planner",
      "fuel-cost",
      "car-depreciation",
      "loan-calc",
    ],
  },
  {
    key: "studio",
    label: "סטודיו והפקה",
    hint: "וידאו, רחפן ואחסון",
    icon: "film",
    tone: "#F87171",
    grad: GRAD.coral,
    ids: ["video-size", "drone-flight", "timelapse-calc", "aspect-ratio", "storage-conv", "fps-slowmo"],
  },
  {
    key: "pricing",
    label: "תמחור ופיננסים",
    hint: "מע״מ, מתח רווח וייבוא",
    icon: "trending-up",
    tone: "#22D3EE",
    grad: GRAD.cyan,
    ids: ["vat-calc", "margin-calc", "markup-margin", "vat-extract", "rule-72", "percent-calc", "ali-import"],
  },
  {
    key: "personal",
    label: "אישי ופנימייה",
    hint: "זמן, לימודים ויום-יום",
    icon: "user",
    tone: "#E7C46B",
    grad: GRAD.gold,
    ids: [], // everything the benches above did not claim
  },
];

// Resolve ids to catalogue entries once, and sweep the remainder into the last
// bench so the workshop always totals the full catalogue.
const BY_ID = new Map(ALL_TOOLS.map((t) => [t.id, t]));
const CLAIMED = new Set(BENCHES.flatMap((b) => b.ids));
const WORKBENCHES = BENCHES.map((b) => ({
  ...b,
  tools: b.ids.length
    ? b.ids.map((id) => BY_ID.get(id)).filter(Boolean)
    : ALL_TOOLS.filter((t) => !CLAIMED.has(t.id)),
}));

const TOTAL = WORKBENCHES.reduce((n, b) => n + b.tools.length, 0);

export default function ToolsWorkshopScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [activeTool, setActiveTool] = useState(null);
  const [favorites, setFavorites] = usePersistentState(STORAGE_KEYS.toolFavorites, []);

  const favSet = useMemo(() => new Set(favorites || []), [favorites]);
  const favTools = useMemo(
    () => (favorites || []).map((id) => BY_ID.get(id)).filter(Boolean),
    [favorites]
  );

  const q = query.trim();
  const results = useMemo(() => {
    if (!q) return null;
    return ALL_TOOLS.filter((t) => t.name.includes(q) || t.id.includes(q.toLowerCase()));
  }, [q]);

  const open = (tool) => {
    hapticLight();
    setActiveTool(tool);
  };

  const toggleFavorite = (tool) => {
    hapticSuccess();
    setFavorites((prev) => {
      const list = prev || [];
      return list.includes(tool.id) ? list.filter((id) => id !== tool.id) : [...list, tool.id];
    });
  };

  return (
    <Canvas testID="workshop-screen" tone="#22D3EE">
      <View style={{ paddingTop: insets.top + 12 }}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>בית המלאכה</Text>
            <Text style={s.subtitle}>{TOTAL} כלים · {WORKBENCHES.length} עמדות עבודה</Text>
          </View>
          <View style={s.headerBadge}>
            <Icon name="tool" size={20} color={UI.cyan} />
          </View>
        </View>

        <Card style={s.search} radius={UI.radiusSm}>
          <View style={s.searchInner}>
            <Icon name="search" size={17} color={UI.inkMuted} />
            <TextInput
              testID="workshop-search"
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="חיפוש כלי"
              placeholderTextColor={UI.inkMuted}
              textAlign="right"
            />
            {!!q && (
              <Bounce style={s.clearBtn} scaleTo={0.9} onPress={() => setQuery("")}>
                <Icon name="x" size={15} color={UI.inkMuted} />
              </Bounce>
            )}
          </View>
        </Card>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {results ? (
          results.length === 0 ? (
            <View style={s.empty}>
              <Icon name="search" size={26} color={UI.inkMuted} />
              <Text style={s.emptyText}>לא נמצא כלי בשם הזה</Text>
            </View>
          ) : (
            <Animated.View entering={FadeIn.duration(200)}>
              <Text style={s.resultHead}>{results.length} תוצאות</Text>
              <View style={s.grid}>
                {results.map((t, i) => (
                  <ToolTile
                    key={t.id}
                    tool={t}
                    index={i}
                    tone={t.color}
                    fav={favSet.has(t.id)}
                    onPress={() => open(t)}
                    onLongPress={() => toggleFavorite(t)}
                  />
                ))}
              </View>
            </Animated.View>
          )
        ) : (
          <>
            {favTools.length > 0 && (
              <View style={s.bench}>
                <BenchHead
                  icon="star"
                  tone={UI.gold}
                  grad={GRAD.gold}
                  label="המועדפים שלי"
                  hint="לחיצה ארוכה על כלי מוסיפה או מסירה"
                  count={favTools.length}
                />
                <View style={s.grid}>
                  {favTools.map((t, i) => (
                    <ToolTile
                      key={t.id}
                      tool={t}
                      index={i}
                      tone={UI.gold}
                      fav
                      onPress={() => open(t)}
                      onLongPress={() => toggleFavorite(t)}
                    />
                  ))}
                </View>
              </View>
            )}

            {WORKBENCHES.map((b) => (
              <View key={b.key} style={s.bench}>
                <BenchHead
                  icon={b.icon}
                  tone={b.tone}
                  grad={b.grad}
                  label={b.label}
                  hint={b.hint}
                  count={b.tools.length}
                />
                <View style={s.grid}>
                  {b.tools.map((t, i) => (
                    <ToolTile
                      key={t.id}
                      tool={t}
                      index={i}
                      tone={b.tone}
                      fav={favSet.has(t.id)}
                      onPress={() => open(t)}
                      onLongPress={() => toggleFavorite(t)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Tool sheet */}
      <Modal visible={!!activeTool} transparent animationType="slide" onRequestClose={() => setActiveTool(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={() => setActiveTool(null)}>
            <View style={s.backdrop}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
                  <View style={s.grabber} />
                  <View style={s.sheetHead}>
                    <Bounce style={s.sheetBtn} scaleTo={0.9} onPress={() => setActiveTool(null)}>
                      <Icon name="x" size={17} color={UI.inkSoft} />
                    </Bounce>
                    <Bounce
                      testID="sheet-fav"
                      style={s.sheetBtn}
                      scaleTo={0.9}
                      onPress={() => activeTool && toggleFavorite(activeTool)}
                    >
                      <Icon
                        name="star"
                        size={17}
                        color={activeTool && favSet.has(activeTool.id) ? UI.gold : UI.inkMuted}
                      />
                    </Bounce>
                    <Text style={s.sheetTitle} numberOfLines={1}>{activeTool?.name}</Text>
                  </View>
                  <ToolRenderer toolId={activeTool?.id} tool={activeTool} />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </Canvas>
  );
}

function BenchHead({ icon, tone, grad, label, hint, count }) {
  return (
    <View style={s.benchHead}>
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.benchBadge}>
        <Icon name={icon} size={18} color="#FFFFFF" />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={s.benchLabel}>{label}</Text>
        <Text style={s.benchHint}>{hint}</Text>
      </View>
      <View style={[s.benchCount, { backgroundColor: tint(tone, 0.18) }]}>
        <Text style={[s.benchCountText, { color: tone }]}>{count}</Text>
      </View>
    </View>
  );
}

function ToolTile({ tool, index, tone, fav, onPress, onLongPress }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 40, 260)).springify().damping(15)}
      style={s.tileWrap}
    >
      <Bounce
        testID={`tool-${tool.id}`}
        scaleTo={0.94}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={380}
      >
        <GradCard colors={GRAD.surface} radius={UI.radiusSm}>
          <View style={s.tile}>
            {/* The accent rail is what turns a list of identical cards into a
                bench: colour identifies the discipline before the name is read. */}
            <LinearGradient
              colors={[tone, "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={s.tileRail}
              pointerEvents="none"
            />
            {fav && <View style={[s.favDot, { backgroundColor: UI.gold }]} />}
            <View style={[s.tileGem, { backgroundColor: tint(tone, 0.18) }]}>
              <Icon name={tool.icon} size={19} color={tone} />
            </View>
            <Text style={s.tileName} numberOfLines={2}>{tool.name}</Text>
          </View>
        </GradCard>
      </Bounce>
    </Animated.View>
  );
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({
  header: { flexDirection: ROW, alignItems: "center", gap: 12, paddingHorizontal: UI.cardMarginH },
  title: { fontFamily: FONTS.bold, fontSize: TYPE.hero, color: UI.ink, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  headerBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: tint(UI.cyan, 0.18),
    alignItems: "center",
    justifyContent: "center",
    ...BEVEL,
  },

  search: { marginHorizontal: UI.cardMarginH, marginTop: 14 },
  searchInner: { flexDirection: ROW, alignItems: "center", gap: 10, paddingHorizontal: 14, minHeight: 52 },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 14.5,
    color: UI.ink,
    minHeight: 52,
    ...(Platform.OS === "web" ? { outlineStyle: "none", outlineWidth: 0 } : {}),
  },
  clearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: UI.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },

  bench: { marginBottom: 26 },
  benchHead: { flexDirection: ROW, alignItems: "center", gap: 12, paddingHorizontal: UI.cardMarginH, marginBottom: 12 },
  benchBadge: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", ...BEVEL },
  benchLabel: { fontFamily: FONTS.bold, fontSize: TYPE.section, color: UI.ink, textAlign: "right" },
  benchHint: { fontFamily: FONTS.regular, fontSize: 11.5, color: UI.inkMuted, textAlign: "right", marginTop: 1 },
  benchCount: { minWidth: 30, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  benchCountText: { fontFamily: FONTS.bold, fontSize: 12 },

  grid: {
    flexDirection: ROW,
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: UI.cardMarginH,
  },
  tileWrap: { width: "48%" },
  tile: { padding: 14, gap: 10, minHeight: 108, overflow: "hidden" },
  tileRail: { position: "absolute", top: 0, bottom: 0, right: 0, width: 3, opacity: 0.9 },
  tileGem: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", ...BEVEL },
  tileName: { fontFamily: FONTS.semibold, fontSize: 12.5, color: UI.ink, textAlign: "right", lineHeight: 17 },
  favDot: { position: "absolute", top: 12, left: 12, width: 7, height: 7, borderRadius: 4 },

  resultHead: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.section,
    color: UI.ink,
    textAlign: "right",
    paddingHorizontal: UI.cardMarginH,
    marginBottom: 12,
  },
  empty: { alignItems: "center", gap: 10, paddingVertical: 60 },
  emptyText: { fontFamily: FONTS.medium, fontSize: 14, color: UI.inkMuted },

  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.38)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: UI.bg,
    borderTopLeftRadius: UI.radiusLg,
    borderTopRightRadius: UI.radiusLg,
    paddingHorizontal: 18,
    paddingTop: 8,
    maxHeight: "88%",
    borderTopWidth: 1,
    borderTopColor: UI.hairline,
    ...SOFT_SHADOW_LG,
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D6DBE5",
    marginBottom: 10,
  },
  sheetHead: { flexDirection: ROW, alignItems: "center", gap: 10, marginBottom: 14 },
  sheetBtn: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: UI.surface,
    alignItems: "center",
    justifyContent: "center",
    ...BEVEL,
  },
  sheetTitle: { flex: 1, fontFamily: FONTS.bold, fontSize: 17, color: UI.ink, textAlign: "right" },
});
