import { NOA_TOOLS, runNoaTool } from "./NoaTools";
import { apiKey, hasApiKey } from "./apiKeys";
import { recordUsage } from "../utils/quotaTracker";

// Gemini REST configuration, kept in one file so the key has exactly one home.
//
// SECURITY, READ THIS BEFORE SHIPPING
// -----------------------------------
// A key placed here is compiled into the JS bundle and ships inside the APK.
// Anyone can unzip the APK, grep the bundle and take it — obfuscation does not
// help, since the running app must send the key in clear to Google. A taken key
// is billed to this project until it is revoked.
//
// That is acceptable while testing on your own device. Before the app reaches
// anyone else, move the call behind a server you control — a Firebase Cloud
// Function is the smallest step, since Firebase is already wired up here:
//
//   exports.askGemini = onCall(async (req) => {
//     // key lives in the function's environment, never in the client
//     const r = await fetch(`${ENDPOINT}?key=${process.env.GEMINI_KEY}`, ...);
//     return r.json();
//   });
//
// Then the app calls the function and the key never leaves the server. At that
// point Firestore rules also let you require a signed-in user, which stops a
// stranger from spending your quota.

// Read from Settings first (saved in the device keystore), then .env
// (EXPO_PUBLIC_GEMINI_API_KEY), falling back to a placeholder so the app
// still runs before either exists. Called fresh on every request rather than
// read once — that is what lets a key typed into Settings take effect
// immediately, with no rebuild and no app restart. Note that an EXPO_PUBLIC_
// variable is inlined into the bundle at build time — it is not a secret
// either, and the server-side note above still applies.
export const geminiKey = () => apiKey("gemini") || "YOUR_GEMINI_API_KEY";

// MODEL IDS ARE NOT STABLE
// ------------------------
// Google retires model ids on a schedule, and a retired id fails with a 404
// reading "is not found for API version v1beta, or is not supported for
// generateContent". That is what happened to gemini-1.5-flash, which this file
// used to name: the whole 1.5 family was withdrawn from the API, and the
// "-latest" aliases went with it — they resolve to the same removed models, so
// gemini-1.5-flash-latest returns the identical 404.
//
// So this is a list rather than a constant, tried in order. Newest first, with
// the older ids kept at the tail: if a key or region only serves one of them,
// the app finds it instead of failing outright. The first id that answers is
// remembered for the rest of the session, so this costs one wasted request per
// launch at most, and nothing once a working model is known.
export const GEMINI_MODELS = [
  "gemini-3.6-flash", // המודל המוביל והעדכני
  // Same model, the alias form. Which spelling an endpoint accepts is not
  // consistent across model families, so both are tried before falling back a
  // generation — that is cheaper than guessing which one this key wants.
  "gemini-3.6-flash-latest",
  "gemini-2.0-flash", // גיבוי בלבד
];
// Kept for anything that wants to name the preferred model in a message.
export const GEMINI_MODEL = GEMINI_MODELS[0];

// Re-exported so a screen imports its toolkit from the same place it imports
// the transport, rather than reaching into two modules to make one call.
export { NOA_TOOLS };

export const endpointFor = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export const GEMINI_ENDPOINT = endpointFor(GEMINI_MODEL);

// True once a real key exists — saved in Settings or from the build — so the
// UI can say what is wrong instead of firing a request that is certain to
// fail. A function, not a value: a key saved in Settings after launch must
// flip this without a reload.
export const isGeminiConfigured = () => hasApiKey("gemini");

// The model that last answered successfully. Module-level, so every screen
// shares one discovery rather than each paying for its own.
let resolvedModel = null;

export const getResolvedModel = () => resolvedModel;

// Is this response a "that model does not exist here" rejection, as opposed to
// a bad key or a rate limit? Only those are worth retrying on another model —
// retrying a 429 across four ids would just burn the quota four times.
function isModelMissing(status, detail) {
  if (status !== 404 && status !== 400) return false;
  return /not found|not supported|unsupported|does not exist/i.test(detail || "");
}

/**
 * POST a generateContent body, walking the model list until one answers.
 *
 * Returns the parsed JSON plus the model that served it, or a structured
 * failure. Callers get one shape to handle whichever model ends up used.
 */
export async function callGemini(body, { signal } = {}) {
  // A known-good model goes first; the rest stay as backup in case it is
  // retired mid-session too.
  const order = resolvedModel
    ? [resolvedModel, ...GEMINI_MODELS.filter((m) => m !== resolvedModel)]
    : GEMINI_MODELS;

  let lastStatus = 0;
  let lastDetail = "";

  for (const model of order) {
    const res = await fetch(`${endpointFor(model)}?key=${geminiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    // Read once as text: an HTML error page from a proxy would otherwise blow
    // up JSON.parse with a message that hides the real status.
    const raw = await res.text();
    let json = null;
    try {
      json = JSON.parse(raw);
    } catch {
      /* leave null; handled by the caller via `detail` */
    }

    if (res.ok) {
      resolvedModel = model;
      // Gemini's own accounting, straight off the response. Recorded here
      // rather than at the call sites so nothing can consume quota without
      // being counted — including the tool round-trips and the background
      // shortcut suggestions, which are easy to forget and add up.
      recordUsage(json?.usageMetadata, model).catch(() => {});
      return { ok: true, json, model };
    }

    lastStatus = res.status;
    lastDetail = json?.error?.message || raw.slice(0, 140);

    // Anything that is not "no such model" is a real failure — surface it
    // rather than hiding it behind three more identical rejections.
    if (!isModelMissing(res.status, lastDetail)) break;
    if (resolvedModel === model) resolvedModel = null;
  }

  return { ok: false, status: lastStatus, detail: lastDetail, triedAll: true };
}

/**
 * A full turn with tools available.
 *
 * The model is offered the toolkit and decides for itself whether to use it.
 * If it answers in prose, that prose comes straight back — one round trip, no
 * tool touched. If it asks for a function, the function runs, its result goes
 * back as a functionResponse, and the model writes its answer from that.
 *
 * Returns { ok, text, model, toolsUsed } so the caller does not have to know
 * whether a tool was involved.
 */
export async function callGeminiWithTools(base, { tools, signal, maxRounds = 3 } = {}) {
  // AUTO is the entire reason Noa stays a general assistant. It leaves the
  // decision with the model, which is what lets "explain closures in
  // JavaScript" come back as prose while "when is the next bus" reaches for
  // getTransitRoute. ANY would force a call on every single turn — including
  // the ones that are just conversation — and NONE would make the toolkit
  // decorative. It is stated explicitly rather than left to the default so
  // that nobody later "fixes" it to ANY.
  const body = {
    ...base,
    tools,
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
  };

  const contents = [...(base.contents || [])];
  const toolsUsed = [];
  let model;

  for (let round = 0; round < maxRounds; round += 1) {
    const res = await callGemini({ ...body, contents }, { signal });
    if (!res.ok) return { ...res, toolsUsed };

    model = res.model;
    const candidate = res.json?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

    // No function call: this is the answer. The overwhelmingly common path.
    if (!calls.length) {
      const text = parts.map((p) => p.text).filter(Boolean).join("");
      return { ok: true, text, model, toolsUsed, json: res.json };
    }

    // The model's own turn has to go back verbatim — it carries the call ids
    // the API matches the responses against.
    contents.push(candidate.content);

    // Gemini may request several tools in one turn; run them together rather
    // than serially, since none of them depend on each other.
    const responses = await Promise.all(
      calls.map(async (call) => {
        toolsUsed.push(call.name);
        const result = await runNoaTool(call.name, call.args);
        return { functionResponse: { name: call.name, response: result } };
      })
    );

    // Function results are sent back on a `user` turn. The REST API has only
    // `user` and `model` roles — there is no `function` role to put these on.
    contents.push({ role: "user", parts: responses });
  }

  // Ran out of rounds — the model kept asking for tools. Better to say so than
  // to loop forever burning quota.
  return {
    ok: false,
    status: 0,
    detail: `המודל ביקש כלים ${maxRounds} פעמים ברצף ולא סיים תשובה.`,
    model,
    toolsUsed,
  };
}

/**
 * Ask the API which models this key can actually call. Purely diagnostic: when
 * every id in the list is rejected, this answers "then what *is* available?"
 * without needing a guess from outside the app.
 */
export async function listGeminiModels() {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey()}`
    );
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json?.error?.message || `HTTP ${res.status}` };
    const names = (json.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
    return { ok: true, models: names };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
