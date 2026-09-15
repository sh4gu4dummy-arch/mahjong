let muted = false;
let ctx: AudioContext | null = null;

export function isMuted(): boolean {
  return muted;
}

export function setMuted(v: boolean): void {
  muted = v;
  try {
    localStorage.setItem("aa-mahjong-mute", v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function loadMute(): void {
  try {
    muted = localStorage.getItem("aa-mahjong-mute") === "1";
  } catch {
    muted = false;
  }
}

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function beep(freq: number, dur: number, type: OscillatorType, gain = 0.08, delay = 0): void {
  if (muted) return;
  const c = ac();
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function resume(): void {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export const sfx = {
  discard() {
    beep(180, 0.08, "triangle", 0.06);
  },
  draw() {
    beep(420, 0.07, "sine", 0.04);
  },
  claim() {
    beep(520, 0.1, "square", 0.05);
    beep(780, 0.12, "square", 0.04, 0.08);
  },
  win() {
    beep(523, 0.16, "sine", 0.07);
    beep(659, 0.16, "sine", 0.07, 0.12);
    beep(784, 0.28, "sine", 0.08, 0.24);
  },
  click() {
    beep(640, 0.04, "square", 0.03);
  },
};
