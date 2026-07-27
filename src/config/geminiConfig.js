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

// Read from .env first (EXPO_PUBLIC_GEMINI_API_KEY), falling back to the
// literal below so the app still runs before a .env exists. Note that an
// EXPO_PUBLIC_ variable is inlined into the bundle at build time — it is not
// a secret either, and the server-side note above still applies.
export const GEMINI_API_KEY =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";

// The model id is a constant so swapping it is a one-line change. Google
// retires and renames these regularly; if a call starts returning 404 with
// "model not found", this is the line to update.
export const GEMINI_MODEL = "gemini-1.5-flash";

export const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// True once a real key has been pasted in, so the UI can say what is wrong
// instead of firing a request that is certain to fail.
export const isGeminiConfigured =
  typeof GEMINI_API_KEY === "string" &&
  GEMINI_API_KEY.length > 0 &&
  GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY";
