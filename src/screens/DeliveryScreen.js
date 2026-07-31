import { useMemo, useState } from "react";
import { I18nManager, StyleSheet, TextInput, View } from "react-native";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import CustomText from "../components/CustomText";
import Icon from "../components/Icon";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { uid } from "../utils/posStore";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { usePersistentState } from "../utils/usePersistentState";
import { BEVEL, CARD_SHADOW, UI, tint } from "../utils/ui";

// A local scooter round in Beitar Illit has no real turn-by-turn routing
// behind it here — there is no map SDK wired up, and inventing "local
// knowledge" of which streets sit near which would risk sending a real
// deliverer the wrong way on data this app cannot actually verify. So the
// sort below is built only from what the user tells it: a manual 3-tier
// "how far from the depot is this stop" pick per address, plus a genuine
// (if crude) same-street proxy — token overlap between address strings —
// used only to order stops *within* a tier. It is an honest heuristic, not
// GPS routing, and the UI's own copy says so via drag-to-reorder being the
// primary, always-available override.

const TIERS = [
  { key: 1, label: "קרוב", icon: "map-pin" },
  { key: 2, label: "בינוני", icon: "navigation" },
  { key: 3, label: "רחוק", icon: "truck" },
];

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[\s,./\\-]+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length > 1);
}

function sharedTokenCount(a, b) {
  const setA = new Set(tokenize(a));
  let count = 0;
  tokenize(b).forEach((t) => {
    if (setA.has(t)) count += 1;
  });
  return count;
}

// A same-building match is exact, structured data (the user picked it, not
// free text), so it outweighs the fuzzy token overlap rather than competing
// with it on equal footing — that also covers single-digit building numbers
// ("3"), which the token filter below drops for being too short to trust as
// a word on its own.
function stopScore(current, candidate) {
  let score = sharedTokenCount(current.address, candidate.address);
  const a = String(current.building || "").trim().toLowerCase();
  const b = String(candidate.building || "").trim().toLowerCase();
  if (a && a === b) score += 10;
  return score;
}

// Greedy nearest-neighbour by building match / address token overlap, run
// separately inside each distance tier so a "close" stop never gets shuffled
// behind a "far" one just because it happens to share a building.
export function optimizeRoute(stops) {
  const byTier = { 1: [], 2: [], 3: [] };
  stops.forEach((s) => {
    const tier = TIERS.some((t) => t.key === s.distanceTier) ? s.distanceTier : 2;
    byTier[tier].push(s);
  });

  const ordered = [];
  TIERS.forEach(({ key }) => {
    const pool = [...byTier[key]];
    if (pool.length === 0) return;
    let current = pool.shift();
    ordered.push(current);
    while (pool.length > 0) {
      let bestIdx = 0;
      let bestScore = -1;
      pool.forEach((candidate, idx) => {
        const score = stopScore(current, candidate);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = idx;
        }
      });
      current = pool.splice(bestIdx, 1)[0];
      ordered.push(current);
    }
  });
  return ordered;
}

// Building/floor/room rather than a street address: a boarding school's own
// hyper-local delivery unit is its dorm buildings, not house numbers. It also
// sharpens the same-location proxy in optimizeRoute — "same building" from a
// number the user actually typed is a stronger signal than word-overlap ever
// was on free text.
function composeAddress({ building, floor, room }) {
  const parts = [];
  if (building) parts.push(`בניין ${building}`);
  if (floor) parts.push(`קומה ${floor}`);
  if (room) parts.push(`חדר ${room}`);
  return parts.join(" · ");
}

function makeStop({ building, floor, room }, distanceTier) {
  return {
    id: uid(),
    building,
    floor,
    room,
    address: composeAddress({ building, floor, room }),
    distanceTier,
    done: false,
    createdAt: Date.now(),
  };
}

export default function DeliveryScreen() {
  const [stops, setStops] = usePersistentState(STORAGE_KEYS.deliveryStops, []);
  const [draftBuilding, setDraftBuilding] = useState("");
  const [draftFloor, setDraftFloor] = useState("");
  const [draftRoom, setDraftRoom] = useState("");
  const [draftTier, setDraftTier] = useState(2);

  const pending = useMemo(() => stops.filter((s) => !s.done), [stops]);
  const done = useMemo(() => stops.filter((s) => s.done), [stops]);

  const addStop = () => {
    const building = draftBuilding.trim();
    const floor = draftFloor.trim();
    const room = draftRoom.trim();
    if (!building) return;
    setStops((prev) => [...prev, makeStop({ building, floor, room }, draftTier)]);
    setDraftBuilding("");
    setDraftFloor("");
    setDraftRoom("");
    hapticSuccess();
  };

  const removeStop = (id) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
    hapticWarning();
  };

  const toggleDone = (id) => {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
    hapticLight();
  };

  const setTier = (id, tier) => {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, distanceTier: tier } : s)));
    hapticLight();
  };

  const autoSort = () => {
    // Only the pending stops get reordered — re-sorting a stop already
    // marked delivered would undo the one piece of state a deliverer relies
    // on mid-round.
    const sorted = optimizeRoute(pending);
    setStops([...sorted, ...done]);
    hapticSuccess();
  };

  const onDragEnd = ({ data }) => {
    // Scoped to the pending list for the same reason: writing the combined
    // array back could drop a stop below the "done" section without it
    // actually being marked delivered.
    setStops([...data, ...done]);
  };

  const renderStop = ({ item, drag, isActive }) => (
    <ScaleDecorator>
      <Animated.View
        entering={FadeIn}
        exiting={FadeOut}
        style={[st.stopRow, isActive && st.stopRowActive]}
      >
        <Bounce
          style={st.dragHandle}
          onPressIn={drag}
          testID={`stop-drag-${item.id}`}
          hitSlop={8}
        >
          <Icon name="menu" size={18} color={UI.inkMuted} />
        </Bounce>

        <View style={{ flex: 1 }}>
          <CustomText style={st.stopAddress} numberOfLines={2}>
            {item.address}
          </CustomText>
          <View style={st.tierRow}>
            {TIERS.map((t) => (
              <Bounce
                key={t.key}
                style={[
                  st.tierChip,
                  item.distanceTier === t.key && {
                    backgroundColor: tint(UI.cyan, 0.14),
                    borderColor: UI.cyan,
                  },
                ]}
                onPress={() => setTier(item.id, t.key)}
                testID={`stop-tier-${item.id}-${t.key}`}
              >
                <Icon
                  name={t.icon}
                  size={12}
                  color={item.distanceTier === t.key ? UI.cyan : UI.inkMuted}
                />
                <CustomText
                  style={[
                    st.tierChipText,
                    item.distanceTier === t.key && { color: UI.cyan },
                  ]}
                >
                  {t.label}
                </CustomText>
              </Bounce>
            ))}
          </View>
        </View>

        <Bounce style={st.doneBtn} onPress={() => toggleDone(item.id)} testID={`stop-done-${item.id}`}>
          <Icon name="check" size={18} color={UI.green} />
        </Bounce>
        <Bounce style={st.removeBtn} onPress={() => removeStop(item.id)} testID={`stop-remove-${item.id}`}>
          <Icon name="trash-2" size={18} color={UI.red} />
        </Bounce>
      </Animated.View>
    </ScaleDecorator>
  );

  return (
    <View style={st.wrap}>
      {/* Micro-location picker: building/floor/room, not a street address —
          the real unit of hyper-local delivery on campus. */}
      <View style={st.locationRow}>
        <TextInput
          value={draftBuilding}
          onChangeText={setDraftBuilding}
          placeholder="בניין"
          placeholderTextColor={UI.inkMuted}
          style={[st.input, st.locationInputWide]}
          returnKeyType="next"
          testID="delivery-input-building"
        />
        <TextInput
          value={draftFloor}
          onChangeText={setDraftFloor}
          placeholder="קומה"
          placeholderTextColor={UI.inkMuted}
          style={[st.input, st.locationInputNarrow]}
          keyboardType="number-pad"
          returnKeyType="next"
          testID="delivery-input-floor"
        />
        <TextInput
          value={draftRoom}
          onChangeText={setDraftRoom}
          placeholder="חדר"
          placeholderTextColor={UI.inkMuted}
          style={[st.input, st.locationInputNarrow]}
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={addStop}
          testID="delivery-input-room"
        />
        <Bounce
          style={[st.addBtn, !draftBuilding.trim() && { opacity: 0.4 }]}
          onPress={addStop}
          disabled={!draftBuilding.trim()}
          testID="delivery-add"
        >
          <Icon name="plus" size={20} color="#FFFFFF" />
        </Bounce>
      </View>

      <View style={st.tierPicker}>
        <CustomText style={st.tierPickerLabel}>מרחק מהמוקד לעצירה החדשה:</CustomText>
        <View style={st.tierRow}>
          {TIERS.map((t) => (
            <Bounce
              key={t.key}
              style={[
                st.tierChip,
                draftTier === t.key && { backgroundColor: tint(UI.cyan, 0.14), borderColor: UI.cyan },
              ]}
              onPress={() => setDraftTier(t.key)}
              testID={`draft-tier-${t.key}`}
            >
              <Icon name={t.icon} size={12} color={draftTier === t.key ? UI.cyan : UI.inkMuted} />
              <CustomText style={[st.tierChipText, draftTier === t.key && { color: UI.cyan }]}>
                {t.label}
              </CustomText>
            </Bounce>
          ))}
        </View>
      </View>

      <View style={st.sortRow}>
        <CustomText style={st.sortHint}>
          {pending.length} עצירות ממתינות — גררו לסידור ידני, או מיינו לפי מרחק ורחוב
        </CustomText>
        <Bounce
          style={[st.sortBtn, pending.length < 2 && { opacity: 0.4 }]}
          onPress={autoSort}
          disabled={pending.length < 2}
          testID="delivery-autosort"
        >
          <Icon name="shuffle" size={16} color="#FFFFFF" />
          <CustomText style={st.sortBtnText}>מיין מסלול</CustomText>
        </Bounce>
      </View>

      {pending.length === 0 ? (
        <View style={st.empty}>
          <Icon name="map" size={28} color={UI.inkMuted} />
          <CustomText style={st.emptyText}>הוסיפו כתובת כדי להתחיל את סבב ההפצה</CustomText>
        </View>
      ) : (
        <DraggableFlatList
          testID="delivery-list"
          data={pending}
          keyExtractor={(item) => item.id}
          renderItem={renderStop}
          onDragEnd={onDragEnd}
          activationDistance={8}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}

      {done.length > 0 && (
        <View style={st.doneSection}>
          <CustomText style={st.doneHead}>נמסרו ({done.length})</CustomText>
          {done.map((item) => (
            <View key={item.id} style={st.doneRow}>
              <Icon name="check-circle" size={16} color={UI.green} />
              <CustomText style={st.doneText} numberOfLines={1}>
                {item.address}
              </CustomText>
              <Bounce onPress={() => toggleDone(item.id)} testID={`stop-undo-${item.id}`} hitSlop={8}>
                <Icon name="rotate-ccw" size={16} color={UI.inkMuted} />
              </Bounce>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: UI.bg, padding: 16 },
  locationRow: { flexDirection: ROW, gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    // Without this, three text inputs sharing a row never shrink below their
    // own content width on web — flexbox's default min-width is "auto", not
    // 0 — so the row silently overflows the screen instead of compressing.
    minWidth: 0,
    backgroundColor: UI.surface,
    borderRadius: UI.radiusSm,
    borderWidth: 1,
    borderColor: UI.hairline,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontFamily: FONTS.regular,
    fontSize: 14.5,
    color: UI.ink,
    textAlign: "right",
  },
  locationInputWide: { flex: 1.4 },
  locationInputNarrow: { flex: 0.8, textAlign: "center", paddingHorizontal: 6 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  tierPicker: { marginBottom: 12 },
  tierPickerLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12.5,
    color: UI.inkMuted,
    textAlign: "right",
    marginBottom: 6,
  },
  tierRow: { flexDirection: ROW, gap: 8, marginTop: 4 },
  tierChip: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: UI.hairline,
    backgroundColor: UI.surface,
  },
  tierChipText: { fontFamily: FONTS.medium, fontSize: 12, color: UI.inkMuted },
  sortRow: {
    flexDirection: ROW,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  sortHint: { flex: 1, fontFamily: FONTS.regular, fontSize: 12, color: UI.inkMuted, textAlign: "right" },
  sortBtn: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 6,
    backgroundColor: UI.cyan,
    borderRadius: UI.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sortBtnText: { fontFamily: FONTS.medium, fontSize: 12.5, color: "#FFFFFF" },
  stopRow: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 10,
    backgroundColor: UI.surface,
    borderRadius: UI.radius,
    padding: 12,
    marginBottom: 8,
    ...BEVEL,
    ...CARD_SHADOW,
  },
  stopRowActive: { backgroundColor: tint(UI.cyan, 0.08) },
  dragHandle: { padding: 4 },
  stopAddress: { fontFamily: FONTS.medium, fontSize: 14.5, color: UI.ink, textAlign: "right" },
  doneBtn: { padding: 6 },
  removeBtn: { padding: 6 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13.5, color: UI.inkMuted, textAlign: "center" },
  doneSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: UI.hairline, paddingTop: 10 },
  doneHead: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: UI.inkMuted,
    textAlign: "right",
    marginBottom: 6,
  },
  doneRow: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  doneText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: UI.inkMuted,
    textAlign: "right",
    textDecorationLine: "line-through",
  },
});
