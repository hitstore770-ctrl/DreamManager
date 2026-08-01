// {{VARIABLE}} substitution for templates, resolved entirely from the
// device clock -- no network, no stored state beyond "what time is it now".
const VARS = {
  CURRENT_DATE: () => new Date().toLocaleDateString(),
  DATE: () => new Date().toLocaleDateString(),
  CURRENT_TIME: () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  TIME: () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  DATETIME: () => new Date().toLocaleString(),
  YEAR: () => String(new Date().getFullYear()),
  WEEKDAY: () => new Date().toLocaleDateString([], { weekday: "long" }),
};

export const TEMPLATE_VARIABLES = Object.keys(VARS);

// Replaces every {{VAR}} it recognizes; anything else (typos, custom
// markers a user meant literally) is left as-is rather than silently
// dropped.
export function renderTemplate(body) {
  return (body || "").replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (match, key) => (VARS[key] ? VARS[key]() : match));
}
