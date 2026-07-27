import { useEffect, useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Linking, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import Icon from "../../Icon";
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
export function LoanCalc() {
  const [amount, setAmount] = useState("");
  const [annualRate, setAnnualRate] = useState("6");
  const [months, setMonths] = useState("36");

  const r = useMemo(() => {
    const principal = parseFloat(amount);
    const apr = parseFloat(annualRate);
    const n = parseInt(months, 10);
    if (!Number.isFinite(principal) || !Number.isFinite(apr) || !Number.isFinite(n)) {
      return { ready: false };
    }
    if (principal <= 0 || n <= 0) return { ready: false };

    const i = apr / 100 / 12;
    // At zero interest the amortisation formula divides by zero; the payment
    // is simply the principal split evenly.
    const payment = i === 0 ? principal / n : (principal * i) / (1 - (1 + i) ** -n);
    const totalPaid = payment * n;
    const round0 = (x) => Math.round(x);

    // First-year schedule, so the interest-heavy start is visible rather than
    // hidden behind a single average.
    const schedule = [];
    let balance = principal;
    for (let m = 1; m <= Math.min(n, 12); m += 1) {
      const interest = balance * i;
      const principalPart = payment - interest;
      balance -= principalPart;
      schedule.push({
        m,
        interest: round0(interest),
        principal: round0(principalPart),
        balance: round0(Math.max(0, balance)),
      });
    }

    return {
      ready: true,
      payment: Math.round(payment * 100) / 100,
      totalPaid: round0(totalPaid),
      totalInterest: round0(totalPaid - principal),
      interestPct: Math.round(((totalPaid - principal) / principal) * 100),
      schedule,
      zeroRate: i === 0,
    };
  }, [amount, annualRate, months]);

  useCalcHaptic(r.payment);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field testID="loan-amount" label="סכום ההלוואה" value={amount} onChange={setAmount} placeholder="45000" suffix="₪" />
        <Field testID="loan-rate" label="ריבית שנתית" value={annualRate} onChange={setAnnualRate} placeholder="6" suffix="%" />
        <Field testID="loan-months" label="מספר חודשים" value={months} onChange={setMonths} placeholder="36" suffix="חוד׳" />
      </View>
      <Chips options={[12, 24, 36, 48, 60]} onPick={(val) => setMonths(String(val))} active={months} />

      {!r.ready ? (
        <Text style={s.hint}>הזן סכום, ריבית שנתית ומספר חודשים.</Text>
      ) : (
        <>
          <View style={[m.verdict, { backgroundColor: BLUE + "12" }]}>
            <Text testID="loan-payment" style={[m.verdictValue, { color: BLUE }]}>{shekel(r.payment)}</Text>
            <Text style={m.verdictLabel}>תשלום חודשי</Text>
          </View>

          <View style={s.statRow}>
            <Stat label="סה״כ להחזר" value={shekel(r.totalPaid)} />
            <Stat label="סה״כ ריבית" value={shekel(r.totalInterest)} color={GOLD} />
            <Stat label="תוספת לקרן" value={`${r.interestPct}%`} color={r.interestPct > 20 ? RED : INK_SOFT} />
          </View>

          {r.zeroRate && (
            <View style={[s.banner, { backgroundColor: GREEN + "14" }]}>
              <Text style={[s.bannerText, { color: GREEN }]}>ללא ריבית — חלוקה שווה</Text>
            </View>
          )}

          <Text style={s.sectionLabel}>לוח סילוקין — שנה ראשונה</Text>
          {r.schedule.map((row) => (
            <View key={row.m} style={s.routineRow}>
              <Text style={s.routineTime}>{shekel(row.balance)}</Text>
              <Text style={[s.routineLabel, { flex: 1 }]}>
                חודש {row.m} · קרן {shekel(row.principal)} · ריבית {shekel(row.interest)}
              </Text>
            </View>
          ))}

          <Text style={s.hint}>
            החישוב הוא שפיצר — תשלום חודשי קבוע שבתחילתו רובו ריבית. הריבית כאן נומינלית וקבועה;
            הלוואה צמודת מדד או בריבית משתנה תעלה יותר, ועמלות פתיחה אינן כלולות.
          </Text>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// G. מחשבון הנחות
export function BillSplitTip() {
  const [bill, setBill] = useState("");
  const [tipPct, setTipPct] = useState("12");
  const [people, setPeople] = useState("2");
  const [roundUp, setRoundUp] = useState(false);

  const r = useMemo(() => {
    const amount = parseFloat(bill);
    const pct = parseFloat(tipPct);
    const n = parseInt(people, 10);
    if (!Number.isFinite(amount) || !Number.isFinite(pct) || amount < 0) return { ready: false };
    const heads = Number.isFinite(n) && n > 0 ? n : 1;
    const tip = amount * (Math.max(0, pct) / 100);
    const total = amount + tip;
    const exact = total / heads;
    const per = roundUp ? Math.ceil(exact) : Math.round(exact * 100) / 100;
    const round2 = (x) => Math.round(x * 100) / 100;
    return {
      ready: true,
      tip: round2(tip),
      total: round2(total),
      exact: round2(exact),
      per,
      heads,
      collected: round2(per * heads),
      extra: round2(per * heads - total),
      noPeople: !Number.isFinite(n) || n <= 0,
    };
  }, [bill, tipPct, people, roundUp]);

  useCalcHaptic(r.per);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field testID="tip-bill" label="סכום החשבון" value={bill} onChange={setBill} placeholder="240" suffix="₪" />
        <Field testID="tip-pct" label="טיפ" value={tipPct} onChange={setTipPct} placeholder="12" suffix="%" />
        <Field testID="tip-people" label="סועדים" value={people} onChange={setPeople} placeholder="4" suffix="אנשים" />
      </View>
      <Chips options={[0, 10, 12, 15, 18, 20]} onPick={(v) => setTipPct(String(v))} active={tipPct} />

      <TouchableOpacity
        style={s.checkRow}
        onPress={() => { hapticLight(); setRoundUp((v) => !v); }}
        activeOpacity={0.75}
      >
        <View style={[s.checkbox, roundUp && { backgroundColor: BLUE, borderColor: BLUE }]}>
          {roundUp && <Icon name="check" size={13} color={WHITE} />}
        </View>
        <Text style={s.checkLabel}>עגל כל תשלום לשקל שלם</Text>
      </TouchableOpacity>

      {!r.ready ? (
        <Text style={s.hint}>הזן את סכום החשבון ואחוז טיפ.</Text>
      ) : (
        <>
          <View style={[m.verdict, { backgroundColor: BLUE + "12" }]}>
            <Text testID="tip-per" style={[m.verdictValue, { color: BLUE }]}>{shekel(r.per)}</Text>
            <Text style={m.verdictLabel}>לכל אחד · {r.heads} סועדים</Text>
          </View>

          <View style={s.statRow}>
            <Stat label="סה״כ עם טיפ" value={shekel(r.total)} />
            <Stat label="הטיפ" value={shekel(r.tip)} color={GREEN} />
            <Stat label="חלוקה מדויקת" value={shekel(r.exact)} />
          </View>

          {r.noPeople && (
            <View style={[s.banner, { backgroundColor: GOLD + "16" }]}>
              <Text style={[s.bannerText, { color: "#8A6D00" }]}>מספר סועדים לא תקין — חושב לאדם אחד</Text>
            </View>
          )}

          {roundUp && r.extra > 0 && (
            <Text style={s.hint}>
              העיגול אוסף {shekel(r.extra)} מעל החשבון — שווה להשאיר את העודף כתוספת לטיפ.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// J. חילוץ מע״מ

const m = StyleSheet.create({
  verdict: { borderRadius: 24, paddingVertical: 20, alignItems: "center", gap: 4 },
  verdictValue: { fontFamily: FONTS.bold, fontSize: 34 },
  verdictLabel: { fontFamily: FONTS.medium, fontSize: 12.5, color: INK_SOFT },
});

// ---------------------------------------------------------------------------
// F. החזר השקעה בפרסום — ROAS
// ---------------------------------------------------------------------------
export function RoasCalc() {
  const [spend, setSpend] = useState("");
  const [revenue, setRevenue] = useState("");
  const [margin, setMargin] = useState("40");

  const r = useMemo(() => {
    const cost = parseFloat(spend);
    const rev = parseFloat(revenue);
    if (!Number.isFinite(cost) || !Number.isFinite(rev)) return { ready: false };
    // Zero spend has no return to measure — an infinite ROAS is not a result.
    if (cost <= 0) return { ready: true, noSpend: true };

    const roas = rev / cost;
    const marginPct = Math.min(100, Math.max(0, parseFloat(margin) || 0));
    const grossProfit = rev * (marginPct / 100);
    const round2 = (n) => Math.round(n * 100) / 100;
    return {
      ready: true,
      noSpend: false,
      roas: round2(roas),
      pct: Math.round(roas * 100),
      profit: round2(rev - cost),
      // The number that decides whether a campaign is actually worth running:
      // revenue pays for the goods first, and only what is left pays the ads.
      netProfit: round2(grossProfit - cost),
      // Break-even ROAS is 1 / margin — below this, more spend loses money.
      breakEven: marginPct > 0 ? round2(100 / marginPct) : null,
      profitable: grossProfit > cost,
      cpa: null,
    };
  }, [spend, revenue, margin]);

  useCalcHaptic(r.roas);

  const tone = !r.ready || r.noSpend ? INK_SOFT : r.profitable ? GREEN : RED;

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field testID="roas-spend" label="הוצאה על פרסום" value={spend} onChange={setSpend} placeholder="1000" suffix="₪" />
        <Field testID="roas-revenue" label="הכנסה מהקמפיין" value={revenue} onChange={setRevenue} placeholder="4200" suffix="₪" />
      </View>
      <Field testID="roas-margin" label="מתח רווח על המוצר" value={margin} onChange={setMargin} placeholder="40" suffix="%" />

      {!r.ready ? (
        <Text style={s.hint}>הזן כמה הוצאת על הפרסום וכמה הכנסת ממנו.</Text>
      ) : r.noSpend ? (
        <View style={[s.banner, { backgroundColor: GOLD + "16" }]}>
          <Text style={[s.bannerText, { color: "#8A6D00" }]}>ללא הוצאה אין מה למדוד</Text>
          <Text style={[s.bannerSub, { color: "#8A6D00" }]}>
            ROAS הוא יחס בין הכנסה להוצאה. כשההוצאה אפס היחס אינו מוגדר.
          </Text>
        </View>
      ) : (
        <>
          <View style={[m.verdict, { backgroundColor: tone + "12" }]}>
            <Text testID="roas-result" style={[m.verdictValue, { color: tone }]}>×{r.roas}</Text>
            <Text style={m.verdictLabel}>{r.pct}% החזר על ההוצאה</Text>
          </View>

          <View style={s.statRow}>
            <Stat label="הכנסה פחות פרסום" value={shekel(r.profit)} />
            <Stat label="רווח נטו אמיתי" value={shekel(r.netProfit)} color={tone} />
            <Stat label="ROAS לאיזון" value={r.breakEven === null ? "—" : `×${r.breakEven}`} color={GOLD} />
          </View>

          <View style={[s.banner, { backgroundColor: tone + "14" }]}>
            <Text style={[s.bannerText, { color: tone }]}>
              {r.profitable ? "הקמפיין רווחי" : "הקמפיין מפסיד כסף"}
            </Text>
            <Text style={[s.bannerSub, { color: tone }]}>
              {r.profitable
                ? `אחרי עלות הסחורה נשארו ${shekel(r.netProfit)}. אפשר להגדיל תקציב כל עוד ה-ROAS נשאר מעל ×${r.breakEven}.`
                : `ההכנסה נראית גבוהה מההוצאה, אבל אחרי עלות הסחורה נשאר ${shekel(r.netProfit)}. צריך ROAS של ×${r.breakEven} לפחות רק כדי לא להפסיד.`}
            </Text>
          </View>

          <Text style={s.hint}>
            ROAS לבדו מטעה: מכירה של 4,200 ₪ במתח רווח של {margin}% מכניסה לכיס פחות מהמספר הגולמי.
            נקודת האיזון היא 1 חלקי מתח הרווח.
          </Text>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// G. כלל ה-72
// ---------------------------------------------------------------------------
export function RuleOf72() {
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("10000");

  const r = useMemo(() => {
    const pct = parseFloat(rate);
    if (!Number.isFinite(pct)) return { ready: false };
    if (pct <= 0) return { ready: true, noGrowth: true };

    const approx = 72 / pct;
    // The exact answer, so the size of the shortcut's error is visible rather
    // than assumed. Below ~6% and above ~15% the rule of 72 drifts.
    const exact = Math.log(2) / Math.log(1 + pct / 100);
    const round1 = (n) => Math.round(n * 10) / 10;
    const principal = parseFloat(amount) || 0;

    const table = [1, 2, 3, 4].map((doublings) => ({
      doublings,
      years: round1(exact * doublings),
      value: Math.round(principal * 2 ** doublings),
    }));

    return {
      ready: true,
      noGrowth: false,
      approx: round1(approx),
      exact: round1(exact),
      gap: round1(Math.abs(approx - exact)),
      accurate: Math.abs(approx - exact) < 0.3,
      table,
      principal,
    };
  }, [rate, amount]);

  useCalcHaptic(r.approx);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field testID="r72-rate" label="תשואה שנתית" value={rate} onChange={setRate} placeholder="8" suffix="%" />
        <Field testID="r72-amount" label="סכום התחלתי" value={amount} onChange={setAmount} placeholder="10000" suffix="₪" />
      </View>
      <Chips options={[3, 5, 8, 10, 12]} onPick={(v) => setRate(String(v))} active={rate} />

      {!r.ready ? (
        <Text style={s.hint}>הזן תשואה שנתית משוערת באחוזים.</Text>
      ) : r.noGrowth ? (
        <View style={[s.banner, { backgroundColor: GOLD + "16" }]}>
          <Text style={[s.bannerText, { color: "#8A6D00" }]}>בלי תשואה הכסף לא מכפיל את עצמו</Text>
          <Text style={[s.bannerSub, { color: "#8A6D00" }]}>
            כלל ה-72 מחלק ב-אחוז התשואה, ולכן דורש תשואה גדולה מאפס.
          </Text>
        </View>
      ) : (
        <>
          <View style={[m.verdict, { backgroundColor: BLUE + "12" }]}>
            <Text testID="r72-years" style={[m.verdictValue, { color: BLUE }]}>{r.approx}</Text>
            <Text style={m.verdictLabel}>שנים עד להכפלת הסכום</Text>
          </View>

          <View style={s.statRow}>
            <Stat label="לפי כלל ה-72" value={`${r.approx} שנ׳`} />
            <Stat label="חישוב מדויק" value={`${r.exact} שנ׳`} color={GREEN} />
            <Stat label="פער" value={`${r.gap} שנ׳`} color={r.accurate ? INK_SOFT : GOLD} />
          </View>

          {r.principal > 0 && (
            <>
              <Text style={s.sectionLabel}>מסלול ההכפלות</Text>
              {r.table.map((row) => (
                <View key={row.doublings} style={s.routineRow}>
                  <Text style={s.routineTime}>{shekel(row.value)}</Text>
                  <Text style={[s.routineLabel, { flex: 1 }]}>
                    אחרי {row.years} שנים · הכפלה {row.doublings}
                  </Text>
                </View>
              ))}
            </>
          )}

          <Text style={s.hint}>
            כלל ה-72 הוא קיצור דרך לחישוב בראש והוא מדויק בעיקר בטווח 6% עד 10%. כאן מוצג גם החישוב
            המדויק — ln(2) חלקי ln(1+תשואה) — כדי שהפער יהיה גלוי.
          </Text>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// H. מחשבון טיפים
// ---------------------------------------------------------------------------

const TIP_STEPS = [10, 12, 15, 20];

export function QuickTip() {
  const [bill, setBill] = useState("");
  const [pct, setPct] = useState(12);

  const r = useMemo(() => {
    const amount = parseFloat(bill);
    if (!Number.isFinite(amount) || amount < 0) return { ready: false };
    const tip = amount * (pct / 100);
    const round2 = (n) => Math.round(n * 100) / 100;
    return {
      ready: true,
      tip: round2(tip),
      total: round2(amount + tip),
      rounded: Math.ceil(amount + tip),
      roundedTip: round2(Math.ceil(amount + tip) - amount),
    };
  }, [bill, pct]);

  useCalcHaptic(r.total);

  return (
    <View style={{ gap: 12 }}>
      <Field testID="qt-bill" label="סכום החשבון" value={bill} onChange={setBill} placeholder="240" suffix="₪" />

      <View style={qt.steps}>
        {TIP_STEPS.map((step) => {
          const active = step === pct;
          return (
            <TouchableOpacity
              key={step}
              testID={`qt-${step}`}
              style={[qt.step, active && { backgroundColor: BLUE }]}
              onPress={() => { hapticLight(); setPct(step); }}
              activeOpacity={0.85}
            >
              <Text style={[qt.stepText, active && { color: WHITE }]}>{step}%</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!r.ready ? (
        <Text style={s.hint}>הזן את סכום החשבון ובחר אחוז טיפ.</Text>
      ) : (
        <>
          <View style={[m.verdict, { backgroundColor: BLUE + "12" }]}>
            <Text testID="qt-total" style={[m.verdictValue, { color: BLUE }]}>{shekel(r.total)}</Text>
            <Text style={m.verdictLabel}>סה״כ לתשלום</Text>
          </View>

          <View style={s.statRow}>
            <Stat label="הטיפ" value={shekel(r.tip)} color={GREEN} big />
            <Stat label="עיגול כלפי מעלה" value={shekel(r.rounded)} />
            <Stat label="הטיפ בעיגול" value={shekel(r.roundedTip)} color={GOLD} />
          </View>

          <Text style={s.hint}>
            עיגול הסכום הסופי כלפי מעלה נותן טיפ של {shekel(r.roundedTip)} — לרוב הדרך הכי מהירה לסגור
            חשבון בלי לחשב עודף.
          </Text>
        </>
      )}
    </View>
  );
}

const qt = StyleSheet.create({
  steps: { flexDirection: "row", gap: 8 },
  step: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontFamily: FONTS.bold, fontSize: 17, color: INK_SOFT },
});
