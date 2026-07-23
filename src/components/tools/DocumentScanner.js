import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton } from "./ToolKit";

// A5 portrait aspect for crop constraints (document / sticker printing).
const A5_ASPECT = [148, 210];

export default function DocumentScanner() {
  const [imageUri, setImageUri] = useState(null);

  const captureDocument = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      alert("נדרשת הרשאת מצלמה כדי לסרוק מסמך");
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: A5_ASPECT,
        quality: 1,
      });
      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      alert("שגיאה בפתיחת המצלמה");
    }
  };

  return (
    <View>
      <Text style={styles.hint}>
        סריקה מותאמת להדפסת מסמכים ומדבקות בגודל A5 (148×210 מ״מ).
      </Text>

      {imageUri ? (
        <View style={styles.previewWrapper}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          <View style={styles.a5Badge}>
            <Text style={styles.a5BadgeText}>A5</Text>
          </View>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setImageUri(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderEmoji}>📄</Text>
          <Text style={styles.placeholderText}>לא נסרק מסמך עדיין</Text>
        </View>
      )}

      <ToolButton
        label={imageUri ? "סרוק מחדש 📸" : "סרוק מסמך 📸"}
        onPress={captureDocument}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: "right",
    lineHeight: 19,
    marginBottom: 16,
  },
  previewWrapper: {
    position: "relative",
    alignItems: "center",
    marginBottom: 18,
  },
  preview: {
    width: "70%",
    aspectRatio: 148 / 210,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(17, 24, 39, 0.04)",
  },
  a5Badge: {
    position: "absolute",
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(17, 24, 39, 0.6)",
  },
  a5BadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  clearButton: {
    position: "absolute",
    top: 8,
    left: "17%",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  placeholderBox: {
    paddingVertical: 36,
    borderRadius: 16,
    backgroundColor: "rgba(17, 24, 39, 0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    alignItems: "center",
    marginBottom: 18,
  },
  placeholderEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  placeholderText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
});
