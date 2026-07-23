// Reject a promise if it doesn't settle within `ms` — used to guard cloud
// calls (e.g. Firestore) so the initial loading spinner can't hang forever.
export function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// Small fetch wrapper with a timeout so a hung request can't spin forever.
export async function fetchJson(url, { timeout = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
