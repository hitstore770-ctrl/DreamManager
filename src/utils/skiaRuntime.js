import { useEffect, useState } from "react";
import { Platform } from "react-native";

// The one place that decides whether Skia can draw.
//
// There must be exactly one of these. Two modules each running their own
// loader is not merely wasteful — it is wrong, because the order of two steps
// matters and only one of them can go first:
//
//   1. CanvasKit's WASM has to be fetched and instantiated (web only).
//   2. `@shopify/react-native-skia` has to be imported.
//
// The main module builds its `Skia` object out of `global.CanvasKit` when it
// is first evaluated. Import it before the wasm lands and `Skia` is `undefined`
// — permanently, because module evaluation happens once. Nothing throws; the
// probe just quietly fails and the fallback renders forever. That is a
// difficult bug to see, because a fallback that looks fine is exactly what a
// working feature also looks like.
//
// So: load, then require, then verify by asking for a real Paint. Resolving
// the loader is not proof — it can return with a half-wired CanvasKit that
// mounts a <Canvas> and then throws on every frame.

let skia = null;
let started = false;
const listeners = new Set();

async function boot() {
  if (started) return;
  started = true;
  try {
    if (Platform.OS === "web") {
      // eslint-disable-next-line global-require
      const { LoadSkiaWeb } = require("@shopify/react-native-skia/lib/module/web");
      // Served from the site root, next to index.html. Copy it there from
      // node_modules/canvaskit-wasm/bin/full/canvaskit.wasm as a build step;
      // native builds link their own Skia and need none of this.
      await LoadSkiaWeb({ locateFile: (file) => `/${file}` });
    }

    // eslint-disable-next-line global-require
    const mod = require("@shopify/react-native-skia");

    const paint = mod.Skia?.Paint?.();
    if (!paint) throw new Error("Skia runtime did not initialise");

    skia = mod;
  } catch (e) {
    // Say why, once. A silent downgrade is indistinguishable from the effect
    // simply having been built out of gradients, and the difference matters
    // when you are working out whether a development build took.
    console.warn("[skia] unavailable, falling back:", e?.message || e);
    skia = null;
  } finally {
    listeners.forEach((fn) => fn(skia));
  }
}

// The Skia module once it is proven usable, or null. Null is a normal answer:
// Expo Go has no Skia, and neither does a web build without the wasm.
export function useSkia() {
  const [mod, setMod] = useState(skia);

  useEffect(() => {
    if (skia) {
      setMod(skia);
      return undefined;
    }
    let alive = true;
    const fn = (m) => alive && setMod(m);
    listeners.add(fn);
    boot();
    return () => {
      alive = false;
      listeners.delete(fn);
    };
  }, []);

  return mod;
}
