import { useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

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
import CustomText from "../../../components/CustomText";

// Pricing: what to charge, what is left over, and how much of a price is tax.

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
        <CustomText style={s.checkLabel}>כלול מע״מ בחישוב</CustomText>
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
          <CustomText style={s.hint}>
            ההנחה מחושבת קודם, והמע״מ נגבה על המחיר שאחרי ההנחה — כפי שנדרש בחשבונית. שיעור המע״מ בישראל
            הוא 18% מינואר 2025; 17% נשאר לבחירה לתמחורים ולחשבוניות ישנות.
          </CustomText>
        </>
      ) : (
        <CustomText style={s.hint}>הזן מחיר בסיס כדי לחשב.</CustomText>
      )}
    </View>
  );
}

// Map tool id → mini-app component.

// ---------------------------------------------------------------------------
// C. ספירת קופה
// ---------------------------------------------------------------------------


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
        <CustomText style={s.hint}>הזן מחיר עלות ומחיר מכירה כדי לחשב את מתח הרווח.</CustomText>
      ) : (
        <>
          <View style={[m.verdict, { backgroundColor: tone + "12" }]}>
            <CustomText testID="margin-result" style={[m.verdictValue, { color: tone }]}>{r.margin}%</CustomText>
            <CustomText style={m.verdictLabel}>
              {r.loss ? "מכירה בהפסד" : "מתח רווח גולמי מהמחיר"}
            </CustomText>
          </View>

          <View style={s.statRow}>
            <Stat label="רווח ליחידה" value={shekel(r.profit)} color={tone} />
            <Stat label="אחוז תוספת על העלות" value={r.markup === null ? "—" : `${r.markup}%`} />
            <Stat label="מכפיל" value={r.multiplier === null ? "—" : `×${r.multiplier}`} />
          </View>

          <CustomText style={s.hint}>
            מתח הרווח מחושב מתוך מחיר המכירה, ולא מתוך העלות. תוספת של 100% על העלות היא מתח רווח של
            50% בלבד — הבלבול בין השניים הוא הסיבה הנפוצה לתמחור נמוך מהיעד.
          </CustomText>
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
        <CustomText style={s.hint}>הזן מחיר מקורי ואחוז הנחה.</CustomText>
      ) : (
        <>
          <View style={[m.verdict, { backgroundColor: BLUE + "12" }]}>
            <CustomText testID="disc-final" style={[m.verdictValue, { color: BLUE }]}>{shekel(r.final)}</CustomText>
            <CustomText style={m.verdictLabel}>מחיר לתשלום</CustomText>
          </View>

          <View style={s.statRow}>
            <Stat label="חסכת" value={shekel(r.saved)} color={GREEN} big />
            <Stat label="אחוז הנחה" value={`${r.clamped}%`} />
            <Stat label="עיגול לשקל" value={shekel(r.rounded)} />
          </View>

          {r.clampedFrom !== null && (
            <View style={[s.banner, { backgroundColor: GOLD + "16" }]}>
              <CustomText style={[s.bannerText, { color: "#8A6D00" }]}>ההנחה הוגבלה ל-{r.clamped}%</CustomText>
              <CustomText style={[s.bannerSub, { color: "#8A6D00" }]}>
                הוזן {r.clampedFrom}% — הנחה מעל 100% הייתה מייצרת מחיר שלילי.
              </CustomText>
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
        <CustomText style={s.hint}>הזן מחיר עלות ואת הערך השני.</CustomText>
      ) : r.impossible ? (
        <View style={[s.banner, { backgroundColor: RED + "14" }]}>
          <CustomText style={[s.bannerText, { color: RED }]}>מתח רווח של 100% ומעלה אינו אפשרי</CustomText>
          <CustomText style={[s.bannerSub, { color: RED }]}>
            מתח רווח נמדד מתוך מחיר המכירה, ולכן הוא תמיד קטן מ-100% כל עוד יש עלות כלשהי.
          </CustomText>
        </View>
      ) : (
        <>
          <View style={mm.pair}>
            <View style={[mm.half, { backgroundColor: GOLD + "14" }]}>
              <CustomText testID="mm-out-markup" style={[mm.halfValue, { color: "#0E7490" }]}>{r.markup}%</CustomText>
              <CustomText style={mm.halfLabel}>מארק-אפ</CustomText>
              <CustomText style={mm.halfHint}>תוספת על העלות</CustomText>
            </View>
            <View style={[mm.half, { backgroundColor: BLUE + "12" }]}>
              <CustomText testID="mm-out-margin" style={[mm.halfValue, { color: BLUE }]}>{r.margin}%</CustomText>
              <CustomText style={mm.halfLabel}>מתח רווח</CustomText>
              <CustomText style={mm.halfHint}>חלק מהמחיר</CustomText>
            </View>
          </View>

          <View style={s.statRow}>
            <Stat label="עלות" value={shekel(r.cost)} />
            <Stat label="מחיר מכירה" value={shekel(r.price)} color={BLUE} />
            <Stat label="רווח" value={shekel(r.profit)} color={GREEN} />
          </View>

          <CustomText style={s.hint}>
            שני המספרים מתארים את אותו רווח משתי זוויות. הקשר ביניהם הוא מתח = מארק-אפ ÷ (1 + מארק-אפ):
            תוספת של 100% על העלות היא מתח רווח של 50%, ותוספת של 50% היא מתח של 33.3%.
          </CustomText>
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
        <CustomText style={s.hint}>הזן מחיר סופי כולל מע״מ.</CustomText>
      ) : (
        <>
          <View style={mm.pair}>
            <View style={[mm.half, { backgroundColor: BLUE + "12" }]}>
              <CustomText testID="vx-net" style={[mm.halfValue, { color: BLUE }]}>{shekel(r.net)}</CustomText>
              <CustomText style={mm.halfLabel}>לפני מע״מ</CustomText>
            </View>
            <View style={[mm.half, { backgroundColor: GOLD + "14" }]}>
              <CustomText testID="vx-vat" style={[mm.halfValue, { color: "#0E7490" }]}>{shekel(r.vat)}</CustomText>
              <CustomText style={mm.halfLabel}>המע״מ שבתוכו</CustomText>
            </View>
          </View>

          <View style={s.statRow}>
            <Stat label="חלק המע״מ מהסכום" value={`${r.share}%`} />
            <Stat label="החישוב השגוי הנפוץ" value={shekel(r.wrong)} color={RED} />
          </View>

          <CustomText style={s.hint}>
            להוריד {rate}% מהמחיר הסופי היה נותן {shekel(r.wrong)} — יותר מדי. המע״מ מחושב על המחיר לפני
            מע״מ, ולכן חילוץ נכון הוא חלוקה ב-{(1 + (parseFloat(rate) || 0) / 100).toFixed(2)}.
          </CustomText>
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

// ---------------------------------------------------------------------------
// F. כפל מבצעים
// ---------------------------------------------------------------------------
export function DiscountStacking() {
  const [price, setPrice] = useState("");
  const [first, setFirst] = useState("20");
  const [second, setSecond] = useState("10");
  const [third, setThird] = useState("");

  const r = useMemo(() => {
    const base = parseFloat(price);
    if (!Number.isFinite(base) || base < 0) return { ready: false };

    const steps = [first, second, third]
      .map((v) => parseFloat(v))
      .filter((v) => Number.isFinite(v) && v > 0)
      .map((v) => Math.min(100, v));

    // Stacked discounts apply one after another to the running price. Adding
    // the percentages together is the classic mistake: 20% then 10% is not
    // 30% off, because the second cut is taken from an already-reduced price.
    let running = base;
    const chain = steps.map((pct) => {
      const off = running * (pct / 100);
      running -= off;
      return { pct, off: Math.round(off * 100) / 100, after: Math.round(running * 100) / 100 };
    });

    const naiveTotal = steps.reduce((sum, p) => sum + p, 0);
    const naivePrice = base * (1 - Math.min(100, naiveTotal) / 100);
    const effective = base > 0 ? (1 - running / base) * 100 : 0;
    const round2 = (n) => Math.round(n * 100) / 100;

    return {
      ready: true,
      chain,
      final: round2(running),
      saved: round2(base - running),
      effective: round2(effective),
      naiveTotal: round2(Math.min(100, naiveTotal)),
      naivePrice: round2(naivePrice),
      gap: round2(running - naivePrice),
      none: steps.length === 0,
    };
  }, [price, first, second, third]);

  useCalcHaptic(r.final);

  return (
    <View style={{ gap: 12 }}>
      <Field testID="stack-price" label="מחיר מקורי" value={price} onChange={setPrice} placeholder="500" suffix="₪" />
      <View style={s.row}>
        <Field testID="stack-1" label="הנחה ראשונה" value={first} onChange={setFirst} placeholder="20" suffix="%" />
        <Field testID="stack-2" label="הנחה שנייה" value={second} onChange={setSecond} placeholder="10" suffix="%" />
        <Field testID="stack-3" label="שלישית" value={third} onChange={setThird} placeholder="—" suffix="%" />
      </View>

      {!r.ready ? (
        <CustomText style={s.hint}>הזן מחיר מקורי ואת אחוזי ההנחה שמצטברים.</CustomText>
      ) : r.none ? (
        <CustomText style={s.hint}>הזן לפחות אחוז הנחה אחד.</CustomText>
      ) : (
        <>
          <View style={[st.verdict, { backgroundColor: BLUE + "12" }]}>
            <CustomText testID="stack-final" style={[st.verdictValue, { color: BLUE }]}>{shekel(r.final)}</CustomText>
            <CustomText style={st.verdictLabel}>מחיר סופי · הנחה אפקטיבית {r.effective}%</CustomText>
          </View>

          <CustomText style={s.sectionLabel}>שרשרת ההנחות</CustomText>
          {r.chain.map((step, i) => (
            <View key={i} style={s.routineRow}>
              <CustomText style={s.routineTime}>{shekel(step.after)}</CustomText>
              <CustomText style={[s.routineLabel, { flex: 1 }]}>
                הנחה {i + 1} · {step.pct}% ({shekel(step.off)})
              </CustomText>
            </View>
          ))}

          <View style={s.statRow}>
            <Stat label="סה״כ נחסך" value={shekel(r.saved)} color={GREEN} />
            <Stat label="הנחה אפקטיבית" value={`${r.effective}%`} color={BLUE} />
          </View>

          <View style={[s.banner, { backgroundColor: GOLD + "16" }]}>
            <CustomText style={[s.bannerText, { color: "#8A6D00" }]}>
              לא {r.naiveTotal}% — אלא {r.effective}%
            </CustomText>
            <CustomText style={[s.bannerSub, { color: "#8A6D00" }]}>
              חיבור פשוט של האחוזים היה נותן {shekel(r.naivePrice)}, נמוך ב-{shekel(Math.abs(r.gap))} מהמחיר
              האמיתי. ההנחה השנייה נלקחת ממחיר שכבר הוזל.
            </CustomText>
          </View>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  verdict: { borderRadius: 24, paddingVertical: 20, alignItems: "center", gap: 4 },
  verdictValue: { fontFamily: FONTS.bold, fontSize: 34 },
  verdictLabel: { fontFamily: FONTS.medium, fontSize: 12.5, color: INK_SOFT, textAlign: "center" },
});
