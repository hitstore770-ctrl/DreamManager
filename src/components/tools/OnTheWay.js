import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useDreams } from "../../context/DreamContext";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import {
  BRUTAL_BORDER,
  BRUTAL_SHADOW,
  BRUTAL_SHADOW_SM,
  COLORS,
  FONTS,
  RADIUS,
} from "../../utils/theme";

const RADIUS_OPTIONS = [50, 100, 200, 500, 1000];
const SNOOZE_MS = 60 * 60 * 1000; // 1 hour

const TRIGGERS = [
  { key: "enter", label: "בכניסה" },
  { key: "exit", label: "ביציאה" },
  { key: "both", label: "כניסה + יציאה" },
];

// Great-circle distance between two lat/lng points, in metres.
function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Is "HH:MM" now inside the [start, end] window? Empty window = always on.
function withinTimeGate(start, end) {
  if (!start || !end) return true;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const parse = (t) => {
    const [h, m] = t.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };
  const s = parse(start);
  const e = parse(end);
  if (s == null || e == null) return true;
  return s <= e ? mins >= s && mins <= e : mins >= s || mins <= e;
}

export default function OnTheWay() {
  const { dreams } = useDreams();
  const [places, setPlaces] = usePersistentState(STORAGE_KEYS.onTheWay, []);

  const [note, setNote] = useState("");
  const [radius, setRadius] = useState(200);
  const [trigger, setTrigger] = useState("enter");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [dreamId, setDreamId] = useState(null);
  const [checklistDraft, setChecklistDraft] = useState("");

  const [busy, setBusy] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [offline, setOffline] = useState(false);
  const [current, setCurrent] = useState(null); // {lat,lng}
  const [expandedId, setExpandedId] = useState(null);

  const watchRef = useRef(null);
  const insideRef = useRef({}); // id -> boolean (was inside on last tick)
  const placesRef = useRef(places);
  placesRef.current = places;

  // Always tear down the location subscription on unmount.
  useEffect(() => {
    return () => {
      if (watchRef.current) watchRef.current.remove();
    };
  }, []);

  const linkedGoal = dreams.find((d) => d.id === dreamId);

  const addPlace = async () => {
    if (!note.trim()) {
      Alert.alert("שם חסר", "נא להזין שם/הערה למיקום");
      return;
    }
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setOffline(true);
        Alert.alert("אין הרשאה", "נדרשת הרשאת מיקום כדי לשמור מיקום");
        return;
      }
      setOffline(false);
      const pos = await Location.getCurrentPositionAsync({});
      setPlaces((prev) => [
        {
          id: Date.now().toString(),
          note: note.trim(),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          radius,
          trigger,
          timeStart: timeStart.trim(),
          timeEnd: timeEnd.trim(),
          dreamId: dreamId || null,
          dreamTitle: linkedGoal?.title || null,
          checklist: [],
          snoozeUntil: null,
        },
        ...prev,
      ]);
      setNote("");
      setTimeStart("");
      setTimeEnd("");
    } catch {
      setOffline(true);
      Alert.alert("שגיאה", "לא הצלחנו לקבל את המיקום הנוכחי");
    } finally {
      setBusy(false);
    }
  };

  const removePlace = (id) => setPlaces((prev) => prev.filter((p) => p.id !== id));

  // ---- Live geofencing (foreground) --------------------------------------
  const fireEvent = (place, kind) => {
    if (place.snoozeUntil && Date.now() < place.snoozeUntil) return;
    if (!withinTimeGate(place.timeStart, place.timeEnd)) return;
    setExpandedId(place.id); // auto-show the location checklist on arrival
    Alert.alert(
      kind === "enter" ? "🟢 הגעת ליעד" : "🔴 יצאת מהאזור",
      place.dreamTitle ? `${place.note}\n🎯 ${place.dreamTitle}` : place.note
    );
  };

  const handlePosition = (coords) => {
    const here = { lat: coords.latitude, lng: coords.longitude };
    setCurrent(here);
    placesRef.current.forEach((place) => {
      const dist = distanceMeters(here, place);
      const nowInside = dist <= place.radius;
      const wasInside = insideRef.current[place.id] ?? false;
      if (nowInside && !wasInside) {
        if (place.trigger === "enter" || place.trigger === "both") fireEvent(place, "enter");
      } else if (!nowInside && wasInside) {
        if (place.trigger === "exit" || place.trigger === "both") fireEvent(place, "exit");
      }
      insideRef.current[place.id] = nowInside;
    });
  };

  const startMonitoring = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setOffline(true);
        Alert.alert("אין הרשאה", "נדרשת הרשאת מיקום כדי לעקוב אחר מיקומים");
        return;
      }
      setOffline(false);
      insideRef.current = {};
      // Seed current state so we don't fire a spurious "enter" for a place
      // we're already standing inside when monitoring begins.
      const pos = await Location.getCurrentPositionAsync({});
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCurrent(here);
      placesRef.current.forEach((place) => {
        insideRef.current[place.id] = distanceMeters(here, place) <= place.radius;
      });
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 5000 },
        (loc) => handlePosition(loc.coords)
      );
      setMonitoring(true);
    } catch {
      setOffline(true);
      Alert.alert("שגיאה", "לא ניתן להפעיל מעקב מיקום כרגע");
    }
  };

  const stopMonitoring = () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    setMonitoring(false);
  };

  // ---- Per-place actions -------------------------------------------------
  const navigateTo = (place) => {
    const waze = `https://waze.com/ul?ll=${place.lat},${place.lng}&navigate=yes`;
    Linking.openURL(waze).catch(() =>
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`
      ).catch(() => Alert.alert("שגיאה", "לא ניתן לפתוח ניווט"))
    );
  };

  const sharePlace = (place) => {
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
    const text = `📍 ${place.note}\n${mapUrl}`;
    const wa = `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(wa).catch(() =>
      Linking.openURL(
        `https://wa.me/?text=${encodeURIComponent(text)}`
      ).catch(() => Alert.alert("שיתוף", text))
    );
  };

  const snoozePlace = (id) =>
    setPlaces((prev) =>
      prev.map((p) => (p.id === id ? { ...p, snoozeUntil: Date.now() + SNOOZE_MS } : p))
    );

  const clearSnooze = (id) =>
    setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, snoozeUntil: null } : p)));

  const addChecklistItem = (placeId) => {
    if (!checklistDraft.trim()) return;
    setPlaces((prev) =>
      prev.map((p) =>
        p.id === placeId
          ? {
              ...p,
              checklist: [
                ...p.checklist,
                { id: Date.now().toString(), text: checklistDraft.trim(), done: false },
              ],
            }
          : p
      )
    );
    setChecklistDraft("");
  };

  const toggleChecklistItem = (placeId, itemId) =>
    setPlaces((prev) =>
      prev.map((p) =>
        p.id === placeId
          ? {
              ...p,
              checklist: p.checklist.map((c) =>
                c.id === itemId ? { ...c, done: !c.done } : c
              ),
            }
          : p
      )
    );

  const removeChecklistItem = (placeId, itemId) =>
    setPlaces((prev) =>
      prev.map((p) =>
        p.id === placeId
          ? { ...p, checklist: p.checklist.filter((c) => c.id !== itemId) }
          : p
      )
    );

  const distanceLabel = (place) => {
    if (!current) return null;
    const d = distanceMeters(current, place);
    return d >= 1000 ? `${(d / 1000).toFixed(1)} ק״מ` : `${Math.round(d)} מ׳`;
  };

  return (
    <View>
      {/* Offline / status banner */}
      {offline ? (
        <View style={[styles.banner, styles.bannerOffline]}>
          <Text style={styles.bannerText}>📴 מצב לא מקוון — אין גישה למיקום</Text>
        </View>
      ) : (
        <View style={[styles.banner, monitoring ? styles.bannerLive : styles.bannerIdle]}>
          <Text style={styles.bannerText}>
            {monitoring ? "🟢 מעקב פעיל — נתריע בכניסה/יציאה" : "⚪ המעקב כבוי"}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.monitorButton, monitoring ? styles.monitorOn : styles.monitorOff]}
        onPress={monitoring ? stopMonitoring : startMonitoring}
        activeOpacity={0.85}
      >
        <Text style={styles.monitorText}>
          {monitoring ? "⏹  הפסק מעקב" : "▶  הפעל מעקב חכם"}
        </Text>
      </TouchableOpacity>

      {/* Add a new place */}
      <Text style={styles.sectionTitle}>הוסף מיקום</Text>
      <Text style={styles.label}>שם / הערה</Text>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder="לדוגמה: מחסן ציוד ברמלה"
        placeholderTextColor={COLORS.textMuted}
        textAlign="right"
      />

      <Text style={styles.label}>רדיוס התראה</Text>
      <View style={styles.chipRow}>
        {RADIUS_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, radius === r && styles.chipActive]}
            onPress={() => setRadius(r)}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>
              {r >= 1000 ? "1 ק״מ" : `${r} מ׳`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>מתי להתריע</Text>
      <View style={styles.chipRow}>
        {TRIGGERS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.chip, trigger === t.key && styles.chipActive]}
            onPress={() => setTrigger(t.key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, trigger === t.key && styles.chipTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>חלון שעות (לא חובה)</Text>
      <View style={styles.timeRow}>
        <TextInput
          style={[styles.input, styles.timeInput]}
          value={timeStart}
          onChangeText={setTimeStart}
          placeholder="14:00"
          placeholderTextColor={COLORS.textMuted}
          textAlign="center"
        />
        <Text style={styles.timeDash}>—</Text>
        <TextInput
          style={[styles.input, styles.timeInput]}
          value={timeEnd}
          onChangeText={setTimeEnd}
          placeholder="18:00"
          placeholderTextColor={COLORS.textMuted}
          textAlign="center"
        />
      </View>

      <Text style={styles.label}>שייך לפרויקט</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.goalScroll}>
        <TouchableOpacity
          style={[styles.chip, dreamId === null && styles.chipActive]}
          onPress={() => setDreamId(null)}
          activeOpacity={0.85}
        >
          <Text style={[styles.chipText, dreamId === null && styles.chipTextActive]}>ללא</Text>
        </TouchableOpacity>
        {dreams.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={[styles.chip, dreamId === g.id && styles.chipActive]}
            onPress={() => setDreamId(g.id)}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, dreamId === g.id && styles.chipTextActive]}>
              {g.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={addPlace} activeOpacity={0.85}>
        <Text style={styles.addButtonText}>
          {busy ? "מאתר מיקום..." : "📍 שמור מיקום נוכחי"}
        </Text>
      </TouchableOpacity>

      {/* Saved places */}
      {places.length > 0 && <Text style={styles.sectionTitle}>המיקומים שלי</Text>}
      {places.length === 0 && (
        <Text style={styles.empty}>אין מיקומים עדיין. שמור מיקום נוכחי כדי להתחיל.</Text>
      )}

      {places.map((place) => {
        const snoozed = place.snoozeUntil && Date.now() < place.snoozeUntil;
        const dist = distanceLabel(place);
        const expanded = expandedId === place.id;
        const doneCount = place.checklist.filter((c) => c.done).length;
        return (
          <View key={place.id} style={styles.placeCard}>
            <View style={styles.placeHeader}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => removePlace(place.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteButtonText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.placeTitle}>{place.note}</Text>
              {dist && <Text style={styles.placeDist}>{dist}</Text>}
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaChip}>
                {place.radius >= 1000 ? "1 ק״מ" : `${place.radius} מ׳`}
              </Text>
              <Text style={styles.metaChip}>
                {TRIGGERS.find((t) => t.key === place.trigger)?.label}
              </Text>
              {place.timeStart && place.timeEnd && (
                <Text style={styles.metaChip}>
                  🕐 {place.timeStart}-{place.timeEnd}
                </Text>
              )}
              {snoozed && <Text style={[styles.metaChip, styles.metaSnoozed]}>😴 מושתק</Text>}
            </View>

            {place.dreamTitle && <Text style={styles.placeGoal}>🎯 {place.dreamTitle}</Text>}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionNav]}
                onPress={() => navigateTo(place)}
                activeOpacity={0.85}
              >
                <Text style={styles.actionText}>🧭 נווט</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionShare]}
                onPress={() => sharePlace(place)}
                activeOpacity={0.85}
              >
                <Text style={styles.actionText}>↗ שתף</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionSnooze]}
                onPress={() => (snoozed ? clearSnooze(place.id) : snoozePlace(place.id))}
                activeOpacity={0.85}
              >
                <Text style={styles.actionText}>{snoozed ? "🔔 בטל" : "😴 שעה"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.checklistToggle}
              onPress={() => setExpandedId(expanded ? null : place.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.checklistToggleText}>
                {expanded ? "▲ סגור צ׳ק ליסט" : "▼ צ׳ק ליסט"} ({doneCount}/{place.checklist.length})
              </Text>
            </TouchableOpacity>

            {expanded && (
              <View style={styles.checklistBox}>
                {place.checklist.map((c) => (
                  <View key={c.id} style={styles.checkRow}>
                    <TouchableOpacity
                      style={styles.checkDelete}
                      onPress={() => removeChecklistItem(place.id, c.id)}
                    >
                      <Text style={styles.checkDeleteText}>✕</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.checkMain}
                      onPress={() => toggleChecklistItem(place.id, c.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.checkText, c.done && styles.checkTextDone]}>
                        {c.text}
                      </Text>
                      <View style={[styles.checkbox, c.done && styles.checkboxOn]}>
                        <Text style={styles.checkboxMark}>{c.done ? "✓" : ""}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.addCheckRow}>
                  <TextInput
                    style={[styles.input, styles.addCheckInput]}
                    value={expanded ? checklistDraft : ""}
                    onChangeText={setChecklistDraft}
                    placeholder="פריט לצ׳ק ליסט"
                    placeholderTextColor={COLORS.textMuted}
                    textAlign="right"
                  />
                  <TouchableOpacity
                    style={styles.addCheckBtn}
                    onPress={() => addChecklistItem(place.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.addCheckBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}

      {Platform.OS === "web" && (
        <Text style={styles.footNote}>
          * מעקב רקע מלא (גם כשהאפליקציה סגורה) זמין באפליקציה המותקנת במכשיר.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: 12,
    borderRadius: RADIUS,
    marginBottom: 12,
    ...BRUTAL_BORDER,
  },
  bannerLive: { backgroundColor: COLORS.success },
  bannerIdle: { backgroundColor: COLORS.white },
  bannerOffline: { backgroundColor: COLORS.mustard },
  bannerText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: FONTS.bold,
    textAlign: "center",
  },
  monitorButton: {
    height: 60,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  monitorOn: { backgroundColor: COLORS.danger },
  monitorOff: { backgroundColor: COLORS.navy },
  monitorText: { color: "#FFFFFF", fontSize: 19, fontFamily: FONTS.bold },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginTop: 8,
    marginBottom: 12,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.bold,
    marginBottom: 8,
    textAlign: "right",
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.regular,
    marginBottom: 14,
    ...BRUTAL_BORDER,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    marginStart: 8,
    marginBottom: 8,
    ...BRUTAL_BORDER,
  },
  chipActive: { backgroundColor: COLORS.mustard },
  chipText: { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.bold },
  chipTextActive: { color: COLORS.textPrimary },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timeInput: { flex: 1, marginBottom: 14 },
  timeDash: { color: COLORS.textPrimary, fontSize: 18, fontFamily: FONTS.bold, marginBottom: 14 },
  goalScroll: { marginBottom: 14 },
  addButton: {
    height: 52,
    borderRadius: RADIUS,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  addButtonText: { color: "#FFFFFF", fontSize: 16, fontFamily: FONTS.bold },
  empty: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    paddingVertical: 12,
  },
  placeCard: {
    padding: 14,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    marginBottom: 12,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  placeHeader: { flexDirection: "row", alignItems: "center" },
  placeTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginHorizontal: 10,
  },
  placeDist: { color: COLORS.navy, fontSize: 14, fontFamily: FONTS.bold },
  metaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  metaChip: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONTS.medium,
    backgroundColor: COLORS.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginStart: 6,
    marginBottom: 6,
    ...BRUTAL_BORDER,
  },
  metaSnoozed: { backgroundColor: COLORS.mustard, color: COLORS.textPrimary },
  placeGoal: {
    color: COLORS.navy,
    fontSize: 13,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginTop: 4,
  },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    height: 42,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  actionNav: { backgroundColor: COLORS.navy },
  actionShare: { backgroundColor: COLORS.success },
  actionSnooze: { backgroundColor: COLORS.mustard },
  actionText: { color: "#FFFFFF", fontSize: 13, fontFamily: FONTS.bold },
  checklistToggle: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: RADIUS,
    ...BRUTAL_BORDER,
  },
  checklistToggleText: { color: COLORS.textPrimary, fontSize: 13, fontFamily: FONTS.bold },
  checklistBox: { marginTop: 10 },
  checkRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  checkDelete: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  checkDeleteText: { color: COLORS.textPrimary, fontSize: 11, fontFamily: FONTS.bold },
  checkMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginStart: 10,
  },
  checkText: { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontFamily: FONTS.medium, textAlign: "right" },
  checkTextDone: { textDecorationLine: "line-through", color: COLORS.textMuted },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginStart: 10,
    ...BRUTAL_BORDER,
  },
  checkboxOn: { backgroundColor: COLORS.success },
  checkboxMark: { color: "#FFFFFF", fontSize: 14, fontFamily: FONTS.bold },
  addCheckRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addCheckInput: { flex: 1, marginBottom: 0 },
  addCheckBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  addCheckBtnText: { color: "#FFFFFF", fontSize: 22, fontFamily: FONTS.bold },
  footNote: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: FONTS.regular,
    textAlign: "right",
    marginTop: 8,
  },
});
