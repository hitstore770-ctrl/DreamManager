import { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../Icon";
import CustomText from "../CustomText";
import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { uid } from "../../utils/posStore";
import { usePersistentState } from "../../utils/usePersistentState";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { BLUE, CARD, GREEN, INK, INK_MUTED, INK_SOFT, NO_OUTLINE, RED, WHITE, s as kit } from "../tools/kit";

// Floor tools: the four things that happen between taking money and handing
// over a bag. Each one is a mini-app the register opens in a sheet, and each
// persists on its own key so a half-finished count survives the app closing.

const AMBER = "#D97706";

// ---------------------------------------------------------------------------
// Prep queue — a kitchen display board.
//
// Tickets are ordered oldest first and carry a running clock, because the only
// question this screen answers is "who has been waiting longest". The clock
// ticks off a single interval for the whole list rather than one per card:
// twenty tickets meant twenty timers in the naive version, all firing at
// different offsets.

export function PrepQueue() {
  const [tickets, setTickets] = usePersistentState("@dreammanager/pos-prep-queue", []);
  const [name, setName] = useState("");
  const [now, setNow] = useState(Date.now());

  const open = (tickets || []).filter((t) => !t.doneAt);

  useEffect(() => {
    if (!open.length) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open.length]);

  const add = () => {
    const label = name.trim();
    if (!label) return;
    hapticLight();
    setTickets((prev) => [...(prev || []), { id: uid(), label, startedAt: Date.now(), doneAt: null }]);
    setName("");
  };

  const finish = (id) => {
    hapticSuccess();
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, doneAt: Date.now() } : t)));
  };

  return (
    <View style={st.wrap}>
      <View style={kit.fieldRow}>
        <TextInput
          testID="prep-input"
          style={[kit.fieldInput, { fontSize: 15, textAlign: "right" }]}
          value={name}
          onChangeText={setName}
          placeholder="מה מכינים? (למשל: שניצל בלאפה ×2)"
          placeholderTextColor={INK_MUTED}
          onSubmitEditing={add}
        />
        <TouchableOpacity testID="prep-add" style={st.addBtn} onPress={add}>
          <Icon name="plus" size={20} color={WHITE} />
        </TouchableOpacity>
      </View>

      {open.length === 0 ? (
        <Empty icon="check-circle" title="התור ריק" sub="כל ההזמנות סגורות. כרטיס חדש נכנס לתחתית התור." />
      ) : (
        open.map((t, i) => {
          const secs = Math.max(0, Math.floor((now - t.startedAt) / 1000));
          const late = secs >= 300; // five minutes is where a counter order starts feeling slow
          return (
            <View key={t.id} testID={`prep-ticket-${i}`} style={[st.ticket, late && { borderColor: RED, backgroundColor: RED + "0A" }]}>
              <TouchableOpacity style={[st.ticketDone, late && { backgroundColor: RED }]} onPress={() => finish(t.id)}>
                <Icon name="check" size={18} color={WHITE} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <CustomText style={st.ticketLabel}>{t.label}</CustomText>
                <CustomText style={[st.ticketClock, late && { color: RED }]}>{mmss(secs)} בהמתנה</CustomText>
              </View>
              <View style={st.ticketNum}>
                <CustomText style={st.ticketNumText}>{i + 1}</CustomText>
              </View>
            </View>
          );
        })
      )}

      {(tickets || []).some((t) => t.doneAt) && (
        <TouchableOpacity
          style={[kit.actionBtn, { backgroundColor: CARD }]}
          onPress={() => {
            hapticLight();
            setTickets((prev) => prev.filter((t) => !t.doneAt));
          }}
        >
          <CustomText style={[kit.actionText, { color: INK_SOFT }]}>נקה כרטיסים שהושלמו</CustomText>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Batch timer — several dishes cooking at once.
//
// Countdowns are stored as an absolute end timestamp, not a remaining count.
// A remaining-seconds counter drifts whenever the app is backgrounded and the
// interval stops firing; an end time is still correct when you come back.

const PRESETS = [
  { label: "צ׳יפס", secs: 240 },
  { label: "שניצל", secs: 360 },
  { label: "טוסט", secs: 180 },
  { label: "פיצה", secs: 480 },
];

export function BatchTimer() {
  const [timers, setTimers] = useState([]);
  const [now, setNow] = useState(Date.now());
  const fired = useRef(new Set());

  useEffect(() => {
    if (!timers.length) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [timers.length]);

  useEffect(() => {
    timers.forEach((t) => {
      if (t.endsAt <= now && !fired.current.has(t.id)) {
        fired.current.add(t.id);
        hapticWarning();
      }
    });
  }, [now, timers]);

  const start = (label, secs) => {
    hapticLight();
    setTimers((prev) => [...prev, { id: uid(), label, endsAt: Date.now() + secs * 1000, secs }]);
  };

  return (
    <View style={st.wrap}>
      <CustomText style={kit.sectionLabel}>הפעלה מהירה</CustomText>
      <View style={st.presetRow}>
        {PRESETS.map((p) => (
          <TouchableOpacity key={p.label} testID={`timer-${p.label}`} style={st.preset} onPress={() => start(p.label, p.secs)}>
            <CustomText style={st.presetLabel}>{p.label}</CustomText>
            <CustomText style={st.presetSecs}>{mmss(p.secs)}</CustomText>
          </TouchableOpacity>
        ))}
      </View>

      {timers.length === 0 ? (
        <Empty icon="clock" title="אין טיימרים פעילים" sub="בחר מנה למעלה, ואפשר להריץ כמה טיימרים במקביל." />
      ) : (
        timers.map((t) => {
          const left = Math.ceil((t.endsAt - now) / 1000);
          const done = left <= 0;
          return (
            <View key={t.id} style={[st.timerRow, done && { backgroundColor: RED + "12", borderColor: RED }]}>
              <TouchableOpacity
                style={st.timerX}
                onPress={() => {
                  hapticLight();
                  setTimers((prev) => prev.filter((x) => x.id !== t.id));
                }}
              >
                <Icon name="x" size={17} color={INK_MUTED} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <CustomText style={st.timerLabel}>{t.label}</CustomText>
                <View style={st.track}>
                  <View
                    style={[
                      st.trackFill,
                      { width: `${Math.max(0, Math.min(100, (left / t.secs) * 100))}%`, backgroundColor: done ? RED : GREEN },
                    ]}
                  />
                </View>
              </View>
              <CustomText style={[st.timerLeft, { color: done ? RED : INK }]}>{done ? "מוכן!" : mmss(left)}</CustomText>
            </View>
          );
        })
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Packing checklist — the last look inside the box before it is taped.

const PACK_DEFAULT = [
  "הפריט הנכון לפי ההזמנה",
  "כמות תואמת",
  "בדיקת תקינות/הפעלה",
  "כבל או מתאם אם צריך",
  "ריפוד נגד שבירה",
  "פתק תודה או מדבקה",
  "שם וכתובת נמען",
];

export function PackingChecklist() {
  const [steps, setSteps] = usePersistentState("@dreammanager/pos-packing-steps", PACK_DEFAULT);
  const [ticked, setTicked] = useState({});
  const [draft, setDraft] = useState("");

  const list = steps || PACK_DEFAULT;
  const doneCount = list.filter((_, i) => ticked[i]).length;
  const allDone = doneCount === list.length && list.length > 0;

  return (
    <View style={st.wrap}>
      <View style={[st.banner, { backgroundColor: allDone ? GREEN + "12" : CARD }]}>
        <CustomText style={[kit.bannerText, { color: allDone ? GREEN : INK }]}>
          {allDone ? "החבילה מוכנה לסגירה" : `${doneCount} מתוך ${list.length} סומנו`}
        </CustomText>
        <CustomText style={[kit.bannerSub, { color: INK_SOFT }]}>
          הסימונים לא נשמרים בין חבילות — הרשימה עצמה כן. כך כל חבילה מתחילה נקייה.
        </CustomText>
      </View>

      {list.map((step, i) => (
        // Row, not one big button: the delete control has to be its own
        // touchable, and nesting one inside another double-fires on web.
        <View key={`${step}-${i}`} style={kit.checkRow}>
          <TouchableOpacity
            testID={`pack-step-${i}`}
            style={st.checkHit}
            onPress={() => {
              hapticLight();
              setTicked((p) => ({ ...p, [i]: !p[i] }));
            }}
          >
            <View style={[kit.checkbox, ticked[i] && { backgroundColor: GREEN, borderColor: GREEN }]}>
              {ticked[i] && <CustomText style={kit.checkMark}>✓</CustomText>}
            </View>
            <CustomText style={[kit.checkLabel, ticked[i] && { color: INK_MUTED, textDecorationLine: "line-through" }]}>{step}</CustomText>
          </TouchableOpacity>
          <TouchableOpacity
            style={st.trashHit}
            onPress={() => {
              hapticWarning();
              setSteps((prev) => prev.filter((_, j) => j !== i));
              setTicked({});
            }}
          >
            <Icon name="trash-2" size={16} color={INK_MUTED} />
          </TouchableOpacity>
        </View>
      ))}

      <View style={kit.fieldRow}>
        <TextInput
          style={[kit.fieldInput, { fontSize: 14, textAlign: "right" }]}
          value={draft}
          onChangeText={setDraft}
          placeholder="שלב נוסף ברשימה"
          placeholderTextColor={INK_MUTED}
        />
        <TouchableOpacity
          style={st.addBtn}
          onPress={() => {
            const v = draft.trim();
            if (!v) return;
            hapticLight();
            setSteps((prev) => [...(prev || []), v]);
            setDraft("");
          }}
        >
          <Icon name="plus" size={20} color={WHITE} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        testID="pack-reset"
        style={[kit.actionBtn, { backgroundColor: BLUE }]}
        onPress={() => {
          hapticSuccess();
          setTicked({});
        }}
      >
        <CustomText style={kit.actionText}>חבילה הבאה</CustomText>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shared bits

export function Empty({ icon, title, sub }) {
  return (
    <View style={st.empty}>
      <View style={st.emptyBadge}>
        <Icon name={icon} size={24} color={INK_MUTED} />
      </View>
      <CustomText style={st.emptyTitle}>{title}</CustomText>
      <CustomText style={st.emptySub}>{sub}</CustomText>
    </View>
  );
}

export function mmss(totalSeconds) {
  const t = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const st = StyleSheet.create({
  wrap: { gap: 12 },
  checkHit: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  trashHit: { width: 34, height: 44, alignItems: "center", justifyContent: "center" },

  blindCard: { backgroundColor: CARD, borderRadius: 18, padding: 16, gap: 10 },
  blindName: { fontFamily: FONTS.bold, fontSize: 19, color: INK, textAlign: "center" },
  blindSub: { fontFamily: FONTS.regular, fontSize: 11.5, color: INK_MUTED, textAlign: "center" },
  blindInput: {
    minHeight: 62,
    borderRadius: 14,
    backgroundColor: WHITE,
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: INK,
    ...NO_OUTLINE,
  },

  banner: { borderRadius: 14, padding: 12 },

  varRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 54,
  },
  varDiff: { fontFamily: FONTS.bold, fontSize: 17, minWidth: 62, textAlign: "center" },
  varName: { fontFamily: FONTS.semibold, fontSize: 13.5, color: INK, textAlign: "right" },
  varSub: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, textAlign: "right", marginTop: 2 },

  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },

  ticket: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: "#E7EAF0",
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 62,
  },
  ticketDone: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketLabel: { fontFamily: FONTS.semibold, fontSize: 14, color: INK, textAlign: "right" },
  ticketClock: { fontFamily: FONTS.medium, fontSize: 11.5, color: INK_MUTED, textAlign: "right", marginTop: 2 },
  ticketNum: { width: 26, height: 26, borderRadius: 9, backgroundColor: CARD, alignItems: "center", justifyContent: "center" },
  ticketNumText: { fontFamily: FONTS.bold, fontSize: 12, color: INK_SOFT },

  presetRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  preset: { flexGrow: 1, minWidth: 76, backgroundColor: CARD, borderRadius: 13, paddingVertical: 11, alignItems: "center" },
  presetLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: INK },
  presetSecs: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED, marginTop: 2 },

  timerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: "#E7EAF0",
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 62,
  },
  timerX: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  timerLabel: { fontFamily: FONTS.semibold, fontSize: 13.5, color: INK, textAlign: "right" },
  timerLeft: { fontFamily: FONTS.bold, fontSize: 16, minWidth: 58, textAlign: "center" },
  track: { height: 5, borderRadius: 3, backgroundColor: "#E7EAF0", marginTop: 6, overflow: "hidden" },
  trackFill: { height: 5, borderRadius: 3 },

  empty: { alignItems: "center", gap: 8, paddingVertical: 26 },
  emptyBadge: { width: 58, height: 58, borderRadius: 20, backgroundColor: CARD, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 15, color: INK, textAlign: "center" },
  emptySub: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, textAlign: "center", lineHeight: 19, paddingHorizontal: 16 },
});
