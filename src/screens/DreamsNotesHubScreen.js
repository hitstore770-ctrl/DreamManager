import { useMemo, useState } from "react";
import { I18nManager, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { Canvas, Glass, GradCard } from "../components/Glass";
import { DREAM_COVERS, daysUntil, useDreams } from "../context/DreamContext";
import { useNotes } from "../context/NotesContext";
import { hapticLight } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { checklistToText, makeNote } from "../utils/notesStore";
import { shekel } from "../utils/posStore";
import { BEVEL, GRAD, TYPE, UI, glow, tint } from "../utils/ui";

// חלומות ופתקים — one hub, two masonry boards.
//
// Both boards are true masonry (two independent columns filled by running
// height) rather than a grid of equal rows, because both hold cards of
// genuinely different heights: a dream with a photo and four milestones is
// not the same object as one with a title. A fixed grid would pad every short
// card to the tallest in its row and leave the board full of holes.

const COVER = Object.fromEntries(DREAM_COVERS.map((c) => [c.key, c.colors]));
const TAG_TONES = [UI.violetLo, UI.cyan, UI.green, UI.amber, UI.coral];

function tagTone(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i += 1) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_TONES[h % TAG_TONES.length];
}

function fmtUpdated(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
    : `${d.getDate()}.${d.getMonth() + 1}`;
}

// Split into two columns by running height. The estimate only needs to be
// monotonic in content length — it decides which column is "shorter", not any
// actual layout.
function masonry(items, estimate) {
  const left = [];
  const right = [];
  let hl = 0;
  let hr = 0;
  items.forEach((item) => {
    const h = estimate(item);
    if (hl <= hr) {
      left.push(item);
      hl += h;
    } else {
      right.push(item);
      hr += h;
    }
  });
  return [left, right];
}

function DreamCard({ dream, index, onOpen, onAsk }) {
  const target = Number(dream.target) || 0;
  const saved = Number(dream.saved) || 0;
  const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const done = target > 0 && saved >= target;
  const left = dream.targetDate ? daysUntil(dream.targetDate) : null;
  const colors = COVER[dream.cover] || COVER.night;
  const milestones = dream.milestones || [];
  const doneCount = milestones.filter((m) => m.done).length;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 70, 340)).springify().damping(14)}
      layout={LinearTransition.springify().damping(15)}
      style={s.cardShadow}
    >
      <Bounce testID={`dream-${dream.id}`} scaleTo={0.96} onPress={() => onOpen(dream)} style={s.cardClip}>
        {/* Cover: photo if there is one, painted gradient if not. */}
        <View style={s.cover}>
          {dream.imageUri ? (
            <Image source={{ uri: dream.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          {/* Scrim so the title stays legible over any photo. */}
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.72)"]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {done && (
            <View style={s.doneBadge}>
              <Icon name="check" size={12} color="#FFFFFF" />
            </View>
          )}
          <Text style={s.coverTitle} numberOfLines={2}>{dream.title || "חלום"}</Text>
        </View>

        <View style={s.cardBody}>
          <View style={s.trackRow}>
            <Text style={[s.pct, done && { color: UI.green }]}>{pct}%</Text>
            <View style={s.track}>
              <View
                testID={`dream-bar-${dream.id}`}
                style={[s.fill, { width: `${pct}%`, backgroundColor: done ? UI.green : UI.violetLo }]}
              />
            </View>
          </View>

          <Text style={s.money}>
            {shekel(saved)} <Text style={s.moneyOf}>מתוך {shekel(target)}</Text>
          </Text>

          <View style={s.metaRow}>
            {milestones.length > 0 && (
              <View style={s.metaChip}>
                <Icon name="check-circle" size={11} color={UI.inkMuted} />
                <Text style={s.metaText}>{doneCount}/{milestones.length}</Text>
              </View>
            )}
            {left !== null && (
              <View style={s.metaChip}>
                <Icon name="clock" size={11} color={left < 0 ? UI.coral : UI.inkMuted} />
                <Text style={[s.metaText, left < 0 && { color: UI.coral }]}>
                  {left < 0 ? `באיחור ${-left}י׳` : `${left} ימים`}
                </Text>
              </View>
            )}
          </View>

          <Bounce
            testID={`dream-ai-${dream.id}`}
            style={s.aiBtn}
            scaleTo={0.94}
            onPress={() => onAsk(dream)}
          >
            <Icon name="message-circle" size={13} color={UI.violetLo} />
            <Text style={s.aiText}>קו-פיילוט</Text>
          </Bounce>
        </View>
      </Bounce>
    </Animated.View>
  );
}

function NoteCard({ note, index, onOpen }) {
  const preview = note.locked
    ? "פתק נעול"
    : (note.isChecklist ? checklistToText(note.checklist) : note.body || "").slice(0, 150) || "פתק ריק";
  const tags = (note.tags || []).slice(0, 3);

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 60, 320)).springify().damping(14)}
      layout={LinearTransition.springify().damping(15)}
      style={s.cardShadow}
    >
      <Bounce testID={`note-${note.id}`} scaleTo={0.96} onPress={() => onOpen(note)}>
        <GradCard colors={GRAD.surface} radius={UI.radiusSm}>
          <View style={s.note}>
            {/* Ruled margin, as on a real notepad. */}
            <View style={s.noteMargin} />

            <View style={s.noteHead}>
              {note.pinned && <Icon name="bookmark" size={13} color={UI.amber} />}
              {note.locked && <Icon name="lock" size={12} color={UI.inkMuted} />}
              <Text style={s.noteTitle} numberOfLines={2}>{note.title || "ללא כותרת"}</Text>
            </View>

            <Text style={[s.notePreview, note.locked && s.noteLocked]} numberOfLines={6}>
              {preview}
            </Text>

            {tags.length > 0 && (
              <View style={s.tagRow}>
                {tags.map((t) => (
                  <View key={t} style={[s.tag, { backgroundColor: tint(tagTone(t), 0.18) }]}>
                    <Text style={[s.tagText, { color: tagTone(t) }]}>#{t}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={s.noteTime}>{fmtUpdated(note.updatedAt)}</Text>
          </View>
        </GradCard>
      </Bounce>
    </Animated.View>
  );
}

export default function DreamsNotesHubScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { dreams } = useDreams();
  const { notes, setNotes } = useNotes();
  const [mode, setMode] = useState("dreams");

  const dreamList = dreams || [];
  const noteList = useMemo(
    () =>
      [...(notes || [])].sort(
        (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0)
      ),
    [notes]
  );

  const [dreamL, dreamR] = useMemo(
    () => masonry(dreamList, (d) => 210 + (d.imageUri ? 20 : 0) + (d.targetDate ? 18 : 0)),
    [dreamList]
  );
  const [noteL, noteR] = useMemo(
    () => masonry(noteList, (n) => 90 + Math.min(120, ((n.body || "").length / 40) * 16) + (n.tags?.length ? 26 : 0)),
    [noteList]
  );

  const openDream = () => {
    hapticLight();
    navigation?.navigate("DreamsFull");
  };

  const askDream = (dream) => {
    hapticLight();
    navigation?.navigate("ContextualAiChat", {
      threadId: `dream-${dream.id}`,
      title: dream.title,
      itemData: dream,
    });
  };

  const openNote = (note) => {
    hapticLight();
    navigation?.navigate("NoteEditor", { noteId: note.id });
  };

  const createNote = () => {
    hapticLight();
    const n = makeNote();
    setNotes((prev) => [n, ...(prev || [])]);
    navigation?.navigate("NoteEditor", { noteId: n.id });
  };

  const isDreams = mode === "dreams";

  return (
    <Canvas testID="library-screen" tone={isDreams ? UI.violet : UI.cyan}>
      <View style={{ paddingTop: insets.top + 12 }}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{isDreams ? "חלומות" : "פתקים"}</Text>
            <Text style={s.subtitle}>
              {isDreams ? `${dreamList.length} יעדים על הלוח` : `${noteList.length} פתקים`}
            </Text>
          </View>
          <Bounce
            testID="hub-primary"
            style={s.primaryWrap}
            scaleTo={0.92}
            onPress={isDreams ? openDream : createNote}
          >
            <LinearGradient
              colors={isDreams ? GRAD.violet : GRAD.cyan}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.primary}
            >
              <Icon name={isDreams ? "maximize-2" : "plus"} size={19} color="#FFFFFF" />
            </LinearGradient>
          </Bounce>
        </View>

        {/* Segmented switch */}
        <Glass style={s.segment} radius={18}>
          <View style={s.segmentInner}>
            {[
              { key: "dreams", label: "חלומות", icon: "star" },
              { key: "notes", label: "פתקים", icon: "edit-3" },
            ].map((seg) => {
              const on = mode === seg.key;
              return (
                <Bounce
                  key={seg.key}
                  testID={`seg-${seg.key}`}
                  style={[s.segBtn, on && s.segBtnOn]}
                  scaleTo={0.96}
                  onPress={() => { hapticLight(); setMode(seg.key); }}
                >
                  <Icon name={seg.icon} size={15} color={on ? UI.ink : UI.inkMuted} />
                  <Text style={[s.segText, on && s.segTextOn]}>{seg.label}</Text>
                </Bounce>
              );
            })}
          </View>
        </Glass>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120, paddingTop: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {isDreams ? (
          dreamList.length === 0 ? (
            <Empty icon="star" text="אין חלומות עדיין" hint="פתח את הלוח המלא כדי להוסיף אחד" />
          ) : (
            <Animated.View entering={FadeIn.duration(220)} style={s.board}>
              <View style={s.column}>
                {dreamL.map((d, i) => (
                  <DreamCard key={d.id} dream={d} index={i * 2} onOpen={openDream} onAsk={askDream} />
                ))}
              </View>
              <View style={s.column}>
                {dreamR.map((d, i) => (
                  <DreamCard key={d.id} dream={d} index={i * 2 + 1} onOpen={openDream} onAsk={askDream} />
                ))}
              </View>
            </Animated.View>
          )
        ) : noteList.length === 0 ? (
          <Empty icon="edit-3" text="אין פתקים עדיין" hint="הקש על ＋ כדי לכתוב אחד" />
        ) : (
          <Animated.View entering={FadeIn.duration(220)} style={s.board}>
            <View style={s.column}>
              {noteL.map((n, i) => (
                <NoteCard key={n.id} note={n} index={i * 2} onOpen={openNote} />
              ))}
            </View>
            <View style={s.column}>
              {noteR.map((n, i) => (
                <NoteCard key={n.id} note={n} index={i * 2 + 1} onOpen={openNote} />
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </Canvas>
  );
}

function Empty({ icon, text, hint }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyBadge}>
        <Icon name={icon} size={26} color={UI.inkMuted} />
      </View>
      <Text style={s.emptyText}>{text}</Text>
      <Text style={s.emptyHint}>{hint}</Text>
    </View>
  );
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({
  header: { flexDirection: ROW, alignItems: "center", gap: 12, paddingHorizontal: UI.cardMarginH },
  title: { fontFamily: FONTS.bold, fontSize: TYPE.hero, color: UI.ink, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  primaryWrap: { borderRadius: 17, ...glow(UI.violet, 0.4) },
  primary: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center", ...BEVEL },

  segment: { marginHorizontal: UI.cardMarginH, marginTop: 14 },
  segmentInner: { flexDirection: ROW, padding: 5, gap: 5 },
  segBtn: {
    flex: 1,
    flexDirection: ROW,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 42,
    borderRadius: 14,
  },
  segBtnOn: { backgroundColor: "rgba(255,255,255,0.10)", ...BEVEL },
  segText: { fontFamily: FONTS.semibold, fontSize: 13.5, color: UI.inkMuted },
  segTextOn: { color: UI.ink },

  board: { flexDirection: ROW, gap: 12, paddingHorizontal: UI.cardMarginH, alignItems: "flex-start" },
  column: { flex: 1, gap: 12 },

  cardShadow: {
    borderRadius: UI.radiusSm,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.42,
    shadowRadius: 20,
    elevation: 9,
  },
  cardClip: {
    borderRadius: UI.radiusSm,
    overflow: "hidden",
    backgroundColor: UI.surface,
    ...BEVEL,
  },

  cover: { height: 128, justifyContent: "flex-end", padding: 12 },
  coverTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: "#FFFFFF",
    textAlign: "right",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  doneBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: UI.green,
    alignItems: "center",
    justifyContent: "center",
  },

  cardBody: { padding: 12, gap: 8 },
  trackRow: { flexDirection: ROW, alignItems: "center", gap: 8 },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: UI.surfaceAlt, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  pct: { fontFamily: FONTS.bold, fontSize: 11.5, color: UI.violetLo, minWidth: 30 },

  money: { fontFamily: FONTS.bold, fontSize: 13.5, color: UI.ink, textAlign: "right" },
  moneyOf: { fontFamily: FONTS.regular, fontSize: 11, color: UI.inkMuted },

  metaRow: { flexDirection: ROW, gap: 6, flexWrap: "wrap" },
  metaChip: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: UI.surfaceAlt,
  },
  metaText: { fontFamily: FONTS.medium, fontSize: 10.5, color: UI.inkMuted },

  aiBtn: {
    flexDirection: ROW,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: tint(UI.violet, 0.16),
    ...BEVEL,
  },
  aiText: { fontFamily: FONTS.semibold, fontSize: 12, color: UI.violetLo },

  note: { padding: 14, gap: 8 },
  noteMargin: {
    position: "absolute",
    top: 12,
    bottom: 12,
    right: 8,
    width: 2,
    borderRadius: 2,
    backgroundColor: tint(UI.cyan, 0.35),
  },
  noteHead: { flexDirection: ROW, alignItems: "center", gap: 6 },
  noteTitle: { flex: 1, fontFamily: FONTS.bold, fontSize: 14.5, color: UI.ink, textAlign: "right" },
  notePreview: { fontFamily: FONTS.regular, fontSize: 12.5, color: UI.inkSoft, textAlign: "right", lineHeight: 19 },
  noteLocked: { color: UI.inkMuted, fontFamily: FONTS.medium },
  tagRow: { flexDirection: ROW, gap: 5, flexWrap: "wrap" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontFamily: FONTS.semibold, fontSize: 10 },
  noteTime: { fontFamily: FONTS.regular, fontSize: 10, color: UI.inkMuted, textAlign: "left" },

  empty: { alignItems: "center", gap: 8, paddingVertical: 60 },
  emptyBadge: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: UI.surface,
    alignItems: "center",
    justifyContent: "center",
    ...BEVEL,
  },
  emptyText: { fontFamily: FONTS.bold, fontSize: 15, color: UI.inkSoft, marginTop: 6 },
  emptyHint: { fontFamily: FONTS.regular, fontSize: 12.5, color: UI.inkMuted },
});
