// Halachic day times computed locally with the standard NOAA solar-position
// algorithm — no network, no library. Default coordinates are Jerusalem
// (770JLM), and every time is derived from real sun angles rather than being
// hardcoded, so the card stays correct all year.

export const JERUSALEM = { lat: 31.7683, lon: 35.2137, name: "ירושלים", tz: "Asia/Jerusalem" };

const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;

// Days since J2000 for the given date at local midnight.
function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Solar declination + equation of time for a Julian day.
function solar(jd) {
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360; // mean longitude
  const g = rad((357.528 + 0.9856003 * n) % 360); // mean anomaly
  const lambda = rad(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)); // ecliptic longitude
  const epsilon = rad(23.439 - 0.0000004 * n); // obliquity
  const declination = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  // Equation of time in minutes.
  const y = Math.tan(epsilon / 2) ** 2;
  const Lr = rad(L);
  const eqTime =
    4 *
    deg(
      y * Math.sin(2 * Lr) -
        2 * 0.0167 * Math.sin(g) +
        4 * 0.0167 * y * Math.sin(g) * Math.cos(2 * Lr) -
        0.5 * y * y * Math.sin(4 * Lr) -
        1.25 * 0.0167 * 0.0167 * Math.sin(2 * g)
    );
  return { declination, eqTime };
}

// UTC minutes when the sun sits at `angle` below (negative) / above the
// horizon. `morning` picks the ascending crossing.
function sunEvent(date, lat, lon, angle, morning) {
  const jd = julianDay(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12));
  const { declination, eqTime } = solar(jd);
  const latR = rad(lat);
  const cosH =
    (Math.cos(rad(90 - angle)) - Math.sin(latR) * Math.sin(declination)) /
    (Math.cos(latR) * Math.cos(declination));
  if (cosH > 1 || cosH < -1) return null; // sun never reaches this angle today
  const H = deg(Math.acos(cosH));
  const solarNoon = 720 - 4 * lon - eqTime; // UTC minutes
  return solarNoon + (morning ? -4 * H : 4 * H);
}

// Convert UTC minutes to a local Date on the same calendar day.
function toLocal(date, utcMinutes) {
  if (utcMinutes === null) return null;
  const base = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return new Date(base + utcMinutes * 60000);
}

// Always render in the location's own timezone: a Jerusalem zmanim card must
// read the same whether the phone is set to Israel, UTC or anywhere else.
export function fmtTime(d, tz = JERUSALEM.tz) {
  if (!d || isNaN(d)) return "—";
  try {
    return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  } catch {
    // Environment without full ICU — fall back to device local time.
    return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  }
}

export function fmtDate(d, tz = JERUSALEM.tz) {
  if (!d || isNaN(d)) return "—";
  try {
    return d.toLocaleDateString("he-IL", { timeZone: tz });
  } catch {
    return d.toLocaleDateString("he-IL");
  }
}

// The day's key times. Angles follow common practice: dawn at 16.1° below the
// horizon, sunrise/sunset at -0.833° (refraction + solar radius), nightfall
// at 8.5° below.
export function computeZmanim(now = new Date(), place = JERUSALEM) {
  const { lat, lon } = place;
  // Anchor the calendar day to the location, not the device: just after
  // midnight in Jerusalem a UTC phone would otherwise compute yesterday.
  let date = now;
  try {
    const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: place.tz })
      .format(now)
      .split("-")
      .map(Number);
    date = new Date(y, m - 1, d, 12);
  } catch {
    /* no ICU — device date is close enough */
  }
  const dawn = toLocal(date, sunEvent(date, lat, lon, -16.1, true));
  const sunrise = toLocal(date, sunEvent(date, lat, lon, -0.833, true));
  const sunset = toLocal(date, sunEvent(date, lat, lon, -0.833, false));
  const nightfall = toLocal(date, sunEvent(date, lat, lon, -8.5, false));

  // Proportional ("temporal") hour: a twelfth of sunrise→sunset.
  let temporalHourMs = null;
  let midday = null;
  let shemaEnd = null;
  let tefillaEnd = null;
  let minchaGedola = null;
  let plag = null;
  if (sunrise && sunset) {
    temporalHourMs = (sunset - sunrise) / 12;
    midday = new Date(sunrise.getTime() + temporalHourMs * 6);
    shemaEnd = new Date(sunrise.getTime() + temporalHourMs * 3);
    tefillaEnd = new Date(sunrise.getTime() + temporalHourMs * 4);
    minchaGedola = new Date(sunrise.getTime() + temporalHourMs * 6.5);
    plag = new Date(sunrise.getTime() + temporalHourMs * 10.75);
  }

  // Candle lighting: 40 minutes before sunset (Jerusalem custom).
  const candles = sunset ? new Date(sunset.getTime() - 40 * 60000) : null;

  return {
    place,
    date,
    dawn,
    sunrise,
    shemaEnd,
    tefillaEnd,
    midday,
    minchaGedola,
    plag,
    candles,
    sunset,
    nightfall,
    temporalHourMinutes: temporalHourMs ? Math.round(temporalHourMs / 60000) : null,
    dayLengthMinutes: sunrise && sunset ? Math.round((sunset - sunrise) / 60000) : null,
  };
}
