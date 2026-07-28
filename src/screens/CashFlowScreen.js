import { useMemo, useState } from "react";
import { I18nManager, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import CustomText from "../components/CustomText";
import FlowAnimation from "../components/FlowAnimation";
import Icon from "../components/Icon";
import { Canvas, Card, GradCard } from "../components/Paper";
import { useMoney } from "../context/MoneyContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { shekel } from "../utils/posStore";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { usePersistentState } from "../utils/usePersistentState";
import { BEVEL, GRAD, TYPE, UI, glow, tint } from "../utils/ui";

// תזרים מזומנים — the operating view of the micro-businesses.
//
// The savings area answers "what do I have". This answers the harder question:
// "is what I am doing actually making money, and when does it pay itself
// back". Those need different numbers — savings tracks stock, this tracks
// flow — which is why it is a separate screen rather than another tab in the
// savings pager.
//
// Every figure below is derived from entries the user logged. Nothing is
// seeded with plausible-looking demo data: a dashboard whose numbers might be
// invented is worse than an empty one, because you cannot tell by looking
// which ones to trust.

const CATEGORIES = [
  { key: "vending", label: "מכונות", icon: "package", tone: UI.violet },
  { key: "imports", label: "ייבוא", icon: "truck", tone: UI.cyan },
  { key: "service", label: "שירות", icon: "tool", tone: UI.green },
  { key: "other", label: "אחר", icon: "grid", tone: UI.amber },
];

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function monthsBack(entries, n) {
  const now = Date.now();
  return entries.filter((e) => now - (e.at || 0) <= n * MONTH_MS);
}

export default function CashFlowScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { netWorth } = useMoney();
  const [entries, setEntries] = usePersistentState(STORAGE_KEYS.cashFlow, []);

  const [kind, setKind] = useState("income");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("vending");
  const [showAdd, setShowAdd] = useState(false);

  const list = entries || [];

  const stats = useMemo(() => {
    const month = monthsBack(list, 1);
    const sum = (rows, k) =>
      rows.filter((e) => e.kind === k).reduce((n, e) => n + (Number(e.amount) || 0), 0);

    const income = sum(month, "income");
    const expense = sum(month, "expense");
    const net = income - expense;

    const allIncome = sum(list, "income");
    const allExpense = sum(list, "expense");

    // ROI over everything logged. Guarded: with nothing spent there is no
    // return to express as a ratio, and 0/0 rendering as "Infinity%" on a
    // financial dashboard is worse than an honest dash.
    const roi = allExpense > 0 ? ((allIncome - allExpense) / allExpense) * 100 : null;

    // Runway: at the current monthly burn, how long what you hold lasts.
    const burn = expense - income;
    const runwayMonths = burn > 0 && netWorth > 0 ? netWorth / burn : null;

    // Break-even projection on the current month's net. Only meaningful while
    // still underwater overall.
    const deficit = allExpense - allIncome;
    const monthsToBreakEven = deficit > 0 && net > 0 ? Math.ceil(deficit / net) : null;

    const byCategory = CATEGORIES.map((c) => {
      const rows = month.filter((e) => e.category === c.key);
      return {
        ...c,
        income: sum(rows, "income"),
        expense: sum(rows, "expense"),
        net: sum(rows, "income") - sum(rows, "expense"),
      };
    }).filter((c) => c.income || c.expense);

    return { income, expense, net, allIncome, allExpense, roi, runwayMonths, monthsToBreakEven, byCategory, count: list.length };
  }, [list, netWorth]);

  const add = () => {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      hapticWarning();
      return;
    }
    hapticSuccess();
    setEntries((prev) => [
      { id: `e-${Date.now()}`, at: Date.now(), kind, amount: value, label: label.trim() || null, category },
      ...(prev || []),
    ]);
    setAmount("");
    setLabel("");
    setShowAdd(false);
  };

  const remove = (id) => {
    hapticLight();
    setEntries((prev) => (prev || []).filter((e) => e.id !== id));
  };

  const positive = stats.net >= 0;

  return (
    <Canvas testID="cashflow-screen" aurora>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 130 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <CustomText weight="bold" style={s.title}>תזרים מזומנים</CustomText>
            <CustomText style={s.subtitle}>30 הימים האחרונים</CustomText>
          </View>
          <Bounce testID="cf-add-toggle" style={s.addBtn} scaleTo={0.92} onPress={() => { hapticLight(); setShowAdd((v) => !v); }}>
            <Icon name={showAdd ? "x" : "plus"} size={20} color={UI.violet} />
          </Bounce>
        </View>

        {/* Headline: net flow, with the animation reflecting its state. */}
        <Animated.View entering={FadeInDown.springify().damping(14)}>
          <GradCard
            colors={positive ? GRAD.green : GRAD.coral}
            halo={positive ? UI.green : UI.coral}
            radius={28}
            style={s.heroWrap}
          >
            <View style={s.hero}>
              <FlowAnimation state={positive ? "positive" : "negative"} style={s.heroArt} />
              <CustomText style={s.heroLabel}>{positive ? "תזרים חיובי" : "תזרים שלילי"}</CustomText>
              <CustomText weight="bold" testID="cf-net" style={s.heroValue}>
                {positive ? "+" : "−"}{shekel(Math.abs(stats.net))}
              </CustomText>
              <View style={s.heroRow}>
                <Slice label="הכנסות" value={stats.income} />
                <View style={s.heroDivider} />
                <Slice label="הוצאות" value={stats.expense} />
              </View>
            </View>
          </GradCard>
        </Animated.View>

        {/* Add an entry */}
        {showAdd && (
          <Animated.View entering={FadeIn.duration(200)} layout={LinearTransition}>
            <Card style={s.addCard}>
              <View style={s.addInner}>
                <View style={s.kindRow}>
                  {[
                    { k: "income", label: "הכנסה", tone: UI.green },
                    { k: "expense", label: "הוצאה", tone: UI.coral },
                  ].map((o) => (
                    <Bounce
                      key={o.k}
                      testID={`cf-kind-${o.k}`}
                      style={[s.kindBtn, kind === o.k && { backgroundColor: tint(o.tone, 0.14) }]}
                      scaleTo={0.95}
                      onPress={() => { hapticLight(); setKind(o.k); }}
                    >
                      <CustomText
                        weight="bold"
                        style={[s.kindText, kind === o.k && { color: o.tone }]}
                      >
                        {o.label}
                      </CustomText>
                    </Bounce>
                  ))}
                </View>

                <TextInput
                  testID="cf-amount"
                  style={s.input}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="סכום ₪"
                  placeholderTextColor={UI.inkMuted}
                  keyboardType="numeric"
                  textAlign="center"
                />
                <TextInput
                  testID="cf-label"
                  style={s.input}
                  value={label}
                  onChangeText={setLabel}
                  placeholder="על מה? (לא חובה)"
                  placeholderTextColor={UI.inkMuted}
                  textAlign="right"
                />

                <View style={s.catRow}>
                  {CATEGORIES.map((c) => (
                    <Bounce
                      key={c.key}
                      testID={`cf-cat-${c.key}`}
                      style={[s.catBtn, category === c.key && { backgroundColor: tint(c.tone, 0.14) }]}
                      scaleTo={0.94}
                      onPress={() => { hapticLight(); setCategory(c.key); }}
                    >
                      <Icon name={c.icon} size={15} color={category === c.key ? c.tone : UI.inkMuted} />
                      <CustomText style={[s.catText, category === c.key && { color: c.tone }]}>
                        {c.label}
                      </CustomText>
                    </Bounce>
                  ))}
                </View>

                <Bounce testID="cf-save" style={s.saveBtn} scaleTo={0.96} onPress={add}>
                  <LinearGradient colors={GRAD.violet} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.saveInner}>
                    <Icon name="check" size={17} color="#FFFFFF" />
                    <CustomText weight="bold" style={s.saveText}>הוסף</CustomText>
                  </LinearGradient>
                </Bounce>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Projections */}
        <View style={s.metrics}>
          <Metric
            testID="cf-roi"
            icon="trending-up"
            label="ROI מצטבר"
            value={stats.roi === null ? "—" : `${stats.roi > 0 ? "+" : ""}${stats.roi.toFixed(0)}%`}
            hint={stats.roi === null ? "טרם נרשמו הוצאות" : `על ${shekel(stats.allExpense)} שהושקעו`}
            tone={stats.roi === null ? UI.inkMuted : stats.roi >= 0 ? UI.green : UI.coral}
          />
          <Metric
            testID="cf-runway"
            icon="clock"
            label="מסלול הישרדות"
            value={stats.runwayMonths === null ? "—" : `${stats.runwayMonths.toFixed(1)} ח׳`}
            hint={stats.runwayMonths === null ? "אין שריפה חודשית" : "לפי הקצב הנוכחי"}
            tone={UI.violet}
          />
          <Metric
            testID="cf-breakeven"
            icon="target"
            label="החזר השקעה"
            value={stats.monthsToBreakEven === null ? "—" : `${stats.monthsToBreakEven} ח׳`}
            hint={stats.monthsToBreakEven === null ? (stats.allIncome >= stats.allExpense ? "כבר בהחזר" : "צריך תזרים חיובי") : "עד איזון"}
            tone={UI.cyan}
          />
          <Metric
            testID="cf-entries"
            icon="list"
            label="רשומות"
            value={String(stats.count)}
            hint="סה״כ שנרשמו"
            tone={UI.amber}
          />
        </View>

        {/* Per business line */}
        {stats.byCategory.length > 0 && (
          <>
            <CustomText weight="bold" style={s.sectionHead}>לפי ענף</CustomText>
            <View style={s.cats}>
              {stats.byCategory.map((c, i) => {
                const total = c.income + c.expense || 1;
                return (
                  <Animated.View key={c.key} entering={FadeInDown.delay(i * 60).springify().damping(14)}>
                    <Card style={s.catCard} radius={UI.radiusSm}>
                      <View style={s.catCardInner}>
                        <View style={s.catHead}>
                          <View style={[s.catBadge, { backgroundColor: tint(c.tone, 0.14) }]}>
                            <Icon name={c.icon} size={17} color={c.tone} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <CustomText weight="bold" style={s.catName}>{c.label}</CustomText>
                            <CustomText style={s.catMeta}>
                              {shekel(c.income)} נכנס · {shekel(c.expense)} יצא
                            </CustomText>
                          </View>
                          <CustomText
                            weight="bold"
                            style={[s.catNet, { color: c.net >= 0 ? UI.green : UI.coral }]}
                          >
                            {c.net >= 0 ? "+" : "−"}{shekel(Math.abs(c.net))}
                          </CustomText>
                        </View>
                        {/* Income against expense on one bar, so the split is
                            readable without a legend. */}
                        <View style={s.splitTrack}>
                          <View style={[s.splitIn, { flex: c.income / total, backgroundColor: UI.green }]} />
                          <View style={[s.splitOut, { flex: c.expense / total, backgroundColor: UI.coral }]} />
                        </View>
                      </View>
                    </Card>
                  </Animated.View>
                );
              })}
            </View>
          </>
        )}

        {/* Ledger */}
        <View style={s.headRow}>
          <Bounce testID="cf-ask-noa" style={s.askBtn} scaleTo={0.94} onPress={() => {
            hapticLight();
            navigation?.navigate("Main", { screen: "Assistant" });
          }}>
            <Icon name="message-circle" size={14} color={UI.violet} />
            <CustomText weight="bold" style={s.askText}>שאל את נועה</CustomText>
          </Bounce>
          <CustomText weight="bold" style={s.sectionHeadFlush}>תנועות</CustomText>
        </View>

        {list.length === 0 ? (
          <View style={s.empty}>
            <Icon name="bar-chart-2" size={26} color={UI.inkMuted} />
            <CustomText style={s.emptyText}>עוד לא נרשמו תנועות</CustomText>
            <CustomText style={s.emptyHint}>הקש על ＋ כדי לרשום הכנסה או הוצאה</CustomText>
          </View>
        ) : (
          <View style={s.ledger}>
            {list.slice(0, 30).map((e, i) => {
              const cat = CATEGORIES.find((c) => c.key === e.category) || CATEGORIES[3];
              const inflow = e.kind === "income";
              return (
                <Animated.View
                  key={e.id}
                  entering={FadeInDown.delay(Math.min(i * 40, 240)).springify().damping(15)}
                  layout={LinearTransition.springify().damping(15)}
                >
                  <Card style={s.row} radius={UI.radiusSm}>
                    <View style={s.rowInner}>
                      <Bounce testID={`cf-del-${e.id}`} style={s.delBtn} scaleTo={0.9} onPress={() => remove(e.id)}>
                        <Icon name="trash-2" size={14} color={UI.inkMuted} />
                      </Bounce>
                      <View style={{ flex: 1 }}>
                        <CustomText weight="bold" style={s.rowLabel}>
                          {e.label || cat.label}
                        </CustomText>
                        <CustomText style={s.rowMeta}>
                          {cat.label} · {new Date(e.at).toLocaleDateString("he-IL")}
                        </CustomText>
                      </View>
                      <CustomText
                        weight="bold"
                        style={[s.rowAmount, { color: inflow ? UI.green : UI.coral }]}
                      >
                        {inflow ? "+" : "−"}{shekel(e.amount)}
                      </CustomText>
                    </View>
                  </Card>
                </Animated.View>
              );
            })}
          </View>
        )}

        <CustomText style={s.footnote}>
          כל המספרים כאן מחושבים מהתנועות שרשמת. אין נתוני הדגמה — מסך שאי אפשר לדעת אילו מספרים בו
          אמיתיים גרוע ממסך ריק.
        </CustomText>
      </ScrollView>
    </Canvas>
  );
}

function Slice({ label, value }) {
  return (
    <View style={s.slice}>
      <CustomText weight="bold" style={s.sliceValue}>{shekel(value)}</CustomText>
      <CustomText style={s.sliceLabel}>{label}</CustomText>
    </View>
  );
}

function Metric({ icon, label, value, hint, tone, testID }) {
  return (
    <View style={s.metricWrap}>
      <Card radius={UI.radiusSm}>
        <View style={s.metric}>
          <View style={[s.metricBadge, { backgroundColor: tint(tone, 0.14) }]}>
            <Icon name={icon} size={15} color={tone} />
          </View>
          <CustomText weight="bold" testID={testID} style={[s.metricValue, { color: tone }]}>
            {value}
          </CustomText>
          <CustomText style={s.metricLabel}>{label}</CustomText>
          <CustomText style={s.metricHint} numberOfLines={1}>{hint}</CustomText>
        </View>
      </Card>
    </View>
  );
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({
  header: { flexDirection: ROW, alignItems: "center", gap: 12, paddingHorizontal: UI.cardMarginH, paddingBottom: 14 },
  title: { fontSize: TYPE.hero, color: UI.ink, textAlign: "right" },
  subtitle: { fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  addBtn: {
    width: 46, height: 46, borderRadius: 16,
    backgroundColor: tint(UI.violet, 0.12),
    alignItems: "center", justifyContent: "center", ...BEVEL,
  },

  heroWrap: { marginHorizontal: UI.cardMarginH, marginBottom: 14 },
  hero: { paddingVertical: 22, paddingHorizontal: 20, alignItems: "center", overflow: "hidden" },
  heroArt: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  heroLabel: { fontSize: 12.5, color: "rgba(255,255,255,0.85)" },
  heroValue: {
    fontSize: 40, color: "#FFFFFF", marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.3)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 14 },
  heroDivider: { width: 1, height: 26, backgroundColor: "rgba(255,255,255,0.28)" },
  slice: { alignItems: "center" },
  sliceValue: { fontSize: 14, color: "#FFFFFF" },
  sliceLabel: { fontSize: 10.5, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  addCard: { marginHorizontal: UI.cardMarginH, marginBottom: 14 },
  addInner: { padding: UI.cardPadding, gap: 10 },
  kindRow: { flexDirection: ROW, gap: 8 },
  kindBtn: {
    flex: 1, minHeight: 46, borderRadius: UI.radiusSm,
    alignItems: "center", justifyContent: "center",
    backgroundColor: UI.surfaceAlt, ...BEVEL,
  },
  kindText: { fontSize: 14, color: UI.inkSoft },
  input: {
    minHeight: 50, borderRadius: UI.radiusSm, backgroundColor: UI.surfaceAlt,
    paddingHorizontal: 14, fontSize: 15, color: UI.ink, ...BEVEL,
  },
  catRow: { flexDirection: ROW, gap: 6, flexWrap: "wrap" },
  catBtn: {
    flexDirection: ROW, alignItems: "center", gap: 5,
    paddingHorizontal: 10, minHeight: 38, borderRadius: UI.radiusSm,
    backgroundColor: UI.surfaceAlt, ...BEVEL,
  },
  catText: { fontSize: 11.5, color: UI.inkMuted },
  saveBtn: { borderRadius: UI.radiusSm, ...glow(UI.violet, 0.28) },
  saveInner: {
    flexDirection: ROW, alignItems: "center", justifyContent: "center",
    gap: 8, minHeight: 50, borderRadius: UI.radiusSm,
  },
  saveText: { fontSize: 15, color: "#FFFFFF" },

  metrics: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
    paddingHorizontal: UI.cardMarginH, justifyContent: "center",
  },
  metricWrap: { width: "47.5%" },
  metric: { padding: 14, gap: 4 },
  metricBadge: { width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  metricValue: { fontSize: 20, textAlign: "right", marginTop: 4 },
  metricLabel: { fontSize: 11.5, color: UI.inkSoft, textAlign: "right" },
  metricHint: { fontSize: 10, color: UI.inkMuted, textAlign: "right" },

  sectionHead: {
    fontSize: TYPE.section, color: UI.ink, textAlign: "right",
    paddingHorizontal: UI.cardMarginH, marginTop: 24, marginBottom: 10,
  },
  sectionHeadFlush: { fontSize: TYPE.section, color: UI.ink, textAlign: "right" },
  headRow: {
    flexDirection: ROW, alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: UI.cardMarginH, marginTop: 24, marginBottom: 10,
  },
  askBtn: {
    flexDirection: ROW, alignItems: "center", gap: 6,
    paddingHorizontal: 12, minHeight: 34, borderRadius: UI.radiusSm,
    backgroundColor: tint(UI.violet, 0.1),
  },
  askText: { fontSize: 12, color: UI.violet },

  cats: { paddingHorizontal: UI.cardMarginH, gap: 10 },
  catCard: {},
  catCardInner: { padding: 14, gap: 10 },
  catHead: { flexDirection: ROW, alignItems: "center", gap: 10 },
  catBadge: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  catName: { fontSize: 14.5, color: UI.ink, textAlign: "right" },
  catMeta: { fontSize: 11, color: UI.inkMuted, textAlign: "right", marginTop: 1 },
  catNet: { fontSize: 15 },
  splitTrack: { flexDirection: "row", height: 7, borderRadius: 4, overflow: "hidden", backgroundColor: UI.surfaceHi },
  splitIn: { height: "100%" },
  splitOut: { height: "100%" },

  ledger: { paddingHorizontal: UI.cardMarginH, gap: 8 },
  row: {},
  rowInner: { flexDirection: ROW, alignItems: "center", gap: 10, padding: 12 },
  delBtn: {
    width: 30, height: 30, borderRadius: 11,
    backgroundColor: UI.surfaceAlt, alignItems: "center", justifyContent: "center",
  },
  rowLabel: { fontSize: 14, color: UI.ink, textAlign: "right" },
  rowMeta: { fontSize: 10.5, color: UI.inkMuted, textAlign: "right", marginTop: 1 },
  rowAmount: { fontSize: 15 },

  empty: { alignItems: "center", gap: 6, paddingVertical: 44 },
  emptyText: { fontSize: 15, color: UI.inkSoft, marginTop: 8 },
  emptyHint: { fontSize: 12.5, color: UI.inkMuted },

  footnote: {
    fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "center",
    paddingHorizontal: 30, lineHeight: 19, marginTop: 24,
  },
});
