// Hebrew (Jewish) calendar engine — Gregorian ⇄ Hebrew conversion using the
// classic Dershowitz/Reingold "Calendrical Calculations" arithmetic (the same
// algorithm the Emacs calendar uses), plus Hebrew month names and gematria
// number formatting. No external library required.
//
// Month numbering follows Reingold's convention: Nisan = 1 … Tishrei = 7 …
// Adar = 12 (in a leap year 12 = Adar I, 13 = Adar II). The Hebrew year begins
// in Tishrei (month 7).

const HEBREW_EPOCH = -1373428; // calibrated so 1 Jan 2000 = 23 Tevet 5760

// ---- Gregorian helpers -----------------------------------------------------
function isGregLeap(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Absolute day number where 1 Jan 1 (Gregorian) = 1.
export function gregorianToAbsolute(year, month, day) {
  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let n = day;
  for (let m = 0; m < month - 1; m += 1) n += monthDays[m];
  if (month > 2 && isGregLeap(year)) n += 1;
  n +=
    365 * (year - 1) +
    Math.floor((year - 1) / 4) -
    Math.floor((year - 1) / 100) +
    Math.floor((year - 1) / 400);
  return n;
}

export function absoluteToGregorian(abs) {
  let year = Math.floor(abs / 366);
  while (abs >= gregorianToAbsolute(year + 1, 1, 1)) year += 1;
  let month = 1;
  while (abs > gregorianToAbsolute(year, month, daysInGregMonth(month, year))) month += 1;
  const day = abs - gregorianToAbsolute(year, month, 1) + 1;
  return { year, month, day };
}

function daysInGregMonth(month, year) {
  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isGregLeap(year)) return 29;
  return monthDays[month - 1];
}

// ---- Hebrew calendar arithmetic --------------------------------------------
export function hebrewLeapYear(year) {
  return ((7 * year + 1) % 19) < 7;
}

export function hebrewMonthsInYear(year) {
  return hebrewLeapYear(year) ? 13 : 12;
}

// Days from the Hebrew epoch to just before 1 Tishrei of `year`, incorporating
// the molad calculation and the four dechiyot (postponement rules).
function hebrewElapsedDays(year) {
  const monthsElapsed =
    235 * Math.floor((year - 1) / 19) +
    12 * ((year - 1) % 19) +
    Math.floor((7 * ((year - 1) % 19) + 1) / 19);
  const partsElapsed = 204 + 793 * (monthsElapsed % 1080);
  const hoursElapsed =
    5 +
    12 * monthsElapsed +
    793 * Math.floor(monthsElapsed / 1080) +
    Math.floor(partsElapsed / 1080);
  const parts = 1080 * (hoursElapsed % 24) + (partsElapsed % 1080);
  // +1 aligns the molad-day's weekday phase with the dechiyot rules below.
  const day = 29 * monthsElapsed + Math.floor(hoursElapsed / 24) + 1;

  let alt;
  if (
    parts >= 19440 ||
    (day % 7 === 2 && parts >= 9924 && !hebrewLeapYear(year)) ||
    (day % 7 === 1 && parts >= 16789 && hebrewLeapYear(year - 1))
  ) {
    alt = day + 1;
  } else {
    alt = day;
  }

  if (alt % 7 === 0 || alt % 7 === 3 || alt % 7 === 5) return alt + 1;
  return alt;
}

function hebrewDaysInYear(year) {
  return hebrewElapsedDays(year + 1) - hebrewElapsedDays(year);
}
function longCheshvan(year) {
  return hebrewDaysInYear(year) % 10 === 5;
}
function shortKislev(year) {
  return hebrewDaysInYear(year) % 10 === 3;
}

export function hebrewLastDayOfMonth(month, year) {
  if (
    [2, 4, 6, 10, 13].includes(month) ||
    (month === 12 && !hebrewLeapYear(year)) ||
    (month === 8 && !longCheshvan(year)) ||
    (month === 9 && shortKislev(year))
  ) {
    return 29;
  }
  return 30;
}

export function hebrewToAbsolute(year, month, day) {
  let n = day;
  if (month < 7) {
    // months from Tishri to end of year, then Nisan up to (month-1)
    const last = hebrewMonthsInYear(year);
    for (let m = 7; m <= last; m += 1) n += hebrewLastDayOfMonth(m, year);
    for (let m = 1; m < month; m += 1) n += hebrewLastDayOfMonth(m, year);
  } else {
    for (let m = 7; m < month; m += 1) n += hebrewLastDayOfMonth(m, year);
  }
  return n + hebrewElapsedDays(year) + HEBREW_EPOCH - 1;
}

export function absoluteToHebrew(abs) {
  let year = Math.floor((abs - HEBREW_EPOCH) / 366);
  while (hebrewToAbsolute(year + 1, 7, 1) <= abs) year += 1;
  let month = abs < hebrewToAbsolute(year, 1, 1) ? 7 : 1;
  while (abs > hebrewToAbsolute(year, month, hebrewLastDayOfMonth(month, year))) month += 1;
  const day = abs - hebrewToAbsolute(year, month, 1) + 1;
  return { year, month, day };
}

// ---- Public conversion API -------------------------------------------------
// Accepts a JS Date, returns { year, month, day, monthName, dayHeb, yearHeb,
// leap, formatted }.
export function gregorianToHebrew(date = new Date()) {
  const abs = gregorianToAbsolute(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const h = absoluteToHebrew(abs);
  return decorate(h);
}

// Accepts Hebrew { year, month, day }, returns a JS Date.
export function hebrewToGregorian(year, month, day) {
  const abs = hebrewToAbsolute(year, month, day);
  const g = absoluteToGregorian(abs);
  return new Date(g.year, g.month - 1, g.day);
}

function decorate(h) {
  const monthName = hebrewMonthName(h.month, h.year);
  const dayHeb = numberToHebrew(h.day);
  const yearHeb = numberToHebrew(h.year % 1000); // drop the thousands (5786 → תשפ״ו)
  return {
    ...h,
    monthName,
    dayHeb,
    yearHeb,
    formatted: `${dayHeb} ${'ב' + monthName} ${yearHeb}`,
  };
}

// ---- Names & gematria ------------------------------------------------------
export function hebrewMonthName(month, year) {
  const leap = hebrewLeapYear(year);
  const names = {
    1: "ניסן",
    2: "אייר",
    3: "סיון",
    4: "תמוז",
    5: "אב",
    6: "אלול",
    7: "תשרי",
    8: "חשון",
    9: "כסלו",
    10: "טבת",
    11: "שבט",
    12: leap ? "אדר א׳" : "אדר",
    13: "אדר ב׳",
  };
  return names[month] || "";
}

// Convert an integer to its Hebrew-numeral (gematria) string with the proper
// geresh/gershayim punctuation. Handles the 15/16 (טו/טז) special cases.
export function numberToHebrew(num) {
  const hundreds = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];

  let n = num;
  let out = "";
  while (n >= 1000) {
    // very large years: prefix thousands as their own gematria — rarely needed
    out += ones[Math.floor(n / 1000)] || "";
    n %= 1000;
  }
  out += hundreds[Math.floor(n / 100)] || "";
  n %= 100;
  if (n === 15) out += "טו";
  else if (n === 16) out += "טז";
  else {
    out += tens[Math.floor(n / 10)];
    out += ones[n % 10];
  }

  if (out.length === 1) return out + "׳"; // geresh for a single letter
  return out.slice(0, -1) + "״" + out.slice(-1); // gershayim before last letter
}

// Day-of-week name in Hebrew for a JS Date.
export function hebrewWeekday(date = new Date()) {
  const days = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"];
  return days[date.getDay()];
}
