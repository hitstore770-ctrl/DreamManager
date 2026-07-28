// Copy CanvasKit's WASM into public/ so `expo export` serves it at
// /canvaskit.wasm, which is where Aurora's LoadSkiaWeb looks for it.
//
// The binary is 8MB, so it is gitignored and regenerated here instead of being
// committed. If this fails the app is unaffected: Aurora probes the Skia
// runtime before using it and falls back to an SVG wash when it is absent.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "canvaskit-wasm", "bin", "full", "canvaskit.wasm");
const destDir = path.join(__dirname, "..", "public");
const dest = path.join(destDir, "canvaskit.wasm");

try {
  if (!fs.existsSync(src)) {
    console.log("[canvaskit] source not found; skipping (Skia web will use the SVG fallback)");
    process.exit(0);
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[canvaskit] copied ${(fs.statSync(dest).size / 1e6).toFixed(1)}MB -> public/canvaskit.wasm`);
} catch (e) {
  // Never fail an install over an optional asset.
  console.log("[canvaskit] copy skipped:", e.message);
}
