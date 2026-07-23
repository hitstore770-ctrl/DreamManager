import ComingSoon from "../components/tools/ComingSoon";
import EngineeringConverter from "../components/tools/EngineeringConverter";
import InventoryClicker from "../components/tools/InventoryClicker";
import PomodoroTimer from "../components/tools/PomodoroTimer";
import TimecodeCalculator from "../components/tools/TimecodeCalculator";
import ToolsHub from "../components/tools/ToolsHub";

const TOOLS = [
  { key: "timecode", label: "מחשבון קוד זמן", emoji: "🎬", Component: TimecodeCalculator },
  { key: "inventory", label: "מונה מלאי", emoji: "📦", Component: InventoryClicker },
  { key: "scanner", label: "סורק למדפסת", emoji: "🖨️", Component: ComingSoon },
  { key: "decision", label: "השוואת חלופות", emoji: "⚖️", Component: ComingSoon },
  { key: "units", label: "המרת מידות הנדסית", emoji: "📐", Component: EngineeringConverter },
  { key: "barcode", label: "קורא ברקודים", emoji: "🏷️", Component: ComingSoon },
  { key: "pomodoro", label: "טיימר פומודורו", emoji: "🍅", Component: PomodoroTimer },
  { key: "drawpad", label: "פנקס שרבוט", emoji: "✏️", Component: ComingSoon },
  { key: "routine", label: "בונה שגרות", emoji: "🔁", Component: ComingSoon },
  { key: "search", label: "חיפוש גלובלי", emoji: "🔎", Component: ComingSoon },
];

export default function AdvancedToolsScreen({ navigation }) {
  return <ToolsHub title="🚀 כלים מתקדמים" tools={TOOLS} navigation={navigation} />;
}
