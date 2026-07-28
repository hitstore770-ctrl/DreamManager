import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Bounce from "../components/Bounce";
import CustomText from "../components/CustomText";
import Icon from "../components/Icon";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { UI } from "../utils/ui";

// Noa's eyes — a full-screen camera, not a modal.
//
// The distinction is not cosmetic. A camera in a sheet is a preview you glance
// at; a camera that owns the screen is a viewfinder you aim. Framing a
// component's part number or a label needs the second one, and the rounded
// corners and backdrop of a modal actively fight it.
//
// The capture is handed straight back to the caller through a route callback
// rather than pushed into global state, so the screen has no idea what the
// image is for and stays reusable.

let CameraModule = null;
try {
  // eslint-disable-next-line global-require
  CameraModule = require("expo-camera");
} catch {
  CameraModule = null;
}

export default function VisionCameraScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState("back");

  const CameraView = CameraModule?.CameraView;
  const usePermissions = CameraModule?.useCameraPermissions;
  const [permission, requestPermission] = usePermissions ? usePermissions() : [null, null];

  const onCaptured = route?.params?.onCaptured;

  const shoot = async () => {
    if (!cameraRef.current || busy) return;
    hapticLight();
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        // Vision APIs take base64 directly, which avoids a second read of the
        // file just to upload it.
        base64: true,
        skipProcessing: true,
      });
      hapticSuccess();
      onCaptured?.(photo);
      navigation?.goBack();
    } catch {
      hapticWarning();
      setBusy(false);
    }
  };

  // No module, or no permission API: say so rather than showing a black screen.
  if (!CameraView) {
    return (
      <Fallback
        insets={insets}
        navigation={navigation}
        title="המצלמה לא זמינה"
        body="expo-camera לא נטען בסביבה הזו. במכשיר עם build מלא זה יעבוד."
      />
    );
  }

  if (permission && !permission.granted) {
    return (
      <Fallback
        insets={insets}
        navigation={navigation}
        title="צריך גישה למצלמה"
        body="נועה צריכה לראות כדי לזהות רכיב או תווית."
        actionLabel="אשר גישה"
        onAction={requestPermission}
      />
    );
  }

  return (
    <View style={s.screen}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />

      {/* Framing guides. Corner marks rather than a full rectangle: they show
          where the frame is without covering the thing being aimed at. */}
      <View style={s.guides} pointerEvents="none">
        <View style={[s.corner, s.tl]} />
        <View style={[s.corner, s.tr]} />
        <View style={[s.corner, s.bl]} />
        <View style={[s.corner, s.br]} />
      </View>

      <View style={[s.top, { paddingTop: insets.top + 10 }]}>
        <Bounce testID="vision-close" style={s.roundBtn} scaleTo={0.9} onPress={() => navigation?.goBack()}>
          <Icon name="x" size={20} color="#FFFFFF" />
        </Bounce>
        <CustomText weight="bold" style={s.topLabel}>כוון על מה שצריך לזהות</CustomText>
        <Bounce
          testID="vision-flip"
          style={s.roundBtn}
          scaleTo={0.9}
          onPress={() => { hapticLight(); setFacing((f) => (f === "back" ? "front" : "back")); }}
        >
          <Icon name="refresh-cw" size={18} color="#FFFFFF" />
        </Bounce>
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 26 }]}>
        <Bounce testID="vision-shoot" style={s.shutter} scaleTo={0.9} onPress={shoot} disabled={busy}>
          <View style={s.shutterRing}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <View style={s.shutterCore} />}
          </View>
        </Bounce>
      </View>
    </View>
  );
}

function Fallback({ insets, navigation, title, body, actionLabel, onAction }) {
  return (
    <View testID="vision-fallback" style={[s.screen, s.fallback, { paddingTop: insets.top + 20 }]}>
      <Icon name="camera-off" size={34} color="rgba(255,255,255,0.7)" />
      <CustomText weight="bold" style={s.fbTitle}>{title}</CustomText>
      <CustomText style={s.fbBody}>{body}</CustomText>
      {!!onAction && (
        <Bounce style={s.fbBtn} scaleTo={0.95} onPress={onAction}>
          <CustomText weight="bold" style={s.fbBtnText}>{actionLabel}</CustomText>
        </Bounce>
      )}
      <Bounce style={[s.fbBtn, s.fbGhost]} scaleTo={0.95} onPress={() => navigation?.goBack()}>
        <CustomText weight="bold" style={s.fbBtnText}>חזרה</CustomText>
      </Bounce>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  fallback: { alignItems: "center", justifyContent: "center", gap: 10, padding: 30 },
  fbTitle: { fontSize: 19, color: "#FFFFFF", marginTop: 8 },
  fbBody: { fontSize: 14, color: "rgba(255,255,255,0.72)", textAlign: "center", lineHeight: 21 },
  fbBtn: {
    minHeight: 48, alignSelf: "stretch", borderRadius: UI.radius,
    backgroundColor: UI.violet, alignItems: "center", justifyContent: "center", marginTop: 10,
  },
  fbGhost: { backgroundColor: "rgba(255,255,255,0.14)" },
  fbBtnText: { fontSize: 15, color: "#FFFFFF" },

  guides: { ...StyleSheet.absoluteFillObject, margin: 46 },
  corner: { position: "absolute", width: 34, height: 34, borderColor: "rgba(255,255,255,0.85)" },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },

  top: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
  },
  topLabel: { fontSize: 13, color: "rgba(255,255,255,0.9)" },
  roundBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center",
  },

  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center" },
  shutter: { alignItems: "center", justifyContent: "center" },
  shutterRing: {
    width: 74, height: 74, borderRadius: 37,
    borderWidth: 4, borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
  },
  shutterCore: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FFFFFF" },
});
