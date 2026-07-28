import { useMemo, useState } from "react";
import { I18nManager, Image, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { MotiView } from "moti";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { Canvas, Card, FoldedCorner, Note } from "../components/Paper";
import { DREAM_COVERS, daysUntil, useDreams } from "../context/DreamContext";
import { useNotes } from "../context/NotesContext";
import { hapticLight } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { checklistToText, makeNote } from "../utils/notesStore";
import { shekel } from "../utils/posStore";
import { BEVEL, CARD_SHADOW, GRAD, PASTEL, TYPE, UI, glow, pastelFor, tint } from "../utils/ui";
import CustomText from "../components/CustomText";

// חלומות ופתקים — one hub, two pinboards.
//
// Both are true masonry (two independent columns filled by running height)
// rather than a grid of equal rows, because both hold cards of genuinely
// different heights: a dream with a photo and four milestones is not the same
// object as one with a title. A fixed grid would pad every short card to the
// tallest in its row and leave the board full of holes.
//
// The board is a bright desk rather than a cork texture. A photographic cork
// background is the obvious reading of "corkboard", but it fights everything
// the rest of this brief asks for — it is dark, busy, and it drags the
// contrast of every pastel note sitting on it. The paper does the work
// instead: real stocks, a slight tilt, a folded corner and a close shadow.

const COVER = Object.fromEntries(DREAM_COVERS.map((c) => [c.key, c.colors]));
const TAG_TONES = [UI.violet, UI.cyan, UI.green, UI.amber, UI.coral];

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
    <MotiView
      from={{ opacity: 0, translateY: 26, scale: 0.94 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{
        type: "spring",
        damping: 16,
        stiffness: 190,
        mass: 0.9,
        // Capped, so a long board still finishes settling in about half a
        // second rather than trickling in for four.
        delay: Math.min(index * 70, 340),
      }}
    >
      <Bounce testID={`dream-${dream.id}`} scaleTo={0.96} onPress={() => onOpen(dream)}>
        <Card style={s.dreamCard} radius={UI.radius}>
          {/* The photo, or the painted cover, sits inside the card like a
              print taped to the top of a page. */}
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
            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.62)"]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {done && (
              <View style={s.doneBadge}>
                <Icon name="check" size={12} color="#FFFFFF" />
              </View>
            )}
            <CustomText style={s.coverTitle} numberOfLines={2}>{dream.title || "חלום"}</CustomText>
          </View>

          <View style={s.cardBody}>
            <View style={s.trackRow}>
              <CustomText style={[s.pct, done && { color: UI.green }]}>{pct}%</CustomText>
              <View style={s.track}>
                <View
                  testID={`dream-bar-${dream.id}`}
                  style={[s.fill, { width: `${pct}%`, backgroundColor: done ? UI.green : UI.violet }]}
                />
              </View>
            </View>

            <CustomText style={s.money}>
              {shekel(saved)} <CustomText style={s.moneyOf}>מתוך {shekel(target)}</CustomText>
            </CustomText>

            <View style={s.metaRow}>
              {milestones.length > 0 && (
                <View style={s.metaChip}>
                  <Icon name="check-circle" size={11} color={UI.inkMuted} />
                  <CustomText style={s.metaText}>{doneCount}/{milestones.length}</CustomText>
                </View>
              )}
              {left !== null && (
                <View style={s.metaChip}>
                  <Icon name="clock" size={11} color={left < 0 ? UI.coral : UI.inkMuted} />
                  <CustomText style={[s.metaText, left < 0 && { color: UI.coral }]}>
                    {left < 0 ? `באיחור ${-left}י׳` : `${left} ימים`}
                  </CustomText>
                </View>
              )}
            </View>

            <Bounce
              testID={`dream-ai-${dream.id}`}
              style={s.aiBtn}
              scaleTo={0.94}
              onPress={() => onAsk(dream)}
            >
              <Icon name="message-circle" size={13} color={UI.violet} />
              <CustomText style={s.aiText}>קו-פיילוט</CustomText>
            </Bounce>
          </View>
        </Card>
      </Bounce>
    </MotiView>
  );
}

function NoteCard({ note, index, onOpen }) {
  const preview = note.locked
    ? "פתק נעול"
    : (note.isChecklist ? checklistToText(note.checklist) : note.body || "").slice(0, 150) || "פתק ריק";
  const tags = (note.tags || []).slice(0, 3);
  // The note keeps its stock across launches, because the colour is derived
  // from its id rather than drawn at render time.
  const stock = pastelFor(note.id);

  return (
    // A note is *placed* on the board rather than faded in: it arrives lifted,
    // slightly larger and turned a few degrees further than it will rest, then
    // springs down into its own tilt. Rotating to 0 here is what makes it
    // settle *into* the angle the Note component gives it, since the two
    // transforms compose.
    <MotiView
      from={{ opacity: 0, translateY: 30, scale: 1.06, rotate: "-5deg" }}
      animate={{ opacity: 1, translateY: 0, scale: 1, rotate: "0deg" }}
      transition={{
        type: "spring",
        damping: 14,
        stiffness: 170,
        mass: 0.8,
        delay: Math.min(index * 60, 320),
      }}
    >
      <Bounce testID={`note-${note.id}`} scaleTo={0.96} onPress={() => onOpen(note)}>
        <Note tone={stock} seed={note.id} radius={UI.radiusSm}>
          <FoldedCorner tone={stock} size={20} />
          <View style={s.note}>
            <View style={s.noteHead}>
              {note.pinned && <Icon name="bookmark" size={13} color={stock.ink} />}
              {note.locked && <Icon name="lock" size={12} color={stock.ink} />}
              <CustomText style={[s.noteTitle, { color: stock.ink }]} numberOfLines={2}>
                {note.title || "ללא כותרת"}
              </CustomText>
            </View>

            <CustomText
              style={[s.notePreview, { color: stock.ink }, note.locked && s.noteLocked]}
              numberOfLines={6}
            >
              {preview}
            </CustomText>

            {tags.length > 0 && (
              <View style={s.tagRow}>
                {tags.map((t) => (
                  <View key={t} style={[s.tag, { backgroundColor: "rgba(255,255,255,0.7)" }]}>
                    <CustomText style={[s.tagText, { color: tagTone(t) }]}>#{t}</CustomText>
                  </View>
                ))}
              </View>
            )}

            <CustomText style={[s.noteTime, { color: stock.ink }]}>{fmtUpdated(note.updatedAt)}</CustomText>
          </View>
        </Note>
      </Bounce>
    </MotiView>
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
    <Canvas testID="library-screen">
      <View style={{ paddingTop: insets.top + 12 }}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <CustomText style={s.title}>{isDreams ? "חלומות" : "פתקים"}</CustomText>
            <CustomText style={s.subtitle}>
              {isDreams ? `${dreamList.length} יעדים על הלוח` : `${noteList.length} פתקים`}
            </CustomText>
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
        <Card style={s.segment} radius={UI.radius}>
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
                  <Icon name={seg.icon} size={15} color={on ? UI.violet : UI.inkMuted} />
                  <CustomText style={[s.segText, on && s.segTextOn]}>{seg.label}</CustomText>
                </Bounce>
              );
            })}
          </View>
        </Card>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120, paddingTop: 16 }}
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
      <Note tone={PASTEL.butter} seed={text} style={s.emptyNote}>
        <FoldedCorner tone={PASTEL.butter} size={18} />
        <Icon name={icon} size={26} color={PASTEL.butter.ink} />
      </Note>
      <CustomText style={s.emptyText}>{text}</CustomText>
      <CustomText style={s.emptyHint}>{hint}</CustomText>
    </View>
  );
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({
  header: { flexDirection: ROW, alignItems: "center", gap: 12, paddingHorizontal: UI.cardMarginH },
  title: { fontFamily: FONTS.bold, fontSize: TYPE.hero, color: UI.ink, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  primaryWrap: { borderRadius: 17, ...glow(UI.violet, 0.28) },
  primary: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center" },

  segment: { marginHorizontal: UI.cardMarginH, marginTop: 14 },
  segmentInner: { flexDirection: ROW, padding: 5, gap: 5 },
  segBtn: {
    flex: 1,
    flexDirection: ROW,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 42,
    borderRadius: UI.radiusSm,
  },
  segBtnOn: { backgroundColor: tint(UI.violet, 0.1) },
  segText: { fontFamily: FONTS.semibold, fontSize: 13.5, color: UI.inkMuted },
  segTextOn: { color: UI.violet },

  board: { flexDirection: ROW, gap: 12, paddingHorizontal: UI.cardMarginH, alignItems: "flex-start" },
  column: { flex: 1, gap: 14 },

  dreamCard: { overflow: "hidden" },
  cover: { height: 124, justifyContent: "flex-end", padding: 12, margin: 6, borderRadius: UI.radiusSm, overflow: "hidden" },
  coverTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: "#FFFFFF",
    textAlign: "right",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
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

  cardBody: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2, gap: 8 },
  trackRow: { flexDirection: ROW, alignItems: "center", gap: 8 },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: UI.surfaceHi, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  pct: { fontFamily: FONTS.bold, fontSize: 11.5, color: UI.violet, minWidth: 30 },

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
    ...BEVEL,
  },
  metaText: { fontFamily: FONTS.medium, fontSize: 10.5, color: UI.inkMuted },

  aiBtn: {
    flexDirection: ROW,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 36,
    borderRadius: UI.radiusSm,
    backgroundColor: tint(UI.violet, 0.09),
  },
  aiText: { fontFamily: FONTS.semibold, fontSize: 12, color: UI.violet },

  note: { padding: 14, gap: 8 },
  noteHead: { flexDirection: ROW, alignItems: "center", gap: 6 },
  noteTitle: { flex: 1, fontFamily: FONTS.bold, fontSize: 14.5, textAlign: "right" },
  notePreview: { fontFamily: FONTS.regular, fontSize: 12.5, textAlign: "right", lineHeight: 19, opacity: 0.85 },
  noteLocked: { fontFamily: FONTS.medium, opacity: 0.6 },
  tagRow: { flexDirection: ROW, gap: 5, flexWrap: "wrap" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontFamily: FONTS.semibold, fontSize: 10 },
  noteTime: { fontFamily: FONTS.regular, fontSize: 10, textAlign: "left", opacity: 0.55 },

  empty: { alignItems: "center", gap: 8, paddingVertical: 60 },
  emptyNote: { width: 74, height: 74, alignItems: "center", justifyContent: "center" },
  emptyText: { fontFamily: FONTS.bold, fontSize: 15, color: UI.inkSoft, marginTop: 10 },
  emptyHint: { fontFamily: FONTS.regular, fontSize: 12.5, color: UI.inkMuted },
});
