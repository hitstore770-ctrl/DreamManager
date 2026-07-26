import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  I18nManager,
  Linking,
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


import { doc, setDoc } from "firebase/firestore";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { SCREEN_IN } from "../utils/motion";
import PinLock from "../components/PinLock";
import { db, isFirebaseConfigured } from "../config/firebaseConfig";
import { useAuth } from "../context/AuthContext";
import { DEFAULT_SETTINGS, WORKSPACES, useSettings } from "../context/SettingsContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../utils/haptics";
import { monthKey, todayKey, uid } from "../utils/posStore";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { withTimeout } from "../utils/network";
import { IMPLEMENTED, TOOL_COUNT } from "../utils/toolsCatalog";
import { buildSalesCsv } from "../utils/zReport";
import { NOTES_FONTS as FONTS } from "../utils/notesTheme";

// הגדרות — an iOS-style grouped settings list on the 770JLM Light Modern
// surface. Tapping the version line seven times in a row unlocks a developer
// group that renders above everything else.

const WHITE = "#FFFFFF";
const BG = "#F0F2F5";
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

const CURRENCIES = [
  { key: "₪", label: "₪ שקל" },
  { key: "$", label: "$ דולר" },
  { key: "€", label: "€ אירו" },
];

// Business support line for the WhatsApp deep link, international format with
// no "+" (e.g. "9725XXXXXXXX"). Left blank on purpose: with no number WhatsApp
// opens its contact picker with the message ready, which is better than
// deep-linking a number that might belong to someone else.
const SUPPORT_PHONE = "";

const THEME_MODES = [
  { key: "light", label: "בהיר" },
  { key: "dark", label: "כהה" },
  { key: "system", label: "מערכת" },
];

const HAPTIC_LEVELS = [
  { key: "light", label: "עדין" },
  { key: "medium", label: "בינוני" },
  { key: "heavy", label: "חזק" },
];

// Sample basket used by the developer "inject dummy sales" action.
const DUMMY_ITEMS = [
  { name: "פחית שתייה", price: 6 },
  { name: "בקבוק מים", price: 5 },
  { name: "משקה אנרגיה", price: 12 },
  { name: "קפה קר", price: 9 },
  { name: "חטיף", price: 5 },
  { name: "מארז 6 פחיות", price: 30 },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const { update, persist } = settings;
  const { user, logout } = useAuth();
  const scrollRef = useRef(null);

  const [name, setName] = useState(settings.userName || "");
  const [pinModal, setPinModal] = useState(false);
  // "devWipe" clears app storage; "factory" also restores default settings.
  const [confirmMode, setConfirmMode] = useState(null);
  const [crash, setCrash] = useState(false);
  const [vat, setVat] = useState(String(settings.vatRate ?? "17"));
  const [footer, setFooter] = useState(settings.receiptFooter ?? "");
  const [syncState, setSyncState] = useState(null);
  const [storage, setStorage] = useState({ total: 0, count: 0, rows: [] });
  // Snapshot of every app key, captured alongside the size measurement. Held
  // in state so the export handlers can serialise it synchronously — see
  // buildBackup below.
  const [snapshot, setSnapshot] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const hapticsOn = settings.haptics !== "off";
  const bounds = settings.devMode && settings.layoutBounds ? s.bounds : null;
  const compact = !!settings.compactMode;


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
  useEffect(() => {
    setVat(String(settings.vatRate ?? ""));
  }, [settings.vatRate]);
  useEffect(() => {
    setFooter(settings.receiptFooter ?? "");
  }, [settings.receiptFooter]);

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

  // --- Business inputs ------------------------------------------------------
  const saveVat = (text) => {
    // Numbers only, at most two decimals — this feeds the pricing tools.
    const clean = text.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 5);
    setVat(clean);
    update({ vatRate: clean });
  };

  const saveFooter = (text) => {
    setFooter(text);
    update({ receiptFooter: text });
  };

  // --- Data & privacy -------------------------------------------------------
  const exportZReports = async () => {
    hapticLight();
    Alert.alert("Preparing CSV export...", "מכין ייצוא דוחות Z");
    const sales = (snapshot && snapshot[STORAGE_KEYS.posSales]) || [];
    if (!Array.isArray(sales) || sales.length === 0) {
      flash("אין מכירות לייצוא — רענן מדידת אחסון אם מכרת עכשיו");
      return;
    }
    const csv = buildSalesCsv(sales);
    try {
      await Share.share({ message: csv, title: "דוחות Z — CSV" });
      return;
    } catch {
      // No share sheet here — fall back to the clipboard.
    }
    try {
      await Clipboard.setStringAsync(csv);
      flash(`${sales.length} שורות CSV הועתקו ללוח`);
    } catch {
      hapticWarning();
      flash("הייצוא נכשל");
    }
  };

  const toggleCloudBackup = async (on) => {
    hapticLight();
    update({ cloudBackup: on });
    if (!on) {
      setSyncState(null);
      flash("סנכרון לענן כובה");
      return;
    }
    if (!isFirebaseConfigured || !user?.uid) {
      setSyncState({ ok: false, text: "אין חיבור לחשבון ענן" });
      flash("אין חיבור לחשבון ענן");
      return;
    }
    setSyncState({ ok: null, text: "מסנכרן…" });
    try {
      await withTimeout(
        setDoc(doc(db, "users", user.uid), { backup: buildBackup(), backupAt: Date.now() }, { merge: true })
      );
      hapticSuccess();
      setSyncState({ ok: true, text: `סונכרן ${new Date().toLocaleTimeString("he-IL")}` });
      flash("הגיבוי נשלח לענן");
    } catch {
      hapticWarning();
      setSyncState({ ok: false, text: "הסנכרון נכשל — אין רשת" });
      flash("הסנכרון נכשל");
    }
  };

  const clearImageCache = () => {
    hapticLight();
    // React Native has no public image-cache clear API. Bumping a token that
    // every remote cover URI carries forces the loader to miss its entry once,
    // which is the portable equivalent.
    update({ imageCacheToken: Date.now() });
    flash("מטמון התמונות אופס — הכריכות ייטענו מחדש");
  };

  const factoryReset = () => {
    hapticWarning();
    // Alert buttons are ignored by react-native-web, so the web build gets the
    // in-app dialog and native gets the platform alert.
    if (Platform.OS === "web") {
      setConfirmMode("factory");
      return;
    }
    Alert.alert(
      "איפוס אפליקציה מוחלט",
      "כל הנתונים המקומיים וההגדרות יימחקו לצמיתות. אין דרך לשחזר בלי גיבוי.",
      [
        { text: "ביטול", style: "cancel" },
        { text: "אפס הכל", style: "destructive", onPress: () => runWipe(true) },
      ],
      { cancelable: true }
    );
  };

  const requestDeepWipe = () => {
    hapticWarning();
    if (Platform.OS === "web") {
      setConfirmMode("devWipe");
      return;
    }
    Alert.alert(
      "מחיקת AsyncStorage עמוקה",
      "כל מפתחות האחסון של האפליקציה יימחקו. ההגדרות יישארו כפי שהן בזיכרון עד להפעלה מחדש.",
      [
        { text: "ביטול", style: "cancel" },
        { text: "מחק", style: "destructive", onPress: () => runWipe(false) },
      ],
      { cancelable: true }
    );
  };

  const runWipe = async (factory) => {
    setConfirmMode(null);
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith("@dreammanager/"));
      await AsyncStorage.removeMany(keys);
      if (factory) persist({ ...DEFAULT_SETTINGS });
      hapticWarning();
      await measureStorage();
      flash(
        factory
          ? `אופס למצב יצרן · ${keys.length} מפתחות נמחקו`
          : `${keys.length} מפתחות נמחקו — הפעל מחדש את האפליקציה`
      );
    } catch {
      flash("המחיקה נכשלה");
    }
  };

  // --- About & support ----------------------------------------------------
  const contactSupport = async () => {
    hapticLight();
    const text = encodeURIComponent("היי, צריך עזרה עם המערכת...");
    const web = `https://wa.me/${SUPPORT_PHONE}?text=${text}`;
    // The whatsapp:// scheme resolves on a device but not in a browser, so the
    // web build goes straight to wa.me.
    if (Platform.OS !== "web") {
      const app = SUPPORT_PHONE
        ? `whatsapp://send?phone=${SUPPORT_PHONE}&text=${text}`
        : `whatsapp://send?text=${text}`;
      try {
        if (await Linking.canOpenURL(app)) {
          await Linking.openURL(app);
          return;
        }
      } catch {
        // WhatsApp is not installed — fall through to the web endpoint.
      }
    }
    try {
      await Linking.openURL(web);
    } catch {
      hapticWarning();
      flash("לא ניתן לפתוח את וואטסאפ");
    }
  };

  const shareApp = async () => {
    hapticLight();
    const message = [
      "DreamManager — מערכת ניהול לעסק קטן 💼",
      "קופה, מלאי, הקפות, דוחות, פתקים, חלומות ו-121 כלים — הכול במקום אחד.",
      "",
      APP_VERSION,
    ].join("\n");
    try {
      await Share.share({ message, title: "DreamManager" });
    } catch {
      try {
        await Clipboard.setStringAsync(message);
        flash("ההזמנה הועתקה ללוח");
      } catch {
        hapticWarning();
        flash("השיתוף נכשל");
      }
    }
  };

  const comingSoon = (what) => {
    hapticWarning();
    Alert.alert("בקרוב");
    flash(`${what} — בקרוב`);
  };

  // --- Developer ------------------------------------------------------------
  const injectDummySales = async () => {
    hapticLight();
    const records = [];
    const now = Date.now();
    for (let day = 6; day >= 0; day--) {
      const when = new Date(now - day * 86400000);
      const txCount = 2 + ((day * 3) % 3);
      for (let t = 0; t < txCount; t++) {
        const txId = uid();
        const ts = when.setHours(9 + t * 3, 15 * t, 0, 0);
        const lines = 1 + ((day + t) % 3);
        for (let i = 0; i < lines; i++) {
          const item = DUMMY_ITEMS[(day + t + i) % DUMMY_ITEMS.length];
          const qty = 1 + ((t + i) % 3);
          records.push({
            id: uid(),
            eventId: txId,
            ts,
            day: todayKey(new Date(ts)),
            month: monthKey(new Date(ts)),
            name: item.name,
            qty,
            price: item.price,
            total: item.price * qty,
            profit: item.price * qty,
            cost: 0,
            itemId: null,
            category: "demo",
            kind: "sale",
            pay: (day + t) % 2 === 0 ? "cash" : "credit",
          });
        }
      }
    }
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.posSales);
      const existing = raw ? JSON.parse(raw) : [];
      await AsyncStorage.setItem(STORAGE_KEYS.posSales, JSON.stringify([...existing, ...records]));
      hapticSuccess();
      await measureStorage();
      // The business tab keeps its own copy in context once mounted, so the
      // new rows appear there after a restart.
      flash(`${records.length} רשומות מכירה נוספו · הפעל מחדש כדי לראות בעסק`);
    } catch {
      hapticWarning();
      flash("ההזרקה נכשלה");
    }
  };

  // Developer "force crash": thrown after every hook has run, so the only
  // thing that unwinds is the render — exactly what ErrorBoundary catches.
  if (crash) throw new Error("Forced crash from Developer Options 🛠️");

  return (
    <Animated.View entering={SCREEN_IN} style={{ flex: 1, backgroundColor: BG }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Icon name="settings" size={20} color={BLUE} />
            <Text style={s.title}>הגדרות</Text>
          </View>
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
        contentContainerStyle={{ padding: compact ? 6 : 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---------- Developer Options (hidden until unlocked) ---------- */}
        {settings.devMode && (
          <Section index={0}>
            <Group title="Developer Options 🛠️" accent={GOLD}>
              <InfoRow label="פלטפורמה" value={diagnostics.platform} icon="📱" bounds={bounds} compact={compact} />
              <InfoRow label="כיוון פריסה" value={diagnostics.rtl} icon="↔️" bounds={bounds} compact={compact} />
              <InfoRow label="קטלוג כלים" value={diagnostics.tools} icon="🧰" bounds={bounds} compact={compact} />
              <InfoRow label="אחסון מקומי" value={diagnostics.keys} icon="💽" bounds={bounds} compact={compact} />
              <InfoRow label="מזהה משתמש" value={diagnostics.user} icon="🆔" bounds={bounds} compact={compact} />
              <ActionRow label="העתק דוח אבחון" hint="כל הנתונים שלמעלה כטקסט" icon="📋" bounds={bounds} compact={compact} onPress={copyDiagnostics} />
              <ActionRow label="רענן מדידת אחסון" icon="🔄" bounds={bounds} compact={compact} onPress={() => { hapticLight(); measureStorage(); flash("נמדד מחדש"); }} />
              <ActionRow
                label="הזרקת נתוני מכירות לבדיקה"
                hint="מוסיף שבוע של מכירות דמה ל-posSales"
                icon="💉"
                bounds={bounds}
                onPress={injectDummySales}
              />
              <SwitchRow
                label="הצגת גבולות עיצוב"
                hint="מסמן כל שורה ופקד במסך ההגדרות"
                icon="📐"
                compact={compact}
                value={!!settings.layoutBounds}
                bounds={bounds}
                onValueChange={(v) => { hapticLight(); update({ layoutBounds: v }); }}
              />
              <ActionRow
                label="בדיקת קריסה"
                hint="זורק שגיאה כדי לבדוק את ה-Error Boundary"
                icon="💥"
                danger
                bounds={bounds}
                onPress={() => { hapticWarning(); setCrash(true); }}
              />
              <ActionRow
                label="מחיקת AsyncStorage עמוקה"
                hint="פעולה בלתי הפיכה"
                icon="🧨"
                danger
                bounds={bounds}
                onPress={requestDeepWipe}
              />
              <ActionRow
                label="נעל מצב מפתח"
                icon="🔒"
                last
                bounds={bounds}
                onPress={() => {
                  hapticWarning();
                  update({ devMode: false });
                  flash("🔒 מצב מפתח ננעל");
                }}
              />
            </Group>
          </Section>
        )}

        {/* ---------- Profile ---------- */}
        <Section index={1}>
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
          <InfoRow label="חשבון" value={user?.email || "—"} icon="✉️" bounds={bounds} compact={compact} />
          <ActionRow label="התנתקות" icon="🚪" danger last compact={compact} bounds={bounds}  onPress={() => { hapticWarning(); logout(); }} />
        </Group>
        </Section>

        {/* ---------- Business ---------- */}
        <Section index={2}>
        <Group title="הגדרות עסק וקופה" icon="🏪">
          <View style={s.stackRow}>
            <Text style={s.rowLabel}>🗂️  סביבת עבודה</Text>
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
            icon="🔊"
            compact={compact}
            bounds={bounds}
            value={settings.sounds}
            onValueChange={(v) => { hapticLight(); update({ sounds: v }); }}
          />
          <SwitchRow
            label="מצב חשאי"
            hint="הסתרת כל הסכומים הכספיים (•••••)"
            icon="🕶️"
            compact={compact}
            value={settings.stealth}
            bounds={bounds}
            onValueChange={(v) => { hapticLight(); update({ stealth: v }); }}
          />
          <View style={[s.row, compact && s.rowCompact, bounds]}>
            <Text style={s.rowIcon}>🧾</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>מע״מ ברירת מחדל</Text>
              <Text style={s.rowHint}>משמש את מחשבוני התמחור והייבוא (%)</Text>
            </View>
            <TextInput
              testID="vat-input"
              style={[s.inlineInput, bounds]}
              value={vat}
              onChangeText={saveVat}
              keyboardType="numeric"
              placeholder="17"
              placeholderTextColor={INK_MUTED}
              textAlign="right"
              maxLength={5}
            />
          </View>
          <Divider />
          <SwitchRow
            label="ניקוי עגלה אוטומטי בסיום חיוב"
            hint="כבוי — הסל נשאר על המסך אחרי חיוב"
            icon="🧹"
            compact={compact}
            bounds={bounds}
            value={settings.autoClearCart}
            bounds={bounds}
            onValueChange={(v) => { hapticLight(); update({ autoClearCart: v }); }}
          />
          <View style={[s.stackRow, bounds]}>
            <Text style={s.rowLabel}>🧾  הודעת תחתית קבלה</Text>
            <TextInput
              testID="footer-input"
              style={[s.nameInput, bounds]}
              value={footer}
              onChangeText={saveFooter}
              placeholder="תודה שקניתם!"
              placeholderTextColor={INK_MUTED}
              textAlign="right"
              maxLength={60}
            />
          </View>
          <Divider />
          <View style={[s.stackRow, bounds]}>
            <Text style={s.rowLabel}>💱  סמל מטבע</Text>
            <Text style={s.rowHint}>מוחל על כל הסכומים באפליקציה</Text>
            <Segment
              options={CURRENCIES}
              value={settings.currency}
              bounds={bounds}
              onChange={(k) => { hapticLight(); update({ currency: k }); }}
            />
          </View>
          <Divider />
          <View style={[s.stackRow, bounds, !hapticsOn && { opacity: 0.45 }]}>
            <Text style={s.rowLabel}>📳  עוצמת רטט</Text>
            <Text style={s.rowHint}>
              {hapticsOn ? "חוזק המשוב בכל לחיצה באפליקציה" : "מושבת — הפעל ״משוב הפטי״ בקבוצת מערכת"}
            </Text>
            <Segment
              options={HAPTIC_LEVELS}
              value={hapticsOn ? settings.haptics : settings.hapticsLevel}
              disabled={!hapticsOn}
              bounds={bounds}
              onChange={(k) => {
                update({ haptics: k, hapticsLevel: k });
                // Fire after the level lands so the tap demonstrates it.
                setTimeout(hapticLight, 0);
              }}
            />
          </View>
        </Group>
        </Section>

        {/* ---------- Notifications ---------- */}
        <Section index={3}>
        <Group title="התראות" icon="🔔">
          <SwitchRow
            label="התראות מלאי נמוך"
            hint="התרעה כשפריט במחסן יורד מתחת ל-5 יחידות"
            icon="📉"
            value={settings.lowStockAlerts}
            compact={compact}
            bounds={bounds}
            onValueChange={(v) => { hapticLight(); update({ lowStockAlerts: v }); }}
          />
          <SwitchRow
            label="תזכורת דוח Z יומי"
            hint="תזכורת בסוף היום לסגור את המשמרת"
            icon="🧾"
            value={settings.dailyZReminder}
            last
            compact={compact}
            bounds={bounds}
            onValueChange={(v) => { hapticLight(); update({ dailyZReminder: v }); }}
          />
        </Group>
        </Section>

        {/* ---------- Appearance ---------- */}
        <Section index={4}>
        <Group title="תצוגה" icon="🎨">
          <View style={[s.stackRow, bounds]}>
            <Text style={s.rowLabel}>🌙  ערכת נושא</Text>
            <Text style={s.rowHint}>
              {settings.themeMode === "light"
                ? "בהיר — 770JLM Light"
                : "נשמר להעדפות; המסכים עדיין נצבעים בהיר"}
            </Text>
            <Segment
              options={THEME_MODES}
              value={settings.themeMode}
              bounds={bounds}
              onChange={(k) => { hapticLight(); update({ themeMode: k }); }}
            />
          </View>
          <Divider />
          <SwitchRow
            label="תצוגה צפופה"
            hint="פחות ריווח ברשימות — יותר תוכן על מסך צר"
            icon="📏"
            value={compact}
            last
            compact={compact}
            bounds={bounds}
            onValueChange={(v) => { hapticLight(); update({ compactMode: v }); }}
          />
        </Group>
        </Section>

        {/* ---------- Data & backup ---------- */}
        <Section index={5}>
        <Group title="גיבוי, נתונים ופרטיות" icon="💾">
          <View style={s.stackRow}>
            <View style={s.storageHead}>
              <Text style={s.storageTotal}>{fmtBytes(storage.total)}</Text>
              <Text style={s.rowLabel}>💽  נפח בשימוש</Text>
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
          <ActionRow label="ייצוא גיבוי" hint="שיתוף כל הנתונים כקובץ JSON" icon="📤" bounds={bounds} compact={compact} onPress={exportBackup} />
          <ActionRow label="העתק גיבוי ללוח" icon="📋" bounds={bounds} compact={compact} onPress={copyBackup} />
          <ActionRow
            label="ייצוא דוחות Z"
            hint="כל שורות המכירה כקובץ CSV"
            icon="📊"
            bounds={bounds}
            onPress={exportZReports}
          />
          <SwitchRow
            label="סנכרון נתונים לענן"
            icon="☁️"
            compact={compact}
            hint={syncState ? syncState.text : "שולח עותק של הנתונים ל-Firestore"}
            value={settings.cloudBackup}
            bounds={bounds}
            onValueChange={toggleCloudBackup}
          />
          <ActionRow label="ניקוי מטמון תמונות" hint="טוען מחדש את כריכות החלומות" icon="🖼️" bounds={bounds} compact={compact} onPress={clearImageCache} />
          <ActionRow label="ארכוב דוחות מעל 90 יום" hint="מנקה מכירות ישנות" icon="🗄️" last bounds={bounds} compact={compact} onPress={archiveOldReports} />
        </Group>

        </Section>

        {/* ---------- Danger zone ---------- */}
        <Section index={6}>
        <Group title="אזור סכנה" icon="⚠️" accent={RED}>
          <View style={s.dangerWrap}>
            <Text style={s.dangerText}>
              מחיקה מוחלטת של כל המכירות, המלאי, ההקפות, הפתקים, החלומות וההעדפות מהמכשיר, וחזרה
              להגדרות היצרן.
            </Text>
            <Bounce testID="factory-reset" style={[s.dangerBtn, bounds]} onPress={factoryReset}>
              <Text style={s.dangerBtnText}>איפוס אפליקציה מוחלט</Text>
            </Bounce>
          </View>
        </Group>
        </Section>

        {/* ---------- System ---------- */}
        <Section index={7}>
        <Group title="מערכת" icon="🔧">
          <SwitchRow
            label="משוב הפטי"
            hint="רטט בלחיצות ובפעולות בכל האפליקציה"
            icon="📳"
            compact={compact}
            value={hapticsOn}
            bounds={bounds}
            onValueChange={toggleHaptics}
          />
          <InfoRow label="עוצמת רטט" value={HAPTIC_LEVELS.find((l) => l.key === settings.haptics)?.label || "כבוי"} icon="📶" bounds={bounds} compact={compact} />
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
          <InfoRow label="שפה וכיוון" value={`עברית · ${diagnostics.rtl}`} icon="🌐" last bounds={bounds} compact={compact} />
        </Group>
        </Section>

        {/* ---------- About & support ---------- */}
        <Section index={8}>
        <Group title="אודות ותמיכה" icon="💬">
          <ActionRow
            label="צור קשר בוואטסאפ"
            hint="נפתח עם הודעה מוכנה"
            icon="💬"
            compact={compact}
            bounds={bounds}
            onPress={contactSupport}
          />
          <ActionRow label="שתף מערכת" hint="הזמנה קצרה לשליחה" icon="📤" compact={compact} bounds={bounds}  onPress={shareApp} />
          <ActionRow label="תנאי שימוש" icon="📜" compact={compact} bounds={bounds}  onPress={() => comingSoon("תנאי שימוש")} />
          <ActionRow label="מדיניות פרטיות" icon="🔏" last compact={compact} bounds={bounds}  onPress={() => comingSoon("מדיניות פרטיות")} />
        </Group>
        </Section>

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

      {/* Destructive confirmation for web, where Alert buttons are ignored. */}
      <Modal visible={!!confirmMode} transparent animationType="fade" onRequestClose={() => setConfirmMode(null)}>
        <View style={s.backdrop}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>
              {confirmMode === "factory" ? "⚠️ איפוס אפליקציה מוחלט" : "🧨 מחיקת AsyncStorage עמוקה"}
            </Text>
            <Text style={s.dialogBody}>
              {confirmMode === "factory"
                ? "כל הנתונים המקומיים וההגדרות יימחקו לצמיתות וההגדרות יחזרו לברירת המחדל. אין דרך לשחזר בלי גיבוי."
                : "כל מפתחות האחסון של האפליקציה יימחקו. ההגדרות יישארו בזיכרון עד להפעלה מחדש."}
            </Text>
            <TouchableOpacity
              testID="confirm-destructive"
              style={[s.dialogBtn, { backgroundColor: RED }]}
              onPress={() => runWipe(confirmMode === "factory")}
              activeOpacity={0.85}
            >
              <Text style={s.dialogBtnText}>{confirmMode === "factory" ? "אפס הכל" : "כן, מחק הכל"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.dialogBtn, { backgroundColor: BG }]}
              onPress={() => setConfirmMode(null)}
              activeOpacity={0.85}
            >
              <Text style={[s.dialogBtnText, { color: INK_SOFT }]}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

/* --------------------------------------------------------------------------
 * Grouped-list building blocks
 * ----------------------------------------------------------------------- */

// Sections stagger in when the tab mounts.
function Section({ index = 0, children }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 70).duration(340)} layout={LinearTransition.springify()}>
      {children}
    </Animated.View>
  );
}

function Group({ title, icon, accent, children, bounds }) {
  return (
    <View style={[s.group, bounds]}>
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

function InfoRow({ label, value, icon, last, bounds, compact }) {
  return (
    <>
      <View style={[s.row, compact && s.rowCompact, bounds]}>
        <Text style={s.rowIcon}>{icon || "•"}</Text>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowValue} numberOfLines={1}>{value}</Text>
      </View>
      <Divider last={last} />
    </>
  );
}

function SwitchRow({ label, hint, icon, value, onValueChange, disabled, last, bounds, compact }) {
  return (
    <>
      <View style={[s.row, compact && s.rowCompact, bounds, disabled && { opacity: 0.45 }]}>
        <Text style={s.rowIcon}>{icon || "•"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>{label}</Text>
          {!!hint && <Text style={s.rowHint}>{hint}</Text>}
        </View>
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
      </View>
      <Divider last={last} />
    </>
  );
}

function ActionRow({ label, hint, icon, onPress, danger, actionLabel, last, bounds, compact }) {
  return (
    <>
      <TouchableOpacity style={[s.row, compact && s.rowCompact, bounds]} onPress={onPress} activeOpacity={0.65}>
        <Text style={s.rowIcon}>{icon || "•"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.rowLabel, danger && { color: RED }]}>{label}</Text>
          {!!hint && <Text style={s.rowHint}>{hint}</Text>}
        </View>
        {actionLabel ? (
          <View style={[s.actionPill, danger && { backgroundColor: RED + "18" }]}>
            <Text style={[s.actionPillText, danger && { color: RED }]}>{actionLabel}</Text>
          </View>
        ) : (
          <Text style={s.chevron}>‹</Text>
        )}
      </TouchableOpacity>
      <Divider last={last} />
    </>
  );
}

function Segment({ options, value, onChange, disabled, bounds }) {
  return (
    <View style={[s.segment, bounds]}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          testID={`seg-${o.key}`}
          style={[s.segmentBtn, bounds, value === o.key && { backgroundColor: BLUE }]}
          onPress={() => !disabled && onChange(o.key)}
          activeOpacity={disabled ? 1 : 0.75}
        >
          <Text style={[s.segmentText, value === o.key && { color: WHITE }]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.04,
  shadowRadius: 12,
  elevation: 2,
};

const s = StyleSheet.create({
  titleRow: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    flexShrink: 0,
  },
  header: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
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
  groupCard: { backgroundColor: WHITE, borderRadius: 18, overflow: "hidden", ...SHADOW },
  divider: { height: 1, backgroundColor: HAIRLINE, marginStart: 16 },

  // I18nManager.isRTL is false on web, so a plain "row" would mirror the whole
  // list in the preview. Reversing there keeps the icon on the reading-start
  // (right) edge on both platforms.
  row: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 60,
  },
  rowCompact: { paddingVertical: 7, minHeight: 44 },
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
  segment: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    backgroundColor: BG,
    borderRadius: 13,
    padding: 4,
    gap: 4,
    marginTop: 4,
  },
  segmentBtn: { flex: 1, minHeight: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segmentText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: INK_SOFT },

  actionPill: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  actionPillText: { fontFamily: FONTS.bold, fontSize: 12.5, color: BLUE },

  storageHead: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  storageTotal: { fontFamily: FONTS.bold, fontSize: 16, color: BLUE },
  storageRow: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  storageKey: { flex: 1, fontFamily: FONTS.medium, fontSize: 12, color: INK_SOFT, textAlign: "right" },
  storageBytes: { fontFamily: FONTS.regular, fontSize: 11, color: INK_MUTED },
  barBg: { height: 6, borderRadius: 3, backgroundColor: BG, marginTop: 5, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, backgroundColor: BLUE },

  inlineInput: {
    minWidth: 78,
    maxWidth: 120,
    minHeight: 44,
    backgroundColor: BG,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: BLUE,
    ...NO_OUTLINE,
  },

  dangerWrap: { padding: 16, gap: 12 },
  dangerText: { fontFamily: FONTS.regular, fontSize: 12.5, color: INK_SOFT, textAlign: "right", lineHeight: 19 },
  dangerBtn: { minHeight: 54, borderRadius: 14, backgroundColor: RED, alignItems: "center", justifyContent: "center" },
  dangerBtnText: { fontFamily: FONTS.bold, fontSize: 15.5, color: WHITE },

  // Developer "render layout bounds" overlay.
  bounds: { borderWidth: 1, borderColor: "#FF2D95" },

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
