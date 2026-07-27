import { useMemo, useState } from "react";
import { Text, View } from "react-native";

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

// Video production tools.

// ---------------------------------------------------------------------------
// B. מחשבון גודל וידאו (CapCut / עריכה)
// ---------------------------------------------------------------------------
// Practical H.264 bitrates (Mbps) by resolution at 30 fps, in line with what
// editors like CapCut export.
const RES_BITRATE = {
  "720p": { label: "720p", mbps: 5 },
  "1080p": { label: "1080p", mbps: 10 },
  "1440p": { label: "2K", mbps: 20 },
  "4k": { label: "4K", mbps: 45 },
};

export function VideoSizeEstimator() {
  const [minutes, setMinutes] = useState("3");
  const [res, setRes] = useState("1080p");
  const [fps, setFps] = useState("30");
  const [codec, setCodec] = useState("h264");

  const r = useMemo(() => {
    const mins = parseFloat(minutes) || 0;
    const f = parseFloat(fps) || 30;
    const base = RES_BITRATE[res].mbps;
    // Frame rate scales bitrate sub-linearly; 60 fps costs ~1.5x, not 2x.
    const fpsFactor = 1 + (f - 30) / 30 * 0.5;
    // H.265 delivers similar quality at roughly 60% the bitrate.
    const codecFactor = codec === "h265" ? 0.6 : 1;
    const mbps = Math.max(0.5, base * fpsFactor * codecFactor);
    const seconds = mins * 60;
    const megabytes = (mbps * seconds) / 8;
    return {
      mbps: Math.round(mbps * 10) / 10,
      mb: Math.round(megabytes),
      gb: Math.round((megabytes / 1024) * 100) / 100,
      perMinute: Math.round((mbps * 60) / 8),
    };
  }, [minutes, res, fps, codec]);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="אורך הסרטון" value={minutes} onChange={setMinutes} placeholder="3" suffix="דק׳" />
        <Field label="קצב פריימים" value={fps} onChange={setFps} placeholder="30" suffix="fps" />
      </View>

      <Text style={s.fieldLabel}>רזולוציה</Text>
      <Segment
        options={Object.entries(RES_BITRATE).map(([key, v]) => ({ key, label: v.label }))}
        value={res}
        onChange={setRes}
      />

      <Text style={s.fieldLabel}>קודק</Text>
      <Segment
        options={[
          { key: "h264", label: "H.264" },
          { key: "h265", label: "H.265 / HEVC" },
        ]}
        value={codec}
        onChange={setCodec}
      />

      <View style={s.statRow}>
        <Stat label="גודל משוער" value={r.mb >= 1024 ? `${r.gb} GB` : `${r.mb} MB`} color={BLUE} big />
        <Stat label="קצב סיביות" value={`${r.mbps} Mbps`} />
        <Stat label="לכל דקה" value={`${r.perMinute} MB`} />
      </View>
      <Text style={s.hint}>
        הערכה לייצוא H.264/H.265 סטנדרטי. 60 fps מוסיף ~50% ולא כפול, ו-H.265 חוסך כ-40% באותה איכות.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// I. מחשבון סלו-מושן
// ---------------------------------------------------------------------------
export function SlowMoFps() {
  const [timeline, setTimeline] = useState("24");
  const [recorded, setRecorded] = useState("60");
  const [clip, setClip] = useState("10");

  const r = useMemo(() => {
    const base = parseFloat(timeline) || 0;
    const rec = parseFloat(recorded) || 0;
    if (base <= 0 || rec <= 0) return { ready: false, slowest: 0 };
    // Every timeline frame needs a real recorded frame: the slowest smooth
    // speed is exactly timeline fps / recorded fps.
    const slowest = Math.round((base / rec) * 1000) / 10;
    const factor = Math.round((rec / base) * 100) / 100;
    const secs = parseFloat(clip) || 0;
    return {
      ready: true,
      slowest: Math.min(100, slowest),
      factor: Math.max(1, factor),
      stretched: Math.round(secs * Math.max(1, rec / base) * 10) / 10,
      short: rec < base,
      equal: rec === base,
    };
  }, [timeline, recorded, clip]);

  useCalcHaptic(r.slowest);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="FPS בטיימליין" value={timeline} onChange={setTimeline} placeholder="24" suffix="fps" />
        <Field label="FPS בהקלטה" value={recorded} onChange={setRecorded} placeholder="60" suffix="fps" />
      </View>
      <Chips options={[24, 25, 30, 60]} onPick={(v) => setTimeline(String(v))} active={timeline} />
      <Chips options={[30, 60, 120, 240]} onPick={(v) => setRecorded(String(v))} active={recorded} />

      {!r.ready ? (
        <Text style={s.hint}>הזן את שני קצבי הפריימים כדי לחשב.</Text>
      ) : r.short ? (
        <View style={[s.banner, { backgroundColor: RED + "14" }]}>
          <Text style={[s.bannerText, { color: RED }]}>ההקלטה איטית מהטיימליין</Text>
          <Text style={[s.bannerSub, { color: RED }]}>
            הקלטת {recorded}fps לטיימליין {timeline}fps — כל האטה תגמגם, כי חסרים פריימים אמיתיים.
          </Text>
        </View>
      ) : r.equal ? (
        <View style={[s.banner, { backgroundColor: GOLD + "16" }]}>
          <Text style={[s.bannerText, { color: "#0E7490" }]}>אין מרווח להאטה (100%)</Text>
          <Text style={[s.bannerSub, { color: "#0E7490" }]}>
            קצב ההקלטה זהה לטיימליין. כדי להאט צריך להקליד בקצב גבוה יותר.
          </Text>
        </View>
      ) : (
        <>
          <View style={s.statRow}>
            <Stat label="האטה מקסימלית חלקה" value={`${r.slowest}%`} color={BLUE} big />
            <Stat label="פי כמה איטי" value={`×${r.factor}`} color={GREEN} />
          </View>
          <View style={s.row}>
            <Field label="אורך הקטע המקורי" value={clip} onChange={setClip} placeholder="10" suffix="שנ׳" />
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>אורך אחרי האטה מלאה</Text>
              <View style={[s.fieldRow, { justifyContent: "center" }]}>
                <Text style={s.resultInline}>{r.stretched} שנ׳</Text>
              </View>
            </View>
          </View>

          <Text style={s.sectionLabel}>מהירויות נפוצות</Text>
          {[100, 75, 50, 40, 25].map((speed) => {
            const smooth = speed >= r.slowest;
            return (
              <View key={speed} style={s.routineRow}>
                <Text style={[s.routineTime, { color: smooth ? GREEN : RED }]}>
                  {smooth ? "חלק" : "מגמגם"}
                </Text>
                <Text style={s.routineLabel}>{speed}% מהמהירות</Text>
              </View>
            );
          })}
          <Text style={s.hint}>
            כל פריים בטיימליין חייב פריים מוקלט משלו. ב-{recorded}fps על טיימליין {timeline}fps יש מרווח
            להאטה עד {r.slowest}% — מתחת לזה העורך ישכפל פריימים והתנועה תיראה קפואה.
          </Text>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// C. הערכת זמן אוויר לרחפן
// ---------------------------------------------------------------------------

// Never plan to fly a pack to empty: lithium cells are damaged below ~20% and
// you want the reserve for the landing approach. The usable fraction is the
// single most important number in this calculation, so it is a control, not a
// hidden constant.
const RESERVES = [
  { key: "0.8", label: "20% רזרבה" },
  { key: "0.7", label: "30% רזרבה" },
  { key: "1", label: "ללא רזרבה" },
];

export function DroneFlightTime() {
  const [mah, setMah] = useState("5000");
  const [amps, setAmps] = useState("15");
  const [reserve, setReserve] = useState("0.8");

  const r = useMemo(() => {
    const capacity = parseFloat(mah) || 0;
    const draw = parseFloat(amps) || 0;
    const usable = parseFloat(reserve);
    if (capacity <= 0 || draw <= 0) return { ready: false };
    // (mAh / 1000) / A = hours; x60 = minutes.
    const fullMinutes = (capacity / 1000 / draw) * 60;
    const safeMinutes = fullMinutes * usable;
    const round1 = (n) => Math.round(n * 10) / 10;
    return {
      ready: true,
      full: round1(fullMinutes),
      safe: round1(safeMinutes),
      safeMin: Math.floor(safeMinutes),
      safeSec: Math.round((safeMinutes % 1) * 60),
      cRate: round1(draw / (capacity / 1000)),
    };
  }, [mah, amps, reserve]);

  useCalcHaptic(r.safe);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="קיבולת סוללה" value={mah} onChange={setMah} placeholder="5000" suffix="mAh" />
        <Field label="צריכה ממוצעת" value={amps} onChange={setAmps} placeholder="15" suffix="A" />
      </View>

      <Segment options={RESERVES} value={reserve} onChange={setReserve} />

      {!r.ready ? (
        <Text style={s.hint}>הזן קיבולת סוללה וצריכת זרם ממוצעת כדי לחשב.</Text>
      ) : (
        <>
          <View style={s.statRow}>
            <Stat label="זמן טיסה בטוח" value={`${r.safeMin}:${String(r.safeSec).padStart(2, "0")}`} color={BLUE} big />
            <Stat label="עד ריקון מלא" value={`${r.full} דק׳`} color={INK_MUTED} />
            <Stat label="C-Rate" value={`${r.cRate}C`} color={r.cRate > 15 ? RED : GREEN} />
          </View>

          {r.cRate > 15 && (
            <View style={[s.banner, { backgroundColor: RED + "14" }]}>
              <Text style={[s.bannerText, { color: RED }]}>צריכה גבוהה ביחס לסוללה</Text>
              <Text style={[s.bannerSub, { color: RED }]}>
                {r.cRate}C — רוב סוללות הליפו לרחפנים מדורגות ל-10C עד 15C ברציפות. בדוק את דירוג
                הפריקה של הסוללה לפני טיסה כזו.
              </Text>
            </View>
          )}

          <Text style={s.hint}>
            החישוב הוא (mAh ÷ 1000) ÷ אמפר × 60. הוא מניח צריכה קבועה — ריחוף שקט מתקרב למספר הזה,
            אבל טיפוסים, רוח ותמרונים מושכים הרבה יותר, ולכן טיסה אמיתית תמיד קצרה מהתחזית.
          </Text>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// D. מחשבון טיימלאפס
// ---------------------------------------------------------------------------
export function TimelapseCalc() {
  const [eventMinutes, setEventMinutes] = useState("120");
  const [clipSeconds, setClipSeconds] = useState("20");
  const [fps, setFps] = useState("24");

  const r = useMemo(() => {
    const realMin = parseFloat(eventMinutes) || 0;
    const clipSec = parseFloat(clipSeconds) || 0;
    const rate = parseFloat(fps) || 0;
    if (realMin <= 0 || clipSec <= 0 || rate <= 0) return { ready: false };

    const frames = Math.round(clipSec * rate);
    const intervalSec = (realMin * 60) / frames;
    const round1 = (n) => Math.round(n * 10) / 10;
    return {
      ready: true,
      frames,
      interval: round1(intervalSec),
      // Below roughly a third of a second most cameras cannot finish writing
      // one frame before the next is due.
      tooFast: intervalSec < 0.33,
      speedUp: Math.round((realMin * 60) / clipSec),
      // 20 MB a frame is a fair figure for a large-sensor RAW still.
      rawGb: round1((frames * 20) / 1024),
    };
  }, [eventMinutes, clipSeconds, fps]);

  useCalcHaptic(r.interval);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Field label="אורך האירוע" value={eventMinutes} onChange={setEventMinutes} placeholder="120" suffix="דק׳" />
        <Field label="אורך הסרטון" value={clipSeconds} onChange={setClipSeconds} placeholder="20" suffix="שנ׳" />
      </View>
      <Field label="פריימים לשנייה" value={fps} onChange={setFps} placeholder="24" suffix="fps" />
      <Chips options={[24, 25, 30, 60]} onPick={(v) => setFps(String(v))} active={fps} />

      {!r.ready ? (
        <Text style={s.hint}>הזן אורך אירוע, אורך סרטון רצוי וקצב פריימים.</Text>
      ) : (
        <>
          <View style={s.statRow}>
            <Stat label="מרווח בין צילומים" value={`${r.interval} שנ׳`} color={BLUE} big />
            <Stat label="סה״כ פריימים" value={r.frames} />
            <Stat label="האצה" value={`×${r.speedUp}`} color={GOLD} />
          </View>

          {r.tooFast && (
            <View style={[s.banner, { backgroundColor: RED + "14" }]}>
              <Text style={[s.bannerText, { color: RED }]}>המרווח קצר מדי</Text>
              <Text style={[s.bannerSub, { color: RED }]}>
                {r.interval} שניות בין פריימים — רוב המצלמות לא מספיקות לכתוב פריים אחד לפני הבא.
                הארך את האירוע, קצר את הסרטון או צלם בווידאו רגיל והאץ בעריכה.
              </Text>
            </View>
          )}

          <View style={s.statRow}>
            <Stat label="נפח משוער ב-RAW" value={`${r.rawGb} GB`} />
            <Stat label="פריימים לדקת אירוע" value={Math.round(r.frames / (parseFloat(eventMinutes) || 1))} />
          </View>

          <Text style={s.hint}>
            מספר הפריימים הוא אורך הסרטון × fps, והמרווח הוא משך האירוע חלקי מספר הפריימים. הערכת
            הנפח מניחה כ-20MB לפריים RAW בחיישן גדול.
          </Text>
        </>
      )}
    </View>
  );
}
