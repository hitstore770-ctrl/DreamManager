import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BatteryRange from "../components/tools/BatteryRange";
import CurrencyConverter from "../components/tools/CurrencyConverter";
import ProfitCalculator from "../components/tools/ProfitCalculator";
import ReceiptsArchive from "../components/tools/ReceiptsArchive";
import ShiftManager from "../components/tools/ShiftManager";
import SplitBill from "../components/tools/SplitBill";
import StudyTimer from "../components/tools/StudyTimer";
import VatCalculator from "../components/tools/VatCalculator";
import WorldClock from "../components/tools/WorldClock";
import ZmanimTool from "../components/tools/ZmanimTool";
import { COLORS, FONTS } from "../utils/theme";

const TOOLS = [
  { key: "profit", label: "מחשבון תמחור ורווחיות", emoji: "💰", Component: ProfitCalculator },
  { key: "battery", label: "טווח סוללה לקורקינט", emoji: "🛴", Component: BatteryRange },
  { key: "currency", label: "המרת מטבעות", emoji: "💱", Component: CurrencyConverter },
  { key: "worldclock", label: "שעון עולמי", emoji: "🌍", Component: WorldClock },
  { key: "split", label: "חלוקת הוצאות", emoji: "👥", Component: SplitBill },
  { key: "vat", label: 'מחשבון מע״מ 17%', emoji: "🧾", Component: VatCalculator },
  { key: "receipts", label: "ארכיון קבלות", emoji: "🗂️", Component: ReceiptsArchive },
  { key: "timer", label: "טיימר לימודים", emoji: "⏱️", Component: StudyTimer },
  { key: "shifts", label: "ניהול משמרות", emoji: "📅", Component: ShiftManager },
  { key: "zmanim", label: "זמני היום - הלכה", emoji: "🕯️", Component: ZmanimTool },
];

export default function ToolsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeTool, setActiveTool] = useState(null);

  const ActiveComponent = activeTool?.Component;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.headerTitle}>🛠️ ארגז כלים</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>חזרה</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {TOOLS.map((tool) => (
            <TouchableOpacity
              key={tool.key}
              style={styles.toolCard}
              onPress={() => setActiveTool(tool)}
              activeOpacity={0.85}
            >
              <Text style={styles.toolEmoji}>{tool.emoji}</Text>
              <Text style={styles.toolLabel}>{tool.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={activeTool !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveTool(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setActiveTool(null)}
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {activeTool ? `${activeTool.emoji}  ${activeTool.label}` : ""}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setActiveTool(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {ActiveComponent && <ActiveComponent />}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontFamily: FONTS.bold,
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: FONTS.regular,
  },
  gridContent: {
    paddingBottom: 30,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  toolCard: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  toolEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  toolLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.medium,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.35)",
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 18,
    fontFamily: FONTS.bold,
    textAlign: "right",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(17, 24, 39, 0.05)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginStart: 12,
  },
  closeButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: FONTS.medium,
  },
});
