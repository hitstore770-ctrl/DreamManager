import { useEffect, useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Linking, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../../Icon";
import Slider from "../Slider";
import { useSettings } from "../../../context/SettingsContext";
import { hapticLight, hapticSuccess, hapticWarning } from "../../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../../utils/notesTheme";
import { shekel } from "../../../utils/posStore";
import {
  BLUE,
  BtnLabel,
  CARD,
  Chips,
  Field,
  GOLD,
  GREEN,
  INK,
  INK_MUTED,
  INK_SOFT,
  NO_OUTLINE,
  RED,
  Segment,
  Stat,
  Stepper,
  WHITE,
  s,
  useCalcHaptic,
} from "../kit";

// Money tools: splitting, VAT, cash handling.

// ---------------------------------------------------------------------------
// J. מפצל הוצאות חדר
// ---------------------------------------------------------------------------
export function DormSplitter() {
  const [total, setTotal] = useState("240");
  const [people, setPeople] = useState(4);
  const [label, setLabel] = useState("קניות לחדר");
  const [roundUp, setRoundUp] = useState(true);
  const [copied, setCopied] = useState(false);

  const r = useMemo(() => {
    const sum = parseFloat(total) || 0;
    const n = Math.max(1, people);
    const exact = sum / n;
    const per = roundUp ? Math.ceil(exact) : Math.round(exact * 100) / 100;
    const collected = Math.round(per * n * 100) / 100;
    return {
      sum,
      n,
      exact: Math.round(exact * 100) / 100,
      per,
      collected,
      extra: Math.round((collected - sum) * 100) / 100,
      ready: sum > 0,
    };
  }, [total, people, roundUp]);

  useCalcHaptic(r.per);

  const message = useMemo(
    () =>
      [
        `${label.trim() || "הוצאה משותפת"}`,
        `סה״כ: ${shekel(r.sum)}`,
        `מתחלק ל-${r.n} → ${shekel(r.per)} לכל אחד`,
        "תעבירו לי כשנוח.",
      ].join("\n"),
    [label, r.sum, r.n, r.per]
  );

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const sendWhatsApp = async () => {
    hapticSuccess();
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* WhatsApp not installed — fall through to the share sheet */
    }
    try {
      await Share.share({ message });
    } catch {
      /* sharing unavailable on this platform */
    }
  };

  const copyMessage = async () => {
    hapticLight();
    try {
      await Clipboard.setStringAsync(message);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="סה״כ החשבון" value={total} onChange={setTotal} placeholder="240" suffix="₪" />
      </View>
      <Chips options={[60, 120, 240, 500]} onPick={(v) => setTotal(String(v))} active={total} />

      <Stepper label="מספר שותפים לחדר" value={people} onChange={setPeople} min={1} max={20} suffix="שותפים" />

      <View>
        <Text style={s.fieldLabel}>על מה ההוצאה</Text>
        <TextInput
          style={s.textField}
          value={label}
          onChangeText={setLabel}
          placeholder="קניות לחדר"
          placeholderTextColor={INK_MUTED}
          textAlign="right"
        />
      </View>

      <TouchableOpacity
        style={s.checkRow}
        onPress={() => { hapticLight(); setRoundUp((v) => !v); }}
        activeOpacity={0.75}
      >
        <View style={[s.checkbox, roundUp && { backgroundColor: BLUE, borderColor: BLUE }]}>
          {roundUp && <Icon name="check" size={13} color={WHITE} />}
        </View>
        <Text style={s.checkLabel}>עגל לשקל שלם (קל יותר להעביר)</Text>
      </TouchableOpacity>

      {r.ready ? (
        <>
          <View style={s.statRow}>
            <Stat label="לכל אחד" value={shekel(r.per)} color={BLUE} big />
            <Stat label="חלוקה מדויקת" value={shekel(r.exact)} />
            <Stat label="שותפים" value={r.n} />
          </View>
          {roundUp && r.extra > 0 && (
            <Text style={s.hint}>
              העיגול אוסף {shekel(r.extra)} מעל החשבון — שאר העודף נשאר אצל מי שאסף.
            </Text>
          )}

          <TouchableOpacity style={[s.bigBtn, { backgroundColor: "#25D366" }]} onPress={sendWhatsApp} activeOpacity={0.85}>
            <BtnLabel icon="message-circle" text="בקש כסף בוואטסאפ" style={s.bigBtnText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.bigBtn, { backgroundColor: CARD }, copied && { backgroundColor: GREEN }]}
            onPress={copyMessage}
            activeOpacity={0.85}
          >
            <BtnLabel
              icon={copied ? "check" : "copy"}
              text={copied ? "ההודעה הועתקה" : "העתק את ההודעה"}
              color={copied ? WHITE : INK_SOFT}
              style={[s.bigBtnText, !copied && { color: INK_SOFT }]}
            />
          </TouchableOpacity>
          <View style={s.msgPreview}>
            <Text style={s.msgPreviewText}>{message}</Text>
          </View>
        </>
      ) : (
        <Text style={s.hint}>הזן סכום כדי לחשב חלוקה.</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// K. מע״מ והנחה אקספרס
// ---------------------------------------------------------------------------
// Israeli VAT moved to 18% in January 2025; 17% stays selectable for older
// invoices and price lists.
const VAT_RATES = [
  { key: "18", label: "מע״מ 18%" },
  { key: "17", label: "מע״מ 17%" },
];

export function VatDiscount() {
  // Seeded from the default VAT rate in Settings.
  const { vatRate } = useSettings();
  const defaultRate = String(Math.max(0, parseFloat(vatRate) || 18));
  const [base, setBase] = useState("100");
  const [discount, setDiscount] = useState(10);
  const [vatOn, setVatOn] = useState(true);
  const [rate, setRate] = useState(defaultRate);
  // "add" treats the base as net and adds VAT on top; "extract" treats it as a
  // gross price that already includes VAT and works backwards to the net.
  const [mode, setMode] = useState("add");

  // No useCalcHaptic here: the discount slider already taps per step, and
  // stacking a second pulse on the same drag feels buzzy.
  const r = useMemo(() => {
    const b = parseFloat(base) || 0;
    const off = b * (discount / 100);
    const afterDiscount = b - off;
    const vatPct = parseFloat(rate) || 0;
    const round2 = (n) => Math.round(n * 100) / 100;

    let net;
    let vat;
    let final;
    if (!vatOn) {
      net = afterDiscount;
      vat = 0;
      final = afterDiscount;
    } else if (mode === "extract") {
      // Dividing by (1 + rate) is the only correct way back: taking rate% off
      // a gross price undershoots the VAT it actually contains.
      net = afterDiscount / (1 + vatPct / 100);
      vat = afterDiscount - net;
      final = afterDiscount;
    } else {
      net = afterDiscount;
      vat = afterDiscount * (vatPct / 100);
      final = afterDiscount + vat;
    }

    return {
      ready: b > 0,
      extracting: vatOn && mode === "extract",
      off: round2(off),
      afterDiscount: round2(afterDiscount),
      net: round2(net),
      vat: round2(vat),
      final: round2(final),
      rounded: Math.round(final),
    };
  }, [base, discount, vatOn, rate, mode]);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="מחיר בסיס" value={base} onChange={setBase} placeholder="100" suffix="₪" />
      </View>
      <Chips options={[50, 100, 250, 500]} onPick={(v) => setBase(String(v))} active={base} />

      <Slider label="אחוז הנחה" value={discount} min={0} max={100} step={1} onChange={setDiscount} format={(v) => `${v}%`} />
      <Chips options={[0, 5, 10, 15, 20, 25, 50]} onPick={setDiscount} active={discount} />

      <TouchableOpacity
        style={s.checkRow}
        onPress={() => { hapticLight(); setVatOn((v) => !v); }}
        activeOpacity={0.75}
      >
        <View style={[s.checkbox, vatOn && { backgroundColor: BLUE, borderColor: BLUE }]}>
          {vatOn && <Icon name="check" size={13} color={WHITE} />}
        </View>
        <Text style={s.checkLabel}>כלול מע״מ בחישוב</Text>
      </TouchableOpacity>
      {vatOn && (
        <Segment
          options={[
            { key: "add", label: "הוסף מע״מ" },
            { key: "extract", label: "חלץ מע״מ" },
          ]}
          value={mode}
          onChange={(v) => { hapticLight(); setMode(v); }}
        />
      )}
      {vatOn && (
        <Segment
          options={
            VAT_RATES.some((r) => r.key === defaultRate)
              ? VAT_RATES
              : [{ key: defaultRate, label: `מע״מ ${defaultRate}%` }, ...VAT_RATES]
          }
          value={rate}
          onChange={setRate}
        />
      )}

      {r.ready ? (
        <>
          <View style={s.statRow}>
            <Stat label="לתשלום" value={shekel(r.final)} color={BLUE} big />
            <Stat label={r.extracting ? "מחיר לפני מע״מ" : "מחיר אחרי הנחה"} value={shekel(r.extracting ? r.net : r.afterDiscount)} />
          </View>
          <View style={s.statRow}>
            <Stat label="ההנחה שווה" value={shekel(r.off)} color={GREEN} />
            <Stat label={vatOn ? `מע״מ ${rate}%` : "ללא מע״מ"} value={shekel(r.vat)} color={vatOn ? GOLD : INK_MUTED} />
            <Stat label="עיגול לשקל" value={shekel(r.rounded)} />
          </View>
          <Text style={s.hint}>
            ההנחה מחושבת קודם, והמע״מ נגבה על המחיר שאחרי ההנחה — כפי שנדרש בחשבונית. שיעור המע״מ בישראל
            הוא 18% מינואר 2025; 17% נשאר לבחירה לתמחורים ולחשבוניות ישנות.
          </Text>
        </>
      ) : (
        <Text style={s.hint}>הזן מחיר בסיס כדי לחשב.</Text>
      )}
    </View>
  );
}

// Map tool id → mini-app component.

// ---------------------------------------------------------------------------
// C. ספירת קופה
// ---------------------------------------------------------------------------

// Every denomination in circulation. Agorot are held as integers so the sum
// never picks up floating-point dust: 0.1 + 0.2 is not 0.3 in binary, and a
// till count that reads ₪0.30000000000000004 is worthless.
const DENOMS = [
  { agorot: 10, label: "10 אג׳", kind: "coin" },
  { agorot: 50, label: "½ ₪", kind: "coin" },
  { agorot: 100, label: "1 ₪", kind: "coin" },
  { agorot: 200, label: "2 ₪", kind: "coin" },
  { agorot: 500, label: "5 ₪", kind: "coin" },
  { agorot: 1000, label: "10 ₪", kind: "coin" },
  { agorot: 2000, label: "20 ₪", kind: "note" },
  { agorot: 5000, label: "50 ₪", kind: "note" },
  { agorot: 10000, label: "100 ₪", kind: "note" },
  { agorot: 20000, label: "200 ₪", kind: "note" },
];

export function TillCounter() {
  const [counts, setCounts] = useState({});
  const [expected, setExpected] = useState("");

  const set = (agorot, value) => {
    const clean = value.replace(/[^0-9]/g, "");
    setCounts((prev) => ({ ...prev, [agorot]: clean }));
  };

  const bump = (agorot, by) => {
    hapticLight();
    setCounts((prev) => {
      const next = Math.max(0, (parseInt(prev[agorot], 10) || 0) + by);
      return { ...prev, [agorot]: next ? String(next) : "" };
    });
  };

  const r = useMemo(() => {
    let totalAgorot = 0;
    let coinAgorot = 0;
    let noteAgorot = 0;
    let pieces = 0;
    DENOMS.forEach((d) => {
      const qty = parseInt(counts[d.agorot], 10) || 0;
      const value = qty * d.agorot;
      totalAgorot += value;
      pieces += qty;
      if (d.kind === "coin") coinAgorot += value;
      else noteAgorot += value;
    });
    const exp = parseFloat(expected);
    const expAgorot = Number.isFinite(exp) ? Math.round(exp * 100) : null;
    return {
      total: totalAgorot / 100,
      coins: coinAgorot / 100,
      notes: noteAgorot / 100,
      pieces,
      variance: expAgorot === null ? null : (totalAgorot - expAgorot) / 100,
    };
  }, [counts, expected]);

  useCalcHaptic(r.total);

  const varianceTone = r.variance === null || r.variance === 0 ? GREEN : r.variance > 0 ? GOLD : RED;

  return (
    <View style={{ gap: 12 }}>
      <View style={f.totalCard}>
        <Text testID="till-total" style={f.totalValue}>{shekel(r.total)}</Text>
        <Text style={f.totalLabel}>סה״כ בקופה · {r.pieces} פריטים</Text>
      </View>

      {DENOMS.map((d) => {
        const qty = counts[d.agorot] || "";
        const line = ((parseInt(qty, 10) || 0) * d.agorot) / 100;
        return (
          <View key={d.agorot} style={f.denomRow}>
            <Text style={[f.denomLine, !line && { color: INK_MUTED }]}>{shekel(line)}</Text>
            <TouchableOpacity style={f.stepBtn} onPress={() => bump(d.agorot, -1)} activeOpacity={0.7}>
              <Icon name="minus" size={15} color={BLUE} />
            </TouchableOpacity>
            <TextInput
              testID={`till-qty-${d.agorot}`}
              style={f.qtyInput}
              value={qty}
              onChangeText={(v) => set(d.agorot, v)}
              placeholder="0"
              placeholderTextColor={INK_MUTED}
              keyboardType="numeric"
              textAlign="center"
            />
            <TouchableOpacity style={f.stepBtn} onPress={() => bump(d.agorot, 1)} activeOpacity={0.7}>
              <Icon name="plus" size={15} color={BLUE} />
            </TouchableOpacity>
            <View style={f.denomTag}>
              <Icon name={d.kind === "coin" ? "circle" : "credit-card"} size={13} color={INK_SOFT} />
              <Text style={f.denomLabel}>{d.label}</Text>
            </View>
          </View>
        );
      })}

      <View style={s.statRow}>
        <Stat label="מטבעות" value={shekel(r.coins)} />
        <Stat label="שטרות" value={shekel(r.notes)} color={BLUE} />
      </View>

      <Field label="סכום צפוי לפי דוח Z (לא חובה)" value={expected} onChange={setExpected} placeholder="0" suffix="₪" />

      {r.variance !== null && (
        <View style={[s.banner, { backgroundColor: varianceTone + "14" }]}>
          <Text style={[s.bannerText, { color: varianceTone }]}>
            {r.variance === 0
              ? "הקופה מאוזנת"
              : r.variance > 0
                ? `עודף ${shekel(r.variance)}`
                : `חוסר ${shekel(Math.abs(r.variance))}`}
          </Text>
          <Text style={[s.bannerSub, { color: varianceTone }]}>
            ספירה בפועל {shekel(r.total)} מול צפי {shekel(parseFloat(expected) || 0)}.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[s.actionBtn, { backgroundColor: CARD }]}
        onPress={() => { hapticWarning(); setCounts({}); setExpected(""); }}
        activeOpacity={0.85}
      >
        <BtnLabel icon="rotate-ccw" text="אפס ספירה" color={INK_SOFT} style={[s.actionText, { color: INK_SOFT }]} />
      </TouchableOpacity>

      <Text style={s.hint}>
        הסכומים נצברים באגורות ומחולקים ב-100 רק בתצוגה, כדי שהסך לא יצבור שגיאות עיגול על ספירה ארוכה.
      </Text>
    </View>
  );
}

const f = StyleSheet.create({
  totalCard: { backgroundColor: BLUE + "10", borderRadius: 24, paddingVertical: 20, alignItems: "center", gap: 4 },
  totalValue: { fontFamily: FONTS.bold, fontSize: 34, color: BLUE },
  totalLabel: { fontFamily: FONTS.medium, fontSize: 12, color: INK_SOFT },

  denomRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  denomTag: { flexDirection: "row", alignItems: "center", gap: 6, width: 74, justifyContent: "flex-end" },
  denomLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: INK },
  denomLine: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13, color: INK_SOFT, textAlign: "left" },
  stepBtn: { width: 38, height: 44, borderRadius: 12, backgroundColor: CARD, alignItems: "center", justifyContent: "center" },
  qtyInput: {
    width: 52,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: CARD,
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: INK,
    ...NO_OUTLINE,
  },
});

// ---------------------------------------------------------------------------
// D. מעקב הוצאות רישיון נהיגה
// ---------------------------------------------------------------------------

// Israeli licence costs that are not per-lesson. Defaults reflect typical 2025
// figures; every one is editable because they vary by school and region.
const LICENCE_FEES = [
  { key: "theory", label: "אגרת תיאוריה", def: "51" },
  { key: "medical", label: "בדיקת רופא / טופס ירוק", def: "70" },
  { key: "test", label: "אגרת מבחן מעשי", def: "180" },
  { key: "vehicle", label: "השכרת רכב למבחן", def: "450" },
  { key: "licence", label: "הנפקת הרישיון", def: "190" },
];

export function LicenseTracker() {
  const [perLesson, setPerLesson] = useState("220");
  const [done, setDone] = useState("14");
  const [target, setTarget] = useState("28");
  const [fees, setFees] = useState(() =>
    LICENCE_FEES.reduce((acc, f) => ({ ...acc, [f.key]: f.def }), {})
  );
  const [tests, setTests] = useState("1");

  const r = useMemo(() => {
    const price = parseFloat(perLesson) || 0;
    const lessonsDone = parseInt(done, 10) || 0;
    const lessonsTarget = parseInt(target, 10) || 0;
    const attempts = Math.max(1, parseInt(tests, 10) || 1);

    const lessonSpend = price * lessonsDone;
    // A retest re-charges the test fee and the vehicle rental, not the theory
    // fee or the licence issue — those are paid once.
    const perAttempt = (parseFloat(fees.test) || 0) + (parseFloat(fees.vehicle) || 0);
    const oneOff =
      (parseFloat(fees.theory) || 0) +
      (parseFloat(fees.medical) || 0) +
      (parseFloat(fees.licence) || 0);
    const feeSpend = oneOff + perAttempt * attempts;

    const spent = lessonSpend + feeSpend;
    const remainingLessons = Math.max(0, lessonsTarget - lessonsDone);
    const remaining = remainingLessons * price;

    return {
      spent: Math.round(spent),
      lessonSpend: Math.round(lessonSpend),
      feeSpend: Math.round(feeSpend),
      remaining: Math.round(remaining),
      projected: Math.round(spent + remaining),
      remainingLessons,
      pct: lessonsTarget > 0 ? Math.min(100, Math.round((lessonsDone / lessonsTarget) * 100)) : 0,
      over: lessonsTarget > 0 && lessonsDone > lessonsTarget,
    };
  }, [perLesson, done, target, fees, tests]);

  useCalcHaptic(r.spent);

  return (
    <View style={{ gap: 12 }}>
      <View style={f.totalCard}>
        <Text testID="licence-total" style={f.totalValue}>{shekel(r.spent)}</Text>
        <Text style={f.totalLabel}>הוצאת עד כה · {done || 0} שיעורים</Text>
      </View>

      <View style={s.row}>
        <Field label="מחיר שיעור" value={perLesson} onChange={setPerLesson} placeholder="220" suffix="₪" />
        <Field label="שיעורים שבוצעו" value={done} onChange={setDone} placeholder="14" suffix="יח׳" />
        <Field label="יעד שיעורים" value={target} onChange={setTarget} placeholder="28" suffix="יח׳" />
      </View>

      <View>
        <View style={s.loadMetaRow}>
          <Text style={s.loadMeta}>{r.pct}%</Text>
          <Text style={s.loadMeta}>
            {r.over ? "מעל היעד שהוגדר" : `נותרו ${r.remainingLessons} שיעורים`}
          </Text>
        </View>
        <View style={[s.loadTrack, { marginTop: 6 }]}>
          <View
            testID="licence-bar"
            style={[s.loadFill, { width: `${r.pct}%`, backgroundColor: r.over ? GOLD : BLUE }]}
          />
        </View>
      </View>

      <Text style={s.sectionLabel}>אגרות ותשלומים חד-פעמיים</Text>
      {LICENCE_FEES.map((fee) => (
        <Field
          key={fee.key}
          label={fee.label}
          value={fees[fee.key]}
          onChange={(v) => setFees((prev) => ({ ...prev, [fee.key]: v }))}
          placeholder={fee.def}
          suffix="₪"
        />
      ))}
      <Field label="מספר גשות לטסט" value={tests} onChange={setTests} placeholder="1" suffix="פעמים" />

      <View style={s.statRow}>
        <Stat label="על שיעורים" value={shekel(r.lessonSpend)} />
        <Stat label="על אגרות" value={shekel(r.feeSpend)} color={GOLD} />
        <Stat label="נותר לשלם" value={shekel(r.remaining)} color={INK_SOFT} />
      </View>
      <View style={s.statRow}>
        <Stat label="עלות כוללת צפויה" value={shekel(r.projected)} color={BLUE} big />
      </View>

      <Text style={s.hint}>
        כל גשה נוספת לטסט מוסיפה את אגרת המבחן ואת השכרת הרכב בלבד — אגרת התיאוריה והנפקת הרישיון
        משולמות פעם אחת. הסכומים הם ברירת מחדל וניתן לעדכן כל אחד מהם.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// E. מחשבון מתח רווחים
// ---------------------------------------------------------------------------
export function ProfitMargin() {
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");

  const r = useMemo(() => {
    const c = parseFloat(cost);
    const p = parseFloat(price);
    if (!Number.isFinite(c) || !Number.isFinite(p) || p <= 0) return { ready: false };
    const profit = p - c;
    const round2 = (n) => Math.round(n * 100) / 100;
    return {
      ready: true,
      profit: round2(profit),
      // Margin is profit over the selling price. Markup is profit over cost —
      // a different, larger number, and confusing the two is how shops end up
      // pricing below their target.
      margin: round2((profit / p) * 100),
      markup: c > 0 ? round2((profit / c) * 100) : null,
      multiplier: c > 0 ? round2(p / c) : null,
      loss: profit < 0,
    };
  }, [cost, price]);

  useCalcHaptic(r.margin);

  const tone = !r.ready ? INK_SOFT : r.loss ? RED : r.margin >= 30 ? GREEN : GOLD;

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field testID="margin-cost" label="מחיר עלות" value={cost} onChange={setCost} placeholder="6" suffix="₪" />
        <Field testID="margin-price" label="מחיר מכירה" value={price} onChange={setPrice} placeholder="10" suffix="₪" />
      </View>

      {!r.ready ? (
        <Text style={s.hint}>הזן מחיר עלות ומחיר מכירה כדי לחשב את מתח הרווח.</Text>
      ) : (
        <>
          <View style={[m.verdict, { backgroundColor: tone + "12" }]}>
            <Text testID="margin-result" style={[m.verdictValue, { color: tone }]}>{r.margin}%</Text>
            <Text style={m.verdictLabel}>
              {r.loss ? "מכירה בהפסד" : "מתח רווח גולמי מהמחיר"}
            </Text>
          </View>

          <View style={s.statRow}>
            <Stat label="רווח ליחידה" value={shekel(r.profit)} color={tone} />
            <Stat label="אחוז תוספת על העלות" value={r.markup === null ? "—" : `${r.markup}%`} />
            <Stat label="מכפיל" value={r.multiplier === null ? "—" : `×${r.multiplier}`} />
          </View>

          <Text style={s.hint}>
            מתח הרווח מחושב מתוך מחיר המכירה, ולא מתוך העלות. תוספת של 100% על העלות היא מתח רווח של
            50% בלבד — הבלבול בין השניים הוא הסיבה הנפוצה לתמחור נמוך מהיעד.
          </Text>
        </>
      )}
    </View>
  );
}

const m = StyleSheet.create({
  verdict: { borderRadius: 24, paddingVertical: 20, alignItems: "center", gap: 4 },
  verdictValue: { fontFamily: FONTS.bold, fontSize: 34 },
  verdictLabel: { fontFamily: FONTS.medium, fontSize: 12.5, color: INK_SOFT },
});
