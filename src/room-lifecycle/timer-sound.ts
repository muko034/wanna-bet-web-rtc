const SHORT_BEEP_HZ = 784;
const LONG_BEEP_HZ = 1_047;
const BEEP_VOLUME = 0.25;
/** A short rise and a long fade, so a beep rings like a soft bell instead of clicking on and off. */
const ATTACK_S = 0.01;
const SILENCE = 0.001;
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

  const beep = (at: number, lengthS: number, hz: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = hz;
    gain.gain.setValueAtTime(SILENCE, at);
    gain.gain.linearRampToValueAtTime(BEEP_VOLUME, at + ATTACK_S);
    gain.gain.exponentialRampToValueAtTime(SILENCE, at + lengthS);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + lengthS);
  };

  return {
    play: () => {
      const origin = context.currentTime;
      for (let index = 0; index < SHORT_BEEP_COUNT; index++) {
        beep(origin + index * BEEP_SPACING_S, SHORT_BEEP_S, SHORT_BEEP_HZ);
      }
      beep(origin + SHORT_BEEP_COUNT * BEEP_SPACING_S, LONG_BEEP_S, LONG_BEEP_HZ);
    },
    close: () => void context.close(),
  };
}
