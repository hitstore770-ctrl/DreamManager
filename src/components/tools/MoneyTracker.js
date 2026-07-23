import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { formatShekel } from "../../utils/format";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import { usePersistentState } from "../../utils/usePersistentState";
import { BRUTAL_BORDER, BRUTAL_SHADOW_SM, COLORS, FONTS, RADIUS } from "../../utils/theme";
import PieChart from "./PieChart";

const EXPENSE_CATEGORIES = [
  { key: "food", label: "אוכל", color: "#E23B3B" },
  { key: "fuel", label: "דלק", color: "#F4B400" },
  { key: "gear", label: "ציוד", color: "#1B3A6B" },
  { key: "rent", label: "שכירות", color: "#7C3AED" },
  { key: "shopping", label: "קניות", color: "#E07C1D" },
  { key: "other", label: "אחר", color: "#6B7280" },
];

const INCOME_CATEGORIES = [
  { key: "sale", label: "מכירה", color: "#1E9E58" },
  { key: "salary", label: "שכר", color: "#2563EB" },
  { key: "tips", label: "טיפים", color: "#0EA5A5" },
  { key: "other_in", label: "אחר", color: "#6B7280" },
];

function categoryOf(kind, key) {
  const list = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return list.find((c) => c.key === key) ?? list[list.length - 1];
}

export default function MoneyTracker() {
  const [entries, setEntries] = usePersistentState(STORAGE_KEYS.money, []);
  const [debts, setDebts] = usePersistentState(STORAGE_KEYS.debts, []);

  const [kind, setKind] = useState("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [catKey, setCatKey] = useState("food");

  const [person, setPerson] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [direction, setDirection] = useState("owedToMe");

  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    entries.forEach((e) => {
      if (e.kind === "income") income += e.amount;
      else expense += e.amount;
    });
    return { income, expense, net: income - expense };
  }, [entries]);

  const pieData = useMemo(() => {
    const byCat = {};
    entries
      .filter((e) => e.kind === "expense")
      .forEach((e) => {
        byCat[e.category] = (byCat[e.category] || 0) + e.amount;
      });
    return EXPENSE_CATEGORIES.map((c) => ({
      label: c.label,
      value: byCat[c.key] || 0,
      color: c.color,
    })).filter((d) => d.value > 0);
  }, [entries]);

  const debtTotals = useMemo(() => {
    let owedToMe = 0;
    let iOwe = 0;
    debts
      .filter((d) => !d.settled)
      .forEach((d) => {
        if (d.direction === "owedToMe") owedToMe += d.amount;
        else iOwe += d.amount;
      });
    return { owedToMe, iOwe };
  }, [debts]);

  const switchKind = (next) => {
    setKind(next);
    setCatKey(next === "income" ? "sale" : "food");
  };

  const addEntry = () => {
    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) {
      alert("נא להזין סכום תקין");
      return;
    }
    const entry = {
      id: Date.now().toString(),
      kind,
      amount: value,
      category: catKey,
      note: note.trim(),
      date: new Date().toISOString(),
    };
    setEntries((prev) => [entry, ...prev]);
    setAmount("");
    setNote("");
  };

  // OCR structure: pick a receipt image and pre-create an expense entry that
  // is flagged as awaiting text recognition. The pipeline is ready to plug a
  // real OCR call in here later.
  const scanReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert("נדרשת הרשאה לגלריה כדי לסרוק קבלה");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
    });
    if (result.canceled) return;
    const entry = {
      id: Date.now().toString(),
      kind: "expense",
      amount: 0,
      category: "other",
      note: "קבלה סרוקה — ממתין לזיהוי OCR",
      date: new Date().toISOString(),
      imageUri: result.assets[0].uri,
      pendingOcr: true,
    };
    setEntries((prev) => [entry, ...prev]);
    alert("הקבלה נשמרה. מבנה ה-OCR מוכן — עדכן את הסכום ידנית בינתיים.");
  };

  const removeEntry = (id) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const addDebt = () => {
    const value = Number(debtAmount);
    if (!person.trim()) {
      alert("נא להזין שם");
      return;
    }
    if (Number.isNaN(value) || value <= 0) {
      alert("נא להזין סכום תקין");
      return;
    }
    const debt = {
      id: Date.now().toString(),
      person: person.trim(),
      amount: value,
      direction,
      settled: false,
    };
    setDebts((prev) => [debt, ...prev]);
    setPerson("");
    setDebtAmount("");
  };

  const toggleSettled = (id) =>
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, settled: !d.settled } : d)));
  const removeDebt = (id) => setDebts((prev) => prev.filter((d) => d.id !== id));

  return (
    <View>
      {/* Net profit dashboard */}
      <View style={styles.dashboard}>
        <View style={styles.dashRow}>
          <View style={[styles.dashCell, { backgroundColor: COLORS.success }]}>
            <Text style={styles.dashCellLabel}>הכנסות</Text>
            <Text style={styles.dashCellValue}>{formatShekel(totals.income)}</Text>
          </View>
          <View style={[styles.dashCell, { backgroundColor: COLORS.danger }]}>
            <Text style={styles.dashCellLabel}>הוצאות</Text>
            <Text style={styles.dashCellValue}>{formatShekel(totals.expense)}</Text>
          </View>
        </View>
        <View
          style={[
            styles.netBanner,
            { backgroundColor: totals.net >= 0 ? COLORS.navy : COLORS.danger },
          ]}
        >
          <Text style={styles.netLabel}>רווח נקי (Net)</Text>
          <Text style={styles.netValue}>{formatShekel(totals.net)}</Text>
        </View>
      </View>

      {/* Expense pie chart */}
      <Text style={styles.sectionTitle}>פילוח הוצאות</Text>
      <View style={styles.pieWrap}>
        <PieChart data={pieData} size={150} />
        <View style={styles.legend}>
          {pieData.length === 0 ? (
            <Text style={styles.emptyText}>עדיין אין הוצאות</Text>
          ) : (
            pieData.map((d) => (
              <View key={d.label} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                <Text style={styles.legendText}>
                  {d.label} · {formatShekel(d.value)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Add entry */}
      <Text style={styles.sectionTitle}>רישום תנועה</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, kind === "expense" && styles.toggleButtonExpense]}
          onPress={() => switchKind("expense")}
          activeOpacity={0.85}
        >
          <Text style={[styles.toggleText, kind === "expense" && styles.toggleTextActive]}>
            הוצאה
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, kind === "income" && styles.toggleButtonIncome]}
          onPress={() => switchKind("income")}
          activeOpacity={0.85}
        >
          <Text style={[styles.toggleText, kind === "income" && styles.toggleTextActive]}>
            הכנסה
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chipsRow}>
        {categories.map((c) => {
          const selected = c.key === catKey;
          return (
            <TouchableOpacity
              key={c.key}
              style={[styles.chip, selected && { backgroundColor: c.color }]}
              onPress={() => setCatKey(c.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, selected && { color: "#FFFFFF" }]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="סכום ₪"
        placeholderTextColor={COLORS.textMuted}
        keyboardType="numeric"
        textAlign="right"
      />
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder="הערה (לא חובה)"
        placeholderTextColor={COLORS.textMuted}
        textAlign="right"
      />
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.addButton} onPress={addEntry} activeOpacity={0.85}>
          <Text style={styles.addButtonText}>הוסף תנועה</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.scanButton} onPress={scanReceipt} activeOpacity={0.85}>
          <Text style={styles.scanButtonText}>סרוק קבלה 📷</Text>
        </TouchableOpacity>
      </View>

      {/* Recent entries */}
      {entries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>תנועות אחרונות</Text>
          {entries.slice(0, 12).map((e) => {
            const cat = categoryOf(e.kind, e.category);
            return (
              <View key={e.id} style={styles.entryRow}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeEntry(e.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteButtonText}>✕</Text>
                </TouchableOpacity>
                <View style={styles.entryInfo}>
                  <View style={styles.entryTop}>
                    <View style={[styles.entryCatDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.entryCat}>{cat.label}</Text>
                  </View>
                  {!!e.note && <Text style={styles.entryNote}>{e.note}</Text>}
                </View>
                <Text
                  style={[
                    styles.entryAmount,
                    { color: e.kind === "income" ? COLORS.success : COLORS.danger },
                  ]}
                >
                  {e.kind === "income" ? "+" : "-"}
                  {formatShekel(e.amount)}
                </Text>
              </View>
            );
          })}
        </>
      )}

      {/* Debts / owed */}
      <Text style={styles.sectionTitle}>חובות ופתוחים</Text>
      <View style={styles.debtSummaryRow}>
        <View style={[styles.debtSummary, { backgroundColor: COLORS.success }]}>
          <Text style={styles.debtSummaryLabel}>חייבים לי</Text>
          <Text style={styles.debtSummaryValue}>{formatShekel(debtTotals.owedToMe)}</Text>
        </View>
        <View style={[styles.debtSummary, { backgroundColor: COLORS.danger }]}>
          <Text style={styles.debtSummaryLabel}>אני חייב</Text>
          <Text style={styles.debtSummaryValue}>{formatShekel(debtTotals.iOwe)}</Text>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, direction === "owedToMe" && styles.toggleButtonIncome]}
          onPress={() => setDirection("owedToMe")}
          activeOpacity={0.85}
        >
          <Text style={[styles.toggleText, direction === "owedToMe" && styles.toggleTextActive]}>
            חייבים לי
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, direction === "iOwe" && styles.toggleButtonExpense]}
          onPress={() => setDirection("iOwe")}
          activeOpacity={0.85}
        >
          <Text style={[styles.toggleText, direction === "iOwe" && styles.toggleTextActive]}>
            אני חייב
          </Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.input}
        value={person}
        onChangeText={setPerson}
        placeholder="שם"
        placeholderTextColor={COLORS.textMuted}
        textAlign="right"
      />
      <TextInput
        style={styles.input}
        value={debtAmount}
        onChangeText={setDebtAmount}
        placeholder="סכום ₪"
        placeholderTextColor={COLORS.textMuted}
        keyboardType="numeric"
        textAlign="right"
      />
      <TouchableOpacity style={styles.addButtonFull} onPress={addDebt} activeOpacity={0.85}>
        <Text style={styles.addButtonText}>הוסף חוב</Text>
      </TouchableOpacity>

      {debts.map((d) => (
        <View key={d.id} style={styles.entryRow}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => removeDebt(d.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteButtonText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.entryInfo}>
            <Text style={[styles.entryCat, d.settled && styles.settledText]}>{d.person}</Text>
            <Text style={styles.entryNote}>
              {d.direction === "owedToMe" ? "חייב לי" : "אני חייב"}
            </Text>
          </View>
          <Text
            style={[
              styles.entryAmount,
              { color: d.direction === "owedToMe" ? COLORS.success : COLORS.danger },
              d.settled && styles.settledText,
            ]}
          >
            {formatShekel(d.amount)}
          </Text>
          <TouchableOpacity
            style={[styles.settleButton, d.settled && { backgroundColor: COLORS.success }]}
            onPress={() => toggleSettled(d.id)}
            activeOpacity={0.85}
          >
            <Text style={[styles.settleText, d.settled && { color: "#FFFFFF" }]}>
              {d.settled ? "✓" : "סגור"}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: {
    marginBottom: 18,
  },
  dashRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  dashCell: {
    flex: 1,
    padding: 14,
    borderRadius: RADIUS,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  dashCellLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONTS.medium,
    textAlign: "right",
  },
  dashCellValue: {
    color: "#FFFFFF",
    fontSize: 19,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginTop: 4,
  },
  netBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: RADIUS,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  netLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  netValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: FONTS.bold,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginTop: 8,
    marginBottom: 12,
  },
  pieWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 14,
  },
  legend: {
    flex: 1,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
    marginStart: 8,
    ...BRUTAL_BORDER,
  },
  legendText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: FONTS.medium,
    textAlign: "right",
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: "center",
    paddingVertical: 8,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    alignItems: "center",
    ...BRUTAL_BORDER,
  },
  toggleButtonExpense: {
    backgroundColor: COLORS.danger,
  },
  toggleButtonIncome: {
    backgroundColor: COLORS.success,
  },
  toggleText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    ...BRUTAL_BORDER,
  },
  chipText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.regular,
    marginBottom: 12,
    ...BRUTAL_BORDER,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  addButton: {
    flex: 1,
    height: 50,
    borderRadius: RADIUS,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  addButtonFull: {
    height: 50,
    borderRadius: RADIUS,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  scanButton: {
    flex: 1,
    height: 50,
    borderRadius: RADIUS,
    backgroundColor: COLORS.mustard,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  scanButtonText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: RADIUS,
    backgroundColor: COLORS.white,
    marginBottom: 10,
    ...BRUTAL_BORDER,
  },
  entryInfo: {
    flex: 1,
    marginStart: 12,
  },
  entryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  entryCatDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
    marginStart: 8,
    ...BRUTAL_BORDER,
  },
  entryCat: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONTS.bold,
    textAlign: "right",
  },
  entryNote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONTS.regular,
    textAlign: "right",
    marginTop: 3,
  },
  entryAmount: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    marginStart: 8,
  },
  settledText: {
    textDecorationLine: "line-through",
    color: COLORS.textMuted,
  },
  debtSummaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  debtSummary: {
    flex: 1,
    padding: 14,
    borderRadius: RADIUS,
    ...BRUTAL_BORDER,
    ...BRUTAL_SHADOW_SM,
  },
  debtSummaryLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONTS.medium,
    textAlign: "right",
  },
  debtSummaryValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: FONTS.bold,
    textAlign: "right",
    marginTop: 4,
  },
  settleButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    marginStart: 8,
    ...BRUTAL_BORDER,
  },
  settleText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...BRUTAL_BORDER,
  },
  deleteButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
});
