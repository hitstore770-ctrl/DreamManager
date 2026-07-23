import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { withTimeout } from "../../utils/network";
import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton, ToolCopyButton, ToolError, ToolLoading } from "./ToolKit";

const OCR_URL = "https://api.ocr.space/parse/image";

export default function OCRTool() {
  const [imageUri, setImageUri] = useState(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

  const pickAndScan = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert("נדרשת הרשאת גלריה כדי לזהות טקסט מתמונה");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.6,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setStatus("loading");
    setText("");
    try {
      const body = new FormData();
      body.append("base64Image", `data:image/jpeg;base64,${asset.base64}`);
      body.append("apikey", "helloworld"); // ocr.space public demo key
      body.append("language", "eng");
      body.append("OCREngine", "2");

      const response = await withTimeout(fetch(OCR_URL, { method: "POST", body }), 20000);
      const json = await response.json();
      const parsed = json?.ParsedResults?.[0]?.ParsedText?.trim();
      setText(parsed || "לא זוהה טקסט בתמונה");
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  return (
    <View>
      <Text style={styles.hint}>בחרו תמונה עם טקסט וזהו אותו אוטומטית.</Text>

      {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />}

      <ToolButton label="בחר תמונה וזהה טקסט 🔍" onPress={pickAndScan} style={styles.button} />

      {status === "loading" && <ToolLoading label="מזהה טקסט..." />}
      {status === "error" && (
        <ToolError message="שגיאה בזיהוי הטקסט. בדקו את חיבור האינטרנט ונסו שוב." onRetry={pickAndScan} />
      )}
      {status === "ready" && (
        <View style={styles.resultCard}>
          <Text style={styles.resultText} selectable>
            {text}
          </Text>
          <ToolCopyButton text={text} label="העתק טקסט" color="#1E9E58" style={styles.copy} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: COLORS.textSecondary, fontSize: 14, fontFamily: FONTS.regular, textAlign: "right", marginBottom: 14 },
  preview: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    backgroundColor: "rgba(45,42,50,0.04)",
  },
  button: { marginBottom: 4 },
  resultCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(45, 42, 50, 0.04)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.regular,
    textAlign: "right",
    lineHeight: 22,
    marginBottom: 14,
  },
  copy: { alignSelf: "stretch" },
});
