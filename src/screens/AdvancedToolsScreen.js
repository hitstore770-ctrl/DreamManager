import BarcodeReader from "../components/tools/BarcodeReader";
import DecisionMatrix from "../components/tools/DecisionMatrix";
import DNDMode from "../components/tools/DNDMode";
import DocumentScanner from "../components/tools/DocumentScanner";
import DrawPad from "../components/tools/DrawPad";
import EngineeringConverter from "../components/tools/EngineeringConverter";
import Glossary from "../components/tools/Glossary";
import GlobalSearch from "../components/tools/GlobalSearch";
import HabitGrid from "../components/tools/HabitGrid";
import InventoryClicker from "../components/tools/InventoryClicker";
import LocationReminders from "../components/tools/LocationReminders";
import OCRTool from "../components/tools/OCRTool";
import PasswordGenerator from "../components/tools/PasswordGenerator";
import PomodoroTimer from "../components/tools/PomodoroTimer";
import RoutineBuilder from "../components/tools/RoutineBuilder";
import TaskChunking from "../components/tools/TaskChunking";
import TimecodeCalculator from "../components/tools/TimecodeCalculator";
import ToolsHub from "../components/tools/ToolsHub";
import VisualHourglass from "../components/tools/VisualHourglass";
import VoiceRecorder from "../components/tools/VoiceRecorder";
import WordCharCounter from "../components/tools/WordCharCounter";

const TOOLS = [
  { key: "timecode", label: "מחשבון קוד זמן", emoji: "🎞️", Component: TimecodeCalculator },
  { key: "pomodoro", label: "טיימר פומודורו", emoji: "🍅", Component: PomodoroTimer },
  { key: "hourglass", label: "שעון חול חזותי", emoji: "⏳", Component: VisualHourglass },
  { key: "routine", label: "בונה שגרות", emoji: "🌱", Component: RoutineBuilder },
  { key: "scanner", label: "סורק מסמכים", emoji: "🖨️", Component: DocumentScanner },
  { key: "glossary", label: "מילון מונחים", emoji: "📗", Component: Glossary },
  { key: "chunking", label: "פיצול משימות", emoji: "🧩", Component: TaskChunking },
  { key: "recorder", label: "רשמקול", emoji: "🎤", Component: VoiceRecorder },
  { key: "ocr", label: "זיהוי טקסט", emoji: "🔤", Component: OCRTool },
  { key: "barcode", label: "קורא ברקודים", emoji: "🏷️", Component: BarcodeReader },
  { key: "counter", label: "מונה מילים ותווים", emoji: "🔢", Component: WordCharCounter },
  { key: "drawpad", label: "פנקס שרבוט", emoji: "🖊️", Component: DrawPad },
  { key: "inventory", label: "מונה מלאי פשוט", emoji: "📦", Component: InventoryClicker },
  { key: "location", label: "תזכורות מיקום", emoji: "📍", Component: LocationReminders },
  { key: "search", label: "חיפוש גלובלי", emoji: "🔍", Component: GlobalSearch },
  { key: "units", label: "המרת מידות הנדסית", emoji: "📐", Component: EngineeringConverter },
  { key: "habits", label: "מעקב הרגלים", emoji: "🗓️", Component: HabitGrid },
  { key: "password", label: "מחולל סיסמאות", emoji: "🔐", Component: PasswordGenerator },
  { key: "dnd", label: "נא לא להפריע", emoji: "🌙", Component: DNDMode },
  { key: "decision", label: "טבלת החלטות", emoji: "⚖️", Component: DecisionMatrix },
];

export default function AdvancedToolsScreen({ navigation }) {
  return <ToolsHub title="🚀 כלים מתקדמים" tools={TOOLS} navigation={navigation} />;
}
