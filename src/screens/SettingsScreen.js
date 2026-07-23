import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PinLock from "../components/PinLock";
import { useAuth } from "../context/AuthContext";
import { WORKSPACES, useSettings } from "../context/SettingsContext";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { todayKey } from "../utils/posStore";
import { ACCENTS, FONTS, RADIUS, RADIUS_SM, SHADOW_SM } from "../utils/theme";

const FONT_OPTS = [
  { key: "small", label: "קטן" },
  { key: "medium", label: "בינוני" },
  { key: "large", label: "גדול" },
];

export default function SettingsScreen({ navigation }) {
  const settings = useSettings();
  const { theme, fontScale, update, haptic } = settings;
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [pinModal, setPinModal] = useState(false);
  const [storage, setStorage] = useState({ total: 0, rows: [] });
  const [ruleForm, setRuleForm] = useState({ metric: "stock", op: "lt", threshold: "" });

  const s = makeStyles(theme, fontScale);

  // --- Storage health ------------------------------------------------------
  const measureStorage = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const pairs = await AsyncStorage.multiGet(keys);
      let total = 0;
      const rows = pairs
        .map(([k, v]) => {
          const bytes = (v || "").length;
          total += bytes;
          return { key: k.replace("@dreammanager/", ""), bytes };
        })
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 6);
      setStorage({ total, rows });
    } catch {
      setStorage({ total: 0, rows: [] });
    }
  };
  useEffect(() => {
    measureStorage();
  }, []);

  const archiveOldReports = async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const cutoffKey = todayKey(cutoff);

      const rawSales = await AsyncStorage.getItem(STORAGE_KEYS.posSales);
      const sales = rawSales ? JSON.parse(rawSales) : [];
      const kept = sales.filter((x) => (x.day || "") >= cutoffKey);
      const removed = sales.length - kept.length;
      await AsyncStorage.setItem(STORAGE_KEYS.posSales, JSON.stringify(kept));

      const rawLocked = await AsyncStorage.getItem(STORAGE_KEYS.posLockedDays);
      const locked = rawLocked ? JSON.parse(rawLocked) : [];
      await AsyncStorage.setItem(
        STORAGE_KEYS.posLockedDays,
        JSON.stringify(locked.filter((d) => d >= cutoffKey))
      );

      haptic("success");
      await measureStorage();
      Alert.alert("הועבר לארכיון", removed > 0 ? `${removed} רשומות ישנות (מעל 90 יום) נמחקו.` : "אין רשומות ישנות לארכוב.");
    } catch {
      Alert.alert("שגיאה", "לא ניתן לארכב כרגע.");
    }
  };

  const fmtBytes = (n) => (n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

  const addRule = () => {
    const th = Number(ruleForm.threshold);
    if (!th) return;
    const metricLabel = ruleForm.metric === "stock" ? "מלאי" : "מזומן";
    const opLabel = ruleForm.op === "lt" ? "קטן מ־" : "גדול מ־";
    settings.addRule({
      metric: ruleForm.metric,
      op: ruleForm.op,
      threshold: th,
      label: `אם ${metricLabel} ${opLabel}${th} → צור תזכורת`,
    });
    setRuleForm({ metric: "stock", op: "lt", threshold: "" });
    haptic("light");
  };

  const Section = ({ icon, title, children }) => (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{icon}  {title}</Text>
      <View style={s.sectionCard}>{children}</View>
    </View>
  );

  const Row = ({ label, hint, right, last }) => (
    <View style={[s.row, !last && s.rowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {hint ? <Text style={s.rowHint}>{hint}</Text> : null}
      </View>
      {right}
    </View>
  );

  const Segmented = ({ options, value, onChange }) => (
    <View style={s.segment}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            style={[s.segBtn, active && { backgroundColor: theme.accent }]}
            activeOpacity={0.8}
            onPress={() => {
              haptic("light");
              onChange(o.key);
            }}
          >
            <Text style={[s.segText, { color: active ? "#FFF" : theme.textSecondary }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={s.menuBtn} onPress={() => navigation.openDrawer()} activeOpacity={0.7}>
          <Text style={s.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>⚙️ הגדרות</Text>
        <View style={s.menuBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* UI CUSTOMIZATION */}
        <Section icon="🎨" title="עיצוב ותצוגה">
          <Row
            label="מצב כהה"
            hint="החלף בין ערכת נושא בהירה לכהה"
            right={
              <Switch
                value={theme.scheme === "dark"}
                onValueChange={(v) => update({ scheme: v ? "dark" : "light" })}
                trackColor={{ true: theme.accent }}
              />
            }
          />
          <Row label="צבע הדגשה" hint="הצבע הראשי של האפליקציה" right={null} />
          <View style={s.swatchRow}>
            {ACCENTS.map((a) => (
              <TouchableOpacity
                key={a.key}
                style={[s.swatch, { backgroundColor: a.color }, settings.accentKey === a.key && s.swatchActive]}
                activeOpacity={0.8}
                onPress={() => {
                  haptic("light");
                  update({ accentKey: a.key });
                }}
              >
                {settings.accentKey === a.key && <Text style={s.swatchCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
          <Row
            label="גודל טקסט"
            last
            right={<Segmented options={FONT_OPTS} value={settings.fontScaleKey} onChange={(k) => update({ fontScaleKey: k })} />}
          />
        </Section>

        {/* WORKSPACES */}
        <Section icon="🗂️" title="סביבות עבודה">
          <Row
            label="מצב תפריט"
            hint="שנה את סדר הקטגוריות בתפריט הצד"
            last
            right={null}
          />
          <View style={{ marginTop: 4 }}>
            <Segmented
              options={WORKSPACES.map((w) => ({ key: w.key, label: w.label }))}
              value={settings.workspace}
              onChange={(k) => update({ workspace: k })}
            />
            <Text style={s.rowHint}>{WORKSPACES.find((w) => w.key === settings.workspace)?.hint}</Text>
          </View>
        </Section>

        {/* SECURITY & STEALTH */}
        <Section icon="🔐" title="אבטחה ופרטיות">
          <Row
            label="נעילת קוד"
            hint={settings.pin ? "פעיל — נדרש קוד בכל פתיחה" : "כבוי"}
            right={
              settings.pin ? (
                <TouchableOpacity
                  style={[s.smallBtn, { backgroundColor: theme.danger + "22" }]}
                  onPress={() => {
                    update({ pin: null });
                    haptic("light");
                  }}
                >
                  <Text style={[s.smallBtnText, { color: theme.danger }]}>הסר</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[s.smallBtn, { backgroundColor: theme.accent }]} onPress={() => setPinModal(true)}>
                  <Text style={[s.smallBtnText, { color: "#FFF" }]}>הגדר</Text>
                </TouchableOpacity>
              )
            }
          />
          <Row
            label="מצב חשאי"
            hint="הסתר את כל הסכומים הכספיים (•••••)"
            last
            right={
              <Switch
                value={settings.stealth}
                onValueChange={(v) => update({ stealth: v })}
                trackColor={{ true: theme.accent }}
              />
            }
          />
        </Section>

        {/* AUDIO & HAPTICS */}
        <Section icon="🔊" title="צליל ותחושה">
          <Row
            label="צלילי קופה"
            hint="צליל מכני בכל פעולה מול השקט"
            right={
              <Switch value={settings.sounds} onValueChange={(v) => update({ sounds: v })} trackColor={{ true: theme.accent }} />
            }
          />
          <Row
            label="עוצמת רטט"
            last
            right={
              <Segmented
                options={[
                  { key: "off", label: "כבוי" },
                  { key: "light", label: "עדין" },
                  { key: "heavy", label: "חזק" },
                ]}
                value={settings.haptics}
                onChange={(k) => update({ haptics: k })}
              />
            }
          />
        </Section>

        {/* AUTOMATION */}
        <Section icon="🤖" title="מנוע אוטומציה">
          <Text style={s.autoIntro}>חוקי ״אם / אז״ פשוטים</Text>
          {settings.automation.map((r) => (
            <View key={r.id} style={s.ruleRow}>
              <TouchableOpacity onPress={() => settings.removeRule(r.id)}>
                <Text style={{ color: theme.danger, fontFamily: FONTS.bold, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
              <Text style={s.ruleText}>{r.label}</Text>
            </View>
          ))}
          {settings.automation.length === 0 && <Text style={s.rowHint}>אין חוקים עדיין.</Text>}

          <View style={s.ruleBuilder}>
            <View style={s.ruleBuilderRow}>
              <Segmented
                options={[
                  { key: "stock", label: "מלאי" },
                  { key: "cash", label: "מזומן" },
                ]}
                value={ruleForm.metric}
                onChange={(k) => setRuleForm((f) => ({ ...f, metric: k }))}
              />
            </View>
            <View style={s.ruleBuilderRow}>
              <Segmented
                options={[
                  { key: "lt", label: "קטן מ־" },
                  { key: "gt", label: "גדול מ־" },
                ]}
                value={ruleForm.op}
                onChange={(k) => setRuleForm((f) => ({ ...f, op: k }))}
              />
            </View>
            <View style={s.ruleAddRow}>
              <TextInput
                style={s.ruleInput}
                value={ruleForm.threshold}
                onChangeText={(t) => setRuleForm((f) => ({ ...f, threshold: t.replace(/[^0-9]/g, "") }))}
                placeholder="ערך סף"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                textAlign="right"
              />
              <TouchableOpacity style={[s.addRuleBtn, { backgroundColor: theme.accent }]} onPress={addRule}>
                <Text style={s.addRuleText}>הוסף חוק</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* STORAGE HEALTH */}
        <Section icon="💾" title="בריאות האחסון">
          <Text style={s.storageTotal}>סה״כ בשימוש: {fmtBytes(storage.total)}</Text>
          {storage.rows.map((r) => {
            const pct = storage.total ? Math.round((r.bytes / storage.total) * 100) : 0;
            return (
              <View key={r.key} style={{ marginTop: 10 }}>
                <View style={s.storageRow}>
                  <Text style={s.storageKey} numberOfLines={1}>{r.key}</Text>
                  <Text style={s.storageBytes}>{fmtBytes(r.bytes)}</Text>
                </View>
                <View style={s.storageBarBg}>
                  <View style={[s.storageBarFill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
                </View>
              </View>
            );
          })}
          <TouchableOpacity style={[s.archiveBtn, { borderColor: theme.accent }]} onPress={archiveOldReports} activeOpacity={0.8}>
            <Text style={[s.archiveText, { color: theme.accent }]}>🗄️  ארכוב דו״חות Z מעל 90 יום</Text>
          </TouchableOpacity>
        </Section>

        <TouchableOpacity style={[s.logout, { borderColor: theme.danger }]} onPress={logout} activeOpacity={0.8}>
          <Text style={[s.logoutText, { color: theme.danger }]}>התנתקות</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* PIN set overlay */}
      <Modal visible={pinModal} animationType="slide" onRequestClose={() => setPinModal(false)}>
        <PinLock
          mode="set"
          onCancel={() => setPinModal(false)}
          onSet={(pin) => {
            update({ pin });
            setPinModal(false);
            Alert.alert("הוגדר", "נעילת הקוד הופעלה.");
          }}
        />
      </Modal>
    </View>
  );
}

function makeStyles(t, fs) {
  return StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
    menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: t.surface, alignItems: "center", justifyContent: "center", ...SHADOW_SM },
    menuIcon: { fontSize: 20, color: t.textPrimary, fontFamily: FONTS.bold },
    headerTitle: { color: t.textPrimary, fontSize: 18 * fs, fontFamily: FONTS.bold },

    section: { marginBottom: 22 },
    sectionTitle: { color: t.textSecondary, fontSize: 14 * fs, fontFamily: FONTS.bold, textAlign: "right", marginBottom: 8, marginHorizontal: 4 },
    sectionCard: { backgroundColor: t.surface, borderRadius: RADIUS, padding: 16, ...SHADOW_SM },

    row: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: t.hairline },
    rowLabel: { color: t.textPrimary, fontSize: 15 * fs, fontFamily: FONTS.medium, textAlign: "right" },
    rowHint: { color: t.textMuted, fontSize: 12 * fs, fontFamily: FONTS.regular, textAlign: "right", marginTop: 3 },

    swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.hairline },
    swatch: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    swatchActive: { borderWidth: 3, borderColor: t.textPrimary },
    swatchCheck: { color: "#FFF", fontFamily: FONTS.bold, fontSize: 16 },

    segment: { flexDirection: "row", backgroundColor: t.surfaceMuted, borderRadius: RADIUS_SM, padding: 3, gap: 3 },
    segBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS_SM - 2 },
    segText: { fontSize: 13 * fs, fontFamily: FONTS.bold },

    smallBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS_SM },
    smallBtnText: { fontSize: 13 * fs, fontFamily: FONTS.bold },

    autoIntro: { color: t.textSecondary, fontSize: 13 * fs, fontFamily: FONTS.medium, textAlign: "right", marginBottom: 8 },
    ruleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.hairline },
    ruleText: { flex: 1, color: t.textPrimary, fontSize: 13 * fs, fontFamily: FONTS.medium, textAlign: "right" },
    ruleBuilder: { marginTop: 12, gap: 10 },
    ruleBuilderRow: { alignItems: "flex-end" },
    ruleAddRow: { flexDirection: "row", gap: 10, alignItems: "center" },
    ruleInput: { flex: 1, backgroundColor: t.surfaceAlt, borderRadius: RADIUS_SM, paddingHorizontal: 14, paddingVertical: 11, color: t.textPrimary, fontFamily: FONTS.regular, fontSize: 15, borderWidth: 1, borderColor: t.hairline },
    addRuleBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS_SM },
    addRuleText: { color: "#FFF", fontFamily: FONTS.bold, fontSize: 14 * fs },

    storageTotal: { color: t.textPrimary, fontSize: 15 * fs, fontFamily: FONTS.bold, textAlign: "right" },
    storageRow: { flexDirection: "row", justifyContent: "space-between" },
    storageKey: { flex: 1, color: t.textSecondary, fontSize: 12 * fs, fontFamily: FONTS.medium, textAlign: "right" },
    storageBytes: { color: t.textMuted, fontSize: 12 * fs, fontFamily: FONTS.regular, marginStart: 8 },
    storageBarBg: { height: 7, borderRadius: 4, backgroundColor: t.surfaceMuted, marginTop: 4, overflow: "hidden" },
    storageBarFill: { height: "100%", borderRadius: 4 },
    archiveBtn: { marginTop: 16, borderWidth: 1.5, borderRadius: RADIUS_SM, paddingVertical: 13, alignItems: "center" },
    archiveText: { fontSize: 14 * fs, fontFamily: FONTS.bold },

    logout: { borderWidth: 1.5, borderRadius: RADIUS, paddingVertical: 15, alignItems: "center", marginTop: 6 },
    logoutText: { fontSize: 15 * fs, fontFamily: FONTS.bold },
  });
}
