/** Tiny WebAudio synth — hits, clangs, ult stingers. No asset files. */
class Synth {
  private ctx: AudioContext | null = null;
  muted = false;
  /** Silences simulation sounds (e.g. background demo fights). */
  suppressed = false;

  private ac(): AudioContext | null {
    if (typeof window === "undefined") return null; // headless sim (tests/balance)
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    this.ac();
  }

  private tone(freq: number, type: OscillatorType, dur: number, vol: number, slide?: number) {
    const c = this.ac();
    if (!c || this.muted || this.suppressed) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.005 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, filterFreq: number) {
    const c = this.ac();
    if (!c || this.muted || this.suppressed) return;
    const t0 = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.003 + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0);
  }

  hit(big: boolean) {
    this.noise(big ? 0.14 : 0.08, big ? 0.3 : 0.16, 900);
    this.tone(big ? 140 : 200, "square", 0.08, 0.1, 60);
  }
  clash() {
    this.tone(2200 + Math.random() * 1000, "triangle", 0.09, 0.13, 500);
    this.noise(0.05, 0.08, 4000);
  }
  pew() { this.tone(1200, "square", 0.09, 0.09, 200); }
  magic() { this.tone(500, "sine", 0.25, 0.12, 1400); }
  freeze() { this.tone(1800, "sine", 0.35, 0.12, 300); }
  dash() { this.noise(0.12, 0.12, 2200); }
  ult() {
    this.tone(320, "sawtooth", 0.4, 0.14, 90);
    this.tone(640, "triangle", 0.35, 0.12, 1280);
    this.noise(0.25, 0.16, 1400);
  }
  death() { this.noise(0.4, 0.3, 500); this.tone(110, "sawtooth", 0.35, 0.16, 40); }
  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.tone(f, "triangle", 0.25, 0.12), i * 110));
  }
}

export const Sound = new Synth();
