// Live Google Maps Platform calls: Directions and Places.
//
// This is the transport and parsing layer. NoaTools sits on top of it and
// decides *when* to call; this file decides what a call looks like and what
// comes back. They are separate so the parsers below can be exercised against
// captured response shapes without a network or a key.
//
// THE KEY
// -------
// EXPO_PUBLIC_GOOGLE_SERVICES_KEY is inlined into the JavaScript bundle at
// build time, which means it ships inside the APK and anyone with the file can
// read it. Google bills Directions and Places per request against your card.
// Two things follow, and neither is optional before this reaches anyone else:
// restrict the key to the Android app's package + SHA-1 fingerprint in Cloud
// Console, and set a daily quota cap. An unrestricted Maps key in a shipped
// binary is somebody else's free API.
//
// WHERE THIS RUNS
// ---------------
// On device. The Directions and Places *web services* send no CORS headers, so
// a browser refuses these requests outright — the web export will always fall
// into the error path here, and that is Google's design, not a bug in this
// code. Web needs the Maps JavaScript API's DirectionsService instead, which
// is a different client entirely and not worth carrying for a phone app.

const KEY = process.env.EXPO_PUBLIC_GOOGLE_SERVICES_KEY || "";

const DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";
const PLACES_TEXT_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";

export const isGoogleMapsConfigured = KEY.trim().length > 0;

// Returned instead of data whenever a request cannot be made or comes back
// unusable. It goes straight into the model, so it says plainly that there is
// no result — Noa's brief is to report a failed lookup as a failed lookup, and
// she cannot do that if the payload merely looks empty.
function failure(code, message, extra = {}) {
  return { ok: false, error: code, message, ...extra };
}

const MISSING_KEY = () =>
  failure(
    "NO_API_KEY",
    "No Google API key is configured on this build (EXPO_PUBLIC_GOOGLE_SERVICES_KEY is empty), " +
      "so no live lookup could be made. Tell the user the key is missing — do not estimate an answer."
  );

// Google reports application errors inside a 200 response, so the HTTP status
// alone never tells you whether a call worked.
const STATUS_HELP = {
  ZERO_RESULTS: "Google found no route or place matching that request.",
  NOT_FOUND: "Google could not geocode one of the endpoints.",
  OVER_QUERY_LIMIT: "The API key is over its quota or billing is not enabled.",
  REQUEST_DENIED: "Google rejected the key — it is invalid, or this API is not enabled for it.",
  INVALID_REQUEST: "The request was missing a required parameter.",
  MAX_ROUTE_LENGTH_EXCEEDED: "The route is too long for Google to return.",
};

function buildUrl(base, params) {
  const q = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return `${base}?${q}`;
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    return failure("HTTP_ERROR", `Google returned HTTP ${res.status}.`, { httpStatus: res.status });
  }
  const json = await res.json();
  if (json.status && json.status !== "OK") {
    return failure(
      json.status,
      `${STATUS_HELP[json.status] || "Google returned a non-OK status."}${
        json.error_message ? ` ${json.error_message}` : ""
      }`
    );
  }
  return { ok: true, json };
}

// A place argument is either a name the user typed or a "lat,lon" pair the app
// already holds. Both go to Google verbatim — it geocodes free text and accepts
// coordinates — so this only normalises the coordinate object form.
export function asPlace(value) {
  if (!value) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value.lat === "number" && (typeof value.lon === "number" || typeof value.lng === "number")) {
    return `${value.lat},${value.lon ?? value.lng}`;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Directions
// ---------------------------------------------------------------------------

// Strip Google's inline HTML from a step instruction. The model does not need
// <b> and <div> tags, and they cost tokens on every single step.
function plain(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// The transit summary Noa actually needs: how long, which line, and exactly
// when it leaves.
//
// A full Directions response is tens of kilobytes of polyline and per-step
// HTML. Handing that to the model wastes most of a context window on geometry
// it cannot use, and buries the two facts the question was about. So this
// condenses to the boarding decision and keeps the walking legs only as
// durations.
export function parseTransit(json) {
  const route = json?.routes?.[0];
  const leg = route?.legs?.[0];
  if (!leg) return failure("ZERO_RESULTS", "Google returned no transit route for that pair.");

  const steps = leg.steps || [];
  const rides = steps
    .filter((s) => s.travel_mode === "TRANSIT" && s.transit_details)
    .map((s) => {
      const d = s.transit_details;
      const line = d.line || {};
      return {
        line: line.short_name || line.name || "—",
        operator: line.agencies?.[0]?.name || null,
        vehicle: line.vehicle?.name || line.vehicle?.type || null,
        headsign: d.headsign || null,
        boardingStop: d.departure_stop?.name || null,
        alightStop: d.arrival_stop?.name || null,
        departureTime: d.departure_time?.text || null,
        departureAt: d.departure_time?.value ? new Date(d.departure_time.value * 1000).toISOString() : null,
        arrivalTime: d.arrival_time?.text || null,
        stops: d.num_stops ?? null,
      };
    });

  const walkingSeconds = steps
    .filter((s) => s.travel_mode === "WALKING")
    .reduce((n, s) => n + (s.duration?.value || 0), 0);

  return {
    ok: true,
    mode: "transit",
    origin: leg.start_address || null,
    destination: leg.end_address || null,
    durationMinutes: Math.round((leg.duration?.value || 0) / 60),
    distanceKm: leg.distance?.value ? Math.round(leg.distance.value / 100) / 10 : null,
    departureTime: leg.departure_time?.text || null,
    arrivalTime: leg.arrival_time?.text || null,
    // The one number the user is usually actually asking for.
    nextDeparture: rides[0]
      ? { line: rides[0].line, at: rides[0].departureTime, from: rides[0].boardingStop }
      : null,
    transfers: Math.max(0, rides.length - 1),
    walkingMinutes: Math.round(walkingSeconds / 60),
    rides,
    // Fare sits on the route, not the leg — a detail that is easy to miss and
    // silently returns undefined.
    fare: route.fare ? { amount: route.fare.value, currency: route.fare.currency, text: route.fare.text } : null,
    alternatives: (json.routes || []).length,
  };
}

export function parseRide(json, mode) {
  const route = json?.routes?.[0];
  const leg = route?.legs?.[0];
  if (!leg) return failure("ZERO_RESULTS", "Google returned no route for that pair.");

  return {
    ok: true,
    mode,
    origin: leg.start_address || null,
    destination: leg.end_address || null,
    durationMinutes: Math.round((leg.duration?.value || 0) / 60),
    distanceKm: leg.distance?.value ? Math.round(leg.distance.value / 100) / 10 : null,
    summary: route.summary || null,
    // First few manoeuvres only. The full turn list is long and the user is
    // holding a phone, not reading a route sheet.
    firstSteps: (leg.steps || []).slice(0, 5).map((s) => ({
      instruction: plain(s.html_instructions),
      distance: s.distance?.text || null,
    })),
    warnings: route.warnings?.length ? route.warnings : null,
  };
}

/**
 * A route from Google Directions.
 *
 * `departure_time=now` is what makes a transit result live rather than
 * timetabled — without it Google answers for an unspecified time and the
 * "next bus" is whatever the schedule says in the abstract.
 */
export async function fetchDirections(origin, destination, mode, { signal, alternatives = false } = {}) {
  if (!isGoogleMapsConfigured) return MISSING_KEY();

  const from = asPlace(origin);
  const to = asPlace(destination);
  if (!from || !to) {
    return failure("INVALID_REQUEST", "Both an origin and a destination are required.");
  }

  const url = buildUrl(DIRECTIONS_URL, {
    origin: from,
    destination: to,
    mode,
    // Only transit reads departure_time, but sending it always keeps the call
    // shape identical and Google ignores it for the other modes.
    departure_time: "now",
    alternatives: alternatives ? "true" : undefined,
    language: "he",
    region: "il",
    key: KEY,
  });

  try {
    const res = await getJson(url, signal);
    if (!res.ok) return res;
    return mode === "transit" ? parseTransit(res.json) : parseRide(res.json, mode);
  } catch (e) {
    if (e?.name === "AbortError") return failure("ABORTED", "The lookup was cancelled.");
    return failure("NETWORK", `Could not reach Google: ${e?.message || e}`);
  }
}

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

// Google's text search does not return a distance, so it is computed here from
// the coordinates it does return. Haversine on a sphere is accurate to well
// under a percent at neighbourhood scale, which is far finer than "is this
// worth walking to".
export function distanceMeters(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

function parseCoords(value) {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(String(value || ""));
  return m ? { lat: parseFloat(m[1]), lon: parseFloat(m[2]) } : null;
}

export function parsePlaces(json, around) {
  const results = (json?.results || []).slice(0, 6).map((r) => {
    const loc = r.geometry?.location;
    const there = loc ? { lat: loc.lat, lon: loc.lng } : null;
    return {
      name: r.name,
      address: r.formatted_address || r.vicinity || null,
      openNow: r.opening_hours?.open_now ?? null,
      rating: r.rating ?? null,
      ratingCount: r.user_ratings_total ?? null,
      // Present only when the search was anchored to coordinates; null rather
      // than a guessed number when it was anchored to a place name.
      distanceMeters: around && there ? distanceMeters(around, there) : null,
      status: r.business_status || null,
      types: (r.types || []).slice(0, 3),
    };
  });

  if (!results.length) return failure("ZERO_RESULTS", "Google found no places matching that search.");

  results.sort((a, b) => {
    if (a.distanceMeters == null) return 1;
    if (b.distanceMeters == null) return -1;
    return a.distanceMeters - b.distanceMeters;
  });

  return { ok: true, count: results.length, results };
}

export async function fetchPlaces(query, location, { signal, radiusMeters = 5000 } = {}) {
  if (!isGoogleMapsConfigured) return MISSING_KEY();
  if (!query) return failure("INVALID_REQUEST", "A search query is required.");

  const where = asPlace(location);
  const around = parseCoords(where);

  // Coordinates bias the search through `location` + `radius`; a place *name*
  // cannot, so it goes into the query text where Google can geocode it.
  // Sending a name as `location` is silently ignored, which looks like the
  // search working while quietly ranking by nothing.
  const url = buildUrl(PLACES_TEXT_URL, {
    query: around || !where ? query : `${query} ${where}`,
    location: around ? `${around.lat},${around.lon}` : undefined,
    radius: around ? radiusMeters : undefined,
    language: "he",
    region: "il",
    key: KEY,
  });

  try {
    const res = await getJson(url, signal);
    if (!res.ok) return res;
    return parsePlaces(res.json, around);
  } catch (e) {
    if (e?.name === "AbortError") return failure("ABORTED", "The lookup was cancelled.");
    return failure("NETWORK", `Could not reach Google: ${e?.message || e}`);
  }
}

export const __testing = { buildUrl, plain, parseCoords, failure };
