import { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import AppText from "../components/AppText";
import AppTextInput from "../components/AppTextInput";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { RADIUS, useTheme } from "../theme/ThemeContext";
import { useSettings } from "../settings/SettingsContext";
import { useVault } from "../vault/VaultContext";
import { changeVaultPin } from "../db/vaultRepo";
import { exportDatabaseFile } from "../lib/dbExport";
import { t } from "../i18n/strings";
import SwipeBack from "../navigation/SwipeBack";
import BottomSheet from "../components/BottomSheet";

const ACCENT_SWATCHES = ["#2F6F62", "#3E7BD6", "#B05AC4", "#D4952C", "#E8635A", "#0EA5A5", "#7C6FE0", "#5C9B3C"];

export default function SettingsScreen({ navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const vault = useVault();
  const settings = useSettings();

  const [showPinChange, setShowPinChange] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const s = styles(theme);

  const onFontScaleChange = (v) => settings.setFontScale(Math.round(v * 20) / 20);

  const onPickAccent = (color) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    settings.setAccentColor(color === settings.accentColor ? null : color);
  };

  const onPickTheme = (mode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    settings.setThemeMode(mode);
  };

  const submitPinChange = async () => {
    if (pinBusy) return;
    if (newPin.trim().length < 4) {
      setPinError("New PIN must be at least 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("New PINs don't match.");
      return;
    }
    setPinBusy(true);
    setPinError("");
    try {
      const newKey = await changeVaultPin(db, oldPin, newPin);
      vault.unlock(newKey);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setShowPinChange(false);
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
    } catch {
      setPinError("Incorrect current PIN.");
    } finally {
      setPinBusy(false);
    }
  };

  const onExportDatabase = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportDatabaseFile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      if (Platform.OS === "web") {
        Alert.alert("Not available on web", "Database export copies a real file and only works in the compiled app.");
      } else {
        Alert.alert("Export failed", "Could not create a backup file.");
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <SwipeBack onDismiss={() => navigation.goBack()} style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={s.topBar}>
        <TouchableOpacity testID="settings-back" style={s.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <AppText style={s.topTitle}>{t("settings")}</AppText>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}>
        <SectionLabel theme={theme}>{t("fontSize")}</SectionLabel>
        <View style={s.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <AppText style={{ fontSize: 12, color: theme.text }}>A</AppText>
            <Slider
              testID="font-scale-slider"
              style={{ flex: 1 }}
              minimumValue={0.85}
              maximumValue={1.4}
              step={0.05}
              value={settings.fontScale}
              onValueChange={onFontScaleChange}
              minimumTrackTintColor={theme.accent}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.accent}
            />
            <AppText style={{ fontSize: 20, color: theme.text }}>A</AppText>
          </View>
          <AppText style={s.previewText}>Aa — {t("appTitle")}</AppText>
        </View>

        <SectionLabel theme={theme}>{t("accentColor")}</SectionLabel>
        <View style={[s.card, { flexDirection: "row", flexWrap: "wrap", gap: 12 }]}>
          {ACCENT_SWATCHES.map((c) => (
            <TouchableOpacity
              key={c}
              testID="accent-swatch"
              onPress={() => onPickAccent(c)}
              style={[s.swatch, { backgroundColor: c }, settings.accentColor === c && { borderColor: theme.text }]}
            >
              {settings.accentColor === c && <Feather name="check" size={16} color="#FFFFFF" />}
            </TouchableOpacity>
          ))}
        </View>

        <SectionLabel theme={theme}>{t("theme")}</SectionLabel>
        <View style={[s.card, { flexDirection: "row", gap: 8 }]}>
          {[
            { key: "system", label: t("themeSystem") },
            { key: "light", label: t("themeLight") },
            { key: "dark", label: t("themeDark") },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.key}
              testID={`theme-${opt.key}`}
              style={[s.themeBtn, settings.themeMode === opt.key && { backgroundColor: theme.accent }]}
              onPress={() => onPickTheme(opt.key)}
            >
              <AppText style={{ color: settings.themeMode === opt.key ? theme.onAccent : theme.text, fontWeight: "600", fontSize: 13 }}>
                {opt.label}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>

        <SectionLabel theme={theme}>{t("vaultPin")}</SectionLabel>
        <TouchableOpacity testID="open-change-pin" style={s.card} onPress={() => setShowPinChange(true)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name="shield" size={17} color={theme.accent} />
            <AppText style={{ color: theme.text, fontSize: 14.5, fontWeight: "600" }}>{t("changePin")}</AppText>
          </View>
        </TouchableOpacity>

        <SectionLabel theme={theme}>{t("exportDatabase")}</SectionLabel>
        <TouchableOpacity testID="export-database" style={s.card} onPress={onExportDatabase} disabled={exporting}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name="download" size={17} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <AppText style={{ color: theme.text, fontSize: 14.5, fontWeight: "600" }}>
                {exporting ? "…" : t("exportDatabase")}
              </AppText>
              <AppText style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>{t("exportDatabaseHint")}</AppText>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <BottomSheet visible={showPinChange} onClose={() => setShowPinChange(false)}>
        <AppText style={s.sheetTitle}>{t("changePin")}</AppText>
        <AppTextInput
          testID="old-pin-input"
          style={s.input}
          value={oldPin}
          onChangeText={setOldPin}
          placeholder="Current PIN"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          keyboardType="number-pad"
        />
        <AppTextInput
          testID="new-pin-input"
          style={s.input}
          value={newPin}
          onChangeText={setNewPin}
          placeholder="New PIN"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          keyboardType="number-pad"
        />
        <AppTextInput
          testID="confirm-pin-input"
          style={s.input}
          value={confirmPin}
          onChangeText={setConfirmPin}
          placeholder="Confirm new PIN"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          keyboardType="number-pad"
        />
        {!!pinError && <AppText style={{ color: theme.danger, fontSize: 12.5, marginBottom: 6 }}>{pinError}</AppText>}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => setShowPinChange(false)} activeOpacity={0.8}>
            <AppText style={{ color: theme.textMuted, fontWeight: "700", fontSize: 14.5 }}>{t("cancel")}</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            testID="submit-pin-change"
            style={[s.btn, { backgroundColor: theme.accent }]}
            onPress={submitPinChange}
            disabled={pinBusy}
            activeOpacity={0.85}
          >
            <AppText style={{ color: theme.onAccent, fontWeight: "700", fontSize: 14.5 }}>{pinBusy ? "…" : t("save")}</AppText>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </SwipeBack>
  );
}

function SectionLabel({ theme, children }) {
  return <AppText style={{ fontSize: 12, fontWeight: "700", color: theme.textMuted, marginTop: 18, marginBottom: 8 }}>{children}</AppText>;
}

const styles = (t) =>
  StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
    iconBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    topTitle: { fontSize: 18, fontWeight: "700", color: t.text },
    card: { backgroundColor: t.surface, borderRadius: RADIUS.lg, padding: 16, ...t.cardShadow },
    previewText: { color: t.text, fontSize: 15, marginTop: 12 },
    swatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
    themeBtn: { flex: 1, height: 40, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", backgroundColor: t.surfaceAlt },
    sheetTitle: { fontSize: 16, fontWeight: "700", color: t.text, marginBottom: 12 },
    input: { backgroundColor: t.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, height: 46, color: t.text, fontSize: 16, letterSpacing: 2, marginBottom: 10 },
    btn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    btnGhost: { backgroundColor: t.surfaceAlt },
  });
