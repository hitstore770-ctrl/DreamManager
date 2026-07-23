import BatteryRange from "../components/tools/BatteryRange";
import CurrencyConverter from "../components/tools/CurrencyConverter";
import MoneyTracker from "../components/tools/MoneyTracker";
import ProfitCalculator from "../components/tools/ProfitCalculator";
import ShiftTracker from "../components/tools/ShiftTracker";
import SplitBill from "../components/tools/SplitBill";
import StudyTimer from "../components/tools/StudyTimer";
import ToolsHub from "../components/tools/ToolsHub";
import VatCalculator from "../components/tools/VatCalculator";
import WorldClock from "../components/tools/WorldClock";
import ZmanimTool from "../components/tools/ZmanimTool";

const TOOLS = [
  { key: "money", label: "אשכרה כסף", emoji: "💰", Component: MoneyTracker },
  { key: "shifts", label: "זמן זה כסף", emoji: "⏱️", Component: ShiftTracker },
  { key: "profit", label: "מחשבון תמחור ורווחיות", emoji: "📊", Component: ProfitCalculator },
  { key: "battery", label: "טווח סוללה לקורקינט", emoji: "🛴", Component: BatteryRange },
  { key: "currency", label: "המרת מטבעות", emoji: "💱", Component: CurrencyConverter },
  { key: "worldclock", label: "שעון עולמי", emoji: "🌍", Component: WorldClock },
  { key: "split", label: "חלוקת הוצאות", emoji: "🧮", Component: SplitBill },
  { key: "vat", label: 'מחשבון מע״מ 17%', emoji: "🧾", Component: VatCalculator },
  { key: "timer", label: "טיימר לימודים", emoji: "📚", Component: StudyTimer },
  { key: "zmanim", label: "זמני היום - הלכה", emoji: "🕯️", Component: ZmanimTool },
];

export default function ToolsScreen({ navigation }) {
  return <ToolsHub title="🧰 ארגז כלים" tools={TOOLS} navigation={navigation} />;
}
