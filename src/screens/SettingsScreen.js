import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  I18nManager,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInUp, LinearTransition } from "react-native-reanimated";

import PinLock from "../components/PinLock";
import { useAuth } from "../context/AuthContext";
import { WORKSPACES, useSettings } from "../context/SettingsContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { todayKey } from "../utils/posStore";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { IMPLEMENTED, TOOL_COUNT } from "../utils/toolsCatalog";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";

// הגדרות — an iOS-style grouped settings list on the 770JLM Light Modern
// surface. Tapping the version line seven times in a row unlocks a developer
// group that renders above everything else.

const WHITE = "#FFFFFF";
const BG = "#F4F5F7";
const INK = "#1A1D21";
const INK_SOFT = "#5A6470";
const INK_MUTED = "#9AA4B0";
const BLUE = "#003366";
const GOLD = "#D4AF37";
const RED = "#E14848";
const HAIRLINE = "#ECEEF1";

const APP_VERSION = "Version 1.0.0 (Build 770) - Made in Beitar Illit";
const TAPS_TO_UNLOCK = 7;
// Taps further apart than this restart the count, so it takes a deliberate
// burst rather than seven idle presses over a minute.
const TAP_WINDOW_MS = 900;

const NO_OUTLINE = Platform.OS === "web" ? { outlineStyle: "none", outlineWidth: 0 } : {};
const WEB_SWITCH_THUMB = Platform.OS === "web" ? { activeThumbColor: WHITE } : {};

const fmtBytes = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const { update } = settings;
  const { user, logout } = useAuth();
  const scrollRef = useRef(null);

  const [name, setName] = useState(settings.userName || "");
  const [pinModal, setPinModal] = useState(false);
  const [wipeModal, setWipeModal] = useState(false);
  const [storage, setStorage] = useState({ total: 0, count: 0, rows: [] });
  // Snapshot of every app key, captured alongside the size measurement. Held
  // in state so the export handlers can serialise it synchronously — see
  // buildBackup below.
  const [snapshot, setSnapshot] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const hapticsOn = settings.haptics !== "off";

  const flash = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  // Keep the local input in sync if the stored name changes elsewhere.
  useEffect(() => {
    setName(settings.userName || "");
  }, [settings.userName]);

  // --- Storage health -------------------------------------------------------
  const measureStorage = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      // v3 renamed the batch APIs: getMany/setMany/removeMany, and it returns
      // an object rather than v2's array of [key, value] pairs.
      const values = await AsyncStorage.getMany(keys);
      let total = 0;
      const data = {};
      const rows = Object.entries(values)
        .map(([k, v]) => {
          const bytes = (v || "").length;
          total += bytes;
          if (k.startsWith("@dreammanager/")) {
            try {
              data[k] = JSON.parse(v);
            } catch {
              data[k] = v;
            }
          }
          return { key: k.replace("@dreammanager/", ""), bytes };
        })
        .sort((a, b) => b.bytes - a.bytes);
      setStorage({ total, count: keys.length, rows });
      setSnapshot(data);
    } catch {
      setStorage({ total: 0, count: 0, rows: [] });
      setSnapshot(null);
    }
  }, []);
  useEffect(() => {
    measureStorage();
  }, [measureStorage]);

  // --- Version tap → developer mode ----------------------------------------
  const taps = useRef(0);
  const lastTap = useRef(0);

  const onVersionPress = () => {
    const now = Date.now();
    taps.current = now - lastTap.current < TAP_WINDOW_MS ? taps.current + 1 : 1;
    lastTap.current = now;

    if (taps.current < TAPS_TO_UNLOCK) {
      // Stay silent for the first couple of taps so it still feels hidden.
      if (taps.current >= 3) {
        hapticLight();
        flash(`עוד ${TAPS_TO_UNLOCK - taps.current} לחיצות…`);
      }
      return;
    }

    taps.current = 0;
    const unlocked = !settings.devMode;
    update({ devMode: unlocked });

    if (unlocked) {
      hapticSuccess();
      // Alert is a no-op on react-native-web, so the toast carries the same
      // message on every platform.
      Alert.alert("Developer Mode Unlocked!", "אפשרויות המפתח נוספו לראש מסך ההגדרות.");
      flash("🛠️ Developer Mode Unlocked!");
      measureStorage();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      hapticWarning();
      Alert.alert("Developer Mode Locked", "אפשרויות המפתח הוסתרו.");
      flash("🔒 מצב מפתח ננעל");
    }
  };

  // --- Actions --------------------------------------------------------------
  const saveName = (text) => {
    setName(text);
    update({ userName: text });
  };

  const toggleHaptics = (on) => {
    // Fire the confirmation tap before switching off, so turning it off still
    // produces one last piece of feedback.
    if (!on) hapticLight();
    update({ haptics: on ? "light" : "off" });
    if (on) setTimeout(hapticSuccess, 0);
    flash(on ? "רטט הופעל" : "רטט כובה");
  };

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

      hapticSuccess();
      await measureStorage();
      flash(removed > 0 ? `${removed} רשומות ישנות הועברו לארכיון` : "אין רשומות מעל 90 יום");
    } catch {
      hapticWarning();
      flash("הארכוב נכשל");
    }
  };

  // Serialised synchronously from the snapshot: browsers only honour a
  // clipboard write while the user gesture is still "active", and awaiting
  // AsyncStorage first drops out of that window, so the write is rejected.
  const buildBackup = () =>
    JSON.stringify(
      { app: "DreamManager", version: APP_VERSION, exportedAt: new Date().toISOString(), data: snapshot || {} },
      null,
      2
    );

  const exportBackup = async () => {
    hapticLight();
    const json = buildBackup();
    try {
      await Share.share({ message: json, title: "גיבוי DreamManager" });
      return;
    } catch {
      // Sharing is unavailable on this platform — fall back to the clipboard.
    }
    try {
      await Clipboard.setStringAsync(json);
      flash("הגיבוי הועתק ללוח");
    } catch {
      hapticWarning();
      flash("ייצוא הגיבוי נכשל");
    }
  };

  const copyBackup = async () => {
    hapticLight();
    try {
      await Clipboard.setStringAsync(buildBackup());
      flash(`הגיבוי הועתק ללוח · ${storage.count} מפתחות`);
    } catch {
      hapticWarning();
      flash("ההעתקה נכשלה");
    }
  };

  const diagnostics = useMemo(
    () => ({
      // Platform.Version is a meaningless "0.0.0" on web.
      platform: [Platform.OS, Platform.Version && Platform.Version !== "0.0.0" ? Platform.Version : null]
        .filter(Boolean)
        .join(" "),
      rtl: I18nManager.isRTL ? "RTL" : "LTR",
      tools: `${TOOL_COUNT} · ${IMPLEMENTED.size} פעילים`,
      keys: `${storage.count} מפתחות · ${fmtBytes(storage.total)}`,
      user: user?.uid || "—",
    }),
    [storage.count, storage.total, user?.uid]
  );

  const copyDiagnostics = async () => {
    hapticLight();
    const text = [
      APP_VERSION,
      `platform: ${diagnostics.platform}`,
      `direction: ${diagnostics.rtl}`,
      `tools: ${diagnostics.tools}`,
      `storage: ${diagnostics.keys}`,
      `uid: ${diagnostics.user}`,
      ...storage.rows.map((r) => `  ${r.key}: ${fmtBytes(r.bytes)}`),
    ].join("\n");
    try {
      await Clipboard.setStringAsync(text);
      flash("דוח האבחון הועתק");
    } catch {
      flash("ההעתקה נכשלה");
    }
  };

  const wipeAll = async () => {
    setWipeModal(false);
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("@dreammanager/"));
      await AsyncStorage.removeMany(keys);
      hapticWarning();
      await measureStorage();
      flash(`${keys.length} מפתחות נמחקו — הפעל מחדש את האפליקציה`);
    } catch {
      flash("המחיקה נכשלה");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>⚙️ הגדרות</Text>
          <Text style={s.subtitle}>
            {settings.userName ? `שלום, ${settings.userName}` : "העדפות, גיבוי ומערכת"}
          </Text>
        </View>
        {settings.devMode && (
          <Animated.View entering={FadeInDown.duration(220)} style={s.devPill}>
            <Text style={s.devPillText}>🛠️ DEV</Text>
          </Animated.View>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---------- Developer Options (hidden until unlocked) ---------- */}
        {settings.devMode && (
          <Animated.View entering={FadeInDown.duration(260)} layout={LinearTransition.springify()}>
            <Group title="Developer Options 🛠️" accent={GOLD}>
              <InfoRow label="פלטפורמה" value={diagnostics.platform} />
              <InfoRow label="כיוון פריסה" value={diagnostics.rtl} />
              <InfoRow label="קטלוג כלים" value={diagnostics.tools} />
              <InfoRow label="אחסון מקומי" value={diagnostics.keys} />
              <InfoRow label="מזהה משתמש" value={diagnostics.user} />
              <ActionRow label="העתק דוח אבחון" hint="כל הנתונים שלמעלה כטקסט" icon="📋" onPress={copyDiagnostics} />
              <ActionRow label="רענן מדידת אחסון" icon="🔄" onPress={() => { hapticLight(); measureStorage(); flash("נמדד מחדש"); }} />
              <ActionRow
                label="מחק את כל הנתונים המקומיים"
                hint="פעולה בלתי הפיכה"
                icon="🧨"
                danger
                onPress={() => { hapticWarning(); setWipeModal(true); }}
              />
              <ActionRow
                label="נעל מצב מפתח"
                icon="🔒"
                last
                onPress={() => {
                  hapticWarning();
                  update({ devMode: false });
                  flash("🔒 מצב מפתח ננעל");
                }}
              />
            </Group>
          </Animated.View>
        )}

        {/* ---------- Profile ---------- */}
        <Group title="פרופיל אישי" icon="👤">
          <View style={s.fieldRow}>
            <Text style={s.rowLabel}>שם משתמש</Text>
            <TextInput
              style={s.nameInput}
              value={name}
              onChangeText={saveName}
              placeholder="איך לקרוא לך?"
              placeholderTextColor={INK_MUTED}
              textAlign="right"
              maxLength={24}
            />
          </View>
          <InfoRow label="חשבון" value={user?.email || "—"} />
          <ActionRow label="התנתקות" icon="🚪" danger last onPress={() => { hapticWarning(); logout(); }} />
        </Group>

        {/* ---------- Business ---------- */}
        <Group title="הגדרות עסק וקופה" icon="🏪">
          <View style={s.stackRow}>
            <Text style={s.rowLabel}>סביבת עבודה</Text>
            <Text style={s.rowHint}>{WORKSPACES.find((w) => w.key === settings.workspace)?.hint}</Text>
            <Segment
              options={WORKSPACES.map((w) => ({ key: w.key, label: w.label }))}
              value={settings.workspace}
              onChange={(k) => { hapticLight(); update({ workspace: k }); }}
            />
          </View>
          <SwitchRow
            label="צלילי קופה"
            hint="קליק מכני בכל פעולה בקופה"
            value={settings.sounds}
            onValueChange={(v) => { hapticLight(); update({ sounds: v }); }}
          />
          <SwitchRow
            label="מצב חשאי"
            hint="הסתרת כל הסכומים הכספיים (•••••)"
            value={settings.stealth}
            last
            onValueChange={(v) => { hapticLight(); update({ stealth: v }); }}
          />
        </Group>

        {/* ---------- Data & backup ---------- */}
        <Group title="גיבוי ואחסון" icon="💾">
          <View style={s.stackRow}>
            <View style={s.storageHead}>
              <Text style={s.storageTotal}>{fmtBytes(storage.total)}</Text>
              <Text style={s.rowLabel}>נפח בשימוש</Text>
            </View>
            {storage.rows.slice(0, 4).map((r) => {
              const pct = storage.total ? Math.round((r.bytes / storage.total) * 100) : 0;
              return (
                <View key={r.key} style={{ marginTop: 10 }}>
                  <View style={s.storageRow}>
                    <Text style={s.storageBytes}>{fmtBytes(r.bytes)}</Text>
                    <Text style={s.storageKey} numberOfLines={1}>{r.key}</Text>
                  </View>
                  <View style={s.barBg}>
                    <View style={[s.barFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
            {storage.rows.length === 0 && <Text style={s.rowHint}>אין עדיין נתונים מקומיים.</Text>}
          </View>
          <ActionRow label="ייצוא גיבוי" hint="שיתוף כל הנתונים כקובץ JSON" icon="📤" onPress={exportBackup} />
          <ActionRow label="העתק גיבוי ללוח" icon="📋" onPress={copyBackup} />
          <ActionRow label="ארכוב דוחות מעל 90 יום" hint="מנקה מכירות ישנות" icon="🗄️" last onPress={archiveOldReports} />
        </Group>

        {/* ---------- System ---------- */}
        <Group title="מערכת" icon="🔧">
          <SwitchRow
            label="משוב הפטי"
            hint="רטט בלחיצות ובפעולות בכל האפליקציה"
            value={hapticsOn}
            onValueChange={toggleHaptics}
          />
          <SwitchRow
            label="רטט חזק"
            hint="עוצמת רטט מוגברת"
            value={settings.haptics === "heavy"}
            disabled={!hapticsOn}
            onValueChange={(v) => { hapticLight(); update({ haptics: v ? "heavy" : "light" }); }}
          />
          <ActionRow
            label="נעילת קוד"
            hint={settings.pin ? "פעיל — נדרש קוד בכל פתיחה" : "כבוי"}
            icon={settings.pin ? "🔐" : "🔓"}
            actionLabel={settings.pin ? "הסר" : "הגדר"}
            onPress={() => {
              hapticLight();
              if (settings.pin) {
                update({ pin: null });
                flash("נעילת הקוד הוסרה");
              } else {
                setPinModal(true);
              }
            }}
          />
          <InfoRow label="שפה וכיוון" value={`עברית · ${diagnostics.rtl}`} last />
        </Group>

        {/* ---------- Version / easter egg ---------- */}
        <TouchableOpacity
          testID="version-line"
          style={s.versionWrap}
          onPress={onVersionPress}
          activeOpacity={0.6}
        >
          <Text style={s.versionText}>{APP_VERSION}</Text>
        </TouchableOpacity>
      </ScrollView>

      {toast && (
        <Animated.View entering={FadeInUp.duration(200)} style={[s.toast, { bottom: insets.bottom + 90 }]}>
          <Text style={s.toastText}>{toast}</Text>
        </Animated.View>
      )}

      {/* PIN set overlay */}
      <Modal visible={pinModal} animationType="slide" onRequestClose={() => setPinModal(false)}>
        <PinLock
          mode="set"
          onCancel={() => setPinModal(false)}
          onSet={(pin) => {
            update({ pin });
            setPinModal(false);
            hapticSuccess();
            flash("נעילת הקוד הופעלה");
          }}
        />
      </Modal>

      {/* Wipe confirmation — a real dialog rather than Alert buttons, which
          react-native-web ignores. */}
      <Modal visible={wipeModal} transparent animationType="fade" onRequestClose={() => setWipeModal(false)}>
        <View style={s.backdrop}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>🧨 למחוק את כל הנתונים?</Text>
            <Text style={s.dialogBody}>
              כל המכירות, המלאי, ההקפות, הפתקים, החלומות וההעדפות יימחקו מהמכשיר. אין דרך לשחזר בלי גיבוי.
            </Text>
            <TouchableOpacity style={[s.dialogBtn, { backgroundColor: RED }]} onPress={wipeAll} activeOpacity={0.85}>
              <Text style={s.dialogBtnText}>כן, מחק הכל</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.dialogBtn, { backgroundColor: BG }]}
              onPress={() => setWipeModal(false)}
              activeOpacity={0.85}
            >
              <Text style={[s.dialogBtnText, { color: INK_SOFT }]}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* --------------------------------------------------------------------------
 * Grouped-list building blocks
 * ----------------------------------------------------------------------- */

function Group({ title, icon, accent, children }) {
  return (
    <View style={s.group}>
      <Text style={[s.groupTitle, accent && { color: accent }]}>
        {icon ? `${icon}  ` : ""}
        {title}
      </Text>
      <View style={[s.groupCard, accent && { borderWidth: 1, borderColor: accent + "55" }]}>{children}</View>
    </View>
  );
}

function Divider({ last }) {
  if (last) return null;
  return <View style={s.divider} />;
}

function InfoRow({ label, value, last }) {
  return (
    <>
      <View style={s.row}>
        <Text style={s.rowValue} numberOfLines={1}>{value}</Text>
        <Text style={s.rowLabel}>{label}</Text>
      </View>
      <Divider last={last} />
    </>
  );
}

function SwitchRow({ label, hint, value, onValueChange, disabled, last }) {
  return (
    <>
      <View style={[s.row, disabled && { opacity: 0.45 }]}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: "#DDE1E6", true: BLUE }}
          thumbColor={WHITE}
          ios_backgroundColor="#DDE1E6"
          // react-native-web keeps a separate on-state thumb colour and
          // defaults it to teal; thumbColor alone only styles the off state.
          {...WEB_SWITCH_THUMB}
        />
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>{label}</Text>
          {!!hint && <Text style={s.rowHint}>{hint}</Text>}
        </View>
      </View>
      <Divider last={last} />
    </>
  );
}

function ActionRow({ label, hint, icon, onPress, danger, actionLabel, last }) {
  return (
    <>
      <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.65}>
        {actionLabel ? (
          <View style={[s.actionPill, danger && { backgroundColor: RED + "18" }]}>
            <Text style={[s.actionPillText, danger && { color: RED }]}>{actionLabel}</Text>
          </View>
        ) : (
          <Text style={s.chevron}>‹</Text>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.rowLabel, danger && { color: RED }]}>{label}</Text>
          {!!hint && <Text style={s.rowHint}>{hint}</Text>}
        </View>
        {!!icon && <Text style={s.rowIcon}>{icon}</Text>}
      </TouchableOpacity>
      <Divider last={last} />
    </>
  );
}

function Segment({ options, value, onChange }) {
  return (
    <View style={s.segment}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          style={[s.segmentBtn, value === o.key && { backgroundColor: BLUE }]}
          onPress={() => onChange(o.key)}
          activeOpacity={0.75}
        >
          <Text style={[s.segmentText, value === o.key && { color: WHITE }]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 3,
  elevation: 2,
};

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, gap: 10 },
  title: { fontFamily: FONTS.bold, fontSize: 22, color: INK, textAlign: "right" },
  subtitle: { fontFamily: FONTS.regular, fontSize: 12, color: INK_MUTED, textAlign: "right", marginTop: 2 },
  devPill: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  devPillText: { fontFamily: FONTS.bold, fontSize: 12, color: "#8A6D14" },

  group: { marginBottom: 18 },
  groupTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: INK_SOFT,
    textAlign: "right",
    marginBottom: 8,
    marginHorizontal: 6,
  },
  groupCard: { backgroundColor: WHITE, borderRadius: 16, overflow: "hidden", ...SHADOW },
  divider: { height: 1, backgroundColor: HAIRLINE, marginStart: 16 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  rowLabel: { fontFamily: FONTS.semibold, fontSize: 14.5, color: INK, textAlign: "right" },
  rowHint: { fontFamily: FONTS.regular, fontSize: 11.5, color: INK_MUTED, textAlign: "right", marginTop: 3, lineHeight: 17 },
  rowValue: { fontFamily: FONTS.medium, fontSize: 13, color: INK_MUTED, maxWidth: "55%" },
  rowIcon: { fontSize: 18 },
  chevron: { fontFamily: FONTS.bold, fontSize: 20, color: "#C6CCD3", width: 12, textAlign: "center" },

  fieldRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 8 },
  nameInput: {
    backgroundColor: BG,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    fontFamily: FONTS.semibold,
    fontSize: 15,
    color: INK,
    ...NO_OUTLINE,
  },

  stackRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 8 },
  segment: { flexDirection: "row", backgroundColor: BG, borderRadius: 13, padding: 4, gap: 4, marginTop: 4 },
  segmentBtn: { flex: 1, minHeight: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segmentText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: INK_SOFT },

  actionPill: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  actionPillText: { fontFamily: FONTS.bold, fontSize: 12.5, color: BLUE },

  storageHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  storageTotal: { fontFamily: FONTS.bold, fontSize: 16, color: BLUE },
  storageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  storageKey: { flex: 1, fontFamily: FONTS.medium, fontSize: 12, color: INK_SOFT, textAlign: "right" },
  storageBytes: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED },
  barBg: { height: 6, borderRadius: 3, backgroundColor: BG, marginTop: 5, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, backgroundColor: BLUE },

  versionWrap: { paddingVertical: 22, alignItems: "center" },
  versionText: { fontFamily: FONTS.regular, fontSize: 11.5, color: INK_MUTED, textAlign: "center" },

  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: INK,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 11,
    maxWidth: "88%",
  },
  toastText: { fontFamily: FONTS.semibold, fontSize: 13, color: WHITE, textAlign: "center" },

  backdrop: { flex: 1, backgroundColor: "rgba(16,20,26,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: { width: "100%", backgroundColor: WHITE, borderRadius: 20, padding: 20, gap: 10 },
  dialogTitle: { fontFamily: FONTS.bold, fontSize: 17, color: INK, textAlign: "right" },
  dialogBody: { fontFamily: FONTS.regular, fontSize: 13, color: INK_SOFT, textAlign: "right", lineHeight: 20, marginBottom: 6 },
  dialogBtn: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dialogBtnText: { fontFamily: FONTS.bold, fontSize: 14.5, color: WHITE },
});
