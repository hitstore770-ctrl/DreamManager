// Speech-to-text via OpenAI Whisper.
//
// SAME SECURITY CAVEAT AS THE GEMINI KEY, AND IT IS WORSE HERE
// -------------------------------------------------------------
// This key ships inside the APK. Anyone can unzip it and take it, and an
// OpenAI key is billed per request against your card with no free tier to
// absorb abuse. Before this app reaches anyone else, the upload belongs behind
// a function you control — the client sends audio to your endpoint, your
// endpoint holds the key.

export const OPENAI_API_KEY =
  process.env.EXPO_PUBLIC_OPENAI_API_KEY || "YOUR_OPENAI_API_KEY";

export const WHISPER_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

// whisper-1 is the transcription endpoint's stable id. Unlike the Gemini
// family it has not been rotated, so a single constant is honest here.
export const WHISPER_MODEL = "whisper-1";

export const isWhisperConfigured =
  typeof OPENAI_API_KEY === "string" &&
  OPENAI_API_KEY.length > 0 &&
  OPENAI_API_KEY !== "YOUR_OPENAI_API_KEY";

/**
 * Transcribe a recorded file.
 *
 * Takes the local URI expo-audio hands back and posts it as multipart form
 * data. The language hint matters: without it Whisper autodetects, and short
 * Hebrew clips with a couple of English tech words in them are regularly
 * detected as English and transliterated into nonsense.
 */
export async function transcribe(uri, { signal, language = "he" } = {}) {
  if (!isWhisperConfigured) {
    return { ok: false, error: "לא הוגדר מפתח OpenAI. הוסף EXPO_PUBLIC_OPENAI_API_KEY לקובץ .env." };
  }
  if (!uri) return { ok: false, error: "לא נמצאה הקלטה." };

  try {
    const form = new FormData();
    // React Native's FormData takes this {uri, name, type} shape rather than a
    // Blob; passing a fetched blob instead works on web and fails on device.
    form.append("file", { uri, name: "speech.m4a", type: "audio/m4a" });
    form.append("model", WHISPER_MODEL);
    form.append("language", language);
    // Nudges spelling of the words this user actually says.
    form.append("prompt", "מכונות ממכר, ייבוא, רחפן, קוד, לוגיסטיקה, תזרים");

    const res = await fetch(WHISPER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        // Content-Type is deliberately unset: fetch has to append the
        // multipart boundary itself, and naming the type here strips it.
      },
      body: form,
      signal,
    });

    const raw = await res.text();
    let json = null;
    try {
      json = JSON.parse(raw);
    } catch {
      /* handled below */
    }

    if (!res.ok) {
      const detail = json?.error?.message || raw.slice(0, 140);
      if (res.status === 401) return { ok: false, error: "מפתח OpenAI לא תקין." };
      if (res.status === 429) return { ok: false, error: "חריגה ממכסת OpenAI. נסה בעוד רגע." };
      return { ok: false, error: `התמלול נכשל (${res.status}). ${detail}` };
    }

    const text = (json?.text || "").trim();
    if (!text) return { ok: false, error: "לא זוהה דיבור בהקלטה." };
    return { ok: true, text };
  } catch (e) {
    if (e?.name === "AbortError") return { ok: false, error: null, aborted: true };
    return { ok: false, error: "אין חיבור לשרת התמלול." };
  }
}
