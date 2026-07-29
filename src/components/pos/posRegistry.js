import { AliImportCalc } from "../tools/apps/importing";
import { DeliveryRoute } from "../tools/apps/cars";
import { TransitLoadCalc } from "../tools/apps/vending";
import { PercentDiff } from "../tools/apps/utils";
import { RoasCalc, RuleOf72, TillCounter } from "../tools/apps/finance";
import {
  DiscountCalc,
  DiscountStacking,
  MarkupVsMargin,
  ProfitMargin,
  VatDiscount,
  VatExtract,
} from "../tools/apps/pricing";

import { BatchTimer, PackingChecklist, PrepQueue } from "./ops";
import { LowStockRules, ShiftRoutine, ShipmentTracker } from "./autoTools";

import BizDashboardScreen from "../../screens/BizDashboardScreen";
import PricingScreen from "../../screens/PricingScreen";
import PromosScreen from "../../screens/PromosScreen";
import SuppliersScreen from "../../screens/SuppliersScreen";
import ZReportScreen from "../../screens/ZReportScreen";

// The register's resolution table: one entry per catalogue target.
//
// posCatalog.js is the *description* of the six zones; this file is what
// actually exists behind them. Keeping them apart is what lets the hub assert,
// at module load, that no category advertises a tool it cannot open — see
// UNRESOLVED below, which the screen surfaces in development rather than
// waiting for a user to tap a dead tile.
//
// TransitLoadCalc comes straight from ./apps/vending rather than through
// TOOL_APPS: it is a business-only tool, and the register is its home now.

export const POS_APPS = {
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
  suppliers: SuppliersScreen,
  pricing: PricingScreen,
  zreport: ZReportScreen,
  dash: BizDashboardScreen,
  promos: PromosScreen,
};

export function resolveTarget(target) {
  if (!target) return null;
  if (target.kind === "screen") return POS_SCREENS[target.key] || null;
  return POS_APPS[target.key] || null;
}
