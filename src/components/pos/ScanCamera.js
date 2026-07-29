import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CustomText from "../CustomText";
import Icon from "../Icon";
import { hapticLight, hapticSuccess } from "../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";
import { UI } from "../../utils/ui";

// The scanner for imported stock — full-screen, nothing else on it.
//
// Full-screen is the requirement and it is not cosmetic: aiming a viewfinder
// at a barcode on a small box needs the whole display. A `Modal` with no
// transparency and no inset *is* the full screen; what would break it is a
// sheet with rounded corners and a visible backdrop, which reads as a preview
// you glance at rather than something you point.
//
// Required lazily, so a build without expo-camera still opens the register
// and says why the scanner is unavailable instead of failing to bundle.
let CameraModule = null;
try {
  // eslint-disable-next-line global-require
  CameraModule = require("expo-camera");
} catch {
  CameraModule = null;
}

export default function ScanCamera({ visible, onScanned, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      {visible ? <ScannerBody onScanned={onScanned} onClose={onClose} /> : <View style={st.screen} />}
    </Modal>
  );
}

function ScannerBody({ onScanned, onClose }) {
  const insets = useSafeAreaInsets();
  const CameraView = CameraModule?.CameraView;
  const useCameraPermissions = CameraModule?.useCameraPermissions;
  const [permission, requestPermission] = useCameraPermissions ? useCameraPermissions() : [null, null];
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission?.();
  }, [permission, requestPermission]);

  // The mock capture.
  //
  // Recognition is not wired: there is no barcode lookup and no product
  // database behind this yet, so the item it returns is a stand-in and is
  // named as one on the cart line. What is real is the plumbing either side of
  // it — camera, permission, capture, close, cart — so wiring a real decoder
  // later is a change to this one function.
  const capture = () => {
    hapticSuccess();
    onScanned();
  };

  const unavailable = !CameraView || !permission?.granted;

  return (
    <View style={st.screen}>
      {CameraView && permission?.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} />
      ) : (
        <View testID="scan-fallback" style={[StyleSheet.absoluteFill, st.fallback]}>
          <Icon name="camera-off" size={34} color="rgba(255,255,255,0.6)" />
          <CustomText style={st.fallbackTitle}>
            {!CameraModule ? "מודול המצלמה לא מותקן בבילד הזה" : "אין הרשאת מצלמה"}
          </CustomText>
          <CustomText style={st.fallbackBody}>
            {!CameraModule
              ? "הסריקה דורשת development build — היא לא זמינה ב-Expo Go."
              : "אפשר לאשר גישה למצלמה בהגדרות המכשיר ולנסות שוב."}
          </CustomText>
        </View>
      )}

      {/* Framing guides. Four corners rather than a full rectangle: a closed
          box invites you to fit the label inside it exactly, which is slower
          than simply pointing. */}
      <View style={st.frameWrap} pointerEvents="none">
        <View style={[st.corner, st.tl]} />
        <View style={[st.corner, st.tr]} />
        <View style={[st.corner, st.bl]} />
        <View style={[st.corner, st.br]} />
      </View>

      <View style={[st.top, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity testID="scan-close" style={st.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Icon name="x" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <CustomText style={st.title}>סריקת פריט</CustomText>
          <CustomText style={st.subtitle}>כוון את המצלמה לברקוד או לאריזה</CustomText>
        </View>
      </View>

      <View style={[st.bottom, { paddingBottom: insets.bottom + 22 }]}>
        <CustomText style={st.mockNote}>הזיהוי עדיין לא מחובר — הסריקה מוסיפה פריט הדגמה</CustomText>
        <TouchableOpacity
          testID="scan-capture"
          style={[st.shutter, unavailable && st.shutterMuted]}
          onPress={capture}
          activeOpacity={0.85}
        >
          {CameraView && permission?.granted && !ready ? (
            <ActivityIndicator color={UI.ink} />
          ) : (
            <View style={st.shutterInner} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const CORNER = 34;
const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },

  fallback: { alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 40 },
  fallbackTitle: { fontFamily: FONTS.bold, fontSize: 16, color: "#FFFFFF", textAlign: "center" },
  fallbackBody: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 20,
  },

  frameWrap: {
    position: "absolute",
    left: 46,
    right: 46,
    top: "30%",
    height: 220,
  },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: "rgba(255,255,255,0.9)" },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },

  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: FONTS.bold, fontSize: 17, color: "#FFFFFF", textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: 12, color: "rgba(255,255,255,0.72)", textAlign: "right", marginTop: 2 },

  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 14,
    paddingTop: 18,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  mockNote: { fontFamily: FONTS.medium, fontSize: 11.5, color: "rgba(255,255,255,0.8)", textAlign: "center" },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterMuted: { borderColor: "rgba(255,255,255,0.45)" },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#FFFFFF" },
});
