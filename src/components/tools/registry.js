import { AgeInDays, PomodoroTimer, TimezoneConverter } from "./apps/time";
import { AiImageGenerator, TextToSpeech } from "./apps/ai";
import { AliImportCalc } from "./apps/importing";
import {
  AspectRatio,
  DroneFlightTime,
  SlowMoFps,
  TimelapseCalc,
  VideoSizeEstimator,
} from "./apps/video";
import {
  BillSplitTip,
  DormSplitter,
  LicenseTracker,
  LoanCalc,
  QuickTip,
  RoasCalc,
  RuleOf72,
} from "./apps/finance";
import { CalorieDensity, StudyPace, ZmanimRoutine } from "./apps/school";
import { CarDepreciation, DeliveryRoute, FuelTripCost } from "./apps/cars";
import { ChangeBreakdown, OhmsLaw, PowerLoad, TransitLoadCalc } from "./apps/vending";
import {
  DecisionPicker,
  PasswordGenerator,
  PercentDiff,
  StorageConverter,
  TextAnalyzer,
  WhatsAppDirect,
  WordScrambler,
} from "./apps/utils";
import {
  DiscountCalc,
  DiscountStacking,
  MarkupVsMargin,
  ProfitMargin,
  VatDiscount,
  VatExtract,
} from "./apps/pricing";
import { PromptBuilder } from "./apps/prompts";
import { QrGenerator } from "./apps/marketing";

// The single map from a catalogue tool id to the component that implements it.
//
// One entry per tool, grouped by the file it lives in. Adding a tool is: write
// the component in the matching ./apps file and add one line here. Nothing
// else in the app changes, and no file has to grow to hold them all — which is
// why this is a lookup table and not a switch.
//
// TillCounter, InventoryForecast and VendingRoi are deliberately absent: they
// live in the "העסק שלי" tab now and are imported straight by BusinessScreen,
// so they no longer surface in the Tools hub.

export const TOOL_APPS = {
  // מכונות ורכבים
  "coin-float": ChangeBreakdown,
  "power-load": PowerLoad,
  "ohms-law": OhmsLaw,
  "fuel-cost": FuelTripCost,
  "car-depreciation": CarDepreciation,
  "route-planner": DeliveryRoute,
  "loan-calc": LoanCalc,
  "transit-load": TransitLoadCalc,

  // הפקה ורחפנים
  "video-size": VideoSizeEstimator,
  "drone-flight": DroneFlightTime,
  "timelapse-calc": TimelapseCalc,
  "aspect-ratio": AspectRatio,
  "storage-conv": StorageConverter,
  "fps-slowmo": SlowMoFps,

  // שיווק ופיננסים
  "qr-gen": QrGenerator,
  "wa-direct": WhatsAppDirect,
  "ai-image": AiImageGenerator,
  roas: RoasCalc,
  "vat-calc": VatDiscount,
  "margin-calc": ProfitMargin,
  "discount-calc": DiscountCalc,
  "markup-margin": MarkupVsMargin,
  "vat-extract": VatExtract,
  "rule-72": RuleOf72,
  "discount-stack": DiscountStacking,
  "percent-calc": PercentDiff,
  "ali-import": AliImportCalc,
  "prompt-builder": PromptBuilder,

  // אישי ופנימייה
  "expense-split": DormSplitter,
  "license-tracker": LicenseTracker,
  pomodoro: PomodoroTimer,
  "calorie-density": CalorieDensity,
  "study-split": StudyPace,
  "world-clock": TimezoneConverter,
  "tip-split": BillSplitTip,
  "tip-quick": QuickTip,
  tts: TextToSpeech,
  "password-gen": PasswordGenerator,
  "age-days": AgeInDays,
  scrambler: WordScrambler,
  "zmanim-routine": ZmanimRoutine,
  "random-picker": DecisionPicker,
  "text-counter": TextAnalyzer,
};

// True when a tool id has a real implementation behind it.
export function hasApp(id) {
  return Object.prototype.hasOwnProperty.call(TOOL_APPS, id);
}

export const BUILT_TOOL_IDS = Object.keys(TOOL_APPS);
