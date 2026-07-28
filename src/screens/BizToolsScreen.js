import { useState } from "react";
import { I18nManager, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { InventoryForecast, VendingRoi } from "../components/tools/apps/vending";
import { TillCounter } from "../components/tools/apps/finance";
import { hapticLight } from "../utils/haptics";
import { FLUID, listEntry } from "../utils/motion";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { CARD_SHADOW, TYPE, UI } from "../utils/ui";
import CustomText from "../components/CustomText";

// כלים עסקיים — the three tools that belong to running the business rather
// than to general utility, moved out of the Tools hub and in beside the
// register they actually serve.
//
// They open inline rather than in a sheet: the Business tab already sits
// inside its own module switcher, and stacking a modal on top of that hides
// the sub-navigation the user needs to get back.

const BIZ_TOOLS = [
  {
    key: "till",
    label: "ספירת קופה",
    hint: "ספירת מטבעות ושטרות מול הצפי בדוח Z",
    icon: "cash-outline",
    Component: TillCounter,
  },
  {
    key: "forecast",
    label: "חיזוי מלאי למכונה",
    hint: "כמה ימים נשארו עד שהמכונה מתרוקנת",
    icon: "package",
    Component: InventoryForecast,
  },
  {
    key: "roi",
    label: "החזר השקעה למכונה",
    hint: "כמה זמן ייקח למכונה להחזיר את עצמה",
    icon: "trending-up",
    Component: VendingRoi,
  },
];

export default function BizToolsScreen() {
  const [open, setOpen] = useState(null);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 110 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {BIZ_TOOLS.map((tool, index) => {
        const isOpen = open === tool.key;
        const { Component } = tool;
        return (
          <Animated.View
            key={tool.key}
            entering={listEntry(index)}
            layout={FLUID}
            style={s.card}
          >
            <Bounce
              style={s.head}
              scaleTo={0.97}
              onPress={() => {
                hapticLight();
                setOpen(isOpen ? null : tool.key);
              }}
            >
              <Icon
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={UI.inkMuted}
              />
              <View style={{ flex: 1 }}>
                <CustomText style={s.label}>{tool.label}</CustomText>
                <CustomText style={s.hint}>{tool.hint}</CustomText>
              </View>
              <View style={[s.badge, isOpen && { backgroundColor: UI.violet }]}>
                <Icon name={tool.icon} size={19} color={isOpen ? "#FFFFFF" : UI.violet} />
              </View>
            </Bounce>

            {isOpen && (
              <Animated.View entering={FadeIn.duration(220)} layout={FLUID} style={s.body}>
                <Component />
              </Animated.View>
            )}
          </Animated.View>
        );
      })}

      <CustomText style={s.footer}>
        הכלים האלה עברו לכאן מטאב הכלים, כדי שכל מה שקשור לניהול העסק יישב במקום אחד.
      </CustomText>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: UI.surface,
    borderRadius: UI.radius,
    padding: UI.cardPadding,
    marginHorizontal: UI.cardMarginH,
    marginBottom: UI.cardMarginB,
    ...CARD_SHADOW,
  },
  head: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: UI.violet + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontFamily: FONTS.bold, fontSize: TYPE.title, color: UI.ink, textAlign: "right" },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.caption,
    color: UI.inkMuted,
    textAlign: "right",
    marginTop: 3,
    lineHeight: 18,
  },
  body: { marginTop: 18, borderTopWidth: 1, borderTopColor: UI.hairline, paddingTop: 18 },
  footer: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.caption,
    color: UI.inkMuted,
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 19,
    marginTop: 4,
  },
});
