import { AliImportCalc } from "../tools/apps/importing";
import { DeliveryRoute } from "../tools/apps/cars";
import { TransitLoadCalc, VendingRoi } from "../tools/apps/vending";
import { PercentDiff, WhatsAppDirect } from "../tools/apps/utils";
import { QrGenerator } from "../tools/apps/marketing";
import { RoasCalc, RuleOf72, TillCounter } from "../tools/apps/finance";
import {
  DiscountCalc,
  DiscountStacking,
  MarkupVsMargin,
  ProfitMargin,
  VatDiscount,
  VatExtract,
} from "../tools/apps/pricing";

import { BatchTimer, BlindCount, PackingChecklist, PrepQueue, StockForecast } from "./ops";
import { LowStockRules, MessageTemplates, ShiftRoutine, ShipmentTracker } from "./autoTools";

import BizDashboardScreen from "../../screens/BizDashboardScreen";
import DebtsScreen from "../../screens/DebtsScreen";
import PricingScreen from "../../screens/PricingScreen";
import PromosScreen from "../../screens/PromosScreen";
import SuppliersScreen from "../../screens/SuppliersScreen";
import WarehouseScreen from "../../screens/WarehouseScreen";
import ZReportScreen from "../../screens/ZReportScreen";

// The register's resolution table: one entry per catalogue target.
//
// posCatalog.js is the *description* of the eight zones; this file is what
// actually exists behind them. Keeping them apart is what lets the hub assert,
// at module load, that no category advertises a tool it cannot open — see
// UNRESOLVED below, which the screen surfaces in development rather than
// waiting for a user to tap a dead tile.
//
// VendingRoi and TransitLoadCalc come straight from ./apps/vending rather than
// through TOOL_APPS: they are business-only tools, and the register is their
// home now. StockForecast replaces the old InventoryForecast calculator, which
// asked you to type a sales rate the app already knows — this one reads the
// live inventory and sales history instead.

export const POS_APPS = {
  // מלאי
  "blind-count": BlindCount,
  "stock-forecast": StockForecast,
  "machine-roi": VendingRoi,

  // שילוח
  shipments: ShipmentTracker,
  "ali-import": AliImportCalc,
  "route-planner": DeliveryRoute,
  "transit-load": TransitLoadCalc,

  // תמחור
  "margin-calc": ProfitMargin,
  "markup-margin": MarkupVsMargin,
  "vat-calc": VatDiscount,
  "vat-extract": VatExtract,
  "discount-stack": DiscountStacking,
  "discount-calc": DiscountCalc,

  // לקוחות
  templates: MessageTemplates,
  "wa-direct": WhatsAppDirect,
  "qr-gen": QrGenerator,

  // מטבח ואריזה
  "prep-queue": PrepQueue,
  "batch-timer": BatchTimer,
  packing: PackingChecklist,

  // אנליטיקה
  "till-count": TillCounter,
  roas: RoasCalc,
  "percent-calc": PercentDiff,
  "rule-72": RuleOf72,

  // אוטומציות
  "low-stock": LowStockRules,
  "shift-routine": ShiftRoutine,
};

export const POS_SCREENS = {
  warehouse: WarehouseScreen,
  suppliers: SuppliersScreen,
  pricing: PricingScreen,
  debts: DebtsScreen,
  zreport: ZReportScreen,
  dash: BizDashboardScreen,
  promos: PromosScreen,
};

export function resolveTarget(target) {
  if (!target) return null;
  if (target.kind === "screen") return POS_SCREENS[target.key] || null;
  return POS_APPS[target.key] || null;
}
