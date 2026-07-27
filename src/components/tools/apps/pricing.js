import { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import Icon from "../../Icon";
import Slider from "../Slider";
import { useSettings } from "../../../context/SettingsContext";
import { hapticLight } from "../../../utils/haptics";
import { NOTES_FONTS as FONTS } from "../../../utils/notesTheme";
import { shekel } from "../../../utils/posStore";
import {
  BLUE,
  Chips,
  Field,
  GOLD,
  GREEN,
  INK_MUTED,
  INK_SOFT,
  RED,
  Segment,
  Stat,
  WHITE,
  s,
  useCalcHaptic,
} from "../kit";

// Pricing: what to charge, what is left over, and how much of a price is tax.

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

// ---------------------------------------------------------------------------
// F. מחשבון הלוואות ומימון
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
export function DiscountCalc() {
  const [original, setOriginal] = useState("");
  const [percent, setPercent] = useState("20");

  const r = useMemo(() => {
    const price = parseFloat(original);
    const pct = parseFloat(percent);
    if (!Number.isFinite(price) || !Number.isFinite(pct) || price < 0) return { ready: false };
    const clamped = Math.min(100, Math.max(0, pct));
    const saved = price * (clamped / 100);
    const round2 = (n) => Math.round(n * 100) / 100;
    return {
      ready: true,
      saved: round2(saved),
      final: round2(price - saved),
      rounded: Math.round(price - saved),
      clamped,
      clampedFrom: pct !== clamped ? pct : null,
    };
  }, [original, percent]);

  useCalcHaptic(r.final);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field testID="disc-price" label="מחיר מקורי" value={original} onChange={setOriginal} placeholder="250" suffix="₪" />
        <Field testID="disc-pct" label="אחוז הנחה" value={percent} onChange={setPercent} placeholder="20" suffix="%" />
      </View>
      <Chips options={[10, 15, 20, 25, 30, 50]} onPick={(v) => setPercent(String(v))} active={percent} />

      {!r.ready ? (
        <Text style={s.hint}>הזן מחיר מקורי ואחוז הנחה.</Text>
      ) : (
        <>
          <View style={[m.verdict, { backgroundColor: BLUE + "12" }]}>
            <Text testID="disc-final" style={[m.verdictValue, { color: BLUE }]}>{shekel(r.final)}</Text>
            <Text style={m.verdictLabel}>מחיר לתשלום</Text>
          </View>

          <View style={s.statRow}>
            <Stat label="חסכת" value={shekel(r.saved)} color={GREEN} big />
            <Stat label="אחוז הנחה" value={`${r.clamped}%`} />
            <Stat label="עיגול לשקל" value={shekel(r.rounded)} />
          </View>

          {r.clampedFrom !== null && (
            <View style={[s.banner, { backgroundColor: GOLD + "16" }]}>
              <Text style={[s.bannerText, { color: "#8A6D00" }]}>ההנחה הוגבלה ל-{r.clamped}%</Text>
              <Text style={[s.bannerSub, { color: "#8A6D00" }]}>
                הוזן {r.clampedFrom}% — הנחה מעל 100% הייתה מייצרת מחיר שלילי.
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// H. מארק-אפ מול מתח רווח
// ---------------------------------------------------------------------------

// The two ratios most often confused in pricing. Given a cost and a price they
// are both derived; given either ratio the other follows, so the tool converts
// in both directions rather than just reporting.
export function MarkupVsMargin() {
  const [mode, setMode] = useState("prices");
  const [cost, setCost] = useState("6");
  const [price, setPrice] = useState("10");
  const [markupIn, setMarkupIn] = useState("50");
  const [marginIn, setMarginIn] = useState("33.3");

  const r = useMemo(() => {
    const round2 = (n) => Math.round(n * 100) / 100;
    if (mode === "prices") {
      const c = parseFloat(cost);
      const p = parseFloat(price);
      if (!Number.isFinite(c) || !Number.isFinite(p) || c <= 0 || p <= 0) return { ready: false };
      const profit = p - c;
      return {
        ready: true,
        cost: c,
        price: p,
        profit: round2(profit),
        markup: round2((profit / c) * 100),
        margin: round2((profit / p) * 100),
      };
    }
    if (mode === "markup") {
      const c = parseFloat(cost);
      const mk = parseFloat(markupIn);
      if (!Number.isFinite(c) || !Number.isFinite(mk) || c <= 0) return { ready: false };
      const p = c * (1 + mk / 100);
      const profit = p - c;
      return {
        ready: true,
        cost: c,
        price: round2(p),
        profit: round2(profit),
        markup: round2(mk),
        // margin = markup / (1 + markup) — the conversion people get wrong.
        margin: round2((mk / (100 + mk)) * 100),
      };
    }
    const c = parseFloat(cost);
    const mg = parseFloat(marginIn);
    if (!Number.isFinite(c) || !Number.isFinite(mg) || c <= 0) return { ready: false };
    if (mg >= 100) return { ready: true, impossible: true };
    const p = c / (1 - mg / 100);
    const profit = p - c;
    return {
      ready: true,
      cost: c,
      price: round2(p),
      profit: round2(profit),
      markup: round2((mg / (100 - mg)) * 100),
      margin: round2(mg),
    };
  }, [mode, cost, price, markupIn, marginIn]);

  useCalcHaptic(r.margin);

  return (
    <View style={{ gap: 12 }}>
      <Segment
        options={[
          { key: "prices", label: "משני מחירים" },
          { key: "markup", label: "ממארק-אפ" },
          { key: "margin", label: "ממתח רווח" },
        ]}
        value={mode}
        onChange={(v) => { hapticLight(); setMode(v); }}
      />

      <View style={s.row}>
        <Field testID="mm-cost" label="מחיר עלות" value={cost} onChange={setCost} placeholder="6" suffix="₪" />
        {mode === "prices" && (
          <Field testID="mm-price" label="מחיר מכירה" value={price} onChange={setPrice} placeholder="10" suffix="₪" />
        )}
        {mode === "markup" && (
          <Field testID="mm-markup" label="מארק-אפ" value={markupIn} onChange={setMarkupIn} placeholder="50" suffix="%" />
        )}
        {mode === "margin" && (
          <Field testID="mm-margin" label="מתח רווח" value={marginIn} onChange={setMarginIn} placeholder="33.3" suffix="%" />
        )}
      </View>

      {!r.ready ? (
        <Text style={s.hint}>הזן מחיר עלות ואת הערך השני.</Text>
      ) : r.impossible ? (
        <View style={[s.banner, { backgroundColor: RED + "14" }]}>
          <Text style={[s.bannerText, { color: RED }]}>מתח רווח של 100% ומעלה אינו אפשרי</Text>
          <Text style={[s.bannerSub, { color: RED }]}>
            מתח רווח נמדד מתוך מחיר המכירה, ולכן הוא תמיד קטן מ-100% כל עוד יש עלות כלשהי.
          </Text>
        </View>
      ) : (
        <>
          <View style={mm.pair}>
            <View style={[mm.half, { backgroundColor: GOLD + "14" }]}>
              <Text testID="mm-out-markup" style={[mm.halfValue, { color: "#0E7490" }]}>{r.markup}%</Text>
              <Text style={mm.halfLabel}>מארק-אפ</Text>
              <Text style={mm.halfHint}>תוספת על העלות</Text>
            </View>
            <View style={[mm.half, { backgroundColor: BLUE + "12" }]}>
              <Text testID="mm-out-margin" style={[mm.halfValue, { color: BLUE }]}>{r.margin}%</Text>
              <Text style={mm.halfLabel}>מתח רווח</Text>
              <Text style={mm.halfHint}>חלק מהמחיר</Text>
            </View>
          </View>

          <View style={s.statRow}>
            <Stat label="עלות" value={shekel(r.cost)} />
            <Stat label="מחיר מכירה" value={shekel(r.price)} color={BLUE} />
            <Stat label="רווח" value={shekel(r.profit)} color={GREEN} />
          </View>

          <Text style={s.hint}>
            שני המספרים מתארים את אותו רווח משתי זוויות. הקשר ביניהם הוא מתח = מארק-אפ ÷ (1 + מארק-אפ):
            תוספת של 100% על העלות היא מתח רווח של 50%, ותוספת של 50% היא מתח של 33.3%.
          </Text>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// I. חשבון מסעדה עם טיפ
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
export function VatExtract() {
  const { vatRate } = useSettings();
  const [gross, setGross] = useState("");
  const [rate, setRate] = useState(String(Math.max(0, parseFloat(vatRate) || 18)));

  const r = useMemo(() => {
    const total = parseFloat(gross);
    const pct = parseFloat(rate);
    if (!Number.isFinite(total) || !Number.isFinite(pct) || pct < 0) return { ready: false };
    // Dividing by (1 + rate) is the only correct way back. Taking rate% off
    // the gross undershoots: 18% of 118 is 21.24, not the 18 actually in it.
    const net = total / (1 + pct / 100);
    const vat = total - net;
    const round2 = (n) => Math.round(n * 100) / 100;
    return {
      ready: true,
      net: round2(net),
      vat: round2(vat),
      wrong: round2(total * (pct / 100)),
      share: Math.round((vat / total) * 1000) / 10,
    };
  }, [gross, rate]);

  useCalcHaptic(r.net);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field testID="vx-gross" label="מחיר כולל מע״מ" value={gross} onChange={setGross} placeholder="118" suffix="₪" />
        <Field testID="vx-rate" label="שיעור מע״מ" value={rate} onChange={setRate} placeholder="18" suffix="%" />
      </View>
      <Chips options={[17, 18]} onPick={(v) => setRate(String(v))} active={rate} />

      {!r.ready ? (
        <Text style={s.hint}>הזן מחיר סופי כולל מע״מ.</Text>
      ) : (
        <>
          <View style={mm.pair}>
            <View style={[mm.half, { backgroundColor: BLUE + "12" }]}>
              <Text testID="vx-net" style={[mm.halfValue, { color: BLUE }]}>{shekel(r.net)}</Text>
              <Text style={mm.halfLabel}>לפני מע״מ</Text>
            </View>
            <View style={[mm.half, { backgroundColor: GOLD + "14" }]}>
              <Text testID="vx-vat" style={[mm.halfValue, { color: "#0E7490" }]}>{shekel(r.vat)}</Text>
              <Text style={mm.halfLabel}>המע״מ שבתוכו</Text>
            </View>
          </View>

          <View style={s.statRow}>
            <Stat label="חלק המע״מ מהסכום" value={`${r.share}%`} />
            <Stat label="החישוב השגוי הנפוץ" value={shekel(r.wrong)} color={RED} />
          </View>

          <Text style={s.hint}>
            להוריד {rate}% מהמחיר הסופי היה נותן {shekel(r.wrong)} — יותר מדי. המע״מ מחושב על המחיר לפני
            מע״מ, ולכן חילוץ נכון הוא חלוקה ב-{(1 + (parseFloat(rate) || 0) / 100).toFixed(2)}.
          </Text>
        </>
      )}
    </View>
  );
}

const mm = StyleSheet.create({
  pair: { flexDirection: "row", gap: 10 },
  half: { flex: 1, borderRadius: 24, paddingVertical: 18, alignItems: "center", gap: 3 },
  halfValue: { fontFamily: FONTS.bold, fontSize: 24 },
  halfLabel: { fontFamily: FONTS.semibold, fontSize: 12.5, color: INK_SOFT },
  halfHint: { fontFamily: FONTS.regular, fontSize: 10.5, color: INK_MUTED },
});
