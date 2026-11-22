// A routine's sound and buzz at each change. iOS only plays Web Audio after a
// tap (and not in silent mode) and has no vibration, so these are a help, not
// something to rely on.

let ctx: AudioContext | null = null;

/** Allow sound: call from a tap (Start, Resume) before any cue. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch {
    // no Web Audio: cues stay silent
  }
}

function tone(freq: number, ms: number, delay = 0) {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

const buzz = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
};

export const cue = {
  /** The 3-2-1 before a change. */
  tick: () => tone(660, 90),
  /** A habit starts. */
  habit: () => {
    tone(990, 380);
    buzz(300);
  },
  /** A break starts. */
  break: () => {
    tone(440, 380);
    buzz([100, 80, 100]);
  },
  /** The routine's done. */
  done: () => {
    tone(660, 150);
    tone(880, 150, 0.18);
    tone(1320, 450, 0.36);
    buzz([100, 60, 100, 60, 300]);
  },
};
