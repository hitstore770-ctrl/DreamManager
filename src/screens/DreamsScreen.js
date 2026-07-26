import { useMemo, useRef, useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { CoverGradient, Scrim } from "../components/dreams/Scrim";
import { DREAM_COVERS, dreamProgress, useDreams } from "../context/DreamContext";
import { hapticHeavy, hapticLight, hapticSuccess } from "../utils/haptics";
import { shekel } from "../utils/posStore";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";

// חלומות — a visual vision board. Cards are photo (or gradient) tiles with a
// dark scrim so the title stays readable, and a gold progress bar driven by
// the milestone checklist.

const WHITE = "#FFFFFF";
const BG = "#F8F9FA";
const CARD = "#F4F5F7";
const INK = "#1A1D21";
const INK_SOFT = "#5A6470";
const INK_MUTED = "#9AA4B0";
const BLUE = "#003366";
const GOLD = "#D4AF37";

const coverOf = (key) => DREAM_COVERS.find((c) => c.key === key) || DREAM_COVERS[0];

export default function DreamsScreen() {
  const insets = useSafeAreaInsets();
  const {
    dreams,
    isLoading,
    addDream,
    removeDream,
    toggleMilestone,
    addChecklistMilestone,
    addDreamSavings,
  } = useDreams();

  const [openId, setOpenId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", target: "", cover: "night" });
  const [newMilestone, setNewMilestone] = useState("");
  const [savingInput, setSavingInput] = useState("");

  // Light tick as the board scrolls past each "page" — subtle, not per-pixel.
  const lastTick = useRef(0);
  const onScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    if (Math.abs(y - lastTick.current) > 220) {
      lastTick.current = y;
      hapticLight();
    }
  };

  const open = dreams.find((d) => d.id === openId) || null;

  // Two-column masonry: taller tile in whichever column is currently shorter.
  const columns = useMemo(() => {
    const cols = [[], []];
    const heights = [0, 0];
    dreams.forEach((d, i) => {
      // Alternate tall/short tiles for a proper vision-board rhythm.
      const h = i % 3 === 0 ? 210 : 168;
      const side = heights[0] <= heights[1] ? 0 : 1;
      cols[side].push({ dream: d, height: h, index: i });
      heights[side] += h + 12;
    });
    return cols;
  }, [dreams]);

  const createDream = () => {
    const title = form.title.trim();
    if (!title) return;
    hapticHeavy(); // heavy feedback: a new dream is a big commitment
    const target = parseFloat(form.target) || 0;
    const dream = addDream({ title, type: target ? "money" : "knowledge", target, cover: form.cover });
    setForm({ title: "", target: "", cover: "night" });
    setCreateOpen(false);
    setOpenId(dream.id);
  };

  const tickMilestone = (dreamId, milestoneId, wasDone) => {
    if (wasDone) hapticLight();
    else hapticSuccess(); // success feedback when completing
    toggleMilestone(dreamId, milestoneId);
  };

  const addSavings = (amount) => {
    if (!open) return;
    hapticLight();
    addDreamSavings(open.id, amount);
  };

  const submitSaving = () => {
    const v = parseFloat(savingInput);
    if (!(v > 0)) return;
    addSavings(v);
    setSavingInput("");
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>✨ חלומות</Text>
        {dreams.length > 0 && (
          <Text style={s.headerSub}>{dreams.length} חלומות על הלוח</Text>
        )}
      </View>

      {isLoading && dreams.length === 0 ? (
        // Skeleton tiles while the board loads — showing the empty state here
        // would wrongly tell the user they have no dreams.
        <View style={s.skeletonWrap}>
          {[210, 168, 168, 210].map((h, i) => (
            <View key={i} style={[s.skeleton, { height: h, width: "47%" }]} />
          ))}
        </View>
      ) : dreams.length === 0 ? (
        <Animated.View entering={FadeInUp.duration(400)} style={s.empty}>
          <View style={s.emptyBadge}>
            <Text style={{ fontSize: 46 }}>🌙</Text>
          </View>
          <Text style={s.emptyTitle}>מה החלום הבא שלך?</Text>
          <Text style={s.emptyText}>
            הוסף חלום ראשון ללוח החזון — תמונה, יעד ואבני דרך שיקרבו אותך אליו.
          </Text>
        </Animated.View>
      ) : (
        <ScrollView
          onScroll={onScroll}
          scrollEventThrottle={64}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 110 }}
        >
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            {columns.map((col, ci) => (
              <View key={ci} style={{ flex: 1, gap: 12 }}>
                {col.map(({ dream, height, index }) => (
                  <DreamCard
                    key={dream.id}
                    dream={dream}
                    height={height}
                    index={index}
                    onPress={() => { hapticLight(); setOpenId(dream.id); }}
                  />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Floating add — lifted clear of the tab bar / gesture area */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 26 }]}
        onPress={() => { hapticLight(); setCreateOpen(true); }}
        activeOpacity={0.85}
      >
        <Text style={s.fabPlus}>＋</Text>
      </TouchableOpacity>

      {/* ---- Dream details sheet ---- */}
      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpenId(null)}>
        <TouchableWithoutFeedback onPress={() => setOpenId(null)}>
          <View style={s.backdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[s.sheet, { paddingBottom: insets.bottom + 18 }]}>
                {open && (
                  <>
                    <View style={s.grabber} />
                    {/* Hero */}
                    <View style={s.sheetHero}>
                      {open.imageUri ? (
                        <Image source={{ uri: open.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <CoverGradient colors={coverOf(open.cover).colors} />
                      )}
                      <Scrim />
                      <View style={s.sheetHeroText}>
                        <Text style={s.sheetTitle} numberOfLines={2}>{open.title}</Text>
                        <Text style={s.sheetPct}>{dreamProgress(open)}% הושלם</Text>
                      </View>
                    </View>

                    <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                      {/* Financial target */}
                      <View style={s.finCard}>
                        <View style={s.finRow}>
                          <Text style={s.finTarget}>{shekel(open.target || 0)}</Text>
                          <Text style={s.finLabel}>🎯 יעד כספי</Text>
                        </View>
                        <View style={s.finRow}>
                          <Text style={s.finSaved}>{shekel(open.saved || 0)}</Text>
                          <Text style={s.finLabel}>💰 נחסך עד כה</Text>
                        </View>
                        <View style={s.finBarBg}>
                          <View
                            style={[
                              s.finBarFill,
                              {
                                width: `${open.target ? Math.min(100, Math.round(((open.saved || 0) / open.target) * 100)) : 0}%`,
                              },
                            ]}
                          />
                        </View>
                        <View style={s.finQuick}>
                          <TextInput
                            style={s.finInput}
                            value={savingInput}
                            onChangeText={setSavingInput}
                            keyboardType="numeric"
                            placeholder="סכום"
                            placeholderTextColor={INK_MUTED}
                            textAlign="center"
                            onSubmitEditing={submitSaving}
                          />
                          {[50, 100, 500].map((amt) => (
                            <TouchableOpacity key={amt} style={s.finChip} onPress={() => addSavings(amt)} activeOpacity={0.7}>
                              <Text style={s.finChipText}>+{amt}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <Text style={s.finHint}>בהמשך נחבר את זה אוטומטית לרווחי הקופה 💼</Text>
                      </View>

                      {/* Milestones */}
                      <Text style={s.sectionTitle}>🪜 אבני דרך</Text>
                      {(open.milestones || []).length === 0 && (
                        <Text style={s.finHint}>עוד אין אבני דרך — הוסף את הצעד הראשון למטה.</Text>
                      )}
                      {(open.milestones || []).map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={s.msRow}
                          onPress={() => tickMilestone(open.id, m.id, m.done)}
                          activeOpacity={0.7}
                        >
                          <View style={[s.msBox, m.done && { backgroundColor: GOLD, borderColor: GOLD }]}>
                            {m.done && <Text style={s.msCheck}>✓</Text>}
                          </View>
                          <Text style={[s.msText, m.done && { color: INK_MUTED, textDecorationLine: "line-through" }]}>
                            {m.title}
                          </Text>
                        </TouchableOpacity>
                      ))}

                      <View style={s.msAddRow}>
                        <TouchableOpacity
                          style={[s.msAddBtn, !newMilestone.trim() && { opacity: 0.35 }]}
                          onPress={() => {
                            const t = newMilestone.trim();
                            if (!t) return;
                            hapticLight();
                            addChecklistMilestone(open.id, t);
                            setNewMilestone("");
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={s.msAddBtnText}>＋</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={s.msInput}
                          value={newMilestone}
                          onChangeText={setNewMilestone}
                          placeholder="אבן דרך חדשה..."
                          placeholderTextColor={INK_MUTED}
                          textAlign="right"
                        />
                      </View>

                      <TouchableOpacity
                        style={s.deleteBtn}
                        onPress={() => { hapticLight(); removeDream(open.id); setOpenId(null); }}
                        activeOpacity={0.7}
                      >
                        <Text style={s.deleteBtnText}>🗑️ הסר חלום מהלוח</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ---- Create dream ---- */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setCreateOpen(false)}>
          <View style={s.centerBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={s.createCard}>
                <Text style={s.createTitle}>✨ חלום חדש</Text>
                <TextInput
                  style={s.createInput}
                  value={form.title}
                  onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                  placeholder="מה החלום?"
                  placeholderTextColor={INK_MUTED}
                  textAlign="right"
                />
                <TextInput
                  style={s.createInput}
                  value={form.target}
                  onChangeText={(v) => setForm((f) => ({ ...f, target: v }))}
                  keyboardType="numeric"
                  placeholder="יעד כספי ₪ (לא חובה)"
                  placeholderTextColor={INK_MUTED}
                  textAlign="center"
                />
                <Text style={s.createLabel}>רקע הכרטיס</Text>
                <View style={s.coverRow}>
                  {DREAM_COVERS.map((c) => (
                    <TouchableOpacity
                      key={c.key}
                      style={[s.coverDot, form.cover === c.key && { borderColor: GOLD, borderWidth: 3 }]}
                      onPress={() => { hapticLight(); setForm((f) => ({ ...f, cover: c.key })); }}
                      activeOpacity={0.8}
                    >
                      <CoverGradient colors={c.colors} />
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setCreateOpen(false)} activeOpacity={0.7}>
                    <Text style={s.cancelBtnText}>ביטול</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.saveBtn, !form.title.trim() && { opacity: 0.35 }]}
                    onPress={createDream}
                    activeOpacity={0.85}
                  >
                    <Text style={s.saveBtnText}>הוסף ללוח</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

// A vision tile: cover photo or gradient, dark scrim for legibility, title and
// a gold progress bar. Enters with a staggered fade + slide-up.
function DreamCard({ dream, height, index, onPress }) {
  const pct = dreamProgress(dream);
  const done = (dream.milestones || []).filter((m) => m.done).length;
  const total = (dream.milestones || []).length;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 80, 480)).duration(420)}>
      <TouchableOpacity style={[s.card, { height }]} onPress={onPress} activeOpacity={0.88}>
        {dream.imageUri ? (
          <Image source={{ uri: dream.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <CoverGradient colors={coverOf(dream.cover).colors} />
        )}
        <Scrim />
        <View style={s.cardBody}>
          <Text style={s.cardTitle} numberOfLines={2}>{dream.title}</Text>
          <View style={s.cardMetaRow}>
            <Text style={s.cardPct}>{pct}%</Text>
            <Text style={s.cardMeta}>
              {total ? `${done}/${total} אבני דרך` : dream.target ? shekel(dream.target) : "יעד אישי"}
            </Text>
          </View>
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${pct}%` }]} />
          </View>
        </View>
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
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  title: { fontFamily: FONTS.bold, fontSize: 22, color: INK, textAlign: "right" },
  headerSub: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, textAlign: "right", marginTop: 2 },

  skeletonWrap: { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 12, justifyContent: "space-between" },
  skeleton: { backgroundColor: "#ECEFF3", borderRadius: 20 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 34, marginTop: -40 },
  emptyBadge: {
    width: 104,
    height: 104,
    borderRadius: 34,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    ...SHADOW,
  },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 21, color: INK, marginBottom: 8, textAlign: "center" },
  emptyText: { fontFamily: FONTS.light, fontSize: 14, color: INK_SOFT, textAlign: "center", lineHeight: 22 },

  card: { borderRadius: 20, overflow: "hidden", justifyContent: "flex-end", ...SHADOW },
  cardBody: { padding: 12 },
  cardTitle: { fontFamily: FONTS.bold, fontSize: 15, color: WHITE, textAlign: "right" },
  cardMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  cardPct: { fontFamily: FONTS.bold, fontSize: 13, color: GOLD },
  cardMeta: { fontFamily: FONTS.regular, fontSize: 11, color: "rgba(255,255,255,0.82)" },
  barBg: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.26)", marginTop: 7, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, backgroundColor: GOLD },

  fab: {
    position: "absolute",
    right: 18,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  fabPlus: { fontFamily: FONTS.bold, fontSize: 30, color: WHITE, lineHeight: 34 },

  backdrop: { flex: 1, backgroundColor: "rgba(16,20,26,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: WHITE, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#E3E6EA", marginBottom: 12 },
  sheetHero: { height: 132, borderRadius: 18, overflow: "hidden", justifyContent: "flex-end", marginBottom: 12 },
  sheetHeroText: { padding: 14 },
  sheetTitle: { fontFamily: FONTS.bold, fontSize: 20, color: WHITE, textAlign: "right" },
  sheetPct: { fontFamily: FONTS.bold, fontSize: 13, color: GOLD, textAlign: "right", marginTop: 3 },

  finCard: { backgroundColor: CARD, borderRadius: 16, padding: 14, marginBottom: 16 },
  finRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 30 },
  finLabel: { fontFamily: FONTS.medium, fontSize: 13, color: INK_SOFT },
  finTarget: { fontFamily: FONTS.bold, fontSize: 17, color: INK },
  finSaved: { fontFamily: FONTS.bold, fontSize: 17, color: GOLD },
  finBarBg: { height: 8, borderRadius: 4, backgroundColor: "#E3E6EA", overflow: "hidden", marginTop: 10 },
  finBarFill: { height: "100%", borderRadius: 4, backgroundColor: GOLD },
  finQuick: { flexDirection: "row", gap: 8, marginTop: 12 },
  finInput: {
    flex: 1.4,
    minHeight: 44,
    backgroundColor: WHITE,
    borderRadius: 12,
    fontFamily: FONTS.semibold,
    fontSize: 15,
    color: INK,
  },
  finChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  finChipText: { fontFamily: FONTS.bold, fontSize: 14, color: BLUE },
  finHint: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, textAlign: "right", marginTop: 10 },

  sectionTitle: { fontFamily: FONTS.bold, fontSize: 15, color: INK, textAlign: "right", marginBottom: 8 },
  msRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingVertical: 4 },
  msBox: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#C9CFD6",
    alignItems: "center",
    justifyContent: "center",
  },
  msCheck: { color: WHITE, fontFamily: FONTS.bold, fontSize: 15 },
  msText: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: INK, textAlign: "right" },

  msAddRow: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 14 },
  msInput: {
    flex: 1,
    minHeight: 48,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: INK,
  },
  msAddBtn: { width: 48, minHeight: 48, borderRadius: 12, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  msAddBtnText: { fontFamily: FONTS.bold, fontSize: 22, color: WHITE },

  deleteBtn: { minHeight: 48, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  deleteBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: "#E14848" },

  centerBackdrop: { flex: 1, backgroundColor: "rgba(16,20,26,0.5)", alignItems: "center", justifyContent: "center", padding: 22 },
  createCard: { width: "100%", backgroundColor: WHITE, borderRadius: 24, padding: 20, gap: 10, ...SHADOW },
  createTitle: { fontFamily: FONTS.bold, fontSize: 19, color: INK, textAlign: "right" },
  createInput: {
    minHeight: 52,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: INK,
  },
  createLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: INK_SOFT, textAlign: "right", marginTop: 2 },
  coverRow: { flexDirection: "row", gap: 10, justifyContent: "space-between" },
  coverDot: { flex: 1, height: 44, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#EAEAEA" },
  cancelBtn: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: CARD, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: INK_SOFT },
  saveBtn: { flex: 2, minHeight: 52, borderRadius: 14, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: WHITE },
});
