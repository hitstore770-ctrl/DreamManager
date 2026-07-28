import { useMemo, useState } from "react";
import { TouchableOpacity, View } from "react-native";

import Icon from "../../Icon";
import { useSettings } from "../../../context/SettingsContext";
import { hapticLight } from "../../../utils/haptics";
import { shekel } from "../../../utils/posStore";
import { Field, Stat, WHITE, INK_SOFT, BLUE, GOLD, GREEN, s } from "../kit";
import CustomText from "../../../components/CustomText";

// Import / landed-cost tools.

// ---------------------------------------------------------------------------
// D. מחשבון ייבוא אליאקספרס
// ---------------------------------------------------------------------------
export function AliImportCalc() {
  const { vatRate } = useSettings();
  const vatPct = Math.max(0, parseFloat(vatRate) || 0);
  const [cost, setCost] = useState("6.5");
  const [shipping, setShipping] = useState("2");
  const [margin, setMargin] = useState("60");
  const [rate, setRate] = useState("3.7");
  const [vat, setVat] = useState(true);

  const r = useMemo(() => {
    const usd = (parseFloat(cost) || 0) + (parseFloat(shipping) || 0);
    const fx = parseFloat(rate) || 0;
    const m = parseFloat(margin) || 0;
    const landedIls = usd * fx;
    const sellBeforeVat = landedIls * (1 + m / 100);
    const sell = vat ? sellBeforeVat * (1 + vatPct / 100) : sellBeforeVat;
    const profit = sellBeforeVat - landedIls;
    const rounded = sell > 0 ? Math.ceil(sell / 5) * 5 : 0;
    return {
      landedIls: Math.round(landedIls * 100) / 100,
      sell: Math.round(sell * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      rounded,
      marginOfPrice: sell > 0 ? Math.round((profit / sell) * 100) : 0,
      ready: usd > 0 && fx > 0,
    };
  }, [cost, shipping, margin, rate, vat, vatPct]);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="עלות המוצר" value={cost} onChange={setCost} placeholder="6.5" suffix="$" />
        <Field label="משלוח" value={shipping} onChange={setShipping} placeholder="2" suffix="$" />
      </View>
      <View style={s.row}>
        <Field label="אחוז רווח רצוי" value={margin} onChange={setMargin} placeholder="60" suffix="%" />
        <Field label="שער דולר" value={rate} onChange={setRate} placeholder="3.7" suffix="₪" />
      </View>

      <TouchableOpacity style={s.checkRow} onPress={() => { hapticLight(); setVat((v) => !v); }} activeOpacity={0.75}>
        <View style={[s.checkbox, vat && { backgroundColor: BLUE, borderColor: BLUE }]}>
          {vat && <Icon name="check" size={13} color={WHITE} />}
        </View>
        <CustomText style={s.checkLabel}>הוסף מע״מ {vatPct}% למחיר המכירה</CustomText>
      </TouchableOpacity>

      {r.ready ? (
        <>
          <View style={s.statRow}>
            <Stat label="מחיר מכירה" value={shekel(r.sell)} color={BLUE} big />
            <Stat label="רווח נקי" value={shekel(r.profit)} color={r.marginOfPrice >= 30 ? GREEN : GOLD} />
          </View>
          <View style={s.statRow}>
            <Stat label="עלות נחיתה בשקלים" value={shekel(r.landedIls)} />
            <Stat label="רווח מהמחיר" value={`${r.marginOfPrice}%`} />
          </View>
          <CustomText style={[s.hint, { color: INK_SOFT }]}>מחיר מדף מומלץ (עיגול ל-5): {shekel(r.rounded)}</CustomText>
          <CustomText style={s.hint}>
            הרווח מחושב לפני מע״מ — המע״מ נגבה מהלקוח ומועבר למדינה, ולכן אינו חלק מהרווח.
          </CustomText>
        </>
      ) : (
        <CustomText style={s.hint}>הזן עלות מוצר ושער דולר כדי לחשב.</CustomText>
      )}
    </View>
  );
}
