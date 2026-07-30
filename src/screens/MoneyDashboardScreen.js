import { useCallback, useMemo, useState } from "react";
import { I18nManager, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import DroneGoalIcon from "../components/money/DroneGoalIcon";
import ProfitAllocationCard from "../components/money/ProfitAllocationCard";
import CustomText from "../components/CustomText";
import Icon from "../components/Icon";
import RiveVault from "../components/money/RiveVault";
import { Canvas } from "../components/Paper";
import { hapticHeavy, hapticLight, hapticSuccess } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { shekel } from "../utils/posStore";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { usePersistentState } from "../utils/usePersistentState";
import { BEVEL, CARD_SHADOW, GRAD, TYPE, UI, tint } from "../utils/ui";

// הכסף שלי — the financial dashboard.
//
// One number at the top, three decisions under it, one sentence of advice, and
// the log everything came from. That order is deliberate: a dashboard that
// leads with a table makes you do the arithmetic yourself, and the arithmetic
// is the whole product.
//
// Every figure is derived from what was actually logged — POS sales carry
// their own cost, and the manual cash-flow entries carry theirs. Nothing here
// is seeded with plausible demo data, because a dashboard whose numbers might
// be invented is worse than an empty one: you cannot tell by looking which
// ones to trust.
//
// Sales are read rather than written, so this reads the store directly instead
// of mounting a second BusinessProvider. Two providers on one key would each
// hold their own copy in memory and quietly disagree.

// How net profit is divided. Stated on the cards themselves rather than
// applied invisibly — a bucket that shows a number without saying where the
// number came from is a number nobody can act on.
const SPLIT = { buying: 0.4, withdraw: 0.4, goal: 0.2 };

const DEFAULT_GOAL = { name: "רחפן DJI", target: 2500 };

// A rough per-sale profit for the time machine slider — not a real average
// pulled from the log, just a plausible planning number so dragging the
// slider gives an order-of-magnitude feel for "what if I sell N more".
const AVG_PROFIT_PER_SALE = 20;

/**
 * Noa's read on the slider position, entirely local — no model call. Three
 * bands, exact copy, so the bubble updates the instant the thumb moves
 * instead of waiting on a round trip for text that would be the same three
 * sentences anyway.
 */
function timeMachineInsight(futureSales) {
  if (futureSales <= 20) {
    return "צמיחה בטוחה ויציבה. הרחפן מתקרב לאט אבל בטוח.";
  }
  if (futureSales <= 60) {
    return "קצב אש! בנקודת המכירות הזו אתה מתחיל לשבור שיאים.";
  }
  return "זהירות - דורש מלאי מסיבי והיערכות לוגיסטית. רמת סיכון עולה.";
}

const todayKey = () => new Date().toISOString().slice(0, 10);

const EMPTY_ALLOC = { day: "", destination: null, amount: 0 };

const ALLOC_LABEL = {
  buying: "לתקציב הרכש מאליאקספרס",
  withdraw: "לכיס",
  goal: "לרחפן",
};

// The first bucket has to be the one you see without scrolling.
//
// Under real RTL a `row` lays itself out right to left and a horizontal
// ScrollView opens against the right edge, so declaring in reading order is
// enough. react-native-web reports isRTL === false, so the row is drawn with
// `row-reverse` and the scroll opens at the *left* — which is the far end,
// putting the first bucket off-screen. Reversing the data in that case is the
// same compensation the register's tab bar makes, and for the same reason.
const orderBuckets = (list) => (I18nManager.isRTL ? list : [...list].reverse());

export default function MoneyDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [sales] = usePersistentState(STORAGE_KEYS.posSales, []);
  const [entries] = usePersistentState(STORAGE_KEYS.cashFlow, []);
  const [goal, setGoal] = usePersistentState("@dreammanager/drone-goal", DEFAULT_GOAL);
  const [editGoal, setEditGoal] = useState(false);
  const [draftTarget, setDraftTarget] = useState("");
  // The time machine. Local and ephemeral on purpose — this is a "what if",
  // not a figure anyone should expect to survive a reload.
  const [futureSales, setFutureSales] = useState(0);

  // What today's profit was swiped toward, if anything — resets the moment
  // the calendar day changes, since "unallocated daily net profit" is a new
  // question every morning. What has actually flown to the drone goal is a
  // separate, cumulative pool: a savings goal does not reset at midnight.
  const [dailyAlloc, setDailyAlloc] = usePersistentState("@dreammanager/dashboard-daily-alloc", EMPTY_ALLOC);
  const [droneSaved, setDroneSaved] = usePersistentState("@dreammanager/drone-saved", 0);
  // Bumped whenever an allocation pushes the drone goal to 100%; the icon
  // watches this to fire its takeoff sequence exactly once per crossing.
  const [takeoffToken, setTakeoffToken] = useState(0);

  const stats = useMemo(() => computeStats(sales || [], entries || []), [sales, entries]);
  const target = Number(goal?.target) > 0 ? Number(goal.target) : DEFAULT_GOAL.target;

  const projecting = futureSales > 0;
  const projectedProfit = stats.net + futureSales * AVG_PROFIT_PER_SALE;
  const timeMachineText = timeMachineInsight(futureSales);

  const buckets = {
    buying: Math.max(0, stats.net * SPLIT.buying),
    withdraw: Math.max(0, stats.net * SPLIT.withdraw),
  };
  const droneAmount = Number(droneSaved) || 0;
  const droneProgress = target > 0 ? droneAmount / target : 0;

  const today = todayKey();
  const dailyProfit = Math.max(0, stats.todayProfit);
  const allocatedToday = dailyAlloc?.day === today ? dailyAlloc : null;
  const showProfitCard = dailyProfit > 0 && !allocatedToday;

  const allocateProfit = useCallback(
    (destination) => {
      const amount = dailyProfit;
      if (amount <= 0) return;

      if (destination === "goal") {
        const next = droneAmount + amount;
        hapticHeavy();
        setDroneSaved(next);
        setDailyAlloc({ day: today, destination: "goal", amount });
        if (target > 0 && next >= target) {
          // The token only has to change, not count anything — the icon
          // reacts to it changing, not to its value.
          setTakeoffToken((t) => t + 1);
        }
        return;
      }
      if (destination === "buying") {
        hapticLight();
        setDailyAlloc({ day: today, destination: "buying", amount });
        return;
      }
      hapticSuccess();
      setDailyAlloc({ day: today, destination: "withdraw", amount });
    },
    [dailyProfit, droneAmount, target, today, setDroneSaved, setDailyAlloc]
  );

  // A drone goal that has just flown away starts the next one from zero
  // rather than sitting at "100% forever" with nothing left on screen to
  // show for it.
  const onDroneTakeoffComplete = useCallback(() => {
    setDroneSaved(0);
  }, [setDroneSaved]);

  const insight = useMemo(() => buildInsight(stats), [stats]);
  const log = useMemo(() => buildLog(sales || [], entries || []), [sales, entries]);

  const saveGoal = () => {
    const v = parseFloat(draftTarget);
    if (Number.isFinite(v) && v > 0) {
      hapticSuccess();
      setGoal({ ...(goal || DEFAULT_GOAL), target: v });
    }
    setEditGoal(false);
    setDraftTarget("");
  };

  return (
    <Canvas testID="money-dashboard" aurora>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Hero */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <CustomText weight="bold" style={s.title}>תזרים</CustomText>
            <CustomText style={s.subtitle}>רווח נקי מכל הפעילות</CustomText>
          </View>
          <Bounce
            testID="go-cashflow"
            style={s.headerBtn}
            scaleTo={0.92}
            onPress={() => {
              hapticLight();
              navigation?.navigate("CashFlowDetail");
            }}
          >
            <Icon name="plus" size={19} color={UI.violet} />
          </Bounce>
        </View>

        <Animated.View entering={FadeIn.duration(320)} style={s.hero}>
          {/* The vault sits behind the number, not beside it — the figure is
              the subject and the vault is the room it is in. */}
          <View style={s.vaultWrap} pointerEvents="none">
            <RiveVault size={172} tone={stats.net >= 0 ? UI.violet : UI.red} open={stats.net > 0} />
          </View>

          <CustomText style={s.heroLabel}>
            {projecting ? "רווח נקי (תחזית)" : "רווח נקי כולל"}
          </CustomText>
          <CustomText
            testID="hero-net"
            weight="bold"
            style={[
              s.heroValue,
              projecting
                ? { color: UI.cyan, textShadowColor: tint(UI.cyan, 0.45), textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } }
                : { color: stats.net >= 0 ? UI.ink : UI.red },
            ]}
          >
            {shekel(projecting ? projectedProfit : stats.net)}
          </CustomText>

          <View style={s.heroPills}>
            <HeroPill icon="arrow-up" tone={UI.green} label="הכנסות" value={shekel(stats.income)} testID="hero-income" />
            <HeroPill icon="arrow-down" tone={UI.amber} label="עלויות" value={shekel(stats.cost)} testID="hero-cost" />
          </View>
        </Animated.View>

        {/* ---------------------------------------------------------------- */}
        {/* Today's profit, thrown rather than read — a gesture card while it
            is unallocated, a one-line receipt once it has been swiped. */}
        {showProfitCard && (
          <ProfitAllocationCard testID="profit-card" amount={dailyProfit} onAllocate={allocateProfit} />
        )}
        {allocatedToday?.destination && (
          <Animated.View entering={FadeInDown.duration(200)} style={s.allocReceipt}>
            <Icon name="check-circle" size={15} color={UI.green} />
            <CustomText testID="alloc-receipt" style={s.allocReceiptText}>
              רווח היום ({shekel(allocatedToday.amount)}) הועבר {ALLOC_LABEL[allocatedToday.destination]}.
            </CustomText>
          </Animated.View>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Financial time machine — a local "what if", no server round trip. */}
        <Animated.View entering={FadeInDown.delay(140).springify().damping(15)} style={s.timeMachine}>
          <View style={s.timeMachineHead}>
            <View style={s.timeMachineBadge}>
              <Icon name="fast-forward" size={15} color={UI.cyan} />
            </View>
            <CustomText weight="bold" style={s.timeMachineTitle}>מכונת זמן פיננסית</CustomText>
            <CustomText testID="time-machine-value" style={s.timeMachineValue}>
              {futureSales > 0 ? `+${futureSales}` : futureSales}
            </CustomText>
          </View>
          <CustomText style={s.timeMachineHint}>מכירות נוספות בעתיד</CustomText>

          <Slider
            testID="time-machine-slider"
            style={s.timeMachineSlider}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={futureSales}
            onValueChange={setFutureSales}
            minimumTrackTintColor={UI.cyan}
            maximumTrackTintColor={UI.hairline}
            thumbTintColor={UI.cyan}
          />

          {/* Glassmorphism: a white wash over the desk plus a hairline,
              matching the smart-bucket cards below rather than a new look. */}
          <View style={s.timeMachineInsight}>
            <LinearGradient
              colors={["rgba(255,255,255,0.94)", "rgba(255,255,255,0.68)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.4, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: UI.radius, borderWidth: 1, borderColor: tint(UI.cyan, 0.2) },
              ]}
            />
            <View style={s.insightHead}>
              <View style={s.insightBadge}>
                <Icon name="message-circle" size={15} color={UI.cyan} />
              </View>
              <CustomText weight="bold" style={s.insightTitle}>התובנה של נועה</CustomText>
            </View>
            <CustomText testID="time-machine-insight" style={s.insightBody}>
              {timeMachineText}
            </CustomText>
          </View>
        </Animated.View>

        {/* ---------------------------------------------------------------- */}
        {/* Smart buckets */}
        <CustomText style={s.sectionHead}>חלוקה חכמה</CustomText>
        <ScrollView
          testID="buckets"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.bucketRow}
        >
          {orderBuckets([
            {
              key: "buying",
              icon: "package",
              tone: UI.cyan,
              title: "תקציב רכש",
              hint: `${Math.round(SPLIT.buying * 100)}% מהרווח · להזמנות הבאות`,
              value: shekel(buckets.buying),
            },
            {
              key: "withdraw",
              icon: "credit-card",
              tone: UI.green,
              title: "רווח למשיכה",
              hint: `${Math.round(SPLIT.withdraw * 100)}% מהרווח · בטוח לקחת`,
              value: shekel(buckets.withdraw),
            },
            {
              key: "goal",
              icon: "target",
              tone: UI.violet,
              title: goal?.name || DEFAULT_GOAL.name,
              hint: `יעד ${shekel(target)}`,
              value: shekel(droneAmount),
              onPress: () => {
                hapticLight();
                setDraftTarget(String(target));
                setEditGoal((e) => !e);
              },
              right: (
                <DroneGoalIcon
                  testID="goal-progress"
                  progress={droneProgress}
                  size={54}
                  color={UI.violet}
                  takeoffTrigger={takeoffToken}
                  onTakeoffComplete={onDroneTakeoffComplete}
                />
              ),
            },
          ]).map((b, i) => (
            <Bucket key={b.key} testID={`bucket-${b.key}`} delay={60 + i * 60} {...b} />
          ))}
        </ScrollView>

        {editGoal && (
          <Animated.View entering={FadeInDown.duration(180)} style={s.goalEdit}>
            <CustomText style={s.goalEditLabel}>יעד החיסכון</CustomText>
            <TextInput
              testID="goal-input"
              style={s.goalInput}
              value={draftTarget}
              onChangeText={setDraftTarget}
              keyboardType="decimal-pad"
              textAlign="center"
              onSubmitEditing={saveGoal}
            />
            <TouchableOpacity testID="goal-save" style={s.goalSave} onPress={saveGoal}>
              <CustomText style={s.goalSaveText}>שמור</CustomText>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Noa's insight */}
        <Animated.View entering={FadeInDown.delay(220).springify().damping(15)}>
          <View style={s.insight}>
            <LinearGradient
              colors={[tint(UI.violet, 0.1), tint(UI.cyan, 0.06)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.insightHead}>
              <View style={s.insightBadge}>
                <Icon name="message-circle" size={16} color={UI.violet} />
              </View>
              <CustomText weight="bold" style={s.insightTitle}>התובנה של נועה</CustomText>
            </View>
            <CustomText testID="insight-text" style={s.insightBody}>
              {insight}
            </CustomText>
          </View>
        </Animated.View>

        {/* ---------------------------------------------------------------- */}
        {/* Transactions */}
        <View style={s.logHead}>
          <CustomText style={s.sectionHead}>תנועות אחרונות</CustomText>
          {log.length > 0 && <CustomText style={s.logCount}>{log.length}</CustomText>}
        </View>

        {log.length === 0 ? (
          <View testID="log-empty" style={s.empty}>
            <View style={s.emptyBadge}>
              <Icon name="activity" size={24} color={UI.inkMuted} />
            </View>
            <CustomText style={s.emptyTitle}>אין עדיין תנועות</CustomText>
            <CustomText style={s.emptySub}>
              מכירה בקופה או תנועה שתרשום ידנית יופיעו כאן, והמספרים למעלה ייגזרו מהן.
            </CustomText>
          </View>
        ) : (
          <View testID="log-list" style={s.log}>
            {log.map((row, i) => (
              <Animated.View key={row.id} entering={FadeInDown.delay(Math.min(i, 8) * 35).duration(220)}>
                <View testID={`log-row-${i}`} style={s.logRow}>
                  <View style={[s.logIcon, { backgroundColor: tint(row.income ? UI.green : UI.amber, 0.11) }]}>
                    <Icon
                      name={row.income ? "arrow-up-right" : "arrow-down-left"}
                      size={16}
                      color={row.income ? UI.green : UI.amber}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <CustomText style={s.logTitle}>{row.title}</CustomText>
                    <CustomText style={s.logMeta}>{row.meta}</CustomText>
                  </View>
                  <CustomText
                    testID={`log-amount-${i}`}
                    style={[s.logAmount, { color: row.income ? UI.green : UI.inkSoft }]}
                  >
                    {row.income ? "+" : "−"}
                    {shekel(row.amount)}
                  </CustomText>
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </Canvas>
  );
}

// ---------------------------------------------------------------------------

function HeroPill({ icon, tone, label, value, testID }) {
  return (
    <View style={s.pill}>
      <Icon name={icon} size={13} color={tone} />
      <CustomText style={s.pillLabel}>{label}</CustomText>
      <CustomText testID={testID} style={[s.pillValue, { color: tone }]}>
        {value}
      </CustomText>
    </View>
  );
}

function Bucket({ testID, delay, icon, tone, title, hint, value, right, onPress }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(15)}>
      <Wrapper testID={testID} activeOpacity={0.88} onPress={onPress} style={s.bucket}>
        {/* Glass: a white wash over the desk plus a hairline, rather than an
            opaque card. On a light background that is what separates "pane"
            from "another rectangle". */}
        <LinearGradient
          colors={["rgba(255,255,255,0.96)", "rgba(255,255,255,0.72)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { borderRadius: UI.radius, borderWidth: 1, borderColor: UI.hairline }]} />

        <View style={s.bucketTop}>
          <View style={[s.bucketIcon, { backgroundColor: tint(tone, 0.12) }]}>
            <Icon name={icon} size={16} color={tone} />
          </View>
          {right}
        </View>
        <CustomText style={s.bucketValue}>{value}</CustomText>
        <CustomText weight="semibold" style={s.bucketTitle}>
          {title}
        </CustomText>
        <CustomText style={s.bucketHint}>{hint}</CustomText>
      </Wrapper>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Derivations

function computeStats(sales, entries) {
  const posSales = sales.filter((r) => r.kind === "sale");
  const posRevenue = posSales.reduce((n, r) => n + (Number(r.total) || 0), 0);
  const posCost = posSales.reduce((n, r) => n + (Number(r.cost) || 0) * (Number(r.qty) || 0), 0);

  const manualIncome = entries
    .filter((e) => e.kind === "income")
    .reduce((n, e) => n + (Number(e.amount) || 0), 0);
  const manualExpense = entries
    .filter((e) => e.kind === "expense")
    .reduce((n, e) => n + (Number(e.amount) || 0), 0);

  const income = posRevenue + manualIncome;
  const cost = posCost + manualExpense;

  const day = new Date().toISOString().slice(0, 10);
  const todayRows = posSales.filter((r) => r.day === day);
  const todayRevenue = todayRows.reduce((n, r) => n + (Number(r.total) || 0), 0);
  const todayProfit = todayRows.reduce((n, r) => n + (Number(r.profit) || 0), 0);

  // Which side of the business earned it. "snacks" is what the register tags
  // fast-food lines with; "electronics" is the import deck.
  const foodProfit = posSales
    .filter((r) => r.category === "snacks")
    .reduce((n, r) => n + (Number(r.profit) || 0), 0);
  const importCost = posSales
    .filter((r) => r.category === "electronics")
    .reduce((n, r) => n + (Number(r.cost) || 0) * (Number(r.qty) || 0), 0);

  return {
    income,
    cost,
    net: income - cost,
    posRevenue,
    posCost,
    manualIncome,
    manualExpense,
    todayRevenue,
    todayProfit,
    foodProfit,
    importCost,
    count: posSales.length + entries.length,
    // Lines the register could not price. They inflate profit rather than
    // shrinking it, so the error always flatters and is worth surfacing.
    uncosted: posSales.filter((r) => !Number(r.cost)).length,
  };
}

/**
 * One sentence about the money, built from the numbers rather than written.
 *
 * A hardcoded "you're up 12% today" would look identical on a screen with no
 * sales on it, which makes the card decorative at exactly the moment it should
 * be useful. So each line below is only reachable when the figures behind it
 * exist, and with nothing logged it says so instead.
 */
export function buildInsight(stats) {
  if (!stats.count) {
    return "אין עדיין מספיק תנועות בשביל תובנה. תרשום מכירה או הוצאה, ואני אתחיל לראות את התמונה.";
  }

  if (stats.foodProfit > 0 && stats.importCost > 0) {
    const covers = stats.foodProfit / stats.importCost;
    if (covers >= 1) {
      return `מכירות המזון (${shekel(stats.foodProfit)}) כיסו את כל הרכש מאליאקספרס (${shekel(
        stats.importCost
      )}). הצד היציב מממן את הצד עם הסיכון — בדיוק הסדר הנכון.`;
    }
    return `מכירות המזון מכסות ${Math.round(covers * 100)}% מהרכש מאליאקספרס. עוד ${shekel(
      stats.importCost - stats.foodProfit
    )} של רווח מהדוכן והייבוא משלם על עצמו.`;
  }

  if (stats.todayRevenue > 0) {
    const margin = stats.todayProfit / stats.todayRevenue;
    return `היום נכנסו ${shekel(stats.todayRevenue)} עם ${Math.round(
      margin * 100
    )}% מתח רווח. ${margin >= 0.4 ? "המתח יפה — שווה לדחוף את אותם פריטים." : "המתח נמוך יחסית; שווה להסתכל על התמחור."}`;
  }

  if (stats.net < 0) {
    return `נכון לעכשיו ההוצאות גדולות מההכנסות ב-${shekel(
      Math.abs(stats.net)
    )}. זה נורמלי אחרי הזמנה גדולה — המספר יתאזן ככל שהמלאי הזה נמכר.`;
  }

  if (stats.uncosted > 0) {
    return `${stats.uncosted} שורות מכירה נרשמו בלי עלות ידועה, אז הרווח למעלה גבוה מהאמיתי. תגיד לי כמה הפריטים האלה עלו ואעדכן.`;
  }

  return `הרווח הנקי עומד על ${shekel(stats.net)} מ-${stats.count} תנועות. המגמה חיובית — כדאי להעביר חלק לתקציב הרכש לפני שזה נגמר בקיוסק.`;
}

function buildLog(sales, entries, limit = 12) {
  const rows = [];

  // POS sales arrive as one record per line; a customer sees one transaction,
  // so they are folded back together on the event id the register stamped.
  const byEvent = new Map();
  sales
    .filter((r) => r.kind === "sale")
    .forEach((r) => {
      const key = r.eventId || r.id;
      const prev = byEvent.get(key) || { at: r.ts || 0, total: 0, units: 0, category: r.category };
      prev.total += Number(r.total) || 0;
      prev.units += Number(r.qty) || 0;
      prev.at = Math.max(prev.at, r.ts || 0);
      byEvent.set(key, prev);
    });

  byEvent.forEach((v, key) => {
    rows.push({
      id: `pos-${key}`,
      at: v.at,
      income: v.total >= 0,
      amount: Math.abs(v.total),
      title: v.category === "electronics" ? "מכירת ייבוא" : "מכירה בקופה",
      meta: `${v.units} פריטים · ${timeLabel(v.at)}`,
    });
  });

  entries.forEach((e) => {
    rows.push({
      id: `cf-${e.id}`,
      at: e.at || 0,
      income: e.kind === "income",
      amount: Math.abs(Number(e.amount) || 0),
      title: e.label || (e.kind === "income" ? "הכנסה" : "הוצאה"),
      meta: timeLabel(e.at),
    });
  });

  return rows.sort((a, b) => b.at - a.at).slice(0, limit);
}

function timeLabel(at) {
  if (!at) return "";
  const mins = Math.floor((Date.now() - at) / 60000);
  if (mins < 1) return "הרגע";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "אתמול" : `לפני ${days} ימים`;
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({
  header: { flexDirection: ROW, alignItems: "center", gap: 12, paddingHorizontal: UI.cardMarginH, paddingBottom: 8 },
  title: { fontSize: TYPE.hero, color: UI.ink, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: tint(UI.violet, 0.1),
    alignItems: "center",
    justifyContent: "center",
    ...BEVEL,
  },

  hero: { alignItems: "center", paddingTop: 14, paddingBottom: 22 },
  vaultWrap: { position: "absolute", top: 0, opacity: 0.5 },
  heroLabel: { fontFamily: FONTS.medium, fontSize: 12.5, color: UI.inkMuted, marginTop: 30 },
  heroValue: { fontSize: 52, letterSpacing: -1, marginTop: 2 },
  heroPills: { flexDirection: ROW, gap: 8, marginTop: 14 },
  pill: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.85)",
    ...BEVEL,
  },
  pillLabel: { fontFamily: FONTS.regular, fontSize: 11, color: UI.inkMuted },
  pillValue: { fontFamily: FONTS.bold, fontSize: 13 },

  sectionHead: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: UI.ink,
    textAlign: "right",
    paddingHorizontal: UI.cardMarginH,
    marginBottom: 10,
  },

  bucketRow: { flexDirection: ROW, gap: 12, paddingHorizontal: UI.cardMarginH, paddingBottom: 6 },
  bucket: {
    width: 168,
    minHeight: 148,
    borderRadius: UI.radius,
    padding: 14,
    justifyContent: "space-between",
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  bucketTop: { flexDirection: ROW, alignItems: "center", justifyContent: "space-between" },
  bucketIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bucketValue: { fontFamily: FONTS.bold, fontSize: 22, color: UI.ink, textAlign: "right", marginTop: 8 },
  bucketTitle: { fontSize: 13, color: UI.ink, textAlign: "right", marginTop: 2 },
  bucketHint: { fontFamily: FONTS.regular, fontSize: 10.5, color: UI.inkMuted, textAlign: "right", marginTop: 2, lineHeight: 15 },

  goalEdit: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 10,
    marginHorizontal: UI.cardMarginH,
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: UI.surface,
    ...BEVEL,
    ...CARD_SHADOW,
  },
  goalEditLabel: { fontFamily: FONTS.semibold, fontSize: 12.5, color: UI.inkSoft },
  goalInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: UI.surfaceAlt,
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: UI.ink,
  },
  goalSave: { paddingHorizontal: 16, minHeight: 44, borderRadius: 12, backgroundColor: UI.violet, alignItems: "center", justifyContent: "center" },
  goalSaveText: { fontFamily: FONTS.bold, fontSize: 13.5, color: "#FFFFFF" },

  allocReceipt: {
    flexDirection: ROW,
    alignItems: "center",
    gap: 8,
    marginHorizontal: UI.cardMarginH,
    marginBottom: 22,
    padding: 12,
    borderRadius: UI.radius,
    backgroundColor: tint(UI.green, 0.08),
    borderWidth: 1,
    borderColor: tint(UI.green, 0.2),
  },
  allocReceiptText: { flex: 1, fontFamily: FONTS.regular, fontSize: 12.5, color: UI.inkSoft, textAlign: "right" },

  timeMachine: {
    marginHorizontal: UI.cardMarginH,
    marginBottom: 22,
    borderRadius: UI.radius,
    padding: 16,
    backgroundColor: UI.surface,
    ...BEVEL,
    ...CARD_SHADOW,
  },
  timeMachineHead: { flexDirection: ROW, alignItems: "center", gap: 9 },
  timeMachineBadge: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: tint(UI.cyan, 0.12),
    alignItems: "center",
    justifyContent: "center",
  },
  timeMachineTitle: { flex: 1, fontSize: 14.5, color: UI.ink, textAlign: "right" },
  timeMachineValue: { fontFamily: FONTS.bold, fontSize: 15, color: UI.cyan },
  timeMachineHint: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: UI.inkMuted,
    textAlign: "right",
    marginTop: 4,
  },
  timeMachineSlider: { width: "100%", height: 40, marginTop: 6 },
  timeMachineInsight: {
    marginTop: 10,
    borderRadius: UI.radius,
    padding: 14,
    gap: 8,
    overflow: "hidden",
  },

  insight: {
    marginHorizontal: UI.cardMarginH,
    marginTop: 18,
    marginBottom: 20,
    borderRadius: UI.radius,
    padding: 16,
    gap: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tint(UI.violet, 0.16),
    ...CARD_SHADOW,
  },
  insightHead: { flexDirection: ROW, alignItems: "center", gap: 9 },
  insightBadge: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: { flex: 1, fontSize: 14.5, color: UI.ink, textAlign: "right" },
  insightBody: { fontFamily: FONTS.regular, fontSize: 13.5, color: UI.inkSoft, textAlign: "right", lineHeight: 22 },

  logHead: { flexDirection: ROW, alignItems: "center", paddingHorizontal: UI.cardMarginH },
  logCount: { fontFamily: FONTS.semibold, fontSize: 12, color: UI.inkMuted, marginBottom: 10 },

  log: { marginHorizontal: UI.cardMarginH, backgroundColor: UI.surface, borderRadius: UI.radius, paddingHorizontal: 14, ...BEVEL, ...CARD_SHADOW },
  logRow: { flexDirection: ROW, alignItems: "center", gap: 12, minHeight: 60, borderBottomWidth: 1, borderBottomColor: UI.hairline },
  logIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  logTitle: { fontFamily: FONTS.semibold, fontSize: 13.5, color: UI.ink, textAlign: "right" },
  logMeta: { fontFamily: FONTS.regular, fontSize: 11, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  logAmount: { fontFamily: FONTS.bold, fontSize: 14.5 },

  empty: { alignItems: "center", gap: 8, paddingVertical: 34, marginHorizontal: UI.cardMarginH },
  emptyBadge: { width: 60, height: 60, borderRadius: 20, backgroundColor: UI.surfaceHi, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 15, color: UI.ink },
  emptySub: { fontFamily: FONTS.regular, fontSize: 12.5, color: UI.inkMuted, textAlign: "center", lineHeight: 19, paddingHorizontal: 30 },
});
