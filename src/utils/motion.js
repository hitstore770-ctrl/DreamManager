import { FadeIn, FadeInDown, LinearTransition, ZoomIn } from "react-native-reanimated";

// Shared motion vocabulary — "Luminous & Alive". Everything that appears,
// expands or reacts to a press moves on a spring.

// Tab roots: a light zoom-and-fade so the screen feels like it arrives.
export const SCREEN_IN = ZoomIn.duration(320).springify().damping(18);

// A softer alternative for screens whose content is already animating.
export const SCREEN_FADE = FadeIn.duration(260);

// Staggered list/grid entrances. Capped so a long grid never crawls.
export const listEntry = (index, step = 100, cap = 700) =>
  FadeInDown.delay(Math.min(index * step, cap)).springify().damping(14);

// Anything that grows, collapses or reorders.
export const FLUID = LinearTransition.springify().damping(14);
