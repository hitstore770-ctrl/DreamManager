// Noa's toolkit: the things she can go and look up.
//
// Each tool is a pair — the async function that does the work, and the schema
// that tells the model when to reach for it. They live next to each other on
// purpose: a declaration kept in a different file from its implementation
// drifts the first time someone adds a parameter, and the failure mode is the
// model calling a function with arguments it does not accept.
//
// EVERY RETURN BELOW IS SIMULATED. Each payload carries `source:
// "mock-not-live"` and a `disclaimer`, which is not decoration — it is fed
// straight back into the model, and Noa's persona already forbids her from
// guessing. Without it she would state invented departure times as fact, in
// Hebrew, with total confidence. When the real Google APIs land, those two
// fields come out and nothing else about the wiring changes.

const MOCK_NOTE = "SIMULATED DATA — not a live API result. Tell the user these figures are placeholders.";

// ---------------------------------------------------------------------------
// 1. Public transit
// ---------------------------------------------------------------------------

export async function getTransitRoute(origin, destination) {
  return {
    source: "mock-not-live",
    disclaimer: MOCK_NOTE,
    origin: origin || "unknown",
    destination: destination || "unknown",
    queriedAt: new Date().toISOString(),
    options: [
      {
        line: "386",
        operator: "Egged",
        boardingStop: "ביתר עילית / מרכז מסחרי",
        departsInMinutes: 12,
        durationMinutes: 35,
        transfers: 0,
        fareIls: 6,
      },
      {
        line: "185",
        operator: "Superbus",
        boardingStop: "ביתר עילית / הרב שך",
        departsInMinutes: 27,
        durationMinutes: 48,
        transfers: 1,
        fareIls: 6,
      },
    ],
    serviceNotes: [
      "Service thins out sharply on Friday afternoons and holiday eves.",
      "No live GPS feed in this payload — treat departure times as estimates.",
    ],
  };
}

export const getTransitRouteDeclaration = {
  name: "getTransitRoute",
  description:
    "Look up bus and public transit options between two places. " +
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
          "Where the journey starts. Use the user's GPS coordinates from the system context if they did not name a place.",
      },
      destination: { type: "string", description: "Where the journey ends." },
    },
    required: ["origin", "destination"],
  },
};

// ---------------------------------------------------------------------------
// 2. Two-wheeler routing
// ---------------------------------------------------------------------------

export async function getScooterRoute(origin, destination) {
  return {
    source: "mock-not-live",
    disclaimer: MOCK_NOTE,
    origin: origin || "unknown",
    destination: destination || "unknown",
    distanceKm: 11.4,
    durationMinutes: 24,
    elevationGainM: 180,
    surface: "mostly paved, one 400m gravel stretch",
    warnings: [
      "Route includes a segment on a road with no shoulder.",
      "Estimated for a 45 km/h two-wheeler; adjust for a slower scooter.",
    ],
  };
}

export const getScooterRouteDeclaration = {
  name: "getScooterRoute",
  description:
    "Look up a route for a scooter, moped or motorcycle between two places, with distance, " +
    "duration and elevation. " +
    "Use this ONLY when the user asks about travelling by scooter or two-wheeler specifically. " +
    "Do NOT use it for bus or transit questions — that is getTransitRoute — and do NOT use it for " +
    "general knowledge or for questions about vehicles in the abstract.",
  parameters: {
    type: "object",
    properties: {
      origin: { type: "string", description: "Where the ride starts." },
      destination: { type: "string", description: "Where the ride ends." },
    },
    required: ["origin", "destination"],
  },
};

// ---------------------------------------------------------------------------
// 3. Nearby businesses
// ---------------------------------------------------------------------------

export async function findLocalBusiness(query, location) {
  return {
    source: "mock-not-live",
    disclaimer: MOCK_NOTE,
    query: query || "unknown",
    location: location || "unknown",
    results: [
      {
        name: "מכולת המרכז",
        category: "grocery",
        distanceMeters: 320,
        openNow: true,
        hours: "07:00–22:00",
        rating: 4.3,
      },
      {
        name: "טכנו-פיקס שירות מחשבים",
        category: "electronics repair",
        distanceMeters: 850,
        openNow: false,
        hours: "09:00–18:00",
        rating: 4.7,
      },
      {
        name: "דלק פזומט",
        category: "fuel",
        distanceMeters: 1600,
        openNow: true,
        hours: "24h",
        rating: 3.9,
      },
    ],
  };
}

export const findLocalBusinessDeclaration = {
  name: "findLocalBusiness",
  description:
    "Find shops, services or businesses near a location, with distance and opening hours. " +
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
          "Where to search around. Use the user's GPS coordinates from the system context if they did not name a place.",
      },
    },
    required: ["query"],
  },
};

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

// One map from tool name to implementation. The runner dispatches through this,
// so a declared-but-unimplemented tool is impossible to ship: the two lists are
// built from the same object.
export const NOA_TOOL_HANDLERS = {
  getTransitRoute: (args = {}) => getTransitRoute(args.origin, args.destination),
  getScooterRoute: (args = {}) => getScooterRoute(args.origin, args.destination),
  findLocalBusiness: (args = {}) => findLocalBusiness(args.query, args.location),
};

export const NOA_TOOL_DECLARATIONS = [
  getTransitRouteDeclaration,
  getScooterRouteDeclaration,
  findLocalBusinessDeclaration,
];

// The shape Gemini wants under `tools`.
export const NOA_TOOLS = [{ functionDeclarations: NOA_TOOL_DECLARATIONS }];

// Run a call the model asked for. Unknown names are reported back as an error
// payload rather than thrown: a hallucinated tool name should make the model
// apologise and carry on, not crash the chat.
export async function runNoaTool(name, args) {
  const handler = NOA_TOOL_HANDLERS[name];
  if (!handler) {
    return { error: `Unknown tool "${name}". Available: ${Object.keys(NOA_TOOL_HANDLERS).join(", ")}.` };
  }
  try {
    return await handler(args || {});
  } catch (e) {
    return { error: String(e?.message || e) };
  }
}
