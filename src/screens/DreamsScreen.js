import { useEffect, useMemo, useRef, useState } from "react";
import {
  I18nManager,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInUp, LinearTransition } from "react-native-reanimated";

import Celebration from "../components/dreams/Celebration";
import HabitChain from "../components/dreams/HabitChain";
import ProgressBar from "../components/dreams/ProgressBar";
import { CoverGradient, Scrim } from "../components/dreams/Scrim";
import PinLock from "../components/PinLock";
import {
  DREAM_COVERS,
  daysUntil,
  dreamProgress,
  isDreamComplete,
  useDreams,
} from "../context/DreamContext";
import { useNotes } from "../context/NotesContext";
import { useSettings } from "../context/SettingsContext";
import { hapticHeavy, hapticLight, hapticSuccess } from "../utils/haptics";
import { bustCache } from "../utils/imageCache";
import { makeNote } from "../utils/notesStore";
import { NOTES_FONTS as FONTS, NOTES_THEME } from "../utils/notesTheme";
import { shekel } from "../utils/posStore";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { usePersistentState } from "../utils/usePersistentState";

// חלומות — visual vision board wired to the business ledger: dreams can be
// funded from POS revenue, locked behind a PIN, exported to Notes, and
// celebrated + archived on completion.

const WHITE = "#FFFFFF";
const BG = "#F8F9FA";
const CARD = "#F4F5F7";
const INK = "#1A1D21";
const INK_SOFT = "#5A6470";
const INK_MUTED = "#9AA4B0";
const BLUE = "#003366";
const GOLD = "#D4AF37";
const RED = "#E14848";

// Same hardcoded vault PIN as the Notes lock, per spec.
const VAULT_PIN = "1234";

const coverOf = (key) => DREAM_COVERS.find((c) => c.key === key) || DREAM_COVERS[0];

// "עוד 45 ימים" / "היום!" / "באיחור של 3 ימים"
function countdownLabel(days) {
  if (days === null) return null;
  if (days === 0) return "⏳ היום!";
  if (days > 0) return `⏳ עוד ${days} ${days === 1 ? "יום" : "ימים"}`;
  const late = Math.abs(days);
  return `⚠️ באיחור ${late} ${late === 1 ? "יום" : "ימים"}`;
}

export default function DreamsScreen({ navigation }) {
  const { imageCacheToken, compactMode: compact } = useSettings();
  const insets = useSafeAreaInsets();
  const {
    dreams,
    isLoading,
    addDream,
    removeDream,
    toggleMilestone,
    addChecklistMilestone,
    addDreamSavings,
    fundFromBusiness,
    updateDreamFields,
    toggleHabitDay,
    addObstacle,
    removeObstacle,
  } = useDreams();
  const { setNotes } = useNotes();

  // Business revenue is read-only here — the Dreams tab never mutates sales.
  const [sales] = usePersistentState(STORAGE_KEYS.posSales, []);

  const [openId, setOpenId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [form, setForm] = useState({ title: "", target: "", cover: "night" });
  const [newMilestone, setNewMilestone] = useState("");
  const [savingInput, setSavingInput] = useState("");
  const [fundInput, setFundInput] = useState("");
  const [whyDraft, setWhyDraft] = useState("");
  const [obstacleIf, setObstacleIf] = useState("");
  const [obstacleThen, setObstacleThen] = useState("");
  const [pinDream, setPinDream] = useState(null); // locked dream awaiting PIN
  const [celebrating, setCelebrating] = useState(null);
  const [toast, setToast] = useState(null);

  const celebratedRef = useRef(new Set());
  const lastTick = useRef(0);

  const onScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    if (Math.abs(y - lastTick.current) > 220) {
      lastTick.current = y;
      hapticLight();
    }
  };

  const open = dreams.find((d) => d.id === openId) || null;
  // Paused dreams sink to the bottom of the board but stay visible.
  const board = useMemo(
    () =>
      dreams
        .filter((d) => !d.archived)
        .slice()
        .sort((a, b) => (a.paused ? 1 : 0) - (b.paused ? 1 : 0)),
    [dreams]
  );
  const archived = useMemo(() => dreams.filter((d) => d.archived), [dreams]);

  // ---- Business revenue available to allocate ------------------------------
  const totalRevenue = useMemo(
    () => (sales || []).filter((r) => r.kind !== "damage").reduce((sum, r) => sum + (r.total || 0), 0),
    [sales]
  );
  const totalAllocated = useMemo(
    () => dreams.reduce((sum, d) => sum + (Number(d.fundedFromBusiness) || 0), 0),
    [dreams]
  );
  const available = Math.max(0, Math.round((totalRevenue - totalAllocated) * 100) / 100);

  // Sync the "why" draft whenever a different dream is opened.
  useEffect(() => {
    setWhyDraft(open?.why || "");
    setFundInput("");
    setSavingInput("");
  }, [openId]);

  // Fire the celebration once per dream, when it first reaches completion.
  useEffect(() => {
    const done = dreams.find(
      (d) => !d.archived && isDreamComplete(d) && !celebratedRef.current.has(d.id)
    );
    if (done) {
      celebratedRef.current.add(done.id);
      setCelebrating(done);
    }
  }, [dreams]);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  // ---- Actions -------------------------------------------------------------
  const createDream = () => {
    const title = form.title.trim();
    if (!title) return;
    hapticHeavy();
    const target = parseFloat(form.target) || 0;
    const dream = addDream({ title, type: target ? "money" : "knowledge", target, cover: form.cover });
    setForm({ title: "", target: "", cover: "night" });
    setCreateOpen(false);
    setOpenId(dream.id);
  };

  const tickMilestone = (dreamId, milestoneId, wasDone) => {
    if (wasDone) hapticLight();
    else hapticSuccess();
    toggleMilestone(dreamId, milestoneId);
  };

  const addSavings = (amount) => {
    if (!open) return;
    hapticLight();
    addDreamSavings(open.id, amount);
  };

  // Allocate business revenue; capped at what's still unallocated.
  const fund = (amount) => {
    if (!open) return;
    const amt = Math.min(amount, available);
    if (!(amt > 0)) return;
    hapticSuccess();
    fundFromBusiness(open.id, amt);
    setFundInput("");
    flash(`הופקדו ${shekel(amt)} מהעסק לחלום 💰`);
  };

  const saveWhy = () => {
    if (!open) return;
    hapticLight();
    updateDreamFields(open.id, { why: whyDraft });
    flash("ה״למה״ נשמר ✓");
  };

  const setTargetDate = (days) => {
    if (!open) return;
    hapticLight();
    if (days === null) {
      updateDreamFields(open.id, { targetDate: null });
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    updateDreamFields(open.id, { targetDate: d.toISOString() });
  };

  const toggleVault = () => {
    if (!open) return;
    hapticLight();
    updateDreamFields(open.id, { locked: !open.locked });
    flash(open.locked ? "החלום נפתח 🔓" : "החלום ננעל בכספת 🔒");
  };

  // Send the dream's open milestones to a new Pro note in the Notes tab.
  const sendToNotes = () => {
    if (!open) return;
    hapticSuccess();
    const remaining = (open.milestones || []).filter((m) => !m.done);
    const lines = [
      `✨ ${open.title}`,
      "",
      open.why ? `הלמה שלי: ${open.why}` : null,
      open.target ? `יעד כספי: ${shekel(open.target)} · נחסך: ${shekel(open.saved || 0)}` : null,
      open.targetDate ? `תאריך יעד: ${new Date(open.targetDate).toLocaleDateString("he-IL")}` : null,
      "",
      "אבני דרך שנותרו:",
      ...(remaining.length ? remaining.map((m) => `• ${m.title}`) : ["• הכול הושלם! 🎉"]),
    ].filter((l) => l !== null);

    const note = makeNote({
      title: `חלום: ${open.title}`,
      body: lines.join("\n"),
      tags: ["חלומות"],
      proMode: true,
    });
    setNotes((prev) => [note, ...prev]);
    flash("נוצר פתק חדש בטאב פתקים 📝");
  };

  const togglePause = () => {
    if (!open) return;
    hapticLight();
    updateDreamFields(open.id, { paused: !open.paused });
    flash(open.paused ? "החלום הופשר ▶️" : "החלום הוקפא ❄️");
  };

  const addObstacleRow = () => {
    if (!open) return;
    const ifText = obstacleIf.trim();
    const thenText = obstacleThen.trim();
    if (!ifText || !thenText) return;
    hapticLight();
    addObstacle(open.id, ifText, thenText);
    setObstacleIf("");
    setObstacleThen("");
  };

  // Compile the vision into one clean shareable line.
  const shareVision = async () => {
    if (!open) return;
    hapticLight();
    const next = (open.milestones || []).find((m) => !m.done);
    const message = `החלום שלי: ${open.title} | התקדמות: ${dreamProgress(open)}% | יעד הבא: ${
      next ? next.title : "הושלם! 🎉"
    }`;
    try {
      await Share.share({ message });
    } catch {
      /* user cancelled */
    }
  };

  const archiveDream = (dream) => {
    hapticSuccess();
    updateDreamFields(dream.id, { archived: true });
    setCelebrating(null);
    setOpenId(null);
    flash("החלום עבר להיכל ההישגים 🗄️");
  };

  const restoreDream = (dream) => {
    hapticLight();
    celebratedRef.current.delete(dream.id);
    updateDreamFields(dream.id, { archived: false });
  };

  const openDream = (dream) => {
    hapticLight();
    if (dream.locked) setPinDream(dream);
    else setOpenId(dream.id);
  };

  // Two-column masonry with alternating tile heights.
  const columns = useMemo(() => {
    const cols = [[], []];
    const heights = [0, 0];
    board.forEach((d, i) => {
      const h = i % 3 === 0 ? 214 : 172;
      const side = heights[0] <= heights[1] ? 0 : 1;
      cols[side].push({ dream: d, height: h, index: i });
      heights[side] += h + 12;
    });
    return cols;
  }, [board]);

  const openPct = open ? dreamProgress(open) : 0;
  const fundPct = open?.target ? Math.min(100, ((open.saved || 0) / open.target) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>✨ חלומות</Text>
          {board.length > 0 && <Text style={s.headerSub}>{board.length} חלומות על הלוח</Text>}
        </View>
        {archived.length > 0 && (
          <TouchableOpacity style={s.archiveBtn} onPress={() => { hapticLight(); setArchiveOpen(true); }} activeOpacity={0.75}>
            <Text style={s.archiveBtnText}>🏆 {archived.length}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Business wallet strip */}
      {totalRevenue > 0 && (
        <View style={s.wallet}>
          <Text style={s.walletValue}>{shekel(available)}</Text>
          <Text style={s.walletLabel}>💼 זמין להפקדה מהעסק</Text>
        </View>
      )}

      {isLoading && board.length === 0 ? (
        <View style={s.skeletonWrap}>
          {[214, 172, 172, 214].map((h, i) => (
            <View key={i} style={[s.skeleton, { height: h, width: "47%" }]} />
          ))}
        </View>
      ) : board.length === 0 ? (
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
          contentContainerStyle={{ padding: compact ? 6 : 12, paddingBottom: insets.bottom + 110 }}
        >
          {/* The board must read top-right first (Hebrew), so the first column
              has to sit on the right. Native RTL already flips `row`; on web
              I18nManager.isRTL is false and it doesn't, so reverse there. */}
          <View style={[s.masonry, !I18nManager.isRTL && { flexDirection: "row-reverse" }]}>
            {columns.map((col, ci) => (
              <View key={ci} style={{ flex: 1, gap: 12 }}>
                {col.map(({ dream, height, index }) => (
                  <DreamCard key={dream.id} dream={dream} height={height} index={index} onPress={() => openDream(dream)} />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 26 }]}
        onPress={() => { hapticLight(); setCreateOpen(true); }}
        activeOpacity={0.85}
      >
        <Text style={s.fabPlus}>＋</Text>
      </TouchableOpacity>

      {toast && (
        <Animated.View entering={FadeInUp.duration(200)} style={[s.toast, { bottom: insets.bottom + 100 }]}>
          <Text style={s.toastText}>{toast}</Text>
        </Animated.View>
      )}

      {/* ---- Dream details ---- */}
      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpenId(null)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <TouchableWithoutFeedback onPress={() => setOpenId(null)}>
          <View style={s.backdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[s.sheet, { paddingBottom: insets.bottom + 18 }]}>
                {open && (
                  <>
                    <View style={s.grabber} />
                    <View style={s.sheetHero}>
                      {open.imageUri ? (
                        <Image
                          source={{ uri: bustCache(open.imageUri, imageCacheToken) }}
                          style={StyleSheet.absoluteFill}
                          resizeMode="cover"
                        />
                      ) : (
                        <CoverGradient colors={coverOf(open.cover).colors} />
                      )}
                      <Scrim />
                      <View style={s.sheetHeroText}>
                        <Text style={s.sheetTitle} numberOfLines={2}>{open.title}</Text>
                        <Text style={s.sheetPct}>{openPct}% הושלם</Text>
                      </View>
                    </View>

                    {/* Quick actions */}
                    <View style={s.quickRow}>
                      <TouchableOpacity style={s.quickBtn} onPress={shareVision} activeOpacity={0.75}>
                        <Text style={s.quickEmoji}>📤</Text>
                        <Text style={s.quickText}>שתף</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.quickBtn} onPress={sendToNotes} activeOpacity={0.75}>
                        <Text style={s.quickEmoji}>📝</Text>
                        <Text style={s.quickText}>לפתקים</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.quickBtn, open.paused && s.quickBtnOn]} onPress={togglePause} activeOpacity={0.75}>
                        <Text style={s.quickEmoji}>{open.paused ? "▶️" : "❄️"}</Text>
                        <Text style={[s.quickText, open.paused && { color: GOLD }]}>
                          {open.paused ? "הפשר" : "הקפא"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.quickBtn, open.locked && s.quickBtnOn]} onPress={toggleVault} activeOpacity={0.75}>
                        <Text style={s.quickEmoji}>{open.locked ? "🔒" : "🔓"}</Text>
                        <Text style={[s.quickText, open.locked && { color: GOLD }]}>כספת</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.quickBtn} onPress={() => archiveDream(open)} activeOpacity={0.75}>
                        <Text style={s.quickEmoji}>🗄️</Text>
                        <Text style={s.quickText}>ארכיון</Text>
                      </TouchableOpacity>
                    </View>

                    <ScrollView
                      style={{ maxHeight: 372 }}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={{ paddingBottom: 100 }}
                    >
                      {/* Habit chain */}
                      <Text style={s.sectionTitle}>🔥 הרגל יומי</Text>
                      <HabitChain
                        habitDays={open.habitDays || {}}
                        onToggle={(dayKey) => {
                          const was = !!(open.habitDays || {})[dayKey];
                          if (was) hapticLight();
                          else hapticSuccess();
                          toggleHabitDay(open.id, dayKey);
                        }}
                      />

                      {/* Financial target + funding */}
                      <View style={s.finCard}>
                        <View style={s.finRow}>
                          <Text style={s.finTarget}>{shekel(open.target || 0)}</Text>
                          <Text style={s.finLabel}>🎯 יעד כספי</Text>
                        </View>
                        <View style={s.finRow}>
                          <Text style={s.finSaved}>{shekel(open.saved || 0)}</Text>
                          <Text style={s.finLabel}>💰 נחסך עד כה</Text>
                        </View>
                        <ProgressBar pct={fundPct} height={8} track="#E3E6EA" style={{ marginTop: 10 }} />

                        {/* Fund from business */}
                        <View style={s.fundBox}>
                          <Text style={s.fundTitle}>💼 הפקד מרווחי העסק</Text>
                          <Text style={s.fundAvail}>
                            זמין: {shekel(available)}
                            {open.fundedFromBusiness > 0 ? ` · הופקד לחלום זה: ${shekel(open.fundedFromBusiness)}` : ""}
                          </Text>
                          <View style={s.fundRow}>
                            <TextInput
                              style={s.fundInput}
                              value={fundInput}
                              onChangeText={setFundInput}
                              keyboardType="numeric"
                              placeholder="סכום"
                              placeholderTextColor={INK_MUTED}
                              textAlign="center"
                              onSubmitEditing={() => fund(parseFloat(fundInput) || 0)}
                            />
                            <TouchableOpacity
                              style={[s.fundBtn, !(available > 0) && { opacity: 0.35 }]}
                              onPress={() => fund(parseFloat(fundInput) || 0)}
                              activeOpacity={0.8}
                            >
                              <Text style={s.fundBtnText}>הפקד</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={s.fundChips}>
                            {[50, 100, 250].map((amt) => (
                              <TouchableOpacity
                                key={amt}
                                style={[s.fundChip, available < amt && { opacity: 0.35 }]}
                                onPress={() => fund(amt)}
                                activeOpacity={0.7}
                              >
                                <Text style={s.fundChipText}>+{amt}</Text>
                              </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                              style={[s.fundChip, { backgroundColor: GOLD + "22" }, !(available > 0) && { opacity: 0.35 }]}
                              onPress={() => fund(available)}
                              activeOpacity={0.7}
                            >
                              <Text style={[s.fundChipText, { color: "#8A6D14" }]}>הכול</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Manual savings */}
                        <View style={s.finQuick}>
                          <TextInput
                            style={s.finInput}
                            value={savingInput}
                            onChangeText={setSavingInput}
                            keyboardType="numeric"
                            placeholder="חיסכון ידני"
                            placeholderTextColor={INK_MUTED}
                            textAlign="center"
                            onSubmitEditing={() => {
                              const v = parseFloat(savingInput);
                              if (v > 0) { addSavings(v); setSavingInput(""); }
                            }}
                          />
                          {[50, 100, 500].map((amt) => (
                            <TouchableOpacity key={amt} style={s.finChip} onPress={() => addSavings(amt)} activeOpacity={0.7}>
                              <Text style={s.finChipText}>+{amt}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* The Why */}
                      <Text style={s.sectionTitle}>❤️ הלמה שלי</Text>
                      <TextInput
                        style={s.whyInput}
                        value={whyDraft}
                        onChangeText={setWhyDraft}
                        onBlur={saveWhy}
                        placeholder="למה החלום הזה חשוב לי?"
                        placeholderTextColor={INK_MUTED}
                        multiline
                        textAlign="right"
                      />
                      <TouchableOpacity style={s.whySave} onPress={saveWhy} activeOpacity={0.7}>
                        <Text style={s.whySaveText}>שמור את ה״למה״</Text>
                      </TouchableOpacity>

                      {/* Target date */}
                      <Text style={s.sectionTitle}>📅 תאריך יעד</Text>
                      {open.targetDate && (
                        <Text style={s.dateCurrent}>
                          {new Date(open.targetDate).toLocaleDateString("he-IL")} · {countdownLabel(daysUntil(open.targetDate))}
                        </Text>
                      )}
                      <View style={s.dateRow}>
                        {[
                          { label: "חודש", days: 30 },
                          { label: "3 חודשים", days: 90 },
                          { label: "חצי שנה", days: 180 },
                          { label: "שנה", days: 365 },
                        ].map((opt) => (
                          <TouchableOpacity key={opt.days} style={s.dateChip} onPress={() => setTargetDate(opt.days)} activeOpacity={0.7}>
                            <Text style={s.dateChipText}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                        {open.targetDate && (
                          <TouchableOpacity style={[s.dateChip, { backgroundColor: "#FDEBEB" }]} onPress={() => setTargetDate(null)} activeOpacity={0.7}>
                            <Text style={[s.dateChipText, { color: RED }]}>נקה</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Milestones */}
                      <Text style={s.sectionTitle}>🪜 אבני דרך</Text>
                      {(open.milestones || []).length === 0 && (
                        <Text style={s.hint}>עוד אין אבני דרך — הוסף את הצעד הראשון למטה.</Text>
                      )}
                      {(open.milestones || []).map((m) => (
                        <TouchableOpacity key={m.id} style={s.msRow} onPress={() => tickMilestone(open.id, m.id, m.done)} activeOpacity={0.7}>
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

                      {/* Obstacle mapper — If/Then planning */}
                      <Text style={s.sectionTitle}>🧗 מכשולים ופתרונות</Text>
                      {(open.obstacles || []).length === 0 && (
                        <Text style={s.hint}>מה עלול לעצור אותך? תכנן מראש את התגובה.</Text>
                      )}
                      {(open.obstacles || []).map((o) => (
                        <Animated.View key={o.id} layout={LinearTransition.springify()} style={s.obsRow}>
                          <TouchableOpacity
                            style={s.obsRemove}
                            onPress={() => { hapticLight(); removeObstacle(open.id, o.id); }}
                            activeOpacity={0.7}
                          >
                            <Text style={s.obsRemoveText}>✕</Text>
                          </TouchableOpacity>
                          <View style={{ flex: 1 }}>
                            <Text style={s.obsIf}>
                              <Text style={s.obsTag}>אם </Text>
                              {o.ifText}
                            </Text>
                            <Text style={s.obsThen}>
                              <Text style={[s.obsTag, { color: "#1E9E58" }]}>אז </Text>
                              {o.thenText}
                            </Text>
                          </View>
                        </Animated.View>
                      ))}
                      <Animated.View layout={LinearTransition.springify()} style={s.obsForm}>
                        <TextInput
                          style={s.obsInput}
                          value={obstacleIf}
                          onChangeText={setObstacleIf}
                          placeholder="אם... (המכשול)"
                          placeholderTextColor={INK_MUTED}
                          textAlign="right"
                        />
                        <TextInput
                          style={s.obsInput}
                          value={obstacleThen}
                          onChangeText={setObstacleThen}
                          placeholder="אז... (הפתרון)"
                          placeholderTextColor={INK_MUTED}
                          textAlign="right"
                        />
                        <TouchableOpacity
                          style={[s.obsAddBtn, !(obstacleIf.trim() && obstacleThen.trim()) && { opacity: 0.35 }]}
                          onPress={addObstacleRow}
                          activeOpacity={0.85}
                        >
                          <Text style={s.obsAddBtnText}>＋ הוסף מכשול ופתרון</Text>
                        </TouchableOpacity>
                      </Animated.View>

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
        </KeyboardAvoidingView>
      </Modal>

      {/* ---- Create ---- */}
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
                  <TouchableOpacity style={[s.saveBtn, !form.title.trim() && { opacity: 0.35 }]} onPress={createDream} activeOpacity={0.85}>
                    <Text style={s.saveBtnText}>הוסף ללוח</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ---- Archive of achievements ---- */}
      <Modal visible={archiveOpen} transparent animationType="slide" onRequestClose={() => setArchiveOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setArchiveOpen(false)}>
          <View style={s.backdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[s.sheet, { paddingBottom: insets.bottom + 18 }]}>
                <View style={s.grabber} />
                <Text style={s.archiveTitle}>🏆 היכל ההישגים</Text>
                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                  {archived.map((d) => (
                    <View key={d.id} style={s.archRow}>
                      <TouchableOpacity style={s.archRestore} onPress={() => restoreDream(d)} activeOpacity={0.7}>
                        <Text style={s.archRestoreText}>החזר ללוח</Text>
                      </TouchableOpacity>
                      <View style={{ flex: 1, alignItems: "flex-end" }}>
                        <Text style={s.archName} numberOfLines={1}>{d.title}</Text>
                        <Text style={s.archMeta}>
                          {(d.milestones || []).length ? `${(d.milestones || []).length} אבני דרך` : shekel(d.saved || 0)} · הושלם ✓
                        </Text>
                      </View>
                      <Text style={{ fontSize: 22 }}>🏆</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ---- Vault PIN gate ---- */}
      {pinDream && (
        <PinLock
          mode="unlock"
          expected={VAULT_PIN}
          themeOverride={NOTES_THEME}
          onSuccess={() => { const id = pinDream.id; setPinDream(null); setOpenId(id); }}
          onCancel={() => setPinDream(null)}
        />
      )}

      {/* ---- Celebration ---- */}
      <Celebration
        visible={!!celebrating}
        dream={celebrating}
        onArchive={() => archiveDream(celebrating)}
        onClose={() => setCelebrating(null)}
      />
    </View>
  );
}

// Vision tile. Locked dreams hide their title and darken the cover so the
// board can be shown to anyone without leaking private goals.
function DreamCard({ dream, height, index, onPress }) {
  const { imageCacheToken } = useSettings();
  const pct = dreamProgress(dream);
  const done = (dream.milestones || []).filter((m) => m.done).length;
  const total = (dream.milestones || []).length;
  const days = daysUntil(dream.targetDate);
  const countdown = countdownLabel(days);
  const locked = !!dream.locked;
  const paused = !!dream.paused;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 80, 480)).duration(420)}>
      <TouchableOpacity
        style={[s.card, { height }, paused && s.cardPaused]}
        onPress={onPress}
        activeOpacity={0.88}
      >
        {dream.imageUri ? (
          <Image
            source={{ uri: bustCache(dream.imageUri, imageCacheToken) }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={locked ? 18 : 0}
          />
        ) : (
          <CoverGradient colors={coverOf(dream.cover).colors} />
        )}
        <Scrim strength={locked ? 0.92 : 0.78} />
        {locked && <View style={s.vaultVeil} />}
        {/* Desaturate a paused dream: a grey wash over the cover reads as
            "on hold" without needing a native color-matrix filter. */}
        {paused && !locked && <View style={s.pausedVeil} />}

        {paused && !locked && (
          <View style={s.pausedBadge}>
            <Text style={s.pausedBadgeText}>❄️ מוקפא</Text>
          </View>
        )}

        {countdown && !locked && !paused && (
          <View style={[s.countdown, days < 0 && { backgroundColor: "rgba(225,72,72,0.9)" }]}>
            <Text style={s.countdownText}>{countdown}</Text>
          </View>
        )}

        {locked ? (
          <View style={s.lockedBody}>
            <Text style={{ fontSize: 30 }}>🔒</Text>
            <Text style={s.lockedTitle}>***</Text>
            <Text style={s.lockedHint}>חלום נעול</Text>
          </View>
        ) : (
          <View style={s.cardBody}>
            <Text style={s.cardTitle} numberOfLines={2}>{dream.title}</Text>
            <View style={s.cardMetaRow}>
              <Text style={s.cardPct}>{pct}%</Text>
              <Text style={s.cardMeta}>
                {total ? `${done}/${total} אבני דרך` : dream.target ? shekel(dream.target) : "יעד אישי"}
              </Text>
            </View>
            <ProgressBar pct={pct} height={6} style={{ marginTop: 7 }} />
          </View>
        )}
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
  headerSub: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, textAlign: "right", marginTop: 2 },
  archiveBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW,
  },
  archiveBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: "#8A6D14" },

  wallet: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 52,
    ...SHADOW,
  },
  walletLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: INK_SOFT },
  walletValue: { fontFamily: FONTS.bold, fontSize: 18, color: GOLD },

  masonry: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  skeletonWrap: { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 12, justifyContent: "space-between" },
  skeleton: { backgroundColor: "#ECEFF3", borderRadius: 20 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 34, marginTop: -40 },
  emptyBadge: { width: 104, height: 104, borderRadius: 34, backgroundColor: WHITE, alignItems: "center", justifyContent: "center", marginBottom: 20, ...SHADOW },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 21, color: INK, marginBottom: 8, textAlign: "center" },
  emptyText: { fontFamily: FONTS.light, fontSize: 14, color: INK_SOFT, textAlign: "center", lineHeight: 22 },

  card: { borderRadius: 20, overflow: "hidden", justifyContent: "flex-end", ...SHADOW },
  cardBody: { padding: 12 },
  cardTitle: { fontFamily: FONTS.bold, fontSize: 15, color: WHITE, textAlign: "right" },
  cardMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  cardPct: { fontFamily: FONTS.bold, fontSize: 13, color: GOLD },
  cardMeta: { fontFamily: FONTS.regular, fontSize: 11, color: "rgba(255,255,255,0.82)" },

  cardPaused: { opacity: 0.72 },
  pausedVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(122,130,140,0.5)" },
  pausedBadge: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pausedBadgeText: { fontFamily: FONTS.bold, fontSize: 11, color: INK_SOFT },

  vaultVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,14,20,0.55)" },
  lockedBody: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 4 },
  lockedTitle: { fontFamily: FONTS.bold, fontSize: 26, color: "rgba(255,255,255,0.9)", letterSpacing: 4 },
  lockedHint: { fontFamily: FONTS.regular, fontSize: 11, color: "rgba(255,255,255,0.6)" },

  countdown: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countdownText: { fontFamily: FONTS.bold, fontSize: 11, color: WHITE },

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
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#E3E6EA", marginBottom: 12 },
  sheetHero: { height: 124, borderRadius: 18, overflow: "hidden", justifyContent: "flex-end", marginBottom: 10 },
  sheetHeroText: { padding: 14 },
  sheetTitle: { fontFamily: FONTS.bold, fontSize: 20, color: WHITE, textAlign: "right" },
  sheetPct: { fontFamily: FONTS.bold, fontSize: 13, color: GOLD, textAlign: "right", marginTop: 3 },

  quickRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  quickBtn: { flex: 1, minHeight: 56, borderRadius: 14, backgroundColor: CARD, alignItems: "center", justifyContent: "center", gap: 2 },
  quickBtnOn: { backgroundColor: GOLD + "1E" },
  quickEmoji: { fontSize: 19 },
  quickText: { fontFamily: FONTS.semibold, fontSize: 11, color: INK_SOFT },

  finCard: { backgroundColor: CARD, borderRadius: 16, padding: 14, marginBottom: 14 },
  finRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 30 },
  finLabel: { fontFamily: FONTS.medium, fontSize: 13, color: INK_SOFT },
  finTarget: { fontFamily: FONTS.bold, fontSize: 17, color: INK },
  finSaved: { fontFamily: FONTS.bold, fontSize: 17, color: GOLD },

  fundBox: { backgroundColor: WHITE, borderRadius: 14, padding: 12, marginTop: 12 },
  fundTitle: { fontFamily: FONTS.bold, fontSize: 14, color: INK, textAlign: "right" },
  fundAvail: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, textAlign: "right", marginTop: 2, marginBottom: 8 },
  fundRow: { flexDirection: "row", gap: 8 },
  fundInput: { flex: 1.5, minHeight: 46, backgroundColor: CARD, borderRadius: 12, fontFamily: FONTS.semibold, fontSize: 15, color: INK },
  fundBtn: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  fundBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: WHITE },
  fundChips: { flexDirection: "row", gap: 6, marginTop: 8 },
  fundChip: { flex: 1, minHeight: 42, borderRadius: 11, backgroundColor: CARD, alignItems: "center", justifyContent: "center" },
  fundChipText: { fontFamily: FONTS.bold, fontSize: 13, color: BLUE },

  finQuick: { flexDirection: "row", gap: 8, marginTop: 10 },
  finInput: { flex: 1.6, minHeight: 44, backgroundColor: WHITE, borderRadius: 12, fontFamily: FONTS.regular, fontSize: 13, color: INK },
  finChip: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: WHITE, alignItems: "center", justifyContent: "center" },
  finChipText: { fontFamily: FONTS.bold, fontSize: 13, color: BLUE },

  sectionTitle: { fontFamily: FONTS.bold, fontSize: 15, color: INK, textAlign: "right", marginBottom: 8, marginTop: 4 },
  hint: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, textAlign: "right", marginBottom: 8 },

  whyInput: {
    minHeight: 78,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: INK,
    textAlignVertical: "top",
  },
  whySave: { minHeight: 40, alignItems: "flex-end", justifyContent: "center", marginBottom: 8 },
  whySaveText: { fontFamily: FONTS.bold, fontSize: 12, color: BLUE },

  dateCurrent: { fontFamily: FONTS.semibold, fontSize: 13, color: GOLD, textAlign: "right", marginBottom: 8 },
  dateRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  dateChip: { minHeight: 42, paddingHorizontal: 14, borderRadius: 12, backgroundColor: CARD, alignItems: "center", justifyContent: "center" },
  dateChipText: { fontFamily: FONTS.semibold, fontSize: 12, color: INK_SOFT },

  msRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingVertical: 4 },
  msBox: { width: 26, height: 26, borderRadius: 9, borderWidth: 2, borderColor: "#C9CFD6", alignItems: "center", justifyContent: "center" },
  msCheck: { color: WHITE, fontFamily: FONTS.bold, fontSize: 15 },
  msText: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: INK, textAlign: "right" },
  msAddRow: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 14 },
  msInput: { flex: 1, minHeight: 48, backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 12, fontFamily: FONTS.regular, fontSize: 14, color: INK },
  msAddBtn: { width: 48, minHeight: 48, borderRadius: 12, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  msAddBtnText: { fontFamily: FONTS.bold, fontSize: 22, color: WHITE },

  obsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  obsIf: { fontFamily: FONTS.medium, fontSize: 13, color: INK, textAlign: "right" },
  obsThen: { fontFamily: FONTS.medium, fontSize: 13, color: INK_SOFT, textAlign: "right", marginTop: 3 },
  obsTag: { fontFamily: FONTS.bold, color: RED },
  obsRemove: { width: 34, height: 34, borderRadius: 17, backgroundColor: WHITE, alignItems: "center", justifyContent: "center" },
  obsRemoveText: { fontFamily: FONTS.bold, fontSize: 14, color: INK_MUTED },
  obsForm: { gap: 8, marginBottom: 14 },
  obsInput: {
    minHeight: 48,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: INK,
  },
  obsAddBtn: { minHeight: 48, borderRadius: 12, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  obsAddBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: WHITE },

  deleteBtn: { minHeight: 48, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  deleteBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: RED },

  archiveTitle: { fontFamily: FONTS.bold, fontSize: 19, color: INK, textAlign: "right", marginBottom: 12 },
  archRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: CARD, borderRadius: 16, padding: 12, marginBottom: 8, minHeight: 64 },
  archName: { fontFamily: FONTS.semibold, fontSize: 15, color: INK },
  archMeta: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, marginTop: 2 },
  archRestore: { minHeight: 40, paddingHorizontal: 12, borderRadius: 11, backgroundColor: WHITE, alignItems: "center", justifyContent: "center" },
  archRestoreText: { fontFamily: FONTS.bold, fontSize: 12, color: BLUE },

  centerBackdrop: { flex: 1, backgroundColor: "rgba(16,20,26,0.5)", alignItems: "center", justifyContent: "center", padding: 22 },
  createCard: { width: "100%", backgroundColor: WHITE, borderRadius: 24, padding: 20, gap: 10, ...SHADOW },
  createTitle: { fontFamily: FONTS.bold, fontSize: 19, color: INK, textAlign: "right" },
  createInput: { minHeight: 52, backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 14, fontFamily: FONTS.regular, fontSize: 15, color: INK },
  createLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: INK_SOFT, textAlign: "right", marginTop: 2 },
  coverRow: { flexDirection: "row", gap: 10, justifyContent: "space-between" },
  coverDot: { flex: 1, height: 44, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#EAEAEA" },
  cancelBtn: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: CARD, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: INK_SOFT },
  saveBtn: { flex: 2, minHeight: 52, borderRadius: 14, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: WHITE },
});
