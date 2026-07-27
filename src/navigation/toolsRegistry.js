// Single source of truth for the nine business tools and how they group into
// the drawer's categories (POS & Sales / Operations / Finance).

import BarcodeCart from "../components/tools/BarcodeCart";
import CrmDebts from "../components/tools/CrmDebts";
import ExpressPOS from "../components/tools/ExpressPOS";
import ProfitAnalyzer from "../components/tools/ProfitAnalyzer";
import SalesEvent from "../components/tools/SalesEvent";
import SmartInventory from "../components/tools/SmartInventory";
import Suppliers from "../components/tools/Suppliers";
import TithesSavings from "../components/tools/TithesSavings";
import ZReport from "../components/tools/ZReport";

export const TOOLS = [
  { key: "pos", label: "קופת אקספרס", emoji: "", category: "pos", Component: ExpressPOS },
  { key: "barcode", label: "סורק ברקודים", emoji: "", category: "pos", Component: BarcodeCart },
  { key: "event", label: "סיכום אירוע", emoji: "", category: "pos", Component: SalesEvent },
  { key: "inventory", label: "ניהול מלאי חכם", emoji: "", category: "operations", Component: SmartInventory },
  { key: "suppliers", label: "ניהול ספקים", emoji: "", category: "operations", Component: Suppliers },
  { key: "zreport", label: "דו״ח Z", emoji: "", category: "finance", Component: ZReport },
  { key: "profit", label: "מנתח ריווחיות", emoji: "", category: "finance", Component: ProfitAnalyzer },
  { key: "debts", label: "פנקס חובות", emoji: "", category: "finance", Component: CrmDebts },
  { key: "savings", label: "חסכונות ומעשרות", emoji: "", category: "finance", Component: TithesSavings },
];

export const CATEGORIES = [
  { key: "pos", label: "קופה ומכירות", emoji: ""},
  { key: "operations", label: "תפעול", emoji: ""},
  { key: "finance", label: "כספים", emoji: ""},
];

export function toolByKey(key) {
  return TOOLS.find((t) => t.key === key) || null;
}

// Category order depends on the active workspace mode chosen in Settings.
export function orderedCategories(workspace) {
  const base = CATEGORIES.map((c) => c.key);
  if (workspace === "pos") return ["pos", "operations", "finance"];
  if (workspace === "production") return ["operations", "pos", "finance"];
  return base;
}
