import AsyncStorage from "@react-native-async-storage/async-storage";

import { callGemini, isGeminiConfigured } from "../config/geminiConfig";

// The storage and network half of a contextual AI thread, kept out of the
// screen so the screen stays about rendering.

// One key per item. Two dreams never share a thread, which is the whole point:
// the co-pilot for "buy a van" must not see the conversation about "finish the
// course".
export const threadKey = (threadId) => `@ai_thread_${threadId}`;

export async function loadThread(threadId) {
  try {
    const raw = await AsyncStorage.getItem(threadKey(threadId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // A corrupted or hand-edited value must not crash the screen on open.
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveThread(threadId, messages) {
  try {
    await AsyncStorage.setItem(threadKey(threadId), JSON.stringify(messages));
    return true;
  } catch {
    // Out of space, or storage unavailable. The conversation stays usable in
    // memory; the caller decides whether to tell the user.
    return false;
  }
}

export async function clearThread(threadId) {
  try {
    await AsyncStorage.removeItem(threadKey(threadId));
  } catch {
    /* nothing useful to do */
  }
}

// ---------------------------------------------------------------------------
// The system prompt
// ---------------------------------------------------------------------------

// Everything the model is told about the item, built fresh on every send so
// edits to the dream show up in the next answer rather than at next launch.
export function buildSystemPrompt(itemData) {
  // itemData arrives as an object or as a JSON string, depending on how the
  // caller passed it through navigation params.
  let data = itemData;
  if (typeof itemData === "string") {
    try {
      data = JSON.parse(itemData);
    } catch {
      data = { raw: itemData };
    }
  }

  return [
    "You are an AI co-pilot dedicated strictly to helping the user with this specific item.",
    `Here is the exact data for this item: ${JSON.stringify(data)}.`,
    "Use this data to give highly specific, actionable advice on how to achieve or manage it.",
    "",
    "Rules:",
    "- Answer in Hebrew unless the user writes to you in another language.",
    "- Refer to the real numbers in the data. Do not invent facts that are not there.",
    "- Keep answers short and concrete. Prefer a next step over a lecture.",
    "- Stay on this item. If asked about something unrelated, say so briefly and steer back.",
    "- If the user asks for a visual or an image, reply EXACTLY with:",
    "  [IMAGE: detailed prompt in english]",
    "  and nothing else on that line.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// The call
// ---------------------------------------------------------------------------

// Gemini wants alternating user/model turns, and rejects a history that starts
// with a model turn — which is exactly what a stored thread looks like if the
// first thing shown was a greeting. Drop leading model turns before sending.
function toGeminiContents(messages) {
  const turns = messages
    .filter((m) => m.role === "user" || m.role === "model")
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

export async function askGemini({ messages, itemData, signal }) {
  if (!isGeminiConfigured) {
    return {
      ok: false,
      reason: "no-key",
      error: "לא הוגדר מפתח Gemini. הדבק מפתח בקובץ src/config/geminiConfig.js.",
    };
  }

  const body = {
    systemInstruction: { parts: [{ text: buildSystemPrompt(itemData) }] },
    contents: toGeminiContents(messages),
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  };

  try {
    // callGemini walks the model list, so a retired model id is handled here
    // rather than surfacing as a 404 the user has to decode.
    const res = await callGemini(body, { signal });

    if (!res.ok) {
      return {
        ok: false,
        reason: `http-${res.status}`,
        error: describeHttp(res.status, res.detail),
      };
    }

    const { json } = res;
    const candidate = json?.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join("") || "";

    if (!text) {
      // A blocked or empty completion is a normal outcome, not an exception.
      const blocked = candidate?.finishReason || json?.promptFeedback?.blockReason;
      return {
        ok: false,
        reason: "empty",
        error:
          blocked === "SAFETY" || blocked === "PROHIBITED_CONTENT"
            ? "התשובה נחסמה על ידי מסנני הבטיחות של Gemini. נסח את השאלה אחרת."
            : "המודל החזיר תשובה ריקה. נסה שוב.",
      };
    }

    return { ok: true, text };
  } catch (e) {
    if (e?.name === "AbortError") return { ok: false, reason: "aborted", error: null };
    return {
      ok: false,
      reason: "network",
      error: "אין חיבור לשרת. בדוק את האינטרנט ונסה שוב.",
    };
  }
}

function describeHttp(status, detail) {
  if (status === 400 && /API key not valid/i.test(detail)) {
    return "מפתח ה-API לא תקין. בדוק אותו בקובץ geminiConfig.js.";
  }
  if (status === 403) return "המפתח נדחה. ודא שה-Generative Language API מופעל בפרויקט.";
  // Reaching here on a 404 means every id in GEMINI_MODELS was rejected, not
  // that one name is stale — so the message asks for the list, not for an edit.
  if (status === 404) {
    return "אף אחד מהמודלים ברשימה לא זמין למפתח הזה. עדכן את GEMINI_MODELS בקובץ geminiConfig.js.";
  }
  if (status === 429) return "חריגה ממכסת הבקשות. המתן דקה ונסה שוב.";
  if (status >= 500) return "שגיאת שרת אצל Google. נסה שוב בעוד רגע.";
  return `הבקשה נכשלה (${status}). ${detail}`;
}

// ---------------------------------------------------------------------------
// Image interception
// ---------------------------------------------------------------------------

const IMAGE_TAG = /\[IMAGE:\s*([^\]]+)\]/i;

// Splits a reply into the parts around an [IMAGE: ...] tag. Returning the
// surrounding text as well means a model that adds a sentence before or after
// the tag still renders sensibly instead of losing the words.
export function parseImageReply(text) {
  const match = IMAGE_TAG.exec(text || "");
  if (!match) return { hasImage: false, text };
  const prompt = match[1].trim();
  const before = text.slice(0, match.index).trim();
  const after = text.slice(match.index + match[0].length).trim();
  return {
    hasImage: true,
    prompt,
    text: [before, after].filter(Boolean).join("\n\n"),
    url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`,
  };
}
