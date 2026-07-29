// The six zones of the register, and the two decks it sells from.
//
// This is the *micro* side of the business — what happens in the ninety
// seconds around a sale — as opposed to the macro cashflow view. Every entry
// below opens something that actually runs. Nothing here is a "coming soon"
// tile: the catalogue is derived from what is built, so a category can never
// advertise a tool the sheet cannot open (see posRegistry.js, which is the
// thing that would fail to resolve).
//
// Inventory and CRM were the seventh and eighth. They are gone: the warehouse
// and the customer ledger still live in the "העסק שלי" tab, and duplicating
// them here made the register a second front door to the same screens rather
// than a place of its own.
//
// `target.kind` decides how an entry is presented, and the two are genuinely
// different objects:
//   "app"    — a calculator-sized mini-app. Opens in a bottom sheet over the
//              register, because you come back to the cart straight after.
//   "screen" — a full business module with its own scrolling and lists.
//              Opens full-screen; a warehouse inside a 480px sheet is a
//              scrollbar inside a scrollbar.

export const POS_CATEGORIES = [
  {
    key: "pos",
    label: "קופה",
    icon: "shopping-cart",
    color: "#7C3AED",
    hint: "מכירה מהירה · עגלה · תשלום",
    // Rendered by PosRegisterTab, not as a tool list — this tab *is* a tool.
    tools: [],
  },
  {
    key: "logistics",
    label: "שילוח",
    icon: "truck",
    color: "#D97706",
    hint: "ספקים, משלוחים וחישוב עלות נחיתה",
    tools: [
      {
        id: "suppliers",
        name: "ספקים והזמנות",
        hint: "רשימת ספקים, הזמנות פתוחות ותנאי תשלום",
        icon: "truck",
        target: { kind: "screen", key: "suppliers" },
      },
      {
        id: "shipments",
        name: "מעקב משלוחים",
        hint: "מה בדרך מאליאקספרס, מתי אמור להגיע וכמה זה מאחר",
        icon: "navigation",
        target: { kind: "app", key: "shipments" },
      },
      {
        id: "ali-import",
        name: "עלות נחיתה מאליאקספרס",
        hint: "מחיר הפריט + שילוח + מכס = מה זה באמת עולה",
        icon: "package",
        target: { kind: "app", key: "ali-import" },
      },
      {
        id: "route-planner",
        name: "מסלול חלוקה",
        hint: "הערכת זמן ועלות לסבב חלוקה",
        icon: "map",
        target: { kind: "app", key: "route-planner" },
      },
      {
        id: "transit-load",
        name: "עומס רכב",
        hint: "כמה ארגזים נכנסים ומה המשקל הכולל",
        icon: "truck",
        target: { kind: "app", key: "transit-load" },
      },
    ],
  },
  {
    key: "pricing",
    label: "תמחור",
    icon: "tag",
    color: "#059669",
    hint: "כמה לגבות, וכמה באמת נשאר ביד",
    tools: [
      {
        id: "pricing-screen",
        name: "מחשבון תמחור",
        hint: "מעלות למחיר מכירה, לפי מתח רווח או רווח יעד",
        icon: "tag",
        target: { kind: "screen", key: "pricing" },
      },
      {
        id: "margin-calc",
        name: "מתח רווח",
        hint: "אחוז הרווח מתוך מחיר המכירה",
        icon: "trending-up",
        target: { kind: "app", key: "margin-calc" },
      },
      {
        id: "markup-margin",
        name: "מארק-אפ מול מתח רווח",
        hint: "שני מספרים שמתבלבלים ביניהם ועולים כסף",
        icon: "git-compare",
        target: { kind: "app", key: "markup-margin" },
      },
      {
        id: "vat-calc",
        name: "מע״מ והנחה אקספרס",
        hint: "מחיר לפני ואחרי מע״מ, עם הנחה",
        icon: "percent",
        target: { kind: "app", key: "vat-calc" },
      },
      {
        id: "vat-extract",
        name: "חילוץ מע״מ",
        hint: "כמה מע״מ יש בתוך סכום שכבר כולל אותו",
        icon: "percent",
        target: { kind: "app", key: "vat-extract" },
      },
      {
        id: "discount-stack",
        name: "כפל מבצעים",
        hint: "שתי הנחות ברצף אינן סכום ההנחות",
        icon: "layers",
        target: { kind: "app", key: "discount-stack" },
      },
      {
        id: "discount-calc",
        name: "מחשבון הנחות",
        hint: "מחיר אחרי הנחה, וכמה ויתרת",
        icon: "tag",
        target: { kind: "app", key: "discount-calc" },
      },
    ],
  },
  {
    key: "kitchen",
    label: "מטבח ואריזה",
    icon: "clock",
    color: "#B45309",
    hint: "מה מכינים עכשיו ומה נכנס לחבילה",
    tools: [
      {
        id: "prep-queue",
        name: "תור הכנה",
        hint: "כרטיסי הזמנה עם שעון רץ, לפי סדר הגעה",
        icon: "list",
        target: { kind: "app", key: "prep-queue" },
      },
      {
        id: "batch-timer",
        name: "טיימר מנות",
        hint: "כמה טיימרים במקביל, אחד לכל מנה",
        icon: "clock",
        target: { kind: "app", key: "batch-timer" },
      },
      {
        id: "packing",
        name: "צ׳ק ליסט אריזה",
        hint: "מה נכנס לחבילה לפני שהיא נסגרת",
        icon: "check-square",
        target: { kind: "app", key: "packing" },
      },
    ],
  },
  {
    key: "analytics",
    label: "אנליטיקה",
    icon: "bar-chart-2",
    color: "#1D4ED8",
    hint: "מה קרה היום, והאם זה משתפר",
    tools: [
      {
        id: "zreport",
        name: "דוח Z",
        hint: "סגירת יום: מחזור, רווח וארכיון משמרות",
        icon: "file-text",
        target: { kind: "screen", key: "zreport" },
      },
      {
        id: "dashboard",
        name: "דשבורד מכירות",
        hint: "שבעה ימים אחרונים בגרף, ומדדי מפתח",
        icon: "bar-chart-2",
        target: { kind: "screen", key: "dash" },
      },
      {
        id: "till-count",
        name: "ספירת קופה",
        hint: "ספירת מטבעות ושטרות בסוף משמרת מול המחזור",
        icon: "cash-outline",
        target: { kind: "app", key: "till-count" },
      },
      {
        id: "roas",
        name: "החזר השקעה בפרסום",
        hint: "כמה החזיר כל שקל שהושקע בקידום",
        icon: "target",
        target: { kind: "app", key: "roas" },
      },
      {
        id: "percent-calc",
        name: "פערי אחוזים",
        hint: "כמה אחוז עלה או ירד בין שני מספרים",
        icon: "percent",
        target: { kind: "app", key: "percent-calc" },
      },
      {
        id: "rule-72",
        name: "כלל ה-72",
        hint: "בכמה שנים סכום מכפיל את עצמו",
        icon: "trending-up",
        target: { kind: "app", key: "rule-72" },
      },
    ],
  },
  {
    key: "automations",
    label: "אוטומציות",
    icon: "zap",
    color: "#4F46E5",
    hint: "כללים שרצים עליך במקום שתזכור",
    tools: [
      {
        id: "low-stock",
        name: "כללי מלאי נמוך",
        hint: "סף לכל פריט, ורשימת הזמנה שנבנית לבד",
        icon: "alert-triangle",
        target: { kind: "app", key: "low-stock" },
      },
      {
        id: "shift-routine",
        name: "שגרת פתיחה וסגירה",
        hint: "צ׳ק ליסט שמתאפס כל יום",
        icon: "check-circle",
        target: { kind: "app", key: "shift-routine" },
      },
      {
        id: "promos",
        name: "מבצעים וחבילות",
        hint: "חבילות שמופיעות כפתור אחד בקופה",
        icon: "target",
        target: { kind: "screen", key: "promos" },
      },
    ],
  },
];

export const POS_CATEGORY_KEYS = POS_CATEGORIES.map((c) => c.key);

export function posCategory(key) {
  return POS_CATEGORIES.find((c) => c.key === key) || POS_CATEGORIES[0];
}

// ---------------------------------------------------------------------------
// The two decks the register sells from.
//
// These are *starter* decks, not fixed price lists. They are copied into
// storage on first run and are editable from there — a price baked into the
// binary is a price that is wrong the week after it ships.
//
// `cost` is what the item cost to acquire, and it is why this deck exists at
// all: the older POS recorded profit as if cost were zero, which makes every
// margin it reports a lie. With a cost per line the Z-report and the dashboard
// finally reconcile to money actually earned.

export const DECKS = [
  { key: "food", label: "מזון מהיר", icon: "coffee", color: "#D97706" },
  { key: "import", label: "אליאקספרס", icon: "package", color: "#0891B2" },
];

export const FAST_FOOD = [
  { sku: "ff-toast", name: "טוסט", price: 14, cost: 5, icon: "layers" },
  { sku: "ff-schnitzel", name: "שניצל בלאפה", price: 28, cost: 12, icon: "disc" },
  { sku: "ff-burger", name: "המבורגר", price: 32, cost: 14, icon: "disc" },
  { sku: "ff-fries", name: "צ׳יפס", price: 12, cost: 3.5, icon: "grid" },
  { sku: "ff-pizza", name: "משולש פיצה", price: 15, cost: 5, icon: "triangle" },
  { sku: "ff-salad", name: "סלט אישי", price: 22, cost: 8, icon: "feather" },
  { sku: "ff-soda", name: "פחית שתייה", price: 7, cost: 3, icon: "droplet" },
  { sku: "ff-water", name: "בקבוק מים", price: 5, cost: 1.8, icon: "droplet" },
  { sku: "ff-energy", name: "משקה אנרגיה", price: 13, cost: 6.5, icon: "zap" },
  { sku: "ff-coffee", name: "קפה קר", price: 11, cost: 3, icon: "coffee" },
  { sku: "ff-snack", name: "חטיף", price: 7, cost: 2.8, icon: "package" },
  { sku: "ff-cookie", name: "עוגייה", price: 6, cost: 1.5, icon: "circle" },
];

export const ALI_ITEMS = [
  { sku: "al-cable", name: "כבל USB-C", price: 25, cost: 4.2, icon: "link" },
  { sku: "al-charger", name: "מטען מהיר 20W", price: 55, cost: 13, icon: "zap" },
  { sku: "al-buds", name: "אוזניות בלוטות׳", price: 90, cost: 26, icon: "headphones" },
  { sku: "al-powerbank", name: "פאוור בנק 10000", price: 110, cost: 38, icon: "battery-charging" },
  { sku: "al-stand", name: "מעמד לטלפון", price: 30, cost: 6, icon: "smartphone" },
  { sku: "al-ring", name: "טבעת תאורה", price: 75, cost: 22, icon: "sun" },
  { sku: "al-led", name: "רצועת LED", price: 45, cost: 11, icon: "sliders" },
  { sku: "al-case", name: "כיסוי לטלפון", price: 35, cost: 5.5, icon: "shield" },
  { sku: "al-mouse", name: "עכבר אלחוטי", price: 65, cost: 17, icon: "mouse-pointer" },
  { sku: "al-hub", name: "מפצל USB", price: 50, cost: 12, icon: "share-2" },
  { sku: "al-tracker", name: "איתרן מפתחות", price: 40, cost: 9, icon: "map-pin" },
  { sku: "al-holder", name: "מחזיק לרכב", price: 38, cost: 7.5, icon: "truck" },
];

export const DEFAULT_DECK_ITEMS = { food: FAST_FOOD, import: ALI_ITEMS };

// Margin on a deck line, as a fraction of the sale price. Returns null rather
// than 0 when the price is zero, so "no data" never renders as "0% margin".
export function marginOf(item) {
  const price = Number(item?.price) || 0;
  const cost = Number(item?.cost) || 0;
  if (price <= 0) return null;
  return (price - cost) / price;
}
