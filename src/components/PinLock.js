import { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "./Icon";
import { useSettings } from "../context/SettingsContext";
import { FONTS, RADIUS, SHADOW_SM } from "../utils/theme";
import CustomText from "../components/CustomText";

// A numeric PIN gate. Two modes:
//   mode="unlock" → compares against the saved PIN, calls onSuccess() when it
//                   matches (used as the launch lock overlay).
//   mode="set"    → asks for a new PIN twice, returns it via onSet(pin).
export default function PinLock({ mode = "unlock", expected, onSuccess, onSet, onCancel, themeOverride }) {
  const settings = useSettings();
  const theme = themeOverride || settings.theme;
  const { fontScale, haptic } = settings;
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState("");
  const [firstPass, setFirstPass] = useState(null); // set mode: first entry
  const [error, setError] = useState(false);

  const title =
    mode === "set"
      ? firstPass
        ? "אשר את הקוד"
        : "בחר קוד בן 4 ספרות"
      : "הזן קוד גישה";

  useEffect(() => {
    if (entry.length < 4) return;

    if (mode === "unlock") {
      if (entry === expected) {
        haptic("success");
        onSuccess?.();
      } else {
        haptic("error");
        setError(true);
        setTimeout(() => {
          setEntry("");
          setError(false);
        }, 500);
      }
      return;
    }

    // set mode
    if (!firstPass) {
      setFirstPass(entry);
      setEntry("");
    } else if (firstPass === entry) {
      haptic("success");
      onSet?.(entry);
    } else {
      haptic("error");
      setError(true);
      setTimeout(() => {
        setEntry("");
        setFirstPass(null);
        setError(false);
      }, 600);
    }
  }, [entry]);

  const press = (digit) => {
    haptic("light");
    setEntry((prev) => (prev.length >= 4 ? prev : prev + digit));
  };
  const backspace = () => {
    haptic("light");
    setEntry((prev) => prev.slice(0, -1));
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.top}>
        <Icon name="lock" size={32} color={theme.accent} style={styles.lockIcon} />
        <CustomText style={[styles.title, { color: theme.textPrimary, fontSize: 20 * fontScale }]}>{title}</CustomText>

        <View style={styles.dots}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  borderColor: error ? theme.danger : theme.textMuted,
                  backgroundColor:
                    i < entry.length ? (error ? theme.danger : theme.accent) : "transparent",
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.pad}>
        {keys.map((k, i) => {
          if (k === "") return <View key={i} style={styles.key} />;
          const isBack = k === "⌫";
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.key,
                !isBack && { backgroundColor: theme.surface, ...SHADOW_SM },
              ]}
              activeOpacity={0.7}
              onPress={() => (isBack ? backspace() : press(k))}
            >
              <CustomText style={[styles.keyText, { color: theme.textPrimary, fontSize: (isBack ? 22 : 26) * fontScale }]}>
                {k}
              </CustomText>
            </TouchableOpacity>
          );
        })}
      </View>

      {onCancel && (
        <TouchableOpacity onPress={onCancel} style={styles.cancel} activeOpacity={0.7}>
          <CustomText style={[styles.cancelText, { color: theme.textSecondary }]}>ביטול</CustomText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const KEY = 74;
const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 30,
  },
  top: { alignItems: "center", marginTop: 20 },
  lockIcon: { marginBottom: 16 },
  title: { fontFamily: FONTS.bold, marginBottom: 26, textAlign: "center" },
  dots: { flexDirection: "row", gap: 18 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  pad: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: KEY * 3 + 44,
    justifyContent: "space-between",
    rowGap: 18,
  },
  key: {
    width: KEY,
    height: KEY,
    borderRadius: RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontFamily: FONTS.bold },
  cancel: { paddingVertical: 12 },
  cancelText: { fontFamily: FONTS.medium, fontSize: 15 },
});
