// Ballistics for the coin drop, as numbers rather than as guesses.
//
// The old drop was a 540ms tween with an ease-in curve. That reads as "falling"
// but it is not falling: the duration did not depend on the distance, so a coin
// dropped into a tall jar and a short one took exactly as long, and there was
// no impact to speak of. These helpers derive the timings from a gravity
// constant, so the motion stays consistent whatever the geometry becomes.
//
// Everything here is a plain function of numbers, callable from the JS thread
// when building an animation and from a worklet when driving one.

// Pixels per second squared. Real gravity (9.81 m/s²) is meaningless here
// because there is no mapping from pixels to metres; this is tuned so a drop
// the height of the jar lands in about a third of a second, which is the point
// where the eye reads "dropped" rather than "thrown" or "lowered".
export const GRAVITY = 2600;

// Restitution: the fraction of *height* returned by a bounce. Metal on glass is
// lively; 0.28 gives two visible bounces and a third that is barely a shiver,
// which is what a shekel in a jar actually does.
export const RESTITUTION = 0.28;

// Time to fall a given distance from rest. h = ½gt²  →  t = √(2h/g).
export function fallMs(distance, g = GRAVITY) {
  if (!(distance > 0)) return 0;
  return Math.sqrt((2 * distance) / g) * 1000;
}

// One bounce to apex and back down: h' = e²·h, and the round trip is twice the
// fall time from that apex.
export function bounceMs(height, g = GRAVITY) {
  return 2 * fallMs(height, g);
}

/**
 * The full arc for a coin dropped from `fromY` onto `floorY`.
 *
 * Returns the landing time, the bounces (each with its apex height and
 * duration), and the total time to rest — so the caller can schedule the
 * credit, the haptic and the settle against real numbers instead of against a
 * hand-counted stack of delays that silently drifts when one of them changes.
 */
export function dropPlan(distance, { g = GRAVITY, e = RESTITUTION, maxBounces = 3 } = {}) {
  const impactMs = fallMs(distance, g);
  const bounces = [];
  let height = distance;

  for (let i = 0; i < maxBounces; i += 1) {
    height *= e * e;
    // Below a couple of pixels the bounce is invisible and only costs frames.
    if (height < 2) break;
    bounces.push({ height, ms: bounceMs(height, g) });
  }

  const totalMs = impactMs + bounces.reduce((sum, b) => sum + b.ms, 0);
  return { impactMs, bounces, totalMs };
}

// Impact squash, scaled by how hard the coin arrives. A coin that has already
// bounced twice should barely deform. Velocity at impact is v = √(2gh), which
// is normalised against the full-height drop so the first landing squashes most.
export function squashFor(height, fullHeight) {
  if (!(fullHeight > 0)) return 1;
  const v = Math.sqrt(Math.max(0, height) / fullHeight); // ∝ velocity
  return Math.max(0, Math.min(1, v));
}
