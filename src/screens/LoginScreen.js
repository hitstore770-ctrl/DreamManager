import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "../context/AuthContext";
import { BRUTAL_BORDER, BRUTAL_SHADOW, BRUTAL_SHADOW_SM, COLORS, FONTS, RADIUS } from "../utils/theme";

export default function LoginScreen() {
  const { signInWithGoogle, isAuthenticating } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoBox}>
          <Text style={styles.logo}>💪</Text>
        </View>
        <Text style={styles.title}>יאללה לעבודה</Text>
        <Text style={styles.subtitle}>
          הפרויקטים, הכספים והזמן שלך - הכל במקום אחד. בוא נראה כסף.
        </Text>

        <TouchableOpacity
          style={[styles.googleButton, isAuthenticating && styles.googleButtonDisabled]}
          onPress={signInWithGoogle}
          disabled={isAuthenticating}
          activeOpacity={0.85}
        >
          {isAuthenticating ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <>
              <View style={styles.googleBadge}>
                <Text style={styles.googleBadgeText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>התחבר באמצעות גוגל</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    padding: 28,
    borderRadius: RADIUS,
    backgroundColor: COLORS.card,
    alignItems: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: RADIUS,
    backgroundColor: COLORS.mustard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  logo: {
    fontSize: 38,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontFamily: FONTS.bold,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 32,
    lineHeight: 21,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 54,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  googleButtonDisabled: {
    opacity: 0.75,
  },
  googleBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: 12,
  },
  googleBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  googleButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
});
