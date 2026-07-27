import { useState } from "react";
import { I18nManager, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";

import Bounce from "../../components/Bounce";
import Icon from "../../components/Icon";
import { useMoney } from "../../context/MoneyContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { shekel } from "../../utils/posStore";
import { CARD_SHADOW, TYPE, UI } from "../../utils/ui";

// החשבון שלי — one liquid balance on top, and named funds under it that the
// liquid balance can be moved into.

const QUICK = [50, 100, 250];

export default function AccountScreen() {
  const { liquid, deposits, totalDeposited, netWorth, toDeposit, fromDeposit, addDeposit, removeDeposit } = useMoney();
  const [openId, setOpenId] = useState(null);
  const [custom, setCustom] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState(null);

  const say = (t) => {
    setFlash(t);
    setTimeout(() => setFlash(null), 2000);
  };

  const move = (depositId, amount) => {
    const moved = toDeposit(depositId, amount);
    if (!moved) {
      hapticWarning();
      say("אין מספיק יתרה נזילה");
      return;
    }
    hapticSuccess();
    say(`${shekel(moved)} הועברו לקרן`);
    setCustom("");
  };

  const take = (depositId, amount) => {
    const moved = fromDeposit(depositId, amount);
    if (!moved) {
      hapticWarning();
      return;
    }
    hapticLight();
    say(`${shekel(moved)} חזרו ליתרה הנזילה`);
  };

  const createDeposit = () => {
    const label = newLabel.trim();
    const target = parseFloat(newTarget);
    if (!label || !Number.isFinite(target) || target <= 0) {
      hapticWarning();
      return;
    }
    hapticSuccess();
    addDeposit(label, target);
    setNewLabel("");
    setNewTarget("");
    setAdding(false);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Liquid balance */}
      <View style={s.hero}>
        <Text style={s.heroLabel}>יתרה נזילה</Text>
        <Text testID="account-liquid" style={s.heroValue}>{shekel(liquid)}</Text>
        <View style={s.heroMetaRow}>
          <View style={s.heroMeta}>
            <Text style={s.heroMetaValue}>{shekel(totalDeposited)}</Text>
            <Text style={s.heroMetaLabel}>בקרנות</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroMeta}>
            <Text testID="account-networth" style={s.heroMetaValue}>{shekel(netWorth)}</Text>
            <Text style={s.heroMetaLabel}>סה״כ ברשותי</Text>
          </View>
        </View>
      </View>

      {!!flash && (
        <Animated.View entering={FadeIn.duration(200)} style={s.flash}>
          <Text style={s.flashText}>{flash}</Text>
        </Animated.View>
      )}

      <View style={s.headRow}>
        <Bounce style={s.addBtn} scaleTo={0.92} onPress={() => { hapticLight(); setAdding((v) => !v); }}>
          <Icon name={adding ? "x" : "plus"} size={17} color={UI.violet} />
        </Bounce>
        <Text style={s.sectionHead}>הפקדונות שלי</Text>
      </View>

      {adding && (
        <Animated.View entering={FadeIn.duration(200)} layout={LinearTransition} style={s.newCard}>
          <TextInput
            style={s.input}
            value={newLabel}
            onChangeText={setNewLabel}
            placeholder="שם הקרן"
            placeholderTextColor={UI.inkMuted}
            textAlign="right"
          />
          <View style={s.newRow}>
            <Bounce style={s.createBtn} scaleTo={0.94} onPress={createDeposit}>
              <Icon name="check" size={17} color="#FFFFFF" />
            </Bounce>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={newTarget}
              onChangeText={setNewTarget}
              placeholder="יעד ₪"
              placeholderTextColor={UI.inkMuted}
              keyboardType="numeric"
              textAlign="center"
            />
          </View>
        </Animated.View>
      )}

      {deposits.length === 0 && !adding && (
        <View style={s.empty}>
          <Icon name="target" size={26} color={UI.inkMuted} />
          <Text style={s.emptyText}>אין קרנות עדיין. הוסף אחת עם ה-＋</Text>
        </View>
      )}

      {deposits.map((d, index) => {
        const saved = d.saved || 0;
        const pct = d.target > 0 ? Math.min(100, Math.round((saved / d.target) * 100)) : 0;
        const isOpen = openId === d.id;
        const full = saved >= d.target;
        return (
          <Animated.View
            key={d.id}
            entering={FadeInDown.delay(Math.min(index * 80, 320)).springify().damping(14)}
            layout={LinearTransition.springify().damping(14)}
            style={s.card}
          >
            <Bounce
              style={s.cardHead}
              scaleTo={0.98}
              onPress={() => { hapticLight(); setOpenId(isOpen ? null : d.id); }}
            >
              <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={17} color={UI.inkMuted} />
              <View style={{ flex: 1 }}>
                <Text style={s.cardLabel}>{d.label}</Text>
                <Text style={s.cardMeta}>
                  {shekel(saved)} מתוך {shekel(d.target)}
                </Text>
              </View>
              <View style={[s.cardBadge, full && { backgroundColor: UI.green + "1A" }]}>
                <Icon name={d.icon || "target"} size={19} color={full ? UI.green : UI.violet} />
              </View>
            </Bounce>

            <View style={s.track}>
              <View
                testID={`deposit-bar-${d.id}`}
                style={[s.fill, { width: `${pct}%`, backgroundColor: full ? UI.green : UI.violet }]}
              />
            </View>
            <Text style={[s.pct, full && { color: UI.green }]}>{pct}%</Text>

            {isOpen && (
              <Animated.View entering={FadeIn.duration(200)} layout={LinearTransition} style={s.actions}>
                <View style={s.quickRow}>
                  {QUICK.map((amount) => (
                    <Bounce
                      key={amount}
                      testID={`fund-${d.id}-${amount}`}
                      style={s.quickBtn}
                      scaleTo={0.93}
                      onPress={() => move(d.id, amount)}
                    >
                      <Text style={s.quickText}>+{amount}</Text>
                    </Bounce>
                  ))}
                  <Bounce
                    testID={`fund-${d.id}-all`}
                    style={[s.quickBtn, { backgroundColor: UI.violet }]}
                    scaleTo={0.93}
                    onPress={() => move(d.id, liquid)}
                  >
                    <Text style={[s.quickText, { color: "#FFFFFF" }]}>הכול</Text>
                  </Bounce>
                </View>

                <View style={s.customRow}>
                  <Bounce
                    style={s.customBtn}
                    scaleTo={0.93}
                    onPress={() => move(d.id, parseFloat(custom) || 0)}
                  >
                    <Icon name="arrow-left" size={16} color="#FFFFFF" />
                  </Bounce>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={custom}
                    onChangeText={setCustom}
                    placeholder="סכום אחר"
                    placeholderTextColor={UI.inkMuted}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                </View>

                <View style={s.footRow}>
                  <Bounce style={s.footBtn} scaleTo={0.95} onPress={() => take(d.id, saved)}>
                    <Icon name="corner-up-left" size={15} color={UI.inkSoft} />
                    <Text style={s.footText}>משוך הכול</Text>
                  </Bounce>
                  <Bounce
                    style={s.footBtn}
                    scaleTo={0.95}
                    onPress={() => { hapticWarning(); removeDeposit(d.id); setOpenId(null); }}
                  >
                    <Icon name="trash-2" size={15} color={UI.coral} />
                    <Text style={[s.footText, { color: UI.coral }]}>סגור קרן</Text>
                  </Bounce>
                </View>
              </Animated.View>
            )}
          </Animated.View>
        );
      })}

      <Text style={s.hint}>
        סגירת קרן מחזירה את מה שנצבר בה ליתרה הנזילה ולא מוחקת אותו. הכסף עובר בין המקומות ואינו נוצר
        או נעלם — לכן הסכום הכולל למעלה נשאר נכון.
      </Text>
    </ScrollView>
  );
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },
  content: { paddingBottom: 120, paddingTop: 14 },

  hero: {
    backgroundColor: UI.ink,
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginHorizontal: UI.cardMarginH,
    alignItems: "center",
    gap: 3,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 7,
  },
  heroLabel: { fontFamily: FONTS.medium, fontSize: 13, color: "rgba(255,255,255,0.7)" },
  heroValue: { fontFamily: FONTS.bold, fontSize: 40, color: "#FFFFFF" },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 12 },
  heroMeta: { alignItems: "center" },
  heroMetaValue: { fontFamily: FONTS.bold, fontSize: 15, color: "rgba(255,255,255,0.95)" },
  heroMetaLabel: { fontFamily: FONTS.regular, fontSize: 10.5, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  heroDivider: { width: 1, height: 26, backgroundColor: "rgba(255,255,255,0.18)" },

  flash: {
    alignSelf: "center",
    backgroundColor: UI.ink,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 12,
  },
  flashText: { fontFamily: FONTS.semibold, fontSize: 13, color: "#FFFFFF" },

  headRow: {
    flexDirection: ROW,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: UI.cardMarginH,
    marginTop: 22,
    marginBottom: 10,
  },
  sectionHead: { fontFamily: FONTS.bold, fontSize: TYPE.section, color: UI.ink, textAlign: "right" },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: UI.violet + "14",
    alignItems: "center",
    justifyContent: "center",
  },

  newCard: {
    backgroundColor: UI.surface,
    borderRadius: UI.radius,
    padding: UI.cardPadding,
    marginHorizontal: UI.cardMarginH,
    marginBottom: 12,
    gap: 10,
    ...CARD_SHADOW,
  },
  newRow: { flexDirection: ROW, gap: 10, alignItems: "center" },
  createBtn: {
    width: 50,
    height: 50,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: 50,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.surfaceAlt,
    paddingHorizontal: 14,
    fontFamily: FONTS.semibold,
    fontSize: 15,
    color: UI.ink,
  },

  empty: { alignItems: "center", gap: 8, paddingVertical: 26 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: UI.inkMuted },

  card: {
    backgroundColor: UI.surface,
    borderRadius: UI.radius,
    padding: UI.cardPadding,
    marginHorizontal: UI.cardMarginH,
    marginBottom: UI.cardMarginB,
    ...CARD_SHADOW,
  },
  cardHead: { flexDirection: ROW, alignItems: "center", gap: 12 },
  cardLabel: { fontFamily: FONTS.bold, fontSize: TYPE.title, color: UI.ink, textAlign: "right" },
  cardMeta: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  cardBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: UI.violet + "14",
    alignItems: "center",
    justifyContent: "center",
  },

  track: { height: 10, borderRadius: 5, backgroundColor: UI.surfaceAlt, overflow: "hidden", marginTop: 14 },
  fill: { height: "100%", borderRadius: 5 },
  pct: { fontFamily: FONTS.bold, fontSize: 12, color: UI.violet, textAlign: "left", marginTop: 5 },

  actions: { gap: 10, marginTop: 14, borderTopWidth: 1, borderTopColor: UI.hairline, paddingTop: 14 },
  quickRow: { flexDirection: ROW, gap: 8 },
  quickBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: { fontFamily: FONTS.bold, fontSize: 13.5, color: UI.inkSoft },
  customRow: { flexDirection: ROW, gap: 8, alignItems: "center" },
  customBtn: {
    width: 50,
    height: 50,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  footRow: { flexDirection: ROW, gap: 8 },
  footBtn: {
    flex: 1,
    flexDirection: ROW,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 44,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.surfaceAlt,
  },
  footText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: UI.inkSoft },

  hint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.caption,
    color: UI.inkMuted,
    textAlign: "center",
    paddingHorizontal: 30,
    lineHeight: 19,
    marginTop: 12,
  },
});
