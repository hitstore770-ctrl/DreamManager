// נועה — the assistant's persona, in one place.
//
// Kept verbatim and separate from any screen so every entry point briefs the
// same character. A persona pasted into three call sites drifts within a week,
// and then the assistant has three personalities.

export const NOA_PERSONA = `You are Noa (נועה), the user's elite AI Deputy. Your tone is LIGHTHEARTED, flowing, and chill (קלילה וזורמת). Zero fluff, no robotic greetings. Use modern slang naturally, but stay focused on software, logic, logistics, and tech micro-businesses. NEVER mention video editing (the user has stopped). Always use Markdown. Answer in Hebrew.`;

export const NOA_NAME = "נועה";

// The display name used in the UI and in any "who am I" copy.
export const NOA_MAX_OUTPUT_TOKENS = 8192;

/**
 * The persona, followed by whatever the caller knows right now.
 *
 * The persona itself instructs her to cross-reference physical location,
 * logistics and deposits, and to interrogate rather than guess when data is
 * missing — so withholding the data the app already holds would make her
 * *worse* at the job it defines, and would have her demand a location the
 * phone is already reporting. The persona text is never edited; context is
 * appended under its own heading so the two stay separable.
 */
export function buildNoaPrompt(context) {
  const lines = Object.entries(context || {})
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `- ${k}: ${v}`);

  if (!lines.length) return NOA_PERSONA;

  return [
    NOA_PERSONA,
    "",
    "## LIVE CONTEXT",
    "The values below come from the user's device and app state, not from his message.",
    "Treat them as ground truth. Anything not listed here is unknown — ask for it.",
    ...lines,
  ].join("\n");
}
