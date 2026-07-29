import { useCallback, useEffect, useRef, useState } from "react";
import { I18nManager, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSharedValue, withSpring } from "react-native-reanimated";

import GlassIndicator from "./GlassIndicator";
import Icon from "../Icon";
import CustomText from "../CustomText";
import { hapticLight } from "../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { POS_CATEGORIES } from "../../utils/posCatalog";
import { UI } from "../../utils/ui";

// The eight-zone switcher.
//
// Positions are measured, not computed. Hebrew labels differ in width by more
// than a factor of two ("קופה" against "מטבח ואריזה"), so any layout that
// assumes an equal share per tab puts the glass pane in the wrong place on
// most of them. Each pill reports its own frame through onLayout and the
// indicator springs to whatever was measured.
//
// One consequence worth stating: the pane can only move once a layout pass has
// happened. On the very first frame every measurement is zero, so the
// indicator is held at zero width until the active tab has a real frame —
// better than a full-width flash across the bar before it snaps into place.

const SPRING = { damping: 18, stiffness: 190, mass: 0.55 };
const BAR_HEIGHT = 46;

export default function CategoryTabBar({ active, onChange, testID = "pos-tabbar" }) {
  const scroller = useRef(null);
  const frames = useRef({});
  const [measured, setMeasured] = useState(false);

  const x = useSharedValue(0);
  const width = useSharedValue(0);

  const activeIndex = POS_CATEGORIES.findIndex((c) => c.key === active);

  const moveTo = useCallback(
    (key, animate = true) => {
      const frame = frames.current[key];
      if (!frame) return;
      if (animate) {
        x.value = withSpring(frame.x, SPRING);
        width.value = withSpring(frame.width, SPRING);
      } else {
        x.value = frame.x;
        width.value = frame.width;
      }
      // Keep the active tab clear of the edges. Under RTL the content offset
      // still counts from the start of the content, which is the right-hand
      // side — so this arithmetic is the same either way.
      scroller.current?.scrollTo({ x: Math.max(0, frame.x - 90), animated: animate });
    },
    [x, width]
  );

  useEffect(() => {
    moveTo(active, measured);
  }, [active, measured, moveTo]);

  const onPillLayout = (key) => (e) => {
    const { x: px, width: pw } = e.nativeEvent.layout;
    frames.current[key] = { x: px, width: pw };
    if (key === active && !measured && pw > 0) {
      setMeasured(true);
    }
  };

  return (
    <View testID={testID} style={st.wrap}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.row}
        // The bar is the app's own control, not a page — a bounce here reads
        // as the screen coming loose.
        bounces={false}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GlassIndicator x={x} width={width} height={BAR_HEIGHT} radius={14} color={POS_CATEGORIES[Math.max(0, activeIndex)].color} />
        </View>

        {POS_CATEGORIES.map((cat, i) => {
          const on = cat.key === active;
          return (
            <TouchableOpacity
              key={cat.key}
              testID={`pos-tab-${cat.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              activeOpacity={0.75}
              style={st.pill}
              onLayout={onPillLayout(cat.key)}
              onPress={() => {
                if (on) return;
                hapticLight();
                onChange(cat.key);
              }}
            >
              <Icon name={cat.icon} size={16} color={on ? cat.color : UI.inkMuted} />
              <CustomText style={[st.label, on && { color: cat.color, fontFamily: FONTS.bold }]}>{cat.label}</CustomText>
              <View style={[st.index, on && { backgroundColor: cat.color + "1F" }]}>
                <CustomText style={[st.indexText, on && { color: cat.color }]}>{i + 1}</CustomText>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { height: BAR_HEIGHT + 8, justifyContent: "center" },
  row: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 6,
    height: BAR_HEIGHT,
  },
  pill: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 7,
    height: BAR_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  label: { fontFamily: FONTS.semibold, fontSize: 13.5, color: UI.inkSoft },
  index: {
    minWidth: 18,
    height: 18,
    borderRadius: 6,
    backgroundColor: "#E7EAF0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  indexText: { fontFamily: FONTS.bold, fontSize: 10, color: UI.inkMuted },
});
