import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { shekel } from "../../../utils/posStore";
import {
  BLUE,
  CARD,
  Chips,
  Field,
  GOLD,
  GREEN,
  INK,
  INK_SOFT,
  RED,
  Segment,
  Stat,
  Stepper,
  s,
  useCalcHaptic,
} from "../kit";

// Vending-machine and transit tools.

// ---------------------------------------------------------------------------
// A. מחשבון החזר השקעה למכונת שתייה
// ---------------------------------------------------------------------------
export function VendingRoi() {
  const [price, setPrice] = useState("4500");
  const [cansPerDay, setCansPerDay] = useState("18");
  const [profitPerCan, setProfitPerCan] = useState("2.5");
  const [monthlyCosts, setMonthlyCosts] = useState("120");

  const r = useMemo(() => {
    const machine = parseFloat(price) || 0;
    const cans = parseFloat(cansPerDay) || 0;
    const per = parseFloat(profitPerCan) || 0;
    const fixed = parseFloat(monthlyCosts) || 0;

    const grossDaily = cans * per;
    const netDaily = grossDaily - fixed / 30.4; // spread electricity/location fees over a month
    if (machine <= 0 || netDaily <= 0) {
      return { impossible: true, netDaily, grossDaily };
    }
    const days = Math.ceil(machine / netDaily);
    return {
      impossible: false,
      grossDaily: Math.round(grossDaily * 100) / 100,
      netDaily: Math.round(netDaily * 100) / 100,
      days,
      months: Math.round((days / 30.4) * 10) / 10,
      monthlyNet: Math.round(netDaily * 30.4),
      yearOne: Math.round(netDaily * 365 - machine),
    };
  }, [price, cansPerDay, profitPerCan, monthlyCosts]);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="מחיר המכונה" value={price} onChange={setPrice} placeholder="4500" suffix="₪" />
        <Field label="פחיות ביום" value={cansPerDay} onChange={setCansPerDay} placeholder="18" suffix="יח׳" />
      </View>
      <View style={s.row}>
        <Field label="רווח לפחית" value={profitPerCan} onChange={setProfitPerCan} placeholder="2.5" suffix="₪" />
        <Field label="עלויות חודשיות" value={monthlyCosts} onChange={setMonthlyCosts} placeholder="120" suffix="₪" />
      </View>

      {r.impossible ? (
        <View style={[s.banner, { backgroundColor: RED + "14" }]}>
          <Text style={[s.bannerText, { color: RED }]}>אין החזר השקעה בנתונים האלה</Text>
          <Text style={[s.bannerSub, { color: RED }]}>
            הרווח היומי ({shekel(Math.round(r.netDaily * 100) / 100)}) לא מכסה את העלויות הקבועות.
          </Text>
        </View>
      ) : (
        <>
          <View style={s.statRow}>
            <Stat label="ימים להחזר" value={r.days} color={BLUE} big />
            <Stat label="חודשים" value={r.months} />
            <Stat label="רווח נקי לחודש" value={shekel(r.monthlyNet)} color={GREEN} />
          </View>
          <View style={s.statRow}>
            <Stat label="רווח יומי ברוטו" value={shekel(r.grossDaily)} />
            <Stat label="רווח יומי נטו" value={shekel(r.netDaily)} color={GREEN} />
            <Stat
              label="רווח בשנה הראשונה"
              value={shekel(r.yearOne)}
              color={r.yearOne >= 0 ? GREEN : RED}
            />
          </View>
          <Text style={s.hint}>
            העלויות החודשיות (חשמל, דמי מיקום) מחולקות ל-30.4 ימים ומופחתות מהרווח היומי, כך שההחזר משקף
            רווח נטו אמיתי.
          </Text>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// G. מחשבון עומס טרנזיט
// ---------------------------------------------------------------------------
export function TransitLoadCalc() {
  const [payload, setPayload] = useState("1000");
  const [boxWeight, setBoxWeight] = useState("12");
  const [onBoard, setOnBoard] = useState(0);

  const r = useMemo(() => {
    const max = parseFloat(payload) || 0;
    const box = parseFloat(boxWeight) || 0;
    if (max <= 0 || box <= 0) return { ready: false, boxes: 0 };
    // A partial box is not a box you can legally carry — always round down.
    const boxes = Math.floor(max / box);
    const used = boxes * box;
    const loadedKg = onBoard * box;
    return {
      ready: true,
      boxes,
      used: Math.round(used * 10) / 10,
      spare: Math.round((max - used) * 10) / 10,
      loadedKg: Math.round(loadedKg * 10) / 10,
      pct: Math.min(100, Math.round((loadedKg / max) * 100)),
      over: loadedKg > max,
      left: Math.max(0, boxes - onBoard),
    };
  }, [payload, boxWeight, onBoard]);

  useCalcHaptic(r.boxes);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="מטען מותר ברכב" value={payload} onChange={setPayload} placeholder="1000" suffix="ק״ג" />
        <Field label="משקל ארגז בודד" value={boxWeight} onChange={setBoxWeight} placeholder="12" suffix="ק״ג" />
      </View>
      <Chips options={[600, 800, 1000, 1200, 1500]} onPick={(v) => setPayload(String(v))} active={payload} />

      {!r.ready ? (
        <Text style={s.hint}>הזן מטען מותר ומשקל ארגז כדי לחשב.</Text>
      ) : r.boxes === 0 ? (
        <View style={[s.banner, { backgroundColor: RED + "14" }]}>
          <Text style={[s.bannerText, { color: RED }]}>אפילו ארגז אחד חורג מהמטען המותר</Text>
          <Text style={[s.bannerSub, { color: RED }]}>
            משקל הארגז ({boxWeight} ק״ג) גדול מהמטען המותר ({payload} ק״ג).
          </Text>
        </View>
      ) : (
        <>
          <View style={s.statRow}>
            <Stat label="ארגזים מקסימום" value={r.boxes} color={BLUE} big />
            <Stat label="משקל בפועל" value={`${r.used} ק״ג`} />
            <Stat label="עודף מותר" value={`${r.spare} ק״ג`} color={GREEN} />
          </View>

          <Stepper label="כמה ארגזים העמסת בפועל" value={onBoard} onChange={setOnBoard} min={0} max={999} suffix="ארגזים" />
          <View style={s.loadTrack}>
            <View
              style={[
                s.loadFill,
                { width: `${r.pct}%`, backgroundColor: r.over ? RED : r.pct > 85 ? GOLD : GREEN },
              ]}
            />
          </View>
          <View style={s.loadMetaRow}>
            <Text style={[s.loadMeta, r.over && { color: RED }]}>
              {r.loadedKg} ק״ג · {r.pct}% מהמטען
            </Text>
            <Text style={s.loadMeta}>
              {r.over ? "חריגה ממשקל חוקי" : `נשארו עוד ${r.left} ארגזים`}
            </Text>
          </View>

          <Text style={s.hint}>
            המטען המותר הוא ההפרש בין המשקל הכולל המותר לבין משקל הרכב העצמי — מופיע ברישיון הרכב. שים לב
            שנוסעים וציוד קבוע נחשבים גם הם על חשבון אותו מטען.
          </Text>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// C. חוק אוהם לחומרה
// ---------------------------------------------------------------------------

// Which pair of values you know decides which formulas apply. Solving from the
// wrong pair is the usual source of a wrong answer, so the pair is an explicit
// choice rather than something inferred from which boxes happen to be filled.
const OHM_MODES = [
  { key: "vi", label: "V ו-I" },
  { key: "vr", label: "V ו-R" },
  { key: "ir", label: "I ו-R" },
];

// Common rails inside a vending machine's control side.
const VOLT_PRESETS = [5, 12, 24, 230];

export function OhmsLaw() {
  const [mode, setMode] = useState("vi");
  const [volts, setVolts] = useState("12");
  const [amps, setAmps] = useState("2");
  const [ohms, setOhms] = useState("6");

  const r = useMemo(() => {
    const V = parseFloat(volts);
    const I = parseFloat(amps);
    const R = parseFloat(ohms);
    const round3 = (n) => Math.round(n * 1000) / 1000;

    let v;
    let i;
    let res;
    if (mode === "vi") {
      v = V; i = I;
      if (!Number.isFinite(v) || !Number.isFinite(i)) return { ready: false };
      // R = V/I is undefined at zero current — an open circuit, not infinite
      // resistance you can print.
      res = i === 0 ? null : v / i;
    } else if (mode === "vr") {
      v = V; res = R;
      if (!Number.isFinite(v) || !Number.isFinite(res)) return { ready: false };
      i = res === 0 ? null : v / res;
    } else {
      i = I; res = R;
      if (!Number.isFinite(i) || !Number.isFinite(res)) return { ready: false };
      v = i * res;
    }
    if (i === null || res === null) {
      return { ready: true, undef: true, v, i, res };
    }
    const watts = v * i;
    return {
      ready: true,
      undef: false,
      v: round3(v),
      i: round3(i),
      res: round3(res),
      watts: round3(watts),
      milliamps: Math.round(i * 1000),
      // Resistors are sold in steps; a part run near its rating cooks itself,
      // so the usual rule is to fit one rated at twice the dissipation.
      suggestedRating: watts <= 0 ? 0 : Math.ceil(watts * 2 * 4) / 4,
    };
  }, [mode, volts, amps, ohms]);

  useCalcHaptic(r.watts);

  return (
    <View style={{ gap: 12 }}>
      <Segment options={OHM_MODES} value={mode} onChange={setMode} />

      <View style={s.row}>
        {mode !== "ir" && (
          <Field label="מתח (V)" value={volts} onChange={setVolts} placeholder="12" suffix="V" />
        )}
        {mode !== "vr" && (
          <Field label="זרם (I)" value={amps} onChange={setAmps} placeholder="2" suffix="A" />
        )}
        {mode !== "vi" && (
          <Field label="התנגדות (R)" value={ohms} onChange={setOhms} placeholder="6" suffix="Ω" />
        )}
      </View>

      {mode !== "ir" && <Chips options={VOLT_PRESETS} onPick={(v) => setVolts(String(v))} active={volts} />}

      {!r.ready ? (
        <Text style={s.hint}>הזן את שני הערכים הידועים כדי לפתור את השאר.</Text>
      ) : r.undef ? (
        <View style={[s.banner, { backgroundColor: GOLD + "16" }]}>
          <Text style={[s.bannerText, { color: "#8A6D00" }]}>אין פתרון בערכים האלה</Text>
          <Text style={[s.bannerSub, { color: "#8A6D00" }]}>
            חלוקה באפס — זרם אפס פירושו מעגל פתוח, והתנגדות אפס פירושה קצר. שנה את אחד הערכים.
          </Text>
        </View>
      ) : (
        <>
          <View style={s.statRow}>
            <Stat label="הספק" value={`${r.watts} W`} color={BLUE} big />
            <Stat label="התנגדות" value={`${r.res} Ω`} color={GOLD} />
          </View>
          <View style={s.statRow}>
            <Stat label="מתח" value={`${r.v} V`} />
            <Stat label="זרם" value={`${r.i} A`} />
            <Stat label="במיליאמפר" value={`${r.milliamps} mA`} />
          </View>

          <View style={[s.banner, { backgroundColor: CARD }]}>
            <Text style={[s.bannerText, { color: INK }]}>נגד מומלץ: {r.suggestedRating}W ומעלה</Text>
            <Text style={[s.bannerSub, { color: INK_SOFT }]}>
              פי שניים מההספק המחושב ({r.watts}W). רכיב שעובד קרוב לדירוג שלו מתחמם ומתקצר את חייו.
            </Text>
          </View>

          <Text style={s.hint}>
            V = I × R, ו-P = V × I. שים לב שהחישוב נכון לזרם ישר (DC) — ברשת 230V יש גם היגב והפרש
            פאזה, וההספק בפועל נמוך מהמכפלה הפשוטה.
          </Text>
        </>
      )}
    </View>
  );
}
