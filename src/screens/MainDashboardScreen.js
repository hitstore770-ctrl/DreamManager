import { useEffect, useMemo } from "react";
import { I18nManager, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, G, Line, LinearGradient as SvgGrad, RadialGradient, Stop } from "react-native-svg";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { Canvas, GradCard, Card } from "../components/Paper";
import { useDreams } from "../context/DreamContext";
import { useMoney } from "../context/MoneyContext";
import { useNotes } from "../context/NotesContext";
import { hapticLight } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { shekel } from "../utils/posStore";
import { TOOL_COUNT } from "../utils/toolsCatalog";
import { BEVEL, GRAD, TYPE, UI, tint } from "../utils/ui";

// הליבה / The Core — the centre tab.
//
// This is the shell of the command centre, and it is deliberately honest about
// that: the reactor and the vitals below it read from real app state (net
// worth, dreams, notes, tools) rather than from invented numbers. A dashboard
// that displays convincing fake metrics is worse than an empty one, because
// you cannot tell by looking which of its numbers you are allowed to trust.

const RING = 250;

function Reactor({ progress = 0 }) {
  const spinSlow = useSharedValue(0);
  const spinFast = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    spinSlow.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.linear }), -1, false);
    spinFast.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);

  // Counter-rotation is what makes a ring stack read as machinery rather than
  // as a loading spinner: the eye needs a fixed reference to see motion.
  const outer = useAnimatedStyle(() => ({ transform: [{ rotate: `${spinSlow.value * 360}deg` }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spinFast.value * 360}deg` }] }));
  const core = useAnimatedStyle(() => ({
    opacity: 0.32 + pulse.value * 0.35,
    transform: [{ scale: 0.92 + pulse.value * 0.12 }],
  }));

  const c = RING / 2;
  const rOuter = c - 6;
  const rMid = c - 34;
  const rArc = c - 20;
  const arcLen = 2 * Math.PI * rArc;

  // Tick marks on the outer bezel.
  const ticks = [];
  for (let i = 0; i < 60; i += 1) {
    const a = (i * Math.PI * 2) / 60;
    const long = i % 5 === 0;
    ticks.push(
      <Line
        key={i}
        x1={c + Math.cos(a) * rOuter}
        y1={c + Math.sin(a) * rOuter}
        x2={c + Math.cos(a) * (rOuter - (long ? 10 : 5))}
        y2={c + Math.sin(a) * (rOuter - (long ? 10 : 5))}
        stroke={long ? UI.violet : "#CBD5E1"}
        strokeWidth={long ? 1.6 : 1}
        opacity={long ? 0.85 : 0.4}
      />
    );
  }

  return (
    <View style={s.reactor}>
      {/* The pulsing core. A linear ramp across the whole square renders as a
          solid violet disc; the glow has to fade from the centre outward, so
          it is a radial fill. */}
      <Animated.View style={[StyleSheet.absoluteFill, core]} pointerEvents="none">
        <Svg width={RING} height={RING}>
          <Defs>
            <RadialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#A78BFA" stopOpacity="0.22" />
              <Stop offset="0.45" stopColor={UI.violet} stopOpacity="0.10" />
              <Stop offset="1" stopColor={UI.violet} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={RING / 2} cy={RING / 2} r={RING / 2} fill="url(#coreGlow)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, outer]}>
        <Svg width={RING} height={RING}>
          <G>{ticks}</G>
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, inner]}>
        <Svg width={RING} height={RING}>
          <Defs>
            <SvgGrad id="coreArc" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#22D3EE" />
              <Stop offset="1" stopColor="#8B5CF6" />
            </SvgGrad>
          </Defs>
          <Circle cx={c} cy={c} r={rMid} stroke="rgba(17,24,39,0.10)" strokeWidth={1.4} fill="none" />
          <Circle
            cx={c}
            cy={c}
            r={rArc}
            stroke="url(#coreArc)"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${arcLen * 0.24} ${arcLen}`}
          />
          <Circle
            cx={c}
            cy={c}
            r={rArc}
            stroke="url(#coreArc)"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${arcLen * 0.1} ${arcLen}`}
            strokeDashoffset={-arcLen * 0.55}
          />
        </Svg>
      </Animated.View>

      {/* Static progress ring — the one thing that must NOT rotate, because it
          encodes a value. */}
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={rMid - 14} stroke="#E7EAF0" strokeWidth={7} fill="none" />
        <Circle
          cx={c}
          cy={c}
          r={rMid - 14}
          stroke={UI.violet}
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${2 * Math.PI * (rMid - 14)}`}
          strokeDashoffset={2 * Math.PI * (rMid - 14) * (1 - progress)}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>

      <View style={s.reactorCore}>
        <Text style={s.coreTitle}>THE CORE</Text>
        <Text style={s.coreSub}>הליבה</Text>
        <View style={s.coreDivider} />
        <Text style={s.corePct}>{Math.round(progress * 100)}%</Text>
        <Text style={s.coreHint}>התקדמות חלומות</Text>
      </View>
    </View>
  );
}

function Vital({ icon, label, value, tone, delay }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(14)} style={s.vitalWrap}>
      <GradCard colors={GRAD.surface} radius={UI.radiusSm}>
        <View style={s.vital}>
          <View style={[s.vitalBadge, { backgroundColor: tint(tone, 0.18) }]}>
            <Icon name={icon} size={16} color={tone} />
          </View>
          <Text style={s.vitalValue} numberOfLines={1}>{value}</Text>
          <Text style={s.vitalLabel}>{label}</Text>
        </View>
      </GradCard>
    </Animated.View>
  );
}

export default function MainDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { netWorth } = useMoney();
  const { dreams } = useDreams();
  const { notes } = useNotes();

  const progress = useMemo(() => {
    const list = dreams || [];
    if (!list.length) return 0;
    const sum = list.reduce((acc, d) => {
      const target = Number(d.target) || 0;
      const saved = Number(d.saved) || 0;
      // Guard the divide: a dream with no target must not become Infinity and
      // drag the whole ring to 100%.
      return acc + (target > 0 ? Math.min(1, saved / target) : 0);
    }, 0);
    return sum / list.length;
  }, [dreams]);

  const go = (route, params) => {
    hapticLight();
    navigation?.navigate(route, params);
  };

  return (
    <Canvas testID="core-screen">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(300)} style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>מרכז הבקרה</Text>
            <Text style={s.title}>The Core</Text>
          </View>
          <Card style={s.statusChip} radius={14}>
            <View style={s.statusInner}>
              <View style={s.statusDot} />
              <Text style={s.statusText}>ONLINE</Text>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(120).duration(500)} style={s.reactorStage}>
          <Reactor progress={progress} />
        </Animated.View>

        <View style={s.vitals}>
          <Vital icon="trending-up" label="סה״כ ברשותי" value={shekel(netWorth)} tone={UI.violet} delay={140} />
          <Vital icon="star" label="חלומות פעילים" value={String((dreams || []).length)} tone={UI.cyan} delay={200} />
          <Vital icon="edit-3" label="פתקים" value={String((notes || []).length)} tone={UI.green} delay={260} />
          <Vital icon="grid" label="כלים זמינים" value={String(TOOL_COUNT)} tone={UI.amber} delay={320} />
        </View>

        <Animated.View entering={FadeInDown.delay(380).springify().damping(14)}>
          <Card style={s.bay} radius={UI.radius}>
            <View style={s.bayInner}>
              <Text style={s.bayTitle}>מודולים</Text>
              <Text style={s.bayHint}>הליבה עדיין נבנית. אלה השערים שכבר פעילים.</Text>

              <View style={s.bayGrid}>
                {[
                  { key: "Business", label: "העסק שלי", icon: "briefcase", tone: UI.violetLo },
                  { key: "DreamsFull", label: "לוח החלומות", icon: "star", tone: UI.cyan },
                  { key: "TransitAssistant", label: "עוזר תחב״ץ", icon: "map-pin", tone: UI.green },
                  { key: "Settings", label: "הגדרות", icon: "settings", tone: UI.inkSoft },
                ].map((m) => (
                  <Bounce
                    key={m.key}
                    testID={`core-${m.key}`}
                    style={s.bayTile}
                    scaleTo={0.94}
                    onPress={() => go(m.key)}
                  >
                    <View style={[s.bayBadge, { backgroundColor: tint(m.tone, 0.18) }]}>
                      <Icon name={m.icon} size={18} color={m.tone} />
                    </View>
                    <Text style={s.bayLabel}>{m.label}</Text>
                  </Bounce>
                ))}
              </View>
            </View>
          </Card>
        </Animated.View>

        <Text style={s.footnote}>
          הנתונים כאן נקראים מהמצב האמיתי של האפליקציה — היתרה, החלומות והפתקים שלך. אין כאן מספרי
          הדגמה.
        </Text>
      </ScrollView>
    </Canvas>
  );
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse";

const s = StyleSheet.create({
  header: { flexDirection: ROW, alignItems: "center", gap: 12, paddingHorizontal: UI.cardMarginH },
  eyebrow: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: UI.violetLo,
    letterSpacing: 2,
    textAlign: "right",
  },
  title: { fontFamily: FONTS.bold, fontSize: TYPE.hero, color: UI.ink, textAlign: "right", letterSpacing: 0.5 },

  statusChip: { alignSelf: "flex-start" },
  statusInner: { flexDirection: ROW, alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: UI.green },
  statusText: { fontFamily: FONTS.bold, fontSize: 10, color: UI.green, letterSpacing: 1.5 },

  reactorStage: { alignItems: "center", marginTop: 18, marginBottom: 6 },
  reactor: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  reactorCore: { alignItems: "center", gap: 1 },
  coreTitle: { fontFamily: FONTS.bold, fontSize: 13, color: UI.ink, letterSpacing: 4 },
  coreSub: { fontFamily: FONTS.regular, fontSize: 11, color: UI.inkMuted, letterSpacing: 1 },
  coreDivider: { width: 44, height: 1, backgroundColor: UI.hairline, marginVertical: 8 },
  corePct: { fontFamily: FONTS.bold, fontSize: 30, color: UI.ink },
  coreHint: { fontFamily: FONTS.regular, fontSize: 10.5, color: UI.inkMuted },

  vitals: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: UI.cardMarginH,
    marginTop: 22,
    justifyContent: "center",
  },
  vitalWrap: { width: "47.5%" },
  vital: { padding: 14, gap: 6 },
  vitalBadge: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  vitalValue: { fontFamily: FONTS.bold, fontSize: 19, color: UI.ink, textAlign: "right" },
  vitalLabel: { fontFamily: FONTS.regular, fontSize: 11, color: UI.inkMuted, textAlign: "right" },

  bay: { marginHorizontal: UI.cardMarginH, marginTop: 18 },
  bayInner: { padding: UI.cardPadding },
  bayTitle: { fontFamily: FONTS.bold, fontSize: TYPE.section, color: UI.ink, textAlign: "right" },
  bayHint: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 3 },
  bayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14, justifyContent: "center" },
  bayTile: {
    width: "47%",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: UI.radiusSm,
    backgroundColor: UI.surfaceAlt,
    ...BEVEL,
  },
  bayBadge: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  bayLabel: { fontFamily: FONTS.semibold, fontSize: 12.5, color: UI.inkSoft },

  footnote: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.caption,
    color: UI.inkMuted,
    textAlign: "center",
    paddingHorizontal: 30,
    lineHeight: 19,
    marginTop: 22,
  },
});
