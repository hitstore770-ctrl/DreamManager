import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import Bounce from "../components/Bounce";
import Pulse from "../components/Pulse";
import { useAuth } from "../context/AuthContext";
import { hapticLight } from "../utils/haptics";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";
import { UI, glow } from "../utils/ui";

// The gate. Nothing else in the app renders until Firebase reports a session.

export default function LoginScreen() {
  const { signInWithGoogle, isAuthenticating, authError } = useAuth();

  return (
    <View style={s.container}>
      {/* Ambient colour wash — two soft blobs behind the card. */}
      <View pointerEvents="none" style={[s.blob, s.blobViolet]} />
      <View pointerEvents="none" style={[s.blob, s.blobCyan]} />

      <Animated.View entering={FadeInDown.duration(520).springify().damping(16)} style={s.card}>
        <Pulse style={s.markPulse} max={1.05} duration={1600}>
          <View style={s.mark}>
            <Text style={s.markText}>770</Text>
          </View>
        </Pulse>

        <Animated.Text entering={FadeIn.delay(180).duration(420)} style={s.title}>
          DreamManager
        </Animated.Text>
        <Animated.Text entering={FadeIn.delay(280).duration(420)} style={s.subtitle}>
          הקופה, המלאי, הפתקים והחלומות שלך — הכול במקום אחד, מסונכרן בענן.
        </Animated.Text>

        <Animated.View entering={FadeInUp.delay(380).duration(460).springify().damping(14)} style={{ width: "100%" }}>
          <Bounce
            testID="google-signin"
            style={[s.googleBtn, isAuthenticating && { opacity: 0.7 }]}
            onPress={() => {
              hapticLight();
              signInWithGoogle();
            }}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <View style={s.gBadge}>
                  <Text style={s.gBadgeText}>G</Text>
                </View>
                <Text style={s.googleBtnText}>התחבר באמצעות Google</Text>
              </>
            )}
          </Bounce>
        </Animated.View>

        {!!authError && (
          <Animated.View entering={FadeIn.duration(240)} style={s.errorBox}>
            <Text style={s.errorText}>{authError}</Text>
          </Animated.View>
        )}

        <Text style={s.legal}>הכניסה מסנכרנת את הנתונים שלך לחשבון Google.</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    overflow: "hidden",
  },

  blob: { position: "absolute", width: 320, height: 320, borderRadius: 160, opacity: 0.16 },
  blobViolet: { backgroundColor: UI.violet, top: -90, right: -80 },
  blobCyan: { backgroundColor: UI.cyan, bottom: -110, left: -90 },

  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: UI.surface,
    borderRadius: UI.radiusLg,
    paddingVertical: 34,
    paddingHorizontal: 24,
    alignItems: "center",
    ...glow(UI.violet, 0.14),
  },

  markPulse: {
    borderRadius: 34,
    shadowColor: UI.violet,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 26,
    elevation: 10,
    marginBottom: 18,
  },
  mark: {
    width: 84,
    height: 84,
    borderRadius: 30,
    backgroundColor: UI.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { fontFamily: FONTS.bold, fontSize: 30, color: "#FFFFFF", letterSpacing: 1 },

  title: { fontFamily: FONTS.bold, fontSize: 25, color: UI.ink, marginBottom: 8 },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: UI.inkSoft,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 26,
  },

  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 58,
    borderRadius: 24,
    backgroundColor: UI.violet,
    ...glow(UI.violet, 0.38),
  },
  gBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  gBadgeText: { fontFamily: FONTS.bold, fontSize: 16, color: UI.violet },
  googleBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: "#FFFFFF" },

  errorBox: {
    marginTop: 16,
    backgroundColor: UI.red + "14",
    borderRadius: UI.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: { fontFamily: FONTS.medium, fontSize: 12.5, color: UI.red, textAlign: "center", lineHeight: 19 },

  legal: { fontFamily: FONTS.regular, fontSize: 11, color: UI.inkMuted, textAlign: "center", marginTop: 18 },
});
