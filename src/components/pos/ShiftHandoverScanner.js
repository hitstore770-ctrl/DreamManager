import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CustomText from "../CustomText";
import Icon from "../Icon";
import { hapticSuccess } from "../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../utils/notesTheme";

// A second, purpose-built camera screen rather than a mode flag on
// ScanCamera.js — that scanner's copy ("סריקת פריט" / point at a barcode) is
// written for adding a product to a sale, and this one is doing something
// unrelated: the Main Admin reading a QR a sub-agent generated when closing
// their shift. Same underlying expo-camera plumbing, different job, so it
// stays a fork rather than a shared component quietly serving two purposes.
let CameraModule = null;
try {
  // eslint-disable-next-line global-require
  CameraModule = require("expo-camera");
} catch {
  CameraModule = null;
}

export default function ShiftHandoverScanner({ visible, onScanned, onClose }) {
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
  const [manualCode, setManualCode] = useState("");
  const handledRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission?.();
  }, [permission, requestPermission]);

  const handleBarcode = ({ data }) => {
    if (handledRef.current || !data) return;
    handledRef.current = true;
    hapticSuccess();
    onScanned(data);
  };

  const submitManual = () => {
    const code = manualCode.trim();
    if (!code) return;
    hapticSuccess();
    onScanned(code);
  };

  const cameraOk = !!CameraView && !!permission?.granted;
  const permissionDenied = !!CameraView && !!permission && !permission.granted;

  return (
    <View style={st.screen}>
      {cameraOk ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => setReady(true)}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleBarcode}
        />
      ) : (
        <View testID="handover-scan-fallback" style={[StyleSheet.absoluteFill, st.fallback]}>
          <Icon name="camera-off" size={34} color="rgba(255,255,255,0.6)" />
          <CustomText style={st.fallbackTitle}>
            {!CameraModule ? "מודול המצלמה לא מותקן בבילד הזה" : "אין הרשאת מצלמה"}
          </CustomText>
          <CustomText style={st.fallbackBody}>
            {!CameraModule
              ? "הסריקה דורשת development build — היא לא זמינה ב-Expo Go."
              : permissionDenied
                ? "אפשר לאשר גישה למצלמה בהגדרות המכשיר ולנסות שוב."
                : "מבקש הרשאת מצלמה…"}
          </CustomText>
          <View style={st.manualRow}>
            <TextInput
              testID="handover-scan-manual-input"
              style={st.manualInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="הדבקת קוד ה-QR ידנית"
              placeholderTextColor="rgba(255,255,255,0.5)"
              textAlign="center"
              returnKeyType="done"
              onSubmitEditing={submitManual}
            />
            <TouchableOpacity
              testID="handover-scan-manual-submit"
              style={[st.manualBtn, !manualCode.trim() && { opacity: 0.4 }]}
              onPress={submitManual}
              disabled={!manualCode.trim()}
              activeOpacity={0.8}
            >
              <Icon name="check" size={18} color="#000000" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={st.frameWrap} pointerEvents="none">
        <View style={[st.corner, st.tl]} />
        <View style={[st.corner, st.tr]} />
        <View style={[st.corner, st.bl]} />
        <View style={[st.corner, st.br]} />
      </View>

      <View style={[st.top, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity testID="handover-scan-close" style={st.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Icon name="x" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <CustomText style={st.title}>קליטת החזרת משמרת</CustomText>
          <CustomText style={st.subtitle}>סרקו את קוד ה-QR שהציג הסוכן בסגירת המשמרת</CustomText>
        </View>
      </View>

      {cameraOk && (
        <View style={[st.bottom, { paddingBottom: insets.bottom + 22 }]}>
          {!ready && <ActivityIndicator color="#FFFFFF" />}
        </View>
      )}
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
  manualRow: { flexDirection: "row", gap: 8, marginTop: 14, width: "100%" },
  manualInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#FFFFFF",
  },
  manualBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  frameWrap: { position: "absolute", left: 46, right: 46, top: "30%", height: 220 },
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
});
