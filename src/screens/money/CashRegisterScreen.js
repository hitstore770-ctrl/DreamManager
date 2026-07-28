import { I18nManager, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Bounce from "../../components/Bounce";
import Icon from "../../components/Icon";
import { TillCounter } from "../../components/tools/apps/finance";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { CARD_SHADOW, TYPE, UI } from "../../utils/ui";
import CustomText from "../../components/CustomText";

// הקופה — end-of-shift counting. The counting itself is TillCounter, which is
// the same component the Business tab uses; this screen is the standalone
// route into it from the money hub, so both entry points stay in step.

export default function CashRegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
      <View style={s.header}>
        <Bounce style={s.iconBtn} scaleTo={0.9} onPress={() => navigation?.goBack()}>
          <Icon name={I18nManager.isRTL ? "arrow-right" : "arrow-left"} size={19} color={UI.ink} />
        </Bounce>
        <View style={{ flex: 1 }}>
          <CustomText style={s.title}>ספירת קופה</CustomText>
          <CustomText style={s.subtitle}>סגירת משמרת · מטבעות ושטרות</CustomText>
        </View>
        <View style={s.badge}>
          <Icon name="cash-outline" size={20} color={UI.violet} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: UI.cardMarginH, paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>
          <TillCounter />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },
  header: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: UI.surface,
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: UI.violet + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: FONTS.bold, fontSize: TYPE.title, color: UI.ink, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: TYPE.caption, color: UI.inkMuted, textAlign: "right", marginTop: 2 },
  card: {
    backgroundColor: UI.surface,
    borderRadius: UI.radius,
    padding: UI.cardPadding,
    ...CARD_SHADOW,
  },
});
