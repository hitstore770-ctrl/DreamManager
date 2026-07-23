import ComingSoon from "../components/tools/ComingSoon";
import EngineeringConverter from "../components/tools/EngineeringConverter";
import InventoryClicker from "../components/tools/InventoryClicker";
import PomodoroTimer from "../components/tools/PomodoroTimer";
import TimecodeCalculator from "../components/tools/TimecodeCalculator";
import ToolsHub from "../components/tools/ToolsHub";

const TOOLS = [
  { key: "timecode", label: "מחשבון קוד זמן", emoji: "🎬", Component: TimecodeCalculator },
  { key: "pomodoro", label: "טיימר פומודורו", emoji: "🍅", Component: PomodoroTimer },
  { key: "hourglass", label: "שעון חול חזותי", emoji: "⏳", Component: ComingSoon },
  { key: "routine", label: "בונה שגרות", emoji: "🔁", Component: ComingSoon },
  { key: "scanner", label: "סורק מסמכים", emoji: "🖨️", Component: ComingSoon },
  { key: "glossary", label: "מילון מונחים", emoji: "📖", Component: ComingSoon },
  { key: "chunking", label: "פיצול משימות", emoji: "✂️", Component: ComingSoon },
  { key: "recorder", label: "רשמקול", emoji: "🎙️", Component: ComingSoon },
  { key: "ocr", label: "זיהוי טקסט", emoji: "🔤", Component: ComingSoon },
  { key: "barcode", label: "קורא ברקודים", emoji: "🏷️", Component: ComingSoon },
  { key: "counter", label: "מונה מילים ותווים", emoji: "🔢", Component: ComingSoon },
  { key: "drawpad", label: "פנקס שרבוט", emoji: "✏️", Component: ComingSoon },
  { key: "inventory", label: "מונה מלאי פשוט", emoji: "📦", Component: InventoryClicker },
  { key: "location", label: "תזכורות מיקום", emoji: "📍", Component: ComingSoon },
  { key: "search", label: "חיפוש גלובלי", emoji: "🔎", Component: ComingSoon },
  { key: "units", label: "המרת מידות הנדסית", emoji: "📐", Component: EngineeringConverter },
  { key: "habits", label: "מעקב הרגלים", emoji: "🗓️", Component: ComingSoon },
  { key: "password", label: "מחולל סיסמאות", emoji: "🔐", Component: ComingSoon },
  { key: "dnd", label: "נא לא להפריע", emoji: "🔕", Component: ComingSoon },
  { key: "decision", label: "טבלת החלטות", emoji: "⚖️", Component: ComingSoon },
];

export default function AdvancedToolsScreen({ navigation }) {
  return <ToolsHub title="🚀 כלים מתקדמים" tools={TOOLS} navigation={navigation} />;
}
