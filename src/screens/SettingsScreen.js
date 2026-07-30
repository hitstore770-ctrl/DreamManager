import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, I18nManager, Linking, Modal, Platform, ScrollView, Share, StyleSheet, Switch, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInUp, LinearTransition } from "react-native-reanimated";


import { doc, setDoc } from "firebase/firestore";

import Bounce from "../components/Bounce";
import Icon from "../components/Icon";
import { FLUID, SCREEN_IN, listEntry } from "../utils/motion";
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
import CustomText from "../components/CustomText";
import { KEY_SLOTS, SECURE_STORE_AVAILABLE, apiKey, keySource, loadApiKeys, maskKey, onApiKeysChanged, saveApiKey } from "../config/apiKeys";
import { STARTUP_SCREENS } from "../navigation/startupScreens";

// הגדרות — an iOS-style grouped settings list on the 770JLM Light Modern
// surface. Tapping the version line seven times in a row unlocks a developer
// group that renders above everything else.

const WHITE = "#FFFFFF";
const BG = "#F4F6F9";
const INK = "#111827";
const INK_SOFT = "#6B7280";
const INK_MUTED = "#9CA3AF";
const BLUE = "#7C3AED";
const GOLD = "#06B6D4";
const GREEN = "#067647";
const RED = "#EF4444";
const HAIRLINE = "#EEF1F6";

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
  const [maaser, setMaaser] = useState(String(settings.maaserRate ?? "10"));
  const [footer, setFooter] = useState(settings.receiptFooter ?? "");
  // What is typed into the API key fields. Never seeded from the stored key:
  // the row shows a mask instead, so an over-the-shoulder look or a screenshot
  // of this screen cannot leak a working key.
  const [keyDrafts, setKeyDrafts] = useState({});
  const [keySources, setKeySources] = useState({});
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
    setMaaser(String(settings.maaserRate ?? ""));
  }, [settings.maaserRate]);
  useEffect(() => {
    setFooter(settings.receiptFooter ?? "");
  }, [settings.receiptFooter]);

  // --- API keys -------------------------------------------------------------
  // Read where each key currently comes from once the keystore has been
  // opened, and again whenever one is saved or cleared.
  const refreshKeySources = useCallback(async () => {
    await loadApiKeys().catch(() => {});
    setKeySources(
      Object.fromEntries(Object.keys(KEY_SLOTS).map((id) => [id, keySource(id)]))
    );
  }, []);
  useEffect(() => {
    refreshKeySources();
    return onApiKeysChanged(() => {
      setKeySources(
        Object.fromEntries(Object.keys(KEY_SLOTS).map((id) => [id, keySource(id)]))
      );
    });
  }, [refreshKeySources]);

  const saveKey = useCallback(
    async (id) => {
      const value = String(keyDrafts[id] ?? "").trim();
      if (!value) return;
      const res = await saveApiKey(id, value);
      if (!res.ok) {
        hapticWarning();
        flash("שמירת המפתח נכשלה");
        return;
      }
      hapticSuccess();
      // Clear the field on success. The key is stored; leaving it on screen
      // only creates another copy of it to be seen.
      setKeyDrafts((prev) => ({ ...prev, [id]: "" }));
      await refreshKeySources();
      flash(`המפתח של ${KEY_SLOTS[id].label} נשמר`);
    },
    [keyDrafts, flash, refreshKeySources]
  );

  const clearKey = useCallback(
    async (id) => {
      await saveApiKey(id, "");
      hapticWarning();
      setKeyDrafts((prev) => ({ ...prev, [id]: "" }));
      await refreshKeySources();
      // Removing the saved key does not necessarily leave the feature dead —
      // a build-time EXPO_PUBLIC_ value takes over if there is one, and the
      // row will say so on its own.
      flash(`המפתח של ${KEY_SLOTS[id].label} נמחק`);
    },
    [flash, refreshKeySources]
  );

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
      flash("Developer Mode Unlocked!");
      measureStorage();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      hapticWarning();
      Alert.alert("Developer Mode Locked", "אפשרויות המפתח הוסתרו.");
      flash("מצב מפתח ננעל");
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

  // Same shape as saveVat: sanitize and commit on every keystroke rather than
  // on blur. react-native-web's TextInput does not implement onEndEditing at
  // all — a field wired to it looks fine on a real device and silently never
  // saves in the browser preview.
  const saveMaaser = (text) => {
    const clean = text.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 5);
    setMaaser(clean);
    update({ maaserRate: clean });
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
      "DreamManager — מערכת ניהול לעסק קטן",
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
  if (crash) throw new Error("Forced crash from Developer Options");

  return (
    <Animated.View entering={SCREEN_IN} style={{ flex: 1, backgroundColor: BG }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Icon name="settings" size={20} color={BLUE} />
            <CustomText style={s.title}>הגדרות</CustomText>
          </View>
          <CustomText style={s.subtitle}>
            {settings.userName ? `שלום, ${settings.userName}` : "העדפות, גיבוי ומערכת"}
          </CustomText>
        </View>
        {settings.devMode && (
          <Animated.View entering={FadeInDown.duration(220)} style={s.devPill}>
            <><Icon name="tool" size={11} color="#7A5B00" /><CustomText style={s.devPillText}>DEV</CustomText></>
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
            <Group title="Developer Options" icon="tool" accent={GOLD}>
              <InfoRow label="פלטפורמה" value={diagnostics.platform} icon="smartphone" bounds={bounds} compact={compact} />
              <InfoRow label="כיוון פריסה" value={diagnostics.rtl} icon="git-compare" bounds={bounds} compact={compact} />
              <InfoRow label="קטלוג כלים" value={diagnostics.tools} icon="grid" bounds={bounds} compact={compact} />
              <InfoRow label="אחסון מקומי" value={diagnostics.keys} icon="hard-drive" bounds={bounds} compact={compact} />
              <InfoRow label="מזהה משתמש" value={diagnostics.user} icon="hash" bounds={bounds} compact={compact} />
              <ActionRow label="העתק דוח אבחון" hint="כל הנתונים שלמעלה כטקסט" icon="copy" bounds={bounds} compact={compact} onPress={copyDiagnostics} />
              <ActionRow label="רענן מדידת אחסון" icon="refresh-cw" bounds={bounds} compact={compact} onPress={() => { hapticLight(); measureStorage(); flash("נמדד מחדש"); }} />
              <ActionRow
                label="הזרקת נתוני מכירות לבדיקה"
                hint="מוסיף שבוע של מכירות דמה ל-posSales"
                icon="database"
                bounds={bounds}
                onPress={injectDummySales}
              />
              <SwitchRow
                label="הצגת גבולות עיצוב"
                hint="מסמן כל שורה ופקד במסך ההגדרות"
                icon="layout"
                compact={compact}
                value={!!settings.layoutBounds}
                bounds={bounds}
                onValueChange={(v) => { hapticLight(); update({ layoutBounds: v }); }}
              />
              <ActionRow
                label="בדיקת קריסה"
                hint="זורק שגיאה כדי לבדוק את ה-Error Boundary"
                icon="zap"
                danger
                bounds={bounds}
                onPress={() => { hapticWarning(); setCrash(true); }}
              />
              <ActionRow
                label="מחיקת AsyncStorage עמוקה"
                hint="פעולה בלתי הפיכה"
                icon="trash-2"
                danger
                bounds={bounds}
                onPress={requestDeepWipe}
              />
              <ActionRow
                label="נעל מצב מפתח"
                icon="lock"
                last
                bounds={bounds}
                onPress={() => {
                  hapticWarning();
                  update({ devMode: false });
                  flash("מצב מפתח ננעל");
                }}
              />
            </Group>
          </Section>
        )}

        {/* ---------- Profile ---------- */}
        <Section index={1}>
        <Group title="פרופיל אישי" icon="user">
          <View style={s.fieldRow}>
            <CustomText style={s.rowLabel}>שם משתמש</CustomText>
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
          <InfoRow label="חשבון" value={user?.email || "—"} icon="mail" bounds={bounds} compact={compact} />
          <ActionRow label="התנתקות" icon="log-out" danger last compact={compact} bounds={bounds}  onPress={() => { hapticWarning(); logout(); }} />
        </Group>
        </Section>

        {/* ---------- Account & security ---------- */}
        <Section index={2}>
        <Group title="חשבון ואבטחה" icon="shield">
          <SwitchRow
            label="נעילה ביומטרית"
            hint={
              "טביעת אצבע או זיהוי פנים בפתיחת האפליקציה. אם אין ביומטריה מוגדרת במכשיר — " +
              "האפליקציה תיפתח רגיל, כדי שלא תינעל בחוץ בלי דרך חזרה."
            }
            icon="lock"
            value={!!settings.biometricLock}
            onValueChange={(v) => {
              hapticLight();
              update({ biometricLock: v });
            }}
            bounds={bounds}
            compact={compact}
          />
          <ActionRow
            label={settings.pin ? "שינוי קוד PIN" : "הגדרת קוד PIN"}
            hint="נעילה נוספת שאינה תלויה בחומרה"
            icon="hash"
            actionLabel={settings.pin ? "שנה" : "הגדר"}
            onPress={() => {
              hapticLight();
              setPinModal(true);
            }}
            bounds={bounds}
            compact={compact}
          />
          <InfoRow
            label="מזהה משתמש"
            value={user?.uid ? `${user.uid.slice(0, 10)}…` : "—"}
            icon="user"
            last
            bounds={bounds}
            compact={compact}
          />
        </Group>
        </Section>

        {/* ---------- App preferences ---------- */}
        <Section index={3}>
        <Group title="העדפות אפליקציה" icon="sliders">
          <View style={s.stackRow}>
            <StackLabel icon="home" text="מסך פתיחה" />
            <CustomText style={s.rowHint}>
              {STARTUP_SCREENS.find((x) => x.name === settings.startupScreen)?.label || "נועה"}
            </CustomText>
            <Segment
              options={STARTUP_SCREENS.map((x) => ({ key: x.name, label: x.label }))}
              value={settings.startupScreen}
              onChange={(v) => {
                hapticLight();
                update({ startupScreen: v });
              }}
              bounds={bounds}
            />
          </View>
          <SwitchRow
            label="אנימציות"
            hint="כיבוי מוריד צריכת סוללה ועוזר למי שרגיש לתנועה. המסכים נטענים מיידית במקום להיכנס בהדרגה."
            icon="zap"
            value={settings.animations !== false}
            onValueChange={(v) => {
              hapticLight();
              update({ animations: v });
            }}
            last
            bounds={bounds}
            compact={compact}
          />
        </Group>
        </Section>

        {/* ---------- POS configuration ---------- */}
        <Section index={4}>
        <Group title="תצורת קופה" icon="shopping-cart">
          <View style={s.fieldRow}>
            <CustomText style={s.rowLabel}>מע״מ (%)</CustomText>
            <TextInput
              testID="set-vat"
              style={s.nameInput}
              value={vat}
              onChangeText={saveVat}
              keyboardType="decimal-pad"
              textAlign="center"
              maxLength={5}
            />
          </View>
          <View style={s.fieldRow}>
            <CustomText style={s.rowLabel}>מעשר מהרווח (%)</CustomText>
            <TextInput
              testID="set-maaser"
              style={s.nameInput}
              value={maaser}
              onChangeText={saveMaaser}
              keyboardType="decimal-pad"
              textAlign="center"
              maxLength={5}
            />
          </View>
          <SwitchRow
            label="פריט ידני בקופה"
            hint="כפתור להוספת פריט בשם ומחיר חופשיים. במצב אליאקספרס אין הזנה ידנית בכל מקרה — פריט נכנס רק בסריקה."
            icon="edit-3"
            value={settings.allowManualItems !== false}
            onValueChange={(v) => {
              hapticLight();
              update({ allowManualItems: v });
            }}
            bounds={bounds}
            compact={compact}
          />
          <SwitchRow
            label="ניקוי עגלה אוטומטי"
            hint="לרוקן את העגלה מיד אחרי חיוב"
            icon="trash-2"
            value={settings.autoClearCart !== false}
            onValueChange={(v) => {
              hapticLight();
              update({ autoClearCart: v });
            }}
            last
            bounds={bounds}
            compact={compact}
          />
        </Group>
        </Section>

        {/* ---------- API keys ---------- */}
        <Section index={5}>
        <Group title="מפתחות API" icon="key">
          <View style={s.noticeRow}>
            <Icon name={SECURE_STORE_AVAILABLE ? "lock" : "alert-triangle"} size={14} color={SECURE_STORE_AVAILABLE ? GREEN : GOLD} />
            <CustomText style={s.noticeText}>
              {SECURE_STORE_AVAILABLE
                ? "המפתחות נשמרים במאגר המאובטח של המכשיר (Keychain / Keystore) ולא נכנסים לקוד האפליקציה."
                : "בדפדפן אין מאגר מאובטח — המפתח נשמר ב-localStorage בטקסט גלוי. במכשיר עצמו הוא נשמר מוצפן."}
            </CustomText>
          </View>

          {Object.values(KEY_SLOTS).map((slot, i) => (
            <ApiKeyRow
              key={slot.id}
              slot={slot}
              value={keyDrafts[slot.id] ?? ""}
              onChange={(v) => setKeyDrafts((prev) => ({ ...prev, [slot.id]: v }))}
              onSave={() => saveKey(slot.id)}
              onClear={() => clearKey(slot.id)}
              source={keySources[slot.id]}
              last={i === Object.values(KEY_SLOTS).length - 1}
              bounds={bounds}
            />
          ))}
        </Group>
        </Section>

        {/* ---------- Business ---------- */}
        <Section index={6}>
        <Group title="הגדרות עסק וקופה" icon="shopping-bag">
          <View style={s.stackRow}>
            <StackLabel icon="folder" text="סביבת עבודה" />
            <CustomText style={s.rowHint}>{WORKSPACES.find((w) => w.key === settings.workspace)?.hint}</CustomText>
            <Segment
              options={WORKSPACES.map((w) => ({ key: w.key, label: w.label }))}
              value={settings.workspace}
              onChange={(k) => { hapticLight(); update({ workspace: k }); }}
            />
          </View>
          <SwitchRow
            label="צלילי קופה"
            hint="קליק מכני בכל פעולה בקופה"
            icon="volume-2"
            compact={compact}
            bounds={bounds}
            value={settings.sounds}
            onValueChange={(v) => { hapticLight(); update({ sounds: v }); }}
          />
          <SwitchRow
            label="מצב חשאי"
            hint="הסתרת כל הסכומים הכספיים (•••••)"
            icon="eye-off"
            compact={compact}
            value={settings.stealth}
            bounds={bounds}
            onValueChange={(v) => { hapticLight(); update({ stealth: v }); }}
          />
          <View style={[s.row, compact && s.rowCompact, bounds]}>
            <Icon name="file-text" size={18} color={INK_SOFT} style={s.rowIcon} />
            <View style={{ flex: 1 }}>
              <CustomText style={s.rowLabel}>מע״מ ברירת מחדל</CustomText>
              <CustomText style={s.rowHint}>משמש את מחשבוני התמחור והייבוא (%)</CustomText>
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
            icon="trash"
            compact={compact}
            bounds={bounds}
            value={settings.autoClearCart}
            bounds={bounds}
            onValueChange={(v) => { hapticLight(); update({ autoClearCart: v }); }}
          />
          <View style={[s.stackRow, bounds]}>
            <StackLabel icon="file-text" text="הודעת תחתית קבלה" />
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
            <StackLabel icon="dollar-sign" text="סמל מטבע" />
            <CustomText style={s.rowHint}>מוחל על כל הסכומים באפליקציה</CustomText>
            <Segment
              options={CURRENCIES}
              value={settings.currency}
              bounds={bounds}
              onChange={(k) => { hapticLight(); update({ currency: k }); }}
            />
          </View>
          <Divider />
          <View style={[s.stackRow, bounds, !hapticsOn && { opacity: 0.45 }]}>
            <StackLabel icon="radio" text="עוצמת רטט" />
            <CustomText style={s.rowHint}>
              {hapticsOn ? "חוזק המשוב בכל לחיצה באפליקציה" : "מושבת — הפעל ״משוב הפטי״ בקבוצת מערכת"}
            </CustomText>
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
        <Section index={7}>
        <Group title="התראות" icon="bell">
          <SwitchRow
            label="התראות מלאי נמוך"
            hint="התרעה כשפריט במחסן יורד מתחת ל-5 יחידות"
            icon="trending-down"
            value={settings.lowStockAlerts}
            compact={compact}
            bounds={bounds}
            onValueChange={(v) => { hapticLight(); update({ lowStockAlerts: v }); }}
          />
          <SwitchRow
            label="תזכורת דוח Z יומי"
            hint="תזכורת בסוף היום לסגור את המשמרת"
            icon="file-text"
            value={settings.dailyZReminder}
            last
            compact={compact}
            bounds={bounds}
            onValueChange={(v) => { hapticLight(); update({ dailyZReminder: v }); }}
          />
        </Group>
        </Section>

        {/* ---------- Appearance ---------- */}
        <Section index={8}>
        <Group title="תצוגה" icon="droplet">
          <View style={[s.stackRow, bounds]}>
            <StackLabel icon="moon" text="ערכת נושא" />
            <CustomText style={s.rowHint}>
              {settings.themeMode === "light"
                ? "בהיר — 770JLM Light"
                : "נשמר להעדפות; המסכים עדיין נצבעים בהיר"}
            </CustomText>
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
            icon="minimize-2"
            value={compact}
            last
            compact={compact}
            bounds={bounds}
            onValueChange={(v) => { hapticLight(); update({ compactMode: v }); }}
          />
        </Group>
        </Section>

        {/* ---------- Data & backup ---------- */}
        <Section index={9}>
        <Group title="גיבוי, נתונים ופרטיות" icon="save">
          <View style={s.stackRow}>
            <View style={s.storageHead}>
              <CustomText style={s.storageTotal}>{fmtBytes(storage.total)}</CustomText>
              <StackLabel icon="hard-drive" text="נפח בשימוש" />
            </View>
            {storage.rows.slice(0, 4).map((r) => {
              const pct = storage.total ? Math.round((r.bytes / storage.total) * 100) : 0;
              return (
                <View key={r.key} style={{ marginTop: 10 }}>
                  <View style={s.storageRow}>
                    <CustomText style={s.storageBytes}>{fmtBytes(r.bytes)}</CustomText>
                    <CustomText style={s.storageKey} numberOfLines={1}>{r.key}</CustomText>
                  </View>
                  <View style={s.barBg}>
                    <View style={[s.barFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
            {storage.rows.length === 0 && <CustomText style={s.rowHint}>אין עדיין נתונים מקומיים.</CustomText>}
          </View>
          <ActionRow label="ייצוא גיבוי" hint="שיתוף כל הנתונים כקובץ JSON" icon="share-2" bounds={bounds} compact={compact} onPress={exportBackup} />
          <ActionRow label="העתק גיבוי ללוח" icon="copy" bounds={bounds} compact={compact} onPress={copyBackup} />
          <ActionRow
            label="ייצוא דוחות Z"
            hint="כל שורות המכירה כקובץ CSV"
            icon="bar-chart-2"
            bounds={bounds}
            onPress={exportZReports}
          />
          <SwitchRow
            label="סנכרון נתונים לענן"
            icon="cloud"
            compact={compact}
            hint={syncState ? syncState.text : "שולח עותק של הנתונים ל-Firestore"}
            value={settings.cloudBackup}
            bounds={bounds}
            onValueChange={toggleCloudBackup}
          />
          <ActionRow label="ניקוי מטמון תמונות" hint="טוען מחדש את כריכות החלומות" icon="image" bounds={bounds} compact={compact} onPress={clearImageCache} />
          <ActionRow label="ארכוב דוחות מעל 90 יום" hint="מנקה מכירות ישנות" icon="archive" last bounds={bounds} compact={compact} onPress={archiveOldReports} />
        </Group>

        </Section>

        {/* ---------- Danger zone ---------- */}
        <Section index={10}>
        <Group title="אזור סכנה" icon="alert-triangle" accent={RED}>
          <View style={s.dangerWrap}>
            <CustomText style={s.dangerText}>
              מחיקה מוחלטת של כל המכירות, המלאי, ההקפות, הפתקים, החלומות וההעדפות מהמכשיר, וחזרה
              להגדרות היצרן.
            </CustomText>
            <Bounce testID="factory-reset" style={[s.dangerBtn, bounds]} onPress={factoryReset}>
              <CustomText style={s.dangerBtnText}>איפוס אפליקציה מוחלט</CustomText>
            </Bounce>
          </View>
        </Group>
        </Section>

        {/* ---------- System ---------- */}
        <Section index={11}>
        <Group title="מערכת" icon="tool">
          <SwitchRow
            label="משוב הפטי"
            hint="רטט בלחיצות ובפעולות בכל האפליקציה"
            icon="radio"
            compact={compact}
            value={hapticsOn}
            bounds={bounds}
            onValueChange={toggleHaptics}
          />
          <InfoRow label="עוצמת רטט" value={HAPTIC_LEVELS.find((l) => l.key === settings.haptics)?.label || "כבוי"} icon="activity" bounds={bounds} compact={compact} />
          <ActionRow
            label="נעילת קוד"
            hint={settings.pin ? "פעיל — נדרש קוד בכל פתיחה" : "כבוי"}
            icon={settings.pin ? "lock" : "unlock"}
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
          <InfoRow label="שפה וכיוון" value={`עברית · ${diagnostics.rtl}`} icon="globe" last bounds={bounds} compact={compact} />
        </Group>
        </Section>

        {/* ---------- About & support ---------- */}
        <Section index={12}>
        <Group title="אודות ותמיכה" icon="message-circle">
          <ActionRow
            label="צור קשר בוואטסאפ"
            hint="נפתח עם הודעה מוכנה"
            icon="message-circle"
            compact={compact}
            bounds={bounds}
            onPress={contactSupport}
          />
          <ActionRow label="שתף מערכת" hint="הזמנה קצרה לשליחה" icon="share-2" compact={compact} bounds={bounds}  onPress={shareApp} />
          <ActionRow label="תנאי שימוש" icon="file" compact={compact} bounds={bounds}  onPress={() => comingSoon("תנאי שימוש")} />
          <ActionRow label="מדיניות פרטיות" icon="shield" last compact={compact} bounds={bounds}  onPress={() => comingSoon("מדיניות פרטיות")} />
        </Group>
        </Section>

        {/* ---------- Version / easter egg ---------- */}
        <TouchableOpacity
          testID="version-line"
          style={s.versionWrap}
          onPress={onVersionPress}
          activeOpacity={0.6}
        >
          <CustomText style={s.versionText}>{APP_VERSION}</CustomText>
        </TouchableOpacity>
      </ScrollView>

      {toast && (
        <Animated.View entering={FadeInUp.duration(200)} style={[s.toast, { bottom: insets.bottom + 90 }]}>
          <CustomText style={s.toastText}>{toast}</CustomText>
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
            <CustomText style={s.dialogTitle}>
              {confirmMode === "factory" ? "איפוס אפליקציה מוחלט" : "מחיקת AsyncStorage עמוקה"}
            </CustomText>
            <CustomText style={s.dialogBody}>
              {confirmMode === "factory"
                ? "כל הנתונים המקומיים וההגדרות יימחקו לצמיתות וההגדרות יחזרו לברירת המחדל. אין דרך לשחזר בלי גיבוי."
                : "כל מפתחות האחסון של האפליקציה יימחקו. ההגדרות יישארו בזיכרון עד להפעלה מחדש."}
            </CustomText>
            <TouchableOpacity
              testID="confirm-destructive"
              style={[s.dialogBtn, { backgroundColor: RED }]}
              onPress={() => runWipe(confirmMode === "factory")}
              activeOpacity={0.85}
            >
              <CustomText style={s.dialogBtnText}>{confirmMode === "factory" ? "אפס הכל" : "כן, מחק הכל"}</CustomText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.dialogBtn, { backgroundColor: BG }]}
              onPress={() => setConfirmMode(null)}
              activeOpacity={0.85}
            >
              <CustomText style={[s.dialogBtnText, { color: INK_SOFT }]}>ביטול</CustomText>
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
    <Animated.View entering={listEntry(index, 90)} layout={FLUID}>
      {children}
    </Animated.View>
  );
}

function Group({ title, icon, accent, children, bounds }) {
  return (
    <View style={[s.group, bounds]}>
      <View style={s.groupHead}>
        {!!icon && <Icon name={icon} size={14} color={accent || INK_MUTED} />}
        <CustomText style={[s.groupTitle, accent && { color: accent }]}>{title}</CustomText>
      </View>
      <View style={[s.groupCard, accent && { borderWidth: 1, borderColor: accent + "55" }]}>{children}</View>
    </View>
  );
}

// A stacked row's heading: icon then label, RTL-correct.
function StackLabel({ icon, text }) {
  return (
    <View style={s.stackLabelRow}>
      <Icon name={icon} size={16} color={INK_SOFT} />
      <CustomText style={s.rowLabel}>{text}</CustomText>
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
        <Icon name={icon || "circle"} size={18} color={INK_SOFT} style={s.rowIcon} />
        <CustomText style={s.rowLabel}>{label}</CustomText>
        <CustomText style={s.rowValue} numberOfLines={1}>{value}</CustomText>
      </View>
      <Divider last={last} />
    </>
  );
}

function SwitchRow({ label, hint, icon, value, onValueChange, disabled, last, bounds, compact }) {
  return (
    <>
      <View style={[s.row, compact && s.rowCompact, bounds, disabled && { opacity: 0.45 }]}>
        <Icon name={icon || "circle"} size={18} color={INK_SOFT} style={s.rowIcon} />
        <View style={{ flex: 1 }}>
          <CustomText style={s.rowLabel}>{label}</CustomText>
          {!!hint && <CustomText style={s.rowHint}>{hint}</CustomText>}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: "#E5E9F0", true: BLUE }}
          thumbColor={WHITE}
          ios_backgroundColor="#E5E9F0"
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
      <Bounce style={[s.row, compact && s.rowCompact, bounds]} onPress={onPress} scaleTo={0.97}>
        <Icon name={icon || "circle"} size={18} color={danger ? RED : INK_SOFT} style={s.rowIcon} />
        <View style={{ flex: 1 }}>
          <CustomText style={[s.rowLabel, danger && { color: RED }]}>{label}</CustomText>
          {!!hint && <CustomText style={s.rowHint}>{hint}</CustomText>}
        </View>
        {actionLabel ? (
          <View style={[s.actionPill, danger && { backgroundColor: RED + "18" }]}>
            <CustomText style={[s.actionPillText, danger && { color: RED }]}>{actionLabel}</CustomText>
          </View>
        ) : (
          <CustomText style={s.chevron}>‹</CustomText>
        )}
      </Bounce>
      <Divider last={last} />
    </>
  );
}

function Segment({ options, value, onChange, disabled, bounds }) {
  return (
    <View style={[s.segment, bounds]}>
      {options.map((o) => (
        <Bounce
          key={o.key}
          testID={`seg-${o.key}`}
          style={[s.segmentBtn, bounds, value === o.key && { backgroundColor: BLUE }]}
          onPress={() => !disabled && onChange(o.key)}
        >
          <CustomText style={[s.segmentText, value === o.key && { color: WHITE }]}>{o.label}</CustomText>
        </Bounce>
      ))}
    </View>
  );
}

// One API key. Shows what is installed and where it came from, takes a new
// one, and never renders the stored value in full.
function ApiKeyRow({ slot, value, onChange, onSave, onClear, source, last, bounds }) {
  const [reveal, setReveal] = useState(false);
  const installed = apiKey(slot.id);

  // Three genuinely different states, and the row says which one it is in.
  // "saved" and "env" both mean the feature works; only the first can be
  // cleared from here, because the second lives in the build.
  const status =
    source === "saved"
      ? { text: `נשמר במכשיר · ${maskKey(installed)}`, color: GREEN, icon: "check-circle" }
      : source === "env"
        ? { text: `מגיע מהבילד · ${maskKey(installed)}`, color: INK_MUTED, icon: "package" }
        : { text: "לא מוגדר — התכונה כבויה", color: GOLD, icon: "alert-circle" };

  return (
    <>
      <View style={[s.fieldRow, bounds]}>
        <View style={s.keyHead}>
          <CustomText style={s.rowLabel}>{slot.label}</CustomText>
          <CustomText style={s.rowHint}>{slot.hint}</CustomText>
        </View>

        <View style={s.keyStatus}>
          <Icon name={status.icon} size={13} color={status.color} />
          <CustomText style={[s.keyStatusText, { color: status.color }]}>{status.text}</CustomText>
        </View>

        <View style={s.keyInputRow}>
          <TextInput
            testID={`key-input-${slot.id}`}
            style={[s.nameInput, s.keyInput]}
            value={value}
            onChangeText={onChange}
            placeholder={slot.placeholder}
            placeholderTextColor={INK_MUTED}
            // A key is not a word: autocorrect and auto-capitalisation will
            // quietly corrupt one, and the keyboard's suggestion strip is one
            // more place it gets cached.
            secureTextEntry={!reveal}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textAlign="left"
          />
          <Bounce testID={`key-reveal-${slot.id}`} style={s.keyIconBtn} onPress={() => setReveal((r) => !r)}>
            <Icon name={reveal ? "eye-off" : "eye"} size={16} color={INK_SOFT} />
          </Bounce>
        </View>

        <View style={s.keyActions}>
          <Bounce
            testID={`key-save-${slot.id}`}
            style={[s.keyBtn, !value.trim() && s.keyBtnOff]}
            onPress={() => value.trim() && onSave()}
          >
            <CustomText style={[s.keyBtnText, !value.trim() && { color: INK_MUTED }]}>שמירה</CustomText>
          </Bounce>
          {source === "saved" && (
            <Bounce testID={`key-clear-${slot.id}`} style={[s.keyBtn, s.keyBtnGhost]} onPress={onClear}>
              <CustomText style={[s.keyBtnText, { color: RED }]}>מחיקה</CustomText>
            </Bounce>
          )}
        </View>
      </View>
      <Divider last={last} />
    </>
  );
}

const SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 18,
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
    flexDirection: "row",
    gap: 5,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  devPillText: { fontFamily: FONTS.bold, fontSize: 12, color: "#7A5B00" },

  group: { marginBottom: 18 },
  groupHead: { flexDirection: I18nManager.isRTL ? "row" : "row-reverse", alignItems: "center", gap: 7, marginBottom: 8, marginEnd: 4 },
  groupTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: INK_SOFT,
    textAlign: "right",
    marginBottom: 8,
    marginHorizontal: 6,
  },
  groupCard: { backgroundColor: WHITE, borderRadius: 24, overflow: "hidden", ...SHADOW },
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
  rowIcon: { width: 20, textAlign: "center" },
  stackLabelRow: { flexDirection: I18nManager.isRTL ? "row" : "row-reverse", alignItems: "center", gap: 8 },
  chevron: { fontFamily: FONTS.bold, fontSize: 20, color: "#D6DBE5", width: 12, textAlign: "center" },

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

  // --- API keys ---
  noticeRow: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  noticeText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    lineHeight: 17,
    color: INK_SOFT,
    textAlign: "right",
  },
  keyHead: { gap: 2 },
  keyStatus: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  keyStatusText: { fontFamily: FONTS.semibold, fontSize: 11.5, textAlign: "right" },
  keyInputRow: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  // A key is Latin text and reads left-to-right even inside an RTL screen.
  keyInput: { flex: 1, writingDirection: "ltr", fontSize: 13 },
  keyIconBtn: {
    width: 40,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG,
  },
  keyActions: { flexDirection: I18nManager.isRTL ? "row" : "row-reverse", gap: 8 },
  keyBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BLUE,
  },
  keyBtnOff: { backgroundColor: BG },
  keyBtnGhost: { backgroundColor: BG },
  keyBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: WHITE },
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
  dangerBtn: {
    minHeight: 54,
    borderRadius: 24,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
    // Destructive action gets its own red halo.
    shadowColor: RED,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 8,
  },
  dangerBtnText: { fontFamily: FONTS.bold, fontSize: 15.5, color: WHITE },

  // Developer "render layout bounds" overlay.
  bounds: { borderWidth: 1, borderColor: "#FF2D95" },

  versionWrap: { paddingVertical: 22, alignItems: "center" },
  versionText: { fontFamily: FONTS.regular, fontSize: 11.5, color: INK_MUTED, textAlign: "center" },

  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: INK,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 11,
    maxWidth: "88%",
  },
  toastText: { fontFamily: FONTS.semibold, fontSize: 13, color: WHITE, textAlign: "center" },

  backdrop: { flex: 1, backgroundColor: "rgba(16,20,26,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: { width: "100%", backgroundColor: WHITE, borderRadius: 24, padding: 20, gap: 10 },
  dialogTitle: { fontFamily: FONTS.bold, fontSize: 17, color: INK, textAlign: "right" },
  dialogBody: { fontFamily: FONTS.regular, fontSize: 13, color: INK_SOFT, textAlign: "right", lineHeight: 20, marginBottom: 6 },
  dialogBtn: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dialogBtnText: { fontFamily: FONTS.bold, fontSize: 14.5, color: WHITE },
});
