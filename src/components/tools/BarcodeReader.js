import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton, ToolCopyButton, ToolResultCard } from "./ToolKit";

const BARCODE_TYPES = ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"];

export default function BarcodeReader() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(null);

  // Permissions still loading.
  if (!permission) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.infoText}>טוען הרשאות מצלמה...</Text>
      </View>
    );
  }

  // Permission not granted yet.
  if (!permission.granted) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.emoji}>📷</Text>
        <Text style={styles.infoText}>נדרשת הרשאת מצלמה כדי לסרוק ברקודים</Text>
        <ToolButton label="אשר גישה למצלמה" onPress={requestPermission} style={styles.grantButton} />
      </View>
    );
  }

  const handleScan = ({ data }) => {
    if (!scanned) {
      setScanned(data);
    }
  };

  return (
    <View>
      {scanned ? (
        <ToolResultCard>
          <Text style={styles.scannedLabel}>תוצאת הסריקה</Text>
          <Text style={styles.scannedText} selectable>
            {scanned}
          </Text>
          <View style={styles.buttonRow}>
            <ToolCopyButton text={scanned} label="העתק" color="#1E9E58" />
            <View style={styles.gap} />
            <ToolButton
              label="סרוק שוב"
              onPress={() => setScanned(null)}
              color={COLORS.textMuted}
            />
          </View>
        </ToolResultCard>
      ) : (
        <View style={styles.cameraWrapper}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={handleScan}
          />
          <Text style={styles.hint}>כוונו את המצלמה אל הברקוד</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerBox: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    marginBottom: 16,
  },
  grantButton: {
    alignSelf: "stretch",
  },
  cameraWrapper: {
    alignItems: "center",
  },
  camera: {
    width: "100%",
    height: 300,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.regular,
    marginTop: 14,
  },
  scannedLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: "right",
  },
  scannedText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.medium,
    textAlign: "center",
    marginVertical: 12,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  gap: {
    width: 12,
  },
});
