import { callGemini } from "../config/geminiConfig";

// The three action buttons under Noa's chat, re-derived after every turn.
//
// This is a second, deliberately tiny call rather than something squeezed out
// of the main answer. Asking the persona to append a JSON block to a
// conversational reply corrupts the reply — she is instructed to write
// long-form Markdown, and a machine-readable tail is exactly the kind of thing
// that leaks into the prose when the model is busy being chatty.
//
// It runs detached: if it fails, times out, or comes back malformed, the
// previous shortcuts stay on screen. Nothing about the chat depends on it.

const DEFAULTS = [
  { label: "מסלול לפנימייה", prompt: "מה הדרך הכי מהירה מהמיקום שלי לפנימייה עכשיו?" },
  { label: "סרוק רכיב", action: "scan" },
  { label: "תזרים החודש", prompt: "תעברי על התזרים של החודש ותגידי לי מה בולט." },
];

export const DEFAULT_SHORTCUTS = DEFAULTS;

const SYSTEM = [
  "You generate exactly three short quick-action buttons for a Hebrew chat app.",
  "Base them on where the conversation just got to — the next thing this user would plausibly tap.",
  "",
  "Rules:",
  '- Reply with ONLY a JSON array. No prose, no markdown fence.',
  '- Each item: {"label": "<2-4 Hebrew words>", "prompt": "<the Hebrew question tapping it should ask>"}',
  '- For an action the app performs rather than asks, use {"label": ..., "action": "scan"} for the camera.',
  "- Labels must be under 22 characters. Longer ones are cut off on screen.",
  "- Never repeat a label already listed as current.",
].join("\n");

function parseShortcuts(text) {
  if (!text) return null;
  // The model wraps JSON in a fence often enough to be worth handling rather
  // than discarding an otherwise good response.
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;

    const clean = parsed
      .filter((x) => x && typeof x.label === "string" && x.label.trim())
      .map((x) => ({
        label: x.label.trim().slice(0, 22),
        prompt: typeof x.prompt === "string" ? x.prompt.trim() : undefined,
        action: x.action === "scan" ? "scan" : undefined,
      }))
      // A button that neither asks anything nor does anything is a dead
      // control; drop it rather than render it.
      .filter((x) => x.prompt || x.action)
      .slice(0, 3);

    return clean.length ? clean : null;
  } catch {
    return null;
  }
}

/**
 * Suggest three shortcuts from the tail of the conversation.
 *
 * Returns null on any failure, which the caller reads as "keep what you have".
 */
export async function suggestShortcuts(messages, current = [], { signal } = {}) {
  // Only the last few turns matter, and sending the whole history would cost
  // more than the answer it produces.
  const tail = (messages || []).slice(-4).map((m) => `${m.role === "user" ? "U" : "N"}: ${m.text}`.slice(0, 400));
  if (!tail.length) return null;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Conversation so far:",
              ...tail,
              "",
              `Current buttons: ${current.map((c) => c.label).join(", ") || "none"}`,
              "",
              "Three new buttons, JSON array only:",
            ].join("\n"),
          },
        ],
      },
    ],
    // Low temperature and a tight cap: this is a formatting job, not a
    // creative one, and a long reply here is always a malformed one.
    generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
  };

  try {
    const res = await callGemini(body, { signal });
    if (!res.ok) return null;
    const text = res.json?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") || "";
    return parseShortcuts(text);
  } catch {
    return null;
  }
}
