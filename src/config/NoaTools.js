import { fetchDirections, fetchPlaces, isGoogleMapsConfigured } from "./googleMaps";
import { allCosts, saveCost } from "../utils/costStore";
import { quotaSnapshot } from "../utils/quotaTracker";

// Noa's toolkit: the things she can go and look up.
//
// Each tool is a pair — the async function that does the work, and the schema
// that tells the model when to reach for it. They live next to each other on
// purpose: a declaration kept in a different file from its implementation
// drifts the first time someone adds a parameter, and the failure mode is the
// model calling a function with arguments it does not accept.
//
// These are live now. Every payload below is a real Google Maps Platform
// response, condensed. The invented returns are gone, along with the markers
// that flagged them as invented and the persona line that told Noa to hedge.
//
// Which makes the failure path the important part. Noa is now instructed to
// present tool results as fact, so a tool that returns something empty-looking
// when a call fails would have her state a confident answer built on nothing.
// Every failure therefore comes back as an explicit `{ ok: false, error,
// message }` that says in words that the lookup did not happen. "I could not
// reach the transit feed" is a good answer; an invented departure time is not.

// ---------------------------------------------------------------------------
// 1. Public transit
// ---------------------------------------------------------------------------

export async function getTransitRoute(origin, destination, options = {}) {
  return fetchDirections(origin, destination, "transit", options);
}

export const getTransitRouteDeclaration = {
  name: "getTransitRoute",
  description:
    "Look up LIVE bus and public transit options between two places, from Google's real-time transit feed. " +
    "Returns real departure times, line numbers, boarding stops and fares as of right now. " +
    "Use this ONLY when the user asks about live bus times, a transit route, which line to take, " +
    "or how to get somewhere by public transport. " +
    "Do NOT use it for general knowledge, coding questions, business advice, arithmetic, or " +
    "anything you can already answer from the conversation. If the user is discussing transit in " +
    "the abstract rather than asking how to travel right now, answer directly instead of calling this.",
  parameters: {
    type: "object",
    properties: {
      origin: {
        type: "string",
        description:
          "Where the journey starts. A place name, an address, or 'lat,lon'. " +
          "Use the user's GPS coordinates from the system context if they did not name a place.",
      },
      destination: { type: "string", description: "Where the journey ends. A place name, address, or 'lat,lon'." },
    },
    required: ["origin", "destination"],
  },
};

// ---------------------------------------------------------------------------
// 2. Two-wheeler routing
// ---------------------------------------------------------------------------

// Routed as `bicycling`.
//
// Google has no scooter mode outside a handful of Asian markets — `two_wheeler`
// is unsupported in Israel and comes back REQUEST_DENIED — so bicycling is the
// closest available profile and the one this is specified to use. It is a good
// approximation of the *path* a small two-wheeler takes through a town and a
// poor one of its speed, since it is timed for a cyclist. The returned payload
// names the mode it actually used rather than claiming to be a scooter routing
// engine, so Noa is reporting what Google returned instead of an assumption.
export async function getScooterRoute(origin, destination, options = {}) {
  const res = await fetchDirections(origin, destination, "bicycling", options);
  if (!res.ok) return res;
  return {
    ...res,
    routedAs: "bicycling",
    timingNote:
      "Duration is Google's cycling estimate. A motor scooter covers this distance faster — " +
      "treat the distance and the path as exact and the minutes as an upper bound.",
  };
}

export const getScooterRouteDeclaration = {
  name: "getScooterRoute",
  description:
    "Look up a LIVE route for a scooter, moped or motorcycle between two places, from Google Maps, " +
    "with real distance, duration and turn-by-turn opening steps. " +
    "Use this ONLY when the user asks about travelling by scooter or two-wheeler specifically. " +
    "Do NOT use it for bus or transit questions — that is getTransitRoute — and do NOT use it for " +
    "general knowledge or for questions about vehicles in the abstract.",
  parameters: {
    type: "object",
    properties: {
      origin: { type: "string", description: "Where the ride starts. A place name, address, or 'lat,lon'." },
      destination: { type: "string", description: "Where the ride ends. A place name, address, or 'lat,lon'." },
    },
    required: ["origin", "destination"],
  },
};

// ---------------------------------------------------------------------------
// 3. Nearby businesses
// ---------------------------------------------------------------------------

export async function findLocalBusiness(query, location, options = {}) {
  return fetchPlaces(query, location, options);
}

export const findLocalBusinessDeclaration = {
  name: "findLocalBusiness",
  description:
    "Search Google Places LIVE for shops, services or businesses near a location, returning real " +
    "names, addresses, ratings and whether each is open right now. " +
    "Use this ONLY when the user asks what is nearby, where to buy or repair something, or " +
    "whether a place is open right now. " +
    "Do NOT use it for general knowledge about companies or brands, for business strategy " +
    "questions, or for anything that is not a search for a physical place near the user.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "What to look for, e.g. 'hardware store', 'pharmacy', 'phone repair'.",
      },
      location: {
        type: "string",
        description:
          "Where to search around, as 'lat,lon' or a place name. " +
          "Use the user's GPS coordinates from the system context if they did not name a place — " +
          "coordinates give distances, a place name does not.",
      },
    },
    required: ["query"],
  },
};

// ---------------------------------------------------------------------------
// 4. Cost of goods
// ---------------------------------------------------------------------------

// The one tool that writes rather than reads.
//
// Everything else here answers a question; this changes the app's state, and
// it does so from a passing remark ("the cables were 4.20 each") rather than
// from a deliberate action. That is the point — nobody opens a spreadsheet to
// log a supplier price — but it is also why the return is verbose. Noa has to
// confirm what she wrote, and name the old value when she overwrote one, so a
// misheard number is caught in the next sentence rather than silently
// reshaping every margin the register reports afterwards.
export async function saveItemCost(itemName, costPrice) {
  const res = await saveCost(itemName, costPrice);
  if (!res.ok) return res;

  return {
    ...res,
    message:
      res.previousCost != null && res.previousCost !== res.cost
        ? `Updated the cost of "${res.name}" from ${res.previousCost} to ${res.cost}. Tell the user you replaced the old figure.`
        : `Recorded: "${res.name}" costs ${res.cost}. Confirm the item and the number back to the user.`,
  };
}

export const saveItemCostDeclaration = {
  name: "saveItemCost",
  description:
    "Save what an item or supply costs the user to buy (its cost price / COGS) into the app's cost ledger, " +
    "so the register can calculate real profit at checkout. " +
    "When the user tells you how much an item or supply cost them to buy, use this tool to log it in the system. " +
    "This applies to any mention of a purchase price — 'the cables cost me 4.20 each', 'I paid 12 shekels a box'. " +
    "Do NOT use it for the price the user SELLS at, for a total spend across many units, or for a price the user " +
    "is only asking about or considering. Only log a per-unit cost the user has actually stated.",
  parameters: {
    type: "object",
    properties: {
      itemName: {
        type: "string",
        description: "The item's name as the user would say it, e.g. 'כבל USB-C'. Keep it short and singular.",
      },
      costPrice: {
        type: "number",
        description: "What one unit costs to buy, as a number. Never the selling price, and never a total for several units.",
      },
    },
    required: ["itemName", "costPrice"],
  },
};

// Re-exported so the register can read the same ledger Noa writes.
export { allCosts };

// ---------------------------------------------------------------------------
// 5. Quota
// ---------------------------------------------------------------------------

// How much of the Gemini allowance this app has used.
//
// The token counts are the API's own, off `usageMetadata` on every response,
// so they are exact rather than derived from character counts. What the tool
// deliberately does not do is invent a ceiling: there is no billing API being
// read here, quota limits differ per model and tier and Google moves them, and
// "you have 400 requests left" is the kind of confident number a person plans
// their evening around. Unconfigured limits come back null with an instruction
// to say so.
export async function checkQuota() {
  return quotaSnapshot();
}

export const checkQuotaDeclaration = {
  name: "checkQuota",
  description:
    "Report how much of the Gemini API allowance this app has used — exact token counts (input, output, total), " +
    "request counts for today and this session, and the current per-minute rate. " +
    "Use this whenever the user asks how much quota, credit or tokens they have left or have used " +
    "('כמה נשאר לי', 'כמה טוקנים שרפתי', 'how much quota is left'). " +
    "Always repeat the limitations the tool returns: the figures cover only this app on this device, and where " +
    "no limit is configured there is no 'remaining' number to give. Never estimate a ceiling that the tool " +
    "reported as null. Do NOT use this tool for questions about money, sales or business costs.",
  parameters: { type: "object", properties: {}, required: [] },
};

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

// One map from tool name to implementation. The runner dispatches through this,
// so a declared-but-unimplemented tool is impossible to ship: the two lists are
// built from the same object.
export const NOA_TOOL_HANDLERS = {
  getTransitRoute: (args = {}, options) => getTransitRoute(args.origin, args.destination, options),
  getScooterRoute: (args = {}, options) => getScooterRoute(args.origin, args.destination, options),
  findLocalBusiness: (args = {}, options) => findLocalBusiness(args.query, args.location, options),
  saveItemCost: (args = {}) => saveItemCost(args.itemName, args.costPrice),
  checkQuota: () => checkQuota(),
};

export const NOA_TOOL_DECLARATIONS = [
  getTransitRouteDeclaration,
  getScooterRouteDeclaration,
  findLocalBusinessDeclaration,
  saveItemCostDeclaration,
  checkQuotaDeclaration,
];

// The shape Gemini wants under `tools`.
export const NOA_TOOLS = [{ functionDeclarations: NOA_TOOL_DECLARATIONS }];

// Re-exported so a screen can tell the user the key is missing before Noa has
// to discover it mid-answer.
export { isGoogleMapsConfigured };

// Run a call the model asked for. Unknown names are reported back as an error
// payload rather than thrown: a hallucinated tool name should make the model
// apologise and carry on, not crash the chat.
export async function runNoaTool(name, args, options) {
  const handler = NOA_TOOL_HANDLERS[name];
  if (!handler) {
    return {
      ok: false,
      error: "UNKNOWN_TOOL",
      message: `Unknown tool "${name}". Available: ${Object.keys(NOA_TOOL_HANDLERS).join(", ")}.`,
    };
  }
  try {
    return await handler(args || {}, options);
  } catch (e) {
    return { ok: false, error: "TOOL_THREW", message: String(e?.message || e) };
  }
}
