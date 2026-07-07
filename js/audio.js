// Tiny WebAudio synth for hit/clash/KO sounds — no assets needed.
"use strict";

const Sound = (() => {
  let ctx = null;
  let muted = false;
  let suppressed = false; // silences the menu's background demo fight

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function env(node, t0, attack, decay, peak) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  function tone(freq, type, dur, vol, slide) {
    const c = ac();
    if (!c || muted || suppressed) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    env(g, t0, 0.005, dur, vol);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq) {
    const c = ac();
    if (!c || muted || suppressed) return;
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
    env(g, t0, 0.003, dur, vol);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0);
  }

  return {
    unlock() { ac(); },
    suppress(v) { suppressed = v; },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    hit(big) { noise(big ? 0.14 : 0.08, big ? 0.35 : 0.2, 900); tone(big ? 140 : 200, "square", 0.08, 0.12, 60); },
    clash() { tone(rand(2200, 3200), "triangle", 0.09, 0.16, 500); noise(0.05, 0.1, 4000); },
    pew() { tone(1200, "square", 0.09, 0.1, 200); },
    magic() { tone(500, "sine", 0.25, 0.15, 1400); },
    freeze() { tone(1800, "sine", 0.35, 0.14, 300); },
    dash() { noise(0.12, 0.14, 2200); },
    death() { noise(0.4, 0.4, 500); tone(110, "sawtooth", 0.35, 0.2, 40); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => tone(f, "triangle", 0.25, 0.15), i * 110));
    },
    count() { tone(700, "sine", 0.1, 0.12); },
    go() { tone(1050, "sine", 0.25, 0.16); },
  };
})();
