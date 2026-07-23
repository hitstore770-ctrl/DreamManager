import BarcodeCart from "../components/tools/BarcodeCart";
import CrmDebts from "../components/tools/CrmDebts";
import ExpressPOS from "../components/tools/ExpressPOS";
import ProfitAnalyzer from "../components/tools/ProfitAnalyzer";
import SalesEvent from "../components/tools/SalesEvent";
import SmartInventory from "../components/tools/SmartInventory";
import Suppliers from "../components/tools/Suppliers";
import TithesSavings from "../components/tools/TithesSavings";
import ToolsHub from "../components/tools/ToolsHub";
import ZReport from "../components/tools/ZReport";

const TOOLS = [
  { key: "inventory", label: "ניהול מלאי חכם", emoji: "📦", Component: SmartInventory },
  { key: "pos", label: "קופת אקספרס", emoji: "🛒", Component: ExpressPOS },
  { key: "barcode", label: "סורק ברקודים", emoji: "🔦", Component: BarcodeCart },
  { key: "event", label: "סיכום אירוע", emoji: "🎪", Component: SalesEvent },
  { key: "zreport", label: 'דו״ח Z', emoji: "📋", Component: ZReport },
  { key: "profit", label: "מנתח ריווחיות", emoji: "📈", Component: ProfitAnalyzer },
  { key: "debts", label: "פנקס חובות", emoji: "📕", Component: CrmDebts },
  { key: "suppliers", label: "ניהול ספקים", emoji: "🚚", Component: Suppliers },
  { key: "savings", label: "חסכונות ומעשרות", emoji: "🪙", Component: TithesSavings },
];

export default function ToolsScreen({ navigation }) {
  return <ToolsHub title="🧰 ארגז הכלים לעסק" tools={TOOLS} navigation={navigation} />;
}
