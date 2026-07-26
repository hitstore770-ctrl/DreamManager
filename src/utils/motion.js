import { FadeInDown } from "react-native-reanimated";

// Shared motion vocabulary so every screen enters the same way.

// Tab roots: a short fade that settles downward into place.
export const SCREEN_IN = FadeInDown.duration(340).springify().damping(20);

// Staggered list/grid entrances — capped so long lists never feel slow.
export const stagger = (index, step = 45, cap = 320) => Math.min(index * step, cap);
