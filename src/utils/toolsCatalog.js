import { BUILT_TOOL_IDS } from "../components/tools/registry";

// The Tools super-hub catalog: 8 categories of utilities.
// A tool opens a real mini-app when its id is wired in the tool registry;
// everything else is catalogued UI that reports "coming soon" instead of
// crashing.
//
// Scope note: electric-scooter, drone and A5-sticker/printer tooling was
// removed in the hub refactor — this business no longer covers them. Vending
// covers drinks machines only (no bubblegum/capsule machines).

export const TOOL_CATEGORIES = [
  {
    key: "vending",
    label: "מכונות שתייה וטרנזיט",
    icon: "shopping-cart",
    color: "#10B981",
    tools: [
      { id: "vending-roi", name: "החזר השקעה למכונה", icon: "trending-up" },
      { id: "can-profit", name: "רווח לפחית", icon: "dollar-sign" },
      { id: "restock-planner", name: "מתכנן מילוי מלאי", icon: "package" },
      { id: "machine-uptime", name: "מעקב תקינות מכונה", icon: "activity" },
      { id: "coin-float", name: "עודף ומטבעות במכונה", icon: "circle" },
      { id: "cooling-cost", name: "עלות קירור וחשמל", icon: "snow-outline" },
      { id: "expiry-track", name: "מעקב תפוגה", icon: "calendar" },
      { id: "location-score", name: "ניקוד מיקום למכונה", icon: "map-pin" },
      { id: "transit-time", name: "זמן נסיעה בין מכונות", icon: "clock" },
      { id: "transit-cost", name: "עלות נסיעות שבועית", icon: "credit-card" },
      { id: "transit-load", name: "מחשבון עומס טרנזיט", icon: "truck" },
      { id: "route-planner", name: "מסלול סבב מכונות", icon: "map" },
      { id: "best-sellers", name: "המשקאות הנמכרים", icon: "award" },
      { id: "price-tuning", name: "כיוונון מחירים", icon: "sliders" },
      { id: "supplier-compare", name: "השוואת ספקים", icon: "git-compare" },
      { id: "machine-log", name: "יומן תקלות וטיפולים", icon: "tool" },
    ],
  },
  {
    key: "dev",
    label: "פיתוח קוד ובינה מלאכותית",
    icon: "code",
    color: "#7C3AED",
    tools: [
      { id: "rn-ui-gen", name: "מחולל עיצוב RN", icon: "layout" },
      { id: "json-validator", name: "בודק JSON", icon: "code" },
      { id: "regex-tester", name: "בודק Regex", icon: "search" },
      { id: "base64", name: "Base64 קידוד/פענוח", icon: "hash" },
      { id: "uuid-gen", name: "מחולל UUID", icon: "key" },
      { id: "hex-color", name: "בורר צבעים HEX", icon: "droplet" },
      { id: "flex-playground", name: "מגרש Flexbox", icon: "columns" },
      { id: "expo-doctor", name: "צ׳קליסט Expo", icon: "check-square" },
      { id: "token-counter", name: "ספירת טוקנים", icon: "type" },
      { id: "api-tester", name: "בודק API", icon: "server" },
      { id: "jwt-decode", name: "פענוח JWT", icon: "unlock" },
      { id: "diff-text", name: "השוואת קוד", icon: "git-merge" },
      { id: "model-compare", name: "השוואת מודלים", icon: "cpu" },
      { id: "cost-per-call", name: "עלות קריאת AI", icon: "dollar-sign" },
      { id: "error-decoder", name: "מפענח שגיאות", icon: "alert-octagon" },
    ],
  },
  {
    key: "video",
    label: "עריכת וידאו ומושן",
    icon: "film",
    color: "#EF4444",
    tools: [
      { id: "video-size", name: "מחשבון גודל וידאו", icon: "hard-drive" },
      { id: "fps-slowmo", name: "מחשבון סלו-מושן", icon: "film" },
      { id: "aspect-ratio", name: "יחסי מסך", icon: "crop" },
      { id: "bitrate-calc", name: "מחשבון Bitrate", icon: "bar-chart-2" },
      { id: "render-time", name: "הערכת זמן רינדור", icon: "clock" },
      { id: "export-preset", name: "פריסטים לייצוא", icon: "upload" },
      { id: "shot-list", name: "רשימת שוטים", icon: "list" },
      { id: "audio-sync", name: "סנכרון אודיו", icon: "mic" },
      { id: "transition-ideas", name: "רעיונות למעברים", icon: "shuffle" },
      { id: "color-lut", name: "מדריך LUT וצבע", icon: "droplet" },
      { id: "subtitle-timing", name: "תזמון כתוביות", icon: "message-square" },
      { id: "reel-length", name: "אורך ריל אידיאלי", icon: "smartphone" },
      { id: "hook-writer", name: "כתיבת הוק לפתיחה", icon: "anchor" },
      { id: "music-bpm", name: "התאמת BPM לחיתוך", icon: "music" },
      { id: "storage-plan", name: "תכנון אחסון פרויקט", icon: "database" },
    ],
  },
  {
    key: "import",
    label: "ייבוא ואליאקספרס",
    icon: "package",
    color: "#D4820A",
    tools: [
      { id: "ali-import", name: "מחשבון ייבוא אליאקספרס", icon: "shopping-cart" },
      { id: "customs-calc", name: "מחשבון מכס ומיסים", icon: "shield" },
      { id: "usd-ils", name: "המרת דולר לשקל", icon: "repeat" },
      { id: "shipping-compare", name: "השוואת שיטות משלוח", icon: "truck" },
      { id: "delivery-eta", name: "זמן הגעה משוער", icon: "calendar" },
      { id: "supplier-rating", name: "ניקוד ספק", icon: "star" },
      { id: "moq-calc", name: "כמות מינימלית להזמנה", icon: "hash" },
      { id: "bulk-discount", name: "מחשבון הנחת כמות", icon: "tag" },
      { id: "product-research", name: "מחקר מוצר", icon: "search" },
      { id: "competitor-price", name: "מחירי מתחרים", icon: "eye" },
      { id: "listing-writer", name: "כתיבת תיאור מוצר", icon: "edit-3" },
      { id: "return-rate", name: "חישוב אחוז החזרות", icon: "corner-up-left" },
      { id: "package-size", name: "מידות ומשקל חבילה", icon: "box" },
      { id: "tracking-log", name: "מעקב משלוחים", icon: "map-pin" },
      { id: "profit-per-unit", name: "רווח ליחידה", icon: "dollar-sign" },
    ],
  },
  {
    key: "school",
    label: "שגרת פנימייה ולימודים",
    icon: "book-open",
    color: "#5B3FA8",
    tools: [
      { id: "zmanim-routine", name: "זמני היום ושגרה", icon: "sunset" },
      { id: "seder-timer", name: "טיימר סדר", icon: "clock" },
      { id: "chavruta-planner", name: "מתכנן חברותא", icon: "users" },
      { id: "daf-tracker", name: "מעקב דף יומי", icon: "book-open" },
      { id: "test-countdown", name: "ספירה למבחן", icon: "edit" },
      { id: "study-split", name: "חלוקת חומר ללמידה", icon: "scissors" },
      { id: "memorize-drill", name: "תרגול שינון", icon: "repeat" },
      { id: "weekly-schedule", name: "מערכת שבועית", icon: "calendar" },
      { id: "laundry-turn", name: "תור כביסה", icon: "refresh-cw" },
      { id: "room-checklist", name: "צ׳קליסט חדר", icon: "check-square" },
      { id: "shabbat-prep", name: "הכנות לשבת", icon: "sunset" },
      { id: "trip-home", name: "תכנון נסיעה הביתה", icon: "home" },
      { id: "pocket-money", name: "ניהול דמי כיס", icon: "wallet-outline" },
      { id: "sleep-calc", name: "מחשבון שינה", icon: "moon" },
      { id: "focus-log", name: "יומן פוקוס", icon: "target" },
    ],
  },
  {
    key: "finance",
    label: "פיננסים מהירים",
    icon: "dollar-sign",
    color: "#1B7F5C",
    tools: [
      { id: "vat-calc", name: "מע״מ והנחה אקספרס", icon: "percent" },
      { id: "margin-calc", name: "מחשבון רווחיות", icon: "trending-up" },
      { id: "discount-calc", name: "מחשבון הנחות", icon: "tag" },
      { id: "tip-split", name: "חלוקת חשבון", icon: "divide" },
      { id: "savings-goal", name: "יעד חיסכון", icon: "target" },
      { id: "cashflow", name: "תזרים חודשי", icon: "activity" },
      { id: "breakeven", name: "נקודת איזון", icon: "git-commit" },
      { id: "tax-set-aside", name: "הפרשה למס", icon: "shield" },
      { id: "loan-calc", name: "מחשבון הלוואה", icon: "credit-card" },
      { id: "debt-tracker", name: "מעקב חובות", icon: "book" },
      { id: "roi-calc", name: "מחשבון ROI", icon: "bar-chart" },
      { id: "invoice-gen", name: "מחולל חשבוניות", icon: "file-text" },
      { id: "expense-split", name: "מפצל הוצאות חדר", icon: "users" },
      { id: "price-history", name: "היסטוריית מחירים", icon: "trending-down" },
      { id: "hourly-rate", name: "חישוב תעריף שעתי", icon: "clock" },
      { id: "till-count", name: "ספירת קופה", icon: "cash-outline" },
    ],
  },
  {
    key: "prompts",
    label: "פרומפטים",
    icon: "message-square",
    color: "#B05AC4",
    tools: [
      { id: "prompt-library", name: "ספריית פרומפטים", icon: "book-open" },
      { id: "prompt-builder", name: "מחולל פרומפטים AI", icon: "layers" },
      { id: "system-prompt", name: "תבנית System Prompt", icon: "settings" },
      { id: "product-desc-prompt", name: "פרומפט תיאור מוצר", icon: "shopping-bag" },
      { id: "video-script", name: "פרומפט תסריט וידאו", icon: "film" },
      { id: "code-review-prompt", name: "פרומפט ביקורת קוד", icon: "search" },
      { id: "summarize-prompt", name: "פרומפט סיכום", icon: "file-text" },
      { id: "translate-prompt", name: "פרומפט תרגום", icon: "globe" },
      { id: "image-prompt", name: "פרומפט לתמונה", icon: "image" },
      { id: "hebrew-tone", name: "כיוונון סגנון עברי", icon: "type" },
      { id: "few-shot", name: "בונה דוגמאות Few-Shot", icon: "target" },
      { id: "chain-thought", name: "תבנית שרשור חשיבה", icon: "link-2" },
      { id: "prompt-tester", name: "בודק פרומפטים", icon: "play-circle" },
      { id: "negative-prompt", name: "פרומפט שלילי", icon: "slash" },
      { id: "prompt-history", name: "היסטוריית פרומפטים", icon: "clock" },
    ],
  },
  {
    key: "utils",
    label: "כלי עזר",
    icon: "tool",
    color: "#4B5563",
    tools: [
      { id: "qr-gen", name: "מחולל ברקודים/QR", icon: "grid" },
      { id: "unit-conv", name: "המרת יחידות", icon: "maximize-2" },
      { id: "percent-calc", name: "פערי אחוזים", icon: "percent" },
      { id: "random-picker", name: "גלגל החלטות", icon: "shuffle" },
      { id: "password-gen", name: "מחולל סיסמאות", icon: "key" },
      { id: "text-counter", name: "ספירת מילים ותווים", icon: "type" },
      { id: "case-convert", name: "המרת Case", icon: "bold" },
      { id: "timestamp-conv", name: "המרת Timestamp", icon: "clock" },
      { id: "countdown", name: "ספירה לאחור", icon: "watch" },
      { id: "world-clock", name: "שעון עולמי", icon: "globe" },
      { id: "hebrew-date", name: "ממיר תאריך עברי", icon: "calendar" },
      { id: "ruler", name: "סרגל מסך", icon: "maximize" },
      { id: "noise-meter", name: "מד רעש", icon: "volume-2" },
      { id: "emoji-picker", name: "בורר אימוג׳י", icon: "smile" },
      { id: "notes-quick", name: "פתק מהיר", icon: "edit-3" },
      { id: "pomodoro", name: "טיימר פומודורו", icon: "clock" },
    ],
  },
];

// Tool ids that open a real mini-app.
// Derived from the app registry rather than hand-maintained: a tool is
// "implemented" precisely when a component is wired to its id, so this set can
// never claim a tool the sheet cannot actually open.
export const IMPLEMENTED = new Set(BUILT_TOOL_IDS);

// Flat list for search + counting.
export const ALL_TOOLS = TOOL_CATEGORIES.flatMap((cat) =>
  cat.tools.map((t) => ({ ...t, categoryKey: cat.key, categoryLabel: cat.label, color: cat.color }))
);

export const TOOL_COUNT = ALL_TOOLS.length;

export const toolById = (id) => ALL_TOOLS.find((t) => t.id === id) || null;
