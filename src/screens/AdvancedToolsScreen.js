import BarcodeReader from "../components/tools/BarcodeReader";
import DecisionMatrix from "../components/tools/DecisionMatrix";
import DNDMode from "../components/tools/DNDMode";
import DocumentScanner from "../components/tools/DocumentScanner";
import DrawPad from "../components/tools/DrawPad";
import EngineeringConverter from "../components/tools/EngineeringConverter";
import FocusTimer from "../components/tools/FocusTimer";
import GlobalSearch from "../components/tools/GlobalSearch";
import HabitGrid from "../components/tools/HabitGrid";
import OCRTool from "../components/tools/OCRTool";
import OnTheWay from "../components/tools/OnTheWay";
import PasswordGenerator from "../components/tools/PasswordGenerator";
import RoutineBuilder from "../components/tools/RoutineBuilder";
import TaskChunking from "../components/tools/TaskChunking";
import TimecodeCalculator from "../components/tools/TimecodeCalculator";
import ToolsHub from "../components/tools/ToolsHub";
import VoiceRecorder from "../components/tools/VoiceRecorder";
import Warehouse from "../components/tools/Warehouse";
import WordCharCounter from "../components/tools/WordCharCounter";

const TOOLS = [
  { key: "focus", label: "זמן פוקוס", emoji: "🎯", Component: FocusTimer },
  { key: "warehouse", label: "המחסן", emoji: "📦", Component: Warehouse },
  { key: "location", label: "על הדרך", emoji: "🗺️", Component: OnTheWay },
  { key: "timecode", label: "מחשבון קוד זמן", emoji: "🎞️", Component: TimecodeCalculator },
  { key: "routine", label: "סדר יום", emoji: "🌱", Component: RoutineBuilder },
  { key: "scanner", label: "סורק מסמכים", emoji: "🖨️", Component: DocumentScanner },
  { key: "chunking", label: "פיצול משימות", emoji: "🧩", Component: TaskChunking },
  { key: "recorder", label: "רשמקול", emoji: "🎤", Component: VoiceRecorder },
  { key: "ocr", label: "שואב טקסטים", emoji: "🔤", Component: OCRTool },
  { key: "barcode", label: "קורא ברקודים", emoji: "🏷️", Component: BarcodeReader },
  { key: "counter", label: "מונה מילים ותווים", emoji: "🔢", Component: WordCharCounter },
  { key: "drawpad", label: "פנקס שרבוט", emoji: "🖊️", Component: DrawPad },
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
