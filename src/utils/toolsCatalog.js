import { BUILT_TOOL_IDS } from "../components/tools/registry";

// The Tools hub catalogue: four categories, and every entry opens a real tool.
//
// This was a 147-entry directory in which roughly ninety tiles reported
// "coming soon". Those are gone — a grid that is mostly dead ends is worse
// than a smaller one where every tile works. Development tools are gone too:
// code is not written in this app.
//
// Three business-only tools — till count, machine stock forecast and machine
// ROI — moved to the "העסק שלי" tab, where the rest of the register lives.

export const TOOL_CATEGORIES = [
  {
    key: "vehicles",
    label: "מכונות ורכבים",
    icon: "truck",
    color: "#10B981",
    tools: [
      { id: "coin-float", name: "מחשבון עודף מדויק", icon: "circle" },
      { id: "power-load", name: "עומס חשמל רכיבים", icon: "battery-charging" },
      { id: "ohms-law", name: "חוק אוהם לחומרה", icon: "zap" },
      { id: "fuel-cost", name: "עלות דלק לנסיעה", icon: "credit-card" },
      { id: "car-depreciation", name: "ירידת ערך רכב", icon: "trending-down" },
      { id: "route-planner", name: "הערכת מסלול חלוקה", icon: "map" },
      { id: "loan-calc", name: "מחשבון הלוואות ומימון", icon: "credit-card" },
      { id: "transit-load", name: "מחשבון עומס רכב", icon: "truck" },
    ],
  },
  {
    key: "production",
    label: "הפקה ורחפנים",
    icon: "film",
    color: "#EF4444",
    tools: [
      { id: "video-size", name: "מחשבון גודל וידאו", icon: "hard-drive" },
      { id: "drone-flight", name: "זמן אוויר לרחפן", icon: "wind" },
      { id: "timelapse-calc", name: "מחשבון טיימלאפס", icon: "clock" },
      { id: "aspect-ratio", name: "יחס מידות מסך", icon: "crop" },
      { id: "storage-conv", name: "ממיר נפח דיגיטלי", icon: "database" },
      { id: "fps-slowmo", name: "מחשבון סלו-מושן", icon: "film" },
    ],
  },
  {
    key: "money",
    label: "שיווק ופיננסים",
    icon: "trending-up",
    color: "#7C3AED",
    tools: [
      { id: "qr-gen", name: "מחולל QR", icon: "grid" },
      { id: "wa-direct", name: "וואטסאפ ללא שמירה", icon: "message-circle" },
      { id: "ai-image", name: "מחולל תמונות AI", icon: "image" },
      { id: "roas", name: "החזר השקעה בפרסום", icon: "target" },
      { id: "vat-calc", name: "מע״מ והנחה אקספרס", icon: "percent" },
      { id: "margin-calc", name: "מחשבון מתח רווחים", icon: "trending-up" },
      { id: "discount-calc", name: "מחשבון הנחות", icon: "tag" },
      { id: "markup-margin", name: "מארק-אפ מול מתח רווח", icon: "git-compare" },
      { id: "vat-extract", name: "חילוץ מע״מ", icon: "percent" },
      { id: "rule-72", name: "כלל ה-72 להשקעות", icon: "trending-up" },
      { id: "discount-stack", name: "כפל מבצעים", icon: "layers" },
      { id: "percent-calc", name: "פערי אחוזים", icon: "percent" },
      { id: "ali-import", name: "מחשבון ייבוא אליאקספרס", icon: "package" },
      { id: "prompt-builder", name: "מחולל פרומפטים AI", icon: "message-square" },
    ],
  },
  {
    key: "personal",
    label: "אישי ופנימייה",
    icon: "user",
    color: "#06B6D4",
    tools: [
      { id: "expense-split", name: "מפצל הוצאות חדר", icon: "users" },
      { id: "license-tracker", name: "מעקב הוצאות רישיון", icon: "credit-card" },
      { id: "pomodoro", name: "טיימר פומודורו", icon: "clock" },
      { id: "calorie-density", name: "מדד נפח קלורי", icon: "nutrition-outline" },
      { id: "study-split", name: "מתכנן קצב למידה", icon: "trending-up" },
      { id: "world-clock", name: "ממיר שעות עולמי", icon: "globe" },
      { id: "tip-split", name: "חשבון מסעדה עם טיפ", icon: "divide" },
      { id: "tip-quick", name: "מחשבון טיפים", icon: "percent" },
      { id: "tts", name: "הקראת טקסט", icon: "volume-2" },
      { id: "password-gen", name: "מחולל סיסמאות", icon: "key" },
      { id: "age-days", name: "גיל בימים", icon: "calendar" },
      { id: "scrambler", name: "מערבל אותיות", icon: "shuffle" },
      { id: "zmanim-routine", name: "זמני היום ושגרה", icon: "sunset" },
      { id: "random-picker", name: "גלגל החלטות", icon: "shuffle" },
      { id: "text-counter", name: "ספירת מילים ותווים", icon: "type" },
    ],
  },
];

// Tool ids that open a real mini-app. Derived from the registry rather than
// hand-maintained, so this set can never claim a tool the sheet cannot open.
export const IMPLEMENTED = new Set(BUILT_TOOL_IDS);

// Flat list for search + counting.
export const ALL_TOOLS = TOOL_CATEGORIES.flatMap((cat) =>
  cat.tools.map((t) => ({ ...t, categoryKey: cat.key, categoryLabel: cat.label, color: cat.color }))
);

export const TOOL_COUNT = ALL_TOOLS.length;

export const toolById = (id) => ALL_TOOLS.find((t) => t.id === id) || null;
