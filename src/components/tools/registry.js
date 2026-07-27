import { AliImportCalc } from "./apps/importing";
import {
  BillSplitTip,
  DormSplitter,
  LicenseTracker,
  LoanCalc,
  QuickTip,
  RoasCalc,
  RuleOf72,
  TillCounter,
} from "./apps/finance";
import { AiImageGenerator, TextToSpeech } from "./apps/ai";
import {
  DiscountCalc,
  DiscountStacking,
  MarkupVsMargin,
  ProfitMargin,
  VatDiscount,
  VatExtract,
} from "./apps/pricing";
import { Base64Tool, JsonValidator, QrGenerator, RegexTester, RnUiGenerator, UuidGenerator } from "./apps/dev";
import {
  ContrastChecker,
  GoldenRatio,
  GradientGenerator,
  IconSizeGuide,
  RgbToHex,
  RnBoilerplate,
} from "./apps/design";
import { CarDepreciation, DeliveryRoute, FuelTripCost } from "./apps/cars";
import {
  DecisionPicker,
  PasswordGenerator,
  PercentDiff,
  StorageConverter,
  TextAnalyzer,
  WhatsAppDirect,
  WordScrambler,
} from "./apps/utils";
import { AgeInDays, PomodoroTimer, TimezoneConverter } from "./apps/time";
import { PromptBuilder } from "./apps/prompts";
import {
  AspectRatio,
  DroneFlightTime,
  SlowMoFps,
  TimelapseCalc,
  VideoSizeEstimator,
} from "./apps/video";
import {
  ChangeBreakdown,
  InventoryForecast,
  OhmsLaw,
  PowerLoad,
  TransitLoadCalc,
  VendingRoi,
} from "./apps/vending";
import { CalorieDensity, StudyPace, ZmanimRoutine } from "./apps/school";

// The single map from a catalogue tool id to the component that implements it.
//
// One entry per tool, grouped by the file it lives in. Adding a tool is: write
// the component in the matching ./apps file, add one line here, and add its id
// to IMPLEMENTED in utils/toolsCatalog. Nothing else in the app changes, and no
// file has to grow to hold all 120 — which is exactly why this is a lookup
// table and not a switch: a switch would put every tool's code in one module.

export const TOOL_APPS = {
  // vending — מכונות שתייה וטרנזיט
  "vending-roi": VendingRoi,
  "transit-load": TransitLoadCalc,
  "ohms-law": OhmsLaw,
  "restock-planner": InventoryForecast,
  "coin-float": ChangeBreakdown,
  "power-load": PowerLoad,

  // cars — רכב ומסלולים
  "fuel-cost": FuelTripCost,
  "car-depreciation": CarDepreciation,
  "route-planner": DeliveryRoute,

  // video — וידאו ועריכה
  "video-size": VideoSizeEstimator,
  "fps-slowmo": SlowMoFps,
  "drone-flight": DroneFlightTime,
  "timelapse-calc": TimelapseCalc,
  "aspect-ratio": AspectRatio,

  // dev — פיתוח וקוד
  "rn-ui-gen": RnUiGenerator,
  "json-validator": JsonValidator,
  "uuid-gen": UuidGenerator,
  "regex-tester": RegexTester,
  "base64": Base64Tool,

  // design — צבע ותבניות
  "gradient-gen": GradientGenerator,
  "rn-boilerplate": RnBoilerplate,
  "contrast-check": ContrastChecker,
  "hex-color": RgbToHex,
  "icon-sizes": IconSizeGuide,
  "golden-ratio": GoldenRatio,

  // import — ייבוא וסחר
  "ali-import": AliImportCalc,

  // school — פנימייה וסדר יום
  "zmanim-routine": ZmanimRoutine,
  "calorie-density": CalorieDensity,
  "study-split": StudyPace,

  // finance — פיננסים מהירים
  "expense-split": DormSplitter,
  "vat-calc": VatDiscount,
  "till-count": TillCounter,
  "license-tracker": LicenseTracker,
  "margin-calc": ProfitMargin,
  "loan-calc": LoanCalc,
  "discount-calc": DiscountCalc,
  "markup-margin": MarkupVsMargin,
  "tip-split": BillSplitTip,
  "vat-extract": VatExtract,
  "discount-stack": DiscountStacking,
  "roas": RoasCalc,
  "rule-72": RuleOf72,
  "tip-quick": QuickTip,

  // prompts — פרומפטים
  "prompt-builder": PromptBuilder,

  // utils — כלי עזר
  "qr-gen": QrGenerator,
  "percent-calc": PercentDiff,
  "random-picker": DecisionPicker,
  "text-counter": TextAnalyzer,
  "pomodoro": PomodoroTimer,
  "world-clock": TimezoneConverter,
  "wa-direct": WhatsAppDirect,
  "storage-conv": StorageConverter,
  "password-gen": PasswordGenerator,
  "age-days": AgeInDays,
  "scrambler": WordScrambler,

  // ai — בינה מלאכותית ומדיה
  "ai-image": AiImageGenerator,
  "tts": TextToSpeech,
};

// True when a tool id has a real implementation behind it.
export function hasApp(id) {
  return Object.prototype.hasOwnProperty.call(TOOL_APPS, id);
}

export const BUILT_TOOL_IDS = Object.keys(TOOL_APPS);
