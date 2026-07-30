import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";

import Bounce from "./Bounce";
import CustomText from "./CustomText";
import Icon from "./Icon";
import { Card } from "./Paper";
import { useSettings } from "../context/SettingsContext";
import { hapticSuccess, hapticWarning } from "../utils/haptics";
import { TYPE, UI, tint } from "../utils/ui";

// Face ID / fingerprint in front of the app.
//
// The gate has to fail *open* in exactly the cases where failing closed would
// be a lockout rather than security:
//
//   - no biometric hardware (web, an emulator, an older phone)
//   - hardware present but nothing enrolled
//
// In both, requiring a biometric would make the app permanently unopenable on
// that device, and there is no password path behind it to fall back to. What
// it must never do is fail open after a real prompt was shown and *refused* —
// that is a user saying no, and it is honoured until they try again.
//
// This is deliberately the weaker of the two available guarantees. It keeps a
// casual passer-by out of the app; it is not protection against someone who
// controls the device, because the data behind it is not encrypted with the
// biometric. Saying so here so nobody mistakes it for a vault.

let LocalAuth = null;
try {
  // eslint-disable-next-line global-require
  LocalAuth = require("expo-local-authentication");
} catch {
  LocalAuth = null;
}

export default function BiometricGate({ children }) {
  // Off unless the user turned it on in Settings, and off until settings have
  // actually loaded — otherwise the first frame prompts for a fingerprint
  // against the default value and then retracts it once the real one arrives.
  const { biometricLock, loaded: settingsLoaded } = useSettings();
  const enabled = settingsLoaded && biometricLock === true;

  const [state, setState] = useState("checking"); // checking | locked | open
  const [reason, setReason] = useState(null);

  const attempt = useCallback(async () => {
    if (!enabled || !LocalAuth || Platform.OS === "web") {
      setState("open");
      return;
    }
    try {
      const [hasHardware, enrolled] = await Promise.all([
        LocalAuth.hasHardwareAsync(),
        LocalAuth.isEnrolledAsync(),
      ]);
      // Nothing to authenticate against — opening is the only sane outcome.
      if (!hasHardware || !enrolled) {
        setState("open");
        return;
      }

      setState("locked");
      const res = await LocalAuth.authenticateAsync({
        promptMessage: "אימות כדי להיכנס",
        cancelLabel: "ביטול",
        // Leave the system PIN/pattern available: a wet or cold finger should
        // not mean the owner cannot open their own app.
        disableDeviceFallback: false,
      });

      if (res.success) {
        hapticSuccess();
        setState("open");
        setReason(null);
      } else {
        hapticWarning();
        setReason(res.error === "user_cancel" ? "האימות בוטל" : "האימות נכשל");
      }
    } catch {
      // A thrown check is not a refusal — treat it like absent hardware.
      setState("open");
    }
  }, [enabled]);

  // Launch only.
  //
  // Once the gate has opened it stays open for the session. Re-running it when
  // `biometricLock` flips would slam the lock screen over Settings the moment
  // the switch is turned on — and if that prompt were then cancelled the user
  // could not reach the switch to turn it back off. A lock you can enable but
  // not disable is a lockout, not a feature.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    attempt();
  }, [attempt]);
  useEffect(() => {
    if (state === "open") opened.current = true;
  }, [state]);

  if (state === "open") return children;

  return (
    <View style={s.screen}>
      <Card style={s.card} radius={UI.radiusLg}>
        <View style={s.inner}>
          <View style={s.badge}>
            <Icon name="lock" size={30} color={UI.violet} />
          </View>
          <CustomText weight="bold" style={s.title}>
            נעול
          </CustomText>
          <CustomText style={s.body}>
            {state === "checking" ? "בודק אמצעי אימות..." : reason || "אמת את הזהות שלך כדי להמשיך"}
          </CustomText>

          {state === "checking" ? (
            <ActivityIndicator color={UI.violet} style={{ marginTop: 8 }} />
          ) : (
            <Bounce testID="biometric-retry" style={s.btn} scaleTo={0.95} onPress={attempt}>
              <Icon name="unlock" size={17} color="#FFFFFF" />
              <CustomText weight="bold" style={s.btnText}>
                פתח
              </CustomText>
            </Bounce>
          )}
        </View>
      </Card>
    </View>
  );
}

const ROW = Platform.OS === "web" ? "row-reverse" : "row";

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg, alignItems: "center", justifyContent: "center", padding: 28 },
  card: { width: "100%", maxWidth: 340 },
  inner: { alignItems: "center", padding: 30, gap: 10 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: tint(UI.violet, 0.12),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: { fontSize: TYPE.title, color: UI.ink },
  body: { fontSize: TYPE.body, color: UI.inkSoft, textAlign: "center", lineHeight: 22 },
  btn: {
    flexDirection: ROW,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    alignSelf: "stretch",
    borderRadius: UI.radius,
    backgroundColor: UI.violet,
    marginTop: 10,
  },
  btnText: { fontSize: 15.5, color: "#FFFFFF" },
});
