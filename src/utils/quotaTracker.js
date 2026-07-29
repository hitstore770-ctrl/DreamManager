import { readPersistent, writePersistent } from "./usePersistentState";

// What this app has spent on Gemini.
//
// EXACT ABOUT WHAT IT MEASURES, HONEST ABOUT WHAT IT CANNOT SEE
// -------------------------------------------------------------
// The token counts here are not estimated from character length. Every Gemini
// response carries a `usageMetadata` block with the prompt, candidate and
// total token counts the API actually billed, and that is what gets recorded.
// For calls this app made, the numbers are exact.
//
// Three things it genuinely cannot know, and the payload says so rather than
// letting a confident-looking total imply otherwise:
//
//   • Usage from anywhere else on the same key — another device, another app,
//     the AI Studio console. There is no billing API being read here.
//   • Anything from before this store existed, or after the user clears data.
//   • The account's real ceiling. Rate limits differ per model and per tier
//     and Google changes them; guessing one and reporting "you have 400 left"
//     would be a fabricated number the user then plans around. So a limit is
//     reported only when it has been configured, and otherwise reported as
//     unknown.
//
// What is always useful regardless of the ceiling is the *rate* — requests and
// tokens in the last minute — because that is what a per-minute limit bites
// on, and it is measurable without knowing the limit.

const KEY = "@dreammanager/gemini-quota";

// Keep enough recent calls to compute a per-minute rate without the record
// growing without bound over a long session.
const WINDOW_MAX = 240;

// Set these to the figures on your own Google AI Studio quota page. Null means
// "not configured", and checkQuota then says so instead of inventing a
// ceiling. They are env vars rather than constants so the number can be
// corrected without a code change when Google moves it.
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const QUOTA_LIMITS = {
  requestsPerDay: num(process.env.EXPO_PUBLIC_GEMINI_RPD_LIMIT),
  requestsPerMinute: num(process.env.EXPO_PUBLIC_GEMINI_RPM_LIMIT),
  tokensPerMinute: num(process.env.EXPO_PUBLIC_GEMINI_TPM_LIMIT),
};

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const EMPTY = {
  day: null,
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  byModel: {},
  window: [], // [{ at, tokens }]
};

// Session figures live in memory only: "this session" ends when the process
// does, so persisting them would make a relaunch look like a continuation.
const session = { startedAt: Date.now(), requests: 0, totalTokens: 0 };

let state = null;
let loading = null;

async function load() {
  if (state) return state;
  if (!loading) {
    loading = (async () => {
      const stored = await readPersistent(KEY, null);
      const today = todayKey();
      // A stored day that is not today is spent — the daily allowance resets
      // at midnight, so carrying yesterday's total forward would understate
      // what is left all of the next day.
      state = stored && stored.day === today ? { ...EMPTY, ...stored } : { ...EMPTY, day: today };
      return state;
    })();
  }
  return loading;
}

/**
 * Record one completed Gemini call.
 *
 * `usageMetadata` is Gemini's own accounting, straight off the response. A
 * response without it (an error, or a model that omits the block) records the
 * request but no tokens, which is better than back-filling a guess that would
 * then be indistinguishable from a measurement.
 */
export async function recordUsage(usageMetadata, model) {
  const s = await load();

  const today = todayKey();
  if (s.day !== today) {
    state = { ...EMPTY, day: today };
  }

  const input = Number(usageMetadata?.promptTokenCount) || 0;
  const output = Number(usageMetadata?.candidatesTokenCount) || 0;
  const total = Number(usageMetadata?.totalTokenCount) || input + output;

  const now = Date.now();
  const perModel = state.byModel[model] || { requests: 0, totalTokens: 0 };

  state = {
    ...state,
    requests: state.requests + 1,
    inputTokens: state.inputTokens + input,
    outputTokens: state.outputTokens + output,
    totalTokens: state.totalTokens + total,
    byModel: {
      ...state.byModel,
      [model || "unknown"]: { requests: perModel.requests + 1, totalTokens: perModel.totalTokens + total },
    },
    window: [...state.window, { at: now, tokens: total }].slice(-WINDOW_MAX),
    measured: !!usageMetadata,
  };

  session.requests += 1;
  session.totalTokens += total;

  await writePersistent(KEY, state);
  return state;
}

/**
 * Everything known about consumption right now.
 *
 * Shaped for a language model to read out loud: every number is labelled, and
 * anything unmeasured is null rather than zero. Null and zero mean very
 * different things to someone asking how much they have left.
 */
export async function quotaSnapshot() {
  const s = await load();
  const now = Date.now();

  const lastMinute = (s.window || []).filter((w) => now - w.at < 60000);
  const requestsLastMinute = lastMinute.length;
  const tokensLastMinute = lastMinute.reduce((n, w) => n + w.tokens, 0);

  const remaining = (limit, used) => (limit == null ? null : Math.max(0, limit - used));
  const pct = (limit, used) => (limit == null ? null : Math.min(100, Math.round((used / limit) * 100)));

  return {
    ok: true,
    measuredFrom: "Gemini usageMetadata on every response — exact token counts, not an estimate.",

    today: {
      date: s.day,
      requests: s.requests,
      inputTokens: s.inputTokens,
      outputTokens: s.outputTokens,
      totalTokens: s.totalTokens,
    },

    session: {
      startedAt: new Date(session.startedAt).toISOString(),
      requests: session.requests,
      totalTokens: session.totalTokens,
    },

    rateNow: {
      requestsLastMinute,
      tokensLastMinute,
    },

    byModel: s.byModel,

    limits: {
      requestsPerDay: QUOTA_LIMITS.requestsPerDay,
      requestsPerMinute: QUOTA_LIMITS.requestsPerMinute,
      tokensPerMinute: QUOTA_LIMITS.tokensPerMinute,
      configured: Object.values(QUOTA_LIMITS).some((v) => v != null),
    },

    remaining: {
      requestsToday: remaining(QUOTA_LIMITS.requestsPerDay, s.requests),
      requestsThisMinute: remaining(QUOTA_LIMITS.requestsPerMinute, requestsLastMinute),
      tokensThisMinute: remaining(QUOTA_LIMITS.tokensPerMinute, tokensLastMinute),
      percentOfDailyRequests: pct(QUOTA_LIMITS.requestsPerDay, s.requests),
    },

    // Read out loud by Noa when she is asked. Stated as instructions rather
    // than as prose so she does not paraphrase the caveat away.
    limitations: [
      "These totals cover only requests this app made on this device.",
      "Usage from another device, another app, or the AI Studio console on the same key is NOT included.",
      Object.values(QUOTA_LIMITS).some((v) => v != null)
        ? "The limits below were configured by the user, not read from Google."
        : "No quota ceiling is configured, so there is no 'remaining' figure. Report the usage and the rate, say plainly that the ceiling is unknown, and mention it can be set with EXPO_PUBLIC_GEMINI_RPD_LIMIT / RPM / TPM. Do NOT guess a limit.",
      "Daily figures reset at local midnight.",
    ],
  };
}

export async function resetQuota() {
  state = { ...EMPTY, day: todayKey() };
  session.requests = 0;
  session.totalTokens = 0;
  session.startedAt = Date.now();
  await writePersistent(KEY, state);
  return state;
}

// For a screen that wants the raw figures without the model-facing shape.
export async function rawQuota() {
  return { ...(await load()) };
}
