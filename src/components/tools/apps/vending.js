import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { shekel } from "../../../utils/posStore";
import { Field, Stat, Chips, Stepper, useCalcHaptic, BLUE, GOLD, GREEN, RED, s } from "../kit";

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
