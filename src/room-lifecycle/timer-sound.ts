const BEEP_HZ = 880;
const BEEP_VOLUME = 0.2;
const SHORT_BEEP_S = 0.15;
const BEEP_SPACING_S = 0.3;
const SHORT_BEEP_COUNT = 3;
const LONG_BEEP_S = 0.8;

export type TimerSound = {
  /** Plays the end-of-Timer signal: three short beeps, then one long one. */
  play: () => void;
  close: () => void;
};

/**
 * Creates the audio context, so call it from a tap: a browser only lets audio start after one.
 * Without Web Audio the sound is silent.
 */
export function createTimerSound(): TimerSound {
  const AudioContextClass: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    return { play: () => undefined, close: () => undefined };
  }
  const context = new AudioContextClass();
  void context.resume();

  const beep = (at: number, lengthS: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = BEEP_HZ;
    gain.gain.value = BEEP_VOLUME;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + lengthS);
  };

  return {
    play: () => {
      const origin = context.currentTime;
      for (let index = 0; index < SHORT_BEEP_COUNT; index++) {
        beep(origin + index * BEEP_SPACING_S, SHORT_BEEP_S);
      }
      beep(origin + SHORT_BEEP_COUNT * BEEP_SPACING_S, LONG_BEEP_S);
    },
    close: () => void context.close(),
  };
}
