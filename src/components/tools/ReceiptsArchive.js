import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { STORAGE_KEYS } from "../../utils/storageKeys";
import { COLORS, FONTS } from "../../utils/theme";
import { ToolButton } from "./ToolKit";

export default function ReceiptsArchive() {
  const [receipts, setReceipts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.receipts);
        const parsed = stored ? JSON.parse(stored) : [];
        setReceipts(Array.isArray(parsed) ? parsed : []);
      } catch {
        setReceipts([]);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = (next) => {
    setReceipts(next);
    AsyncStorage.setItem(STORAGE_KEYS.receipts, JSON.stringify(next)).catch(() => {});
  };

  const addReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert("נדרשת הרשאה לגלריה כדי לצרף קבלה");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled) {
      persist([result.assets[0].uri, ...receipts]);
    }
  };

  const removeReceipt = (uri) => {
    persist(receipts.filter((item) => item !== uri));
  };

  return (
    <View>
      <ToolButton label="הוסף קבלה 📷" onPress={addReceipt} style={styles.addButton} />

      {loaded && receipts.length === 0 ? (
        <Text style={styles.emptyText}>עדיין לא נשמרו קבלות</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {receipts.map((uri) => (
            <View key={uri} style={styles.thumbWrapper}>
              <Image source={{ uri }} style={styles.thumb} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeReceipt(uri)}
                activeOpacity={0.8}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    marginBottom: 18,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: "center",
    paddingVertical: 20,
  },
  list: {
    paddingVertical: 4,
    gap: 12,
  },
  thumbWrapper: {
    position: "relative",
  },
  thumb: {
    width: 120,
    height: 160,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(17, 24, 39, 0.04)",
  },
  removeButton: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
});
