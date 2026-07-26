// One-shot sound effects via expo-audio (the SDK 57 replacement for the
// deprecated expo-av). Best-effort: any failure (unsupported platform, missing
// audio output, autoplay policy on web) is swallowed so the POS never breaks
// over a sound.

let cachingPlayer = null;

export function playCaching() {
  try {
    if (!cachingPlayer) {
      const { createAudioPlayer } = require("expo-audio");
      cachingPlayer = createAudioPlayer(require("../../assets/sounds/cashreg.wav"));
    }
    cachingPlayer.seekTo(0);
    cachingPlayer.play();
  } catch {
    /* no-op */
  }
}
