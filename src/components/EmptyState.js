import { StyleSheet, View } from "react-native";
import AppText from "./AppText";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

// A calmer stand-in for "nothing here" than a bare line of muted text --
// a soft icon badge plus a short, encouraging line. Used anywhere a list
// can come up genuinely empty (as opposed to still loading, which is
// Skeleton's job).
export default function EmptyState({ icon = "inbox", title, subtitle }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.wrap}>
      <View style={s.iconWrap}>
        <Feather name={icon} size={26} color={theme.textMuted} />
      </View>
      {!!title && <AppText style={s.title}>{title}</AppText>}
      {!!subtitle && <AppText style={s.subtitle}>{subtitle}</AppText>}
    </View>
  );
}

const styles = (t) =>
  StyleSheet.create({
    wrap: { alignItems: "center", justifyContent: "center", paddingTop: 76, paddingHorizontal: 34 },
    iconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: t.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    title: { fontSize: 15, fontWeight: "700", color: t.text, textAlign: "center", marginBottom: 5 },
    subtitle: { fontSize: 13, color: t.textMuted, textAlign: "center", lineHeight: 19 },
  });
