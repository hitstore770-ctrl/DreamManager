import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { NOTES_FONTS as FONTS } from "../../../utils/notesTheme";
import { shekel } from "../../../utils/posStore";
import {
  BLUE,
  CARD,
  Chips,
  Field,
  GOLD,
  GREEN,
  INK,
  INK_MUTED,
  INK_SOFT,
  RED,
  Segment,
  Stat,
  s,
  useCalcHaptic,
} from "../kit";
import CustomText from "../../../components/CustomText";

// Vehicle tools: running a car and driving a machine round.

// ---------------------------------------------------------------------------
// A. עלות דלק לנסיעה
// ---------------------------------------------------------------------------
export function FuelTripCost() {
  const [km, setKm] = useState("");
  const [kmPerLitre, setKmPerLitre] = useState("12");
  const [pricePerLitre, setPricePerLitre] = useState("7.4");
  const [roundTrip, setRoundTrip] = useState("one");

  const r = useMemo(() => {
    const distance = parseFloat(km);
    const efficiency = parseFloat(kmPerLitre);
    const price = parseFloat(pricePerLitre);
    // Efficiency is the denominator — a zero or blank here must not produce
    // Infinity on screen.
    if (!Number.isFinite(distance) || !Number.isFinite(efficiency) || !Number.isFinite(price)) {
      return { ready: false };
    }
    if (efficiency <= 0) return { ready: true, badEfficiency: true };
    const total = roundTrip === "return" ? distance * 2 : distance;
    const litres = total / efficiency;
    const round2 = (n) => Math.round(n * 100) / 100;
    return {
      ready: true,
      badEfficiency: false,
      totalKm: round2(total),
      litres: round2(litres),
      cost: round2(litres * price),
      perKm: round2((litres * price) / (total || 1)),
      per100: round2((100 / efficiency) * price),
    };
  }, [km, kmPerLitre, pricePerLitre, roundTrip]);

  useCalcHaptic(r.cost);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field testID="fuel-km" label="מרחק" value={km} onChange={setKm} placeholder="120" suffix="ק״מ" />
        <Field testID="fuel-eff" label="צריכה" value={kmPerLitre} onChange={setKmPerLitre} placeholder="12" suffix="ק״מ/ל׳" />
        <Field testID="fuel-price" label="מחיר לליטר" value={pricePerLitre} onChange={setPricePerLitre} placeholder="7.4" suffix="₪" />
      </View>

      <Segment
        options={[
          { key: "one", label: "כיוון אחד" },
          { key: "return", label: "הלוך ושוב" },
        ]}
        value={roundTrip}
        onChange={setRoundTrip}
      />
      <Chips options={[8, 10, 12, 15, 18]} onPick={(v) => setKmPerLitre(String(v))} active={kmPerLitre} />

      {!r.ready ? (
        <CustomText style={s.hint}>הזן מרחק, צריכת דלק ומחיר לליטר.</CustomText>
      ) : r.badEfficiency ? (
        <View style={[s.banner, { backgroundColor: RED + "14" }]}>
          <CustomText style={[s.bannerText, { color: RED }]}>צריכת דלק חייבת להיות גדולה מאפס</CustomText>
          <CustomText style={[s.bannerSub, { color: RED }]}>
            הערך הוא כמה קילומטרים הרכב עושה על ליטר — בדרך כלל בין 8 ל-18.
          </CustomText>
        </View>
      ) : (
        <>
          <View style={s.statRow}>
            <Stat label="עלות הנסיעה" value={shekel(r.cost)} color={BLUE} big />
            <Stat label="ליטרים" value={`${r.litres} ל׳`} />
            <Stat label="סה״כ ק״מ" value={r.totalKm} />
          </View>
          <View style={s.statRow}>
            <Stat label="עלות לקילומטר" value={shekel(r.perKm)} color={GOLD} />
            <Stat label="עלות ל-100 ק״מ" value={shekel(r.per100)} />
          </View>
          <CustomText style={s.hint}>
            החישוב מכסה דלק בלבד. העלות האמיתית לקילומטר כוללת גם שחיקה, צמיגים, ביטוח וירידת ערך —
            בדרך כלל פי שניים עד שלושה מהמספר הזה.
          </CustomText>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// B. ירידת ערך רכב
// ---------------------------------------------------------------------------
export function CarDepreciation() {
  const [price, setPrice] = useState("");
  const [years, setYears] = useState("3");
  const [rate, setRate] = useState("15");

  const r = useMemo(() => {
    const p = parseFloat(price);
    const y = parseFloat(years);
    const pct = parseFloat(rate);
    if (!Number.isFinite(p) || !Number.isFinite(y) || !Number.isFinite(pct) || p <= 0 || y < 0) {
      return { ready: false };
    }
    // Depreciation compounds on the remaining value, not on the original
    // price: a straight-line subtraction reaches zero and then goes negative,
    // which no car does.
    const factor = Math.max(0, 1 - pct / 100);
    const value = p * factor ** y;
    const round0 = (n) => Math.round(n);
    const perYear = [];
    for (let i = 1; i <= Math.min(10, Math.ceil(y) + 2); i += 1) {
      perYear.push({ year: i, value: round0(p * factor ** i) });
    }
    return {
      ready: true,
      value: round0(value),
      lost: round0(p - value),
      lostPct: Math.round(((p - value) / p) * 100),
      perYearAvg: y > 0 ? round0((p - value) / y) : 0,
      perYear,
    };
  }, [price, years, rate]);

  useCalcHaptic(r.value);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field testID="dep-price" label="מחיר קנייה" value={price} onChange={setPrice} placeholder="80000" suffix="₪" />
        <Field testID="dep-years" label="שנות בעלות" value={years} onChange={setYears} placeholder="3" suffix="שנים" />
        <Field testID="dep-rate" label="ירידה שנתית" value={rate} onChange={setRate} placeholder="15" suffix="%" />
      </View>
      <Chips options={[10, 12, 15, 18, 20]} onPick={(v) => setRate(String(v))} active={rate} />

      {!r.ready ? (
        <CustomText style={s.hint}>הזן מחיר קנייה, כמה שנים הרכב בבעלותך ואחוז ירידת ערך שנתי.</CustomText>
      ) : (
        <>
          <View style={[v.verdict, { backgroundColor: BLUE + "12" }]}>
            <CustomText testID="dep-value" style={[v.verdictValue, { color: BLUE }]}>{shekel(r.value)}</CustomText>
            <CustomText style={v.verdictLabel}>שווי מוערך היום</CustomText>
          </View>

          <View style={s.statRow}>
            <Stat label="ירידת ערך" value={shekel(r.lost)} color={RED} />
            <Stat label="באחוזים" value={`${r.lostPct}%`} color={RED} />
            <Stat label="ממוצע לשנה" value={shekel(r.perYearAvg)} />
          </View>

          <CustomText style={s.sectionLabel}>שווי לפי שנה</CustomText>
          {r.perYear.map((row) => (
            <View key={row.year} style={s.routineRow}>
              <CustomText style={s.routineTime}>{shekel(row.value)}</CustomText>
              <CustomText style={s.routineLabel}>שנה {row.year}</CustomText>
            </View>
          ))}

          <CustomText style={s.hint}>
            הירידה מחושבת כאחוז מהשווי שנותר בכל שנה, ולכן היא תלולה בהתחלה ומתמתנת. בישראל השנה
            הראשונה בדרך כלל חדה יותר מהשאר, במיוחד ברכב חדש מהיבואן.
          </CustomText>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// C. הערכת מסלול חלוקה
// ---------------------------------------------------------------------------
function hhmm(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h > 0 ? `${h} שע׳ ${m} דק׳` : `${m} דק׳`;
}

export function DeliveryRoute() {
  const [stops, setStops] = useState("");
  const [perStop, setPerStop] = useState("12");
  const [driveBetween, setDriveBetween] = useState("9");
  const [startHour, setStartHour] = useState("8");

  const r = useMemo(() => {
    const n = parseInt(stops, 10);
    const service = parseFloat(perStop);
    const drive = parseFloat(driveBetween);
    if (!Number.isFinite(n) || !Number.isFinite(service) || !Number.isFinite(drive) || n <= 0) {
      return { ready: false };
    }
    // n stops have n service periods but only n-1 legs between them. Counting
    // n legs is the classic fencepost error and overstates a long round by
    // a full drive segment.
    const legs = Math.max(0, n - 1);
    const serviceTotal = n * service;
    const driveTotal = legs * drive;
    const total = serviceTotal + driveTotal;
    const start = Math.min(23, Math.max(0, parseFloat(startHour) || 0));
    const endMinutes = start * 60 + total;
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = Math.round(endMinutes % 60);
    return {
      ready: true,
      total,
      serviceTotal,
      driveTotal,
      legs,
      perStopAvg: Math.round((total / n) * 10) / 10,
      finish: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
      overDay: endMinutes > 24 * 60,
      stopsPerHour: total > 0 ? Math.round((n / (total / 60)) * 10) / 10 : 0,
    };
  }, [stops, perStop, driveBetween, startHour]);

  useCalcHaptic(r.total);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field testID="route-stops" label="מספר עצירות" value={stops} onChange={setStops} placeholder="9" suffix="יח׳" />
        <Field testID="route-service" label="זמן בעצירה" value={perStop} onChange={setPerStop} placeholder="12" suffix="דק׳" />
        <Field testID="route-drive" label="נסיעה בין עצירות" value={driveBetween} onChange={setDriveBetween} placeholder="9" suffix="דק׳" />
      </View>
      <Field testID="route-start" label="שעת יציאה" value={startHour} onChange={setStartHour} placeholder="8" suffix=":00" />

      {!r.ready ? (
        <CustomText style={s.hint}>הזן מספר עצירות, זמן ממוצע בכל עצירה וזמן נסיעה ביניהן.</CustomText>
      ) : (
        <>
          <View style={[v.verdict, { backgroundColor: BLUE + "12" }]}>
            <CustomText testID="route-total" style={[v.verdictValue, { color: BLUE }]}>{hhmm(r.total)}</CustomText>
            <CustomText style={v.verdictLabel}>סיום משוער בשעה {r.finish}</CustomText>
          </View>

          <View style={s.statRow}>
            <Stat label="זמן טיפול" value={hhmm(r.serviceTotal)} />
            <Stat label="זמן נסיעה" value={hhmm(r.driveTotal)} color={GOLD} />
            <Stat label="קטעי נסיעה" value={r.legs} />
          </View>
          <View style={s.statRow}>
            <Stat label="ממוצע לעצירה" value={`${r.perStopAvg} דק׳`} />
            <Stat label="עצירות לשעה" value={r.stopsPerHour} color={GREEN} />
          </View>

          {r.overDay && (
            <View style={[s.banner, { backgroundColor: GOLD + "16" }]}>
              <CustomText style={[s.bannerText, { color: "#8A6D00" }]}>הסבב חוצה את חצות</CustomText>
              <CustomText style={[s.bannerSub, { color: "#8A6D00" }]}>
                בקצב הזה הסבב לא נסגר ביום אחד. שווה לפצל אותו לשניים או לקצר את הזמן בכל עצירה.
              </CustomText>
            </View>
          )}

          <CustomText style={s.hint}>
            {r.legs} קטעי נסיעה ל-{stops} עצירות — בין n עצירות יש n פחות אחת נסיעות. החישוב לא כולל
            פקקים, חניה או הפסקות.
          </CustomText>
        </>
      )}
    </View>
  );
}

const v = StyleSheet.create({
  verdict: { borderRadius: 24, paddingVertical: 20, alignItems: "center", gap: 4 },
  verdictValue: { fontFamily: FONTS.bold, fontSize: 32 },
  verdictLabel: { fontFamily: FONTS.medium, fontSize: 12.5, color: INK_SOFT },
});
