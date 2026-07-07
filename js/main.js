// Match flow, menu, rendering loop, and the clip recorder ("studio").
"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
// Render at 2x for crisp 1080x1920 output (TikTok/Shorts resolution).
canvas.width = 1080;
canvas.height = 1920;
ctx.scale(2, 2);

const menuEl = document.getElementById("menu");
const hudEl = document.getElementById("hud");
const rosterGrid = document.getElementById("rosterGrid");
const pickHint = document.getElementById("pickHint");

let state = "menu";        // menu | intro | countdown | fight | ko | winner
let world = null;
let stateT = 0;            // seconds in current state
let timescale = 1;
let hitstop = 0;           // seconds of near-frozen time remaining
let slowmo = 0;            // seconds of slow motion remaining
let winners = [];
let confettiT = 0;

// ---------- menu ----------

const selected = []; // charIds in pick order

function buildMenu() {
  rosterGrid.innerHTML = "";
  for (const c of ROSTER) {
    const el = document.createElement("div");
    el.className = "charCard";
    el.style.setProperty("--c", c.color);
    el.innerHTML = `<div class="icon">${c.icon}</div><div class="name">${c.name}</div><div class="desc">${c.desc}</div>`;
    el.addEventListener("click", () => {
      Sound.unlock();
      const i = selected.indexOf(c.id);
      if (i >= 0) selected.splice(i, 1);
      else selected.push(c.id);
      refreshMenu();
    });
    el.dataset.id = c.id;
    rosterGrid.appendChild(el);
  }
  refreshMenu();
}

function refreshMenu() {
  for (const el of rosterGrid.children) {
    const i = selected.indexOf(el.dataset.id);
    el.classList.toggle("selected", i >= 0);
    let badge = el.querySelector(".order");
    if (i >= 0) {
      if (!badge) {
        badge = document.createElement("div");
        badge.className = "order";
        el.appendChild(badge);
      }
      badge.textContent = i + 1;
    } else if (badge) badge.remove();
  }
  pickHint.textContent = selected.length
    ? `${selected.length} picked — 1v1/FFA: everyone for themselves · 2v2: picks 1+2 vs 3+4`
    : "Pick fighters (in order), then choose a mode";
}

function startMatch(lineup) {
  Sound.unlock();
  world = new World(lineup);
  winners = [];
  timescale = 1; hitstop = 0; slowmo = 0;
  state = "intro";
  stateT = 0;
  menuEl.classList.add("hidden");
  hudEl.classList.remove("hidden");
}

document.getElementById("btnFight").addEventListener("click", () => {
  if (selected.length < 2) { flashHint("Pick at least 2 fighters"); return; }
  startMatch(selected.map((id, i) => ({ charId: id, team: i })));
});
document.getElementById("btnRandom").addEventListener("click", () => {
  const pool = ROSTER.map(c => c.id);
  const a = pick(pool);
  let b = pick(pool);
  while (b === a) b = pick(pool);
  startMatch([{ charId: a, team: 0 }, { charId: b, team: 1 }]);
});
document.getElementById("btn2v2").addEventListener("click", () => {
  if (selected.length !== 4) { flashHint("2v2 needs exactly 4 picks"); return; }
  startMatch(selected.map((id, i) => ({ charId: id, team: i < 2 ? 0 : 1 })));
});
document.getElementById("btnFFA").addEventListener("click", () => {
  const ids = selected.length >= 3 ? selected : ROSTER.map(c => c.id);
  startMatch(ids.map((id, i) => ({ charId: id, team: i })));
});

function flashHint(msg) {
  pickHint.textContent = msg;
  pickHint.style.color = "#ff8a5c";
  setTimeout(() => { pickHint.style.color = ""; refreshMenu(); }, 1400);
}

// ---------- HUD ----------

document.getElementById("btnBack").addEventListener("click", backToMenu);
document.getElementById("btnMute").addEventListener("click", (e) => {
  const m = Sound.toggleMute();
  e.target.textContent = m ? "🔇" : "🔊";
});

function backToMenu() {
  if (recorder) stopRecording();
  state = "menu";
  world = null;
  menuEl.classList.remove("hidden");
  hudEl.classList.add("hidden");
}

// ---------- recorder (export fights as .webm clips) ----------

let recorder = null;
let recChunks = [];
const btnRec = document.getElementById("btnRec");
btnRec.addEventListener("click", () => (recorder ? stopRecording() : startRecording()));

function startRecording() {
  if (!canvas.captureStream || !window.MediaRecorder) {
    flashHint("Recording not supported in this browser");
    return;
  }
  const stream = canvas.captureStream(60);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find(m => MediaRecorder.isTypeSupported(m)) || "";
  recChunks = [];
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(recChunks, { type: "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `battle-balls-${Date.now()}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  recorder.start();
  btnRec.classList.add("recording");
}

function stopRecording() {
  recorder.stop();
  recorder = null;
  btnRec.classList.remove("recording");
}

// ---------- match flow / loop ----------

const STEP = 1 / 120;
let acc = 0;
let last = performance.now();

function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state === "menu") {
    drawIdle(dt);
    return;
  }

  stateT += dt;

  // Time effects
  hitstop = Math.max(0, hitstop - dt);
  slowmo = Math.max(0, slowmo - dt);
  timescale = hitstop > 0 ? 0.06 : slowmo > 0 ? 0.25 : 1;

  const simulate = state === "fight" || state === "ko";
  if (simulate) {
    acc += dt * timescale;
    acc = Math.min(acc, 0.1);
    while (acc >= STEP) {
      world.update(STEP);
      acc -= STEP;
    }
    handleEvents();
  } else {
    // Keep FX (particles/rings) alive during intro & winner screens.
    world.updateFx(dt);
  }

  world.draw(ctx);

  if (state === "intro") {
    drawIntro();
    if (stateT >= 1.7) { state = "countdown"; stateT = 0; countPlayed = -1; }
  } else if (state === "countdown") {
    drawCountdown();
    if (stateT >= 2.2) { state = "fight"; stateT = 0; Sound.go(); }
  } else if (state === "fight" && stateT < 0.6) {
    drawBanner("FIGHT!", "#ffe259", 1 - stateT / 0.6);
  } else if (state === "ko") {
    drawBanner("K.O.", "#ff5c4d", 1);
    if (stateT >= 1.3) { state = "winner"; stateT = 0; confettiT = 0; Sound.win(); }
  } else if (state === "winner") {
    drawWinner(dt);
  }
}

function handleEvents() {
  for (const ev of world.events) {
    if (ev.type === "hit" && ev.dmg >= 12) hitstop = Math.max(hitstop, 0.07);
    if (ev.type === "death") {
      const teams = world.aliveTeams();
      if (teams.length <= 1 && state === "fight") {
        winners = world.balls.filter(b => b.alive);
        state = "ko";
        stateT = 0;
        slowmo = 1.3;
      } else {
        slowmo = Math.max(slowmo, 0.35);
      }
    }
  }
  world.events.length = 0;

  // Stalemate safety: if a fight somehow drags past 3 minutes, highest HP wins.
  if (state === "fight" && world.time > 180) {
    const alive = world.alivBalls().sort((a, b) => b.hp - a.hp);
    winners = [alive[0]];
    state = "ko"; stateT = 0; slowmo = 1.3;
  }
}

function drawBanner(text, color, alpha) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.textAlign = "center";
  ctx.font = "900 84px system-ui, sans-serif";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.strokeText(text, 270, 480);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.fillText(text, 270, 480);
  ctx.restore();
}

function drawIntro() {
  const bs = world.balls;
  const t = Math.min(1, stateT / 0.5);
  const ease = 1 - Math.pow(1 - t, 3);
  ctx.save();
  ctx.fillStyle = "rgba(5,5,10,0.55)";
  ctx.fillRect(0, 0, 540, 960);

  if (bs.length === 2) {
    const y1 = 330, y2 = 630;
    const x1 = lerp(-160, 165, ease), x2 = lerp(700, 375, ease);
    drawIntroCard(bs[0], x1, y1);
    drawIntroCard(bs[1], x2, y2);
  } else {
    ctx.textAlign = "center";
    bs.forEach((b, i) => {
      const cols = bs.length > 4 ? 2 : 1;
      const col = i % cols, row = Math.floor(i / cols);
      const x = cols === 1 ? 270 : 160 + col * 220;
      const y = 250 + row * 110 - (1 - ease) * 40;
      ctx.globalAlpha = ease;
      ctx.font = "44px serif";
      ctx.fillText(b.icon, x - 70, y + 12);
      ctx.font = "800 26px system-ui, sans-serif";
      ctx.fillStyle = b.color;
      ctx.fillText(b.name, x + 30, y + 8);
      ctx.globalAlpha = 1;
    });
  }

  if (stateT > 0.45) {
    const p = Math.min(1, (stateT - 0.45) / 0.25);
    ctx.globalAlpha = p;
    ctx.textAlign = "center";
    ctx.font = `900 ${Math.floor(lerp(160, 96, p))}px system-ui, sans-serif`;
    ctx.lineWidth = 12;
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText("VS", 270, 505);
    ctx.fillStyle = "#ffe259";
    ctx.shadowColor = "#ff7a3d";
    ctx.shadowBlur = 40;
    ctx.fillText("VS", 270, 505);
  }
  ctx.restore();
}

function drawIntroCard(b, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = b.color;
  ctx.shadowBlur = 30;
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = "56px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(b.icon, 0, 2);
  ctx.font = "900 30px system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeText(b.name, 0, 102);
  ctx.fillText(b.name, 0, 102);
  ctx.restore();
}

let countPlayed = -1;
function drawCountdown() {
  const n = Math.max(1, 3 - Math.floor(stateT / 0.7));
  if (n !== countPlayed) { countPlayed = n; Sound.count(); }
  const p = (stateT % 0.7) / 0.7;
  ctx.save();
  ctx.globalAlpha = 1 - p * 0.7;
  ctx.textAlign = "center";
  ctx.font = `900 ${Math.floor(lerp(150, 110, p))}px system-ui, sans-serif`;
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.strokeText(String(n), 270, 510);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#4da6ff";
  ctx.shadowBlur = 30;
  ctx.fillText(String(n), 270, 510);
  ctx.restore();
}

function drawWinner(dt) {
  confettiT += dt;
  if (confettiT < 1.6 && Math.random() < 0.6) {
    world.particles.push({
      x: rand(40, 500), y: 120, vx: rand(-60, 60), vy: rand(120, 320),
      life: rand(0.8, 1.6), t: 0, size: rand(2, 5),
      color: pick(TEAM_HUES),
    });
  }
  ctx.save();
  ctx.fillStyle = "rgba(5,5,10,0.45)";
  ctx.fillRect(0, 0, 540, 960);
  ctx.textAlign = "center";
  const label = winners.length === 0 ? "DRAW"
    : winners.length === 1 ? winners[0].name
    : winners.map(w => w.name).join(" & ");
  const sub = winners.length === 0 ? "" : winners.length === 1 ? "WINS!" : "WIN!";
  if (winners[0]) {
    ctx.font = "110px serif";
    ctx.fillText(winners.map(w => w.icon).join(" "), 270, 400);
  }
  ctx.font = "900 54px system-ui, sans-serif";
  ctx.lineWidth = 9;
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.strokeText(label, 270, 500);
  ctx.fillStyle = winners[0] ? winners[0].color : "#fff";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 26;
  ctx.fillText(label, 270, 500);
  if (sub) {
    ctx.shadowBlur = 0;
    ctx.font = "900 40px system-ui, sans-serif";
    ctx.fillStyle = "#ffe259";
    ctx.strokeText(sub, 270, 556);
    ctx.fillText(sub, 270, 556);
  }
  if (stateT > 1) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(stateT * 5);
    ctx.font = "700 18px system-ui, sans-serif";
    ctx.fillStyle = "#cfd3e4";
    ctx.fillText("tap for menu · R for rematch", 270, 640);
  }
  ctx.restore();
}

// Idle menu backdrop: slow demo fight blurred behind the menu.
let idleWorld = null;
function drawIdle(dt) {
  if (!idleWorld || idleWorld.aliveTeams().length <= 1) {
    const pool = ROSTER.map(c => c.id);
    const a = pick(pool);
    let b = pick(pool);
    while (b === a) b = pick(pool);
    idleWorld = new World([{ charId: a, team: 0 }, { charId: b, team: 1 }]);
  }
  Sound.suppress(true);
  idleWorld.update(Math.min(dt, 0.033));
  Sound.suppress(false);
  idleWorld.events.length = 0;
  idleWorld.draw(ctx);
}

canvas.addEventListener("click", () => {
  Sound.unlock();
  if (state === "winner") backToMenu();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R") {
    if (world && (state === "winner" || state === "fight" || state === "ko")) {
      startMatch(world.balls.map(b => ({ charId: b.char.id, team: b.team })));
    }
  }
  if (e.key === "Escape" && state !== "menu") backToMenu();
});

// URL params: ?fight=bladesman,berserker (auto-starts), ?ffa=1, ?auto=1
function handleParams() {
  const q = new URLSearchParams(location.search);
  if (q.get("fight")) {
    const ids = q.get("fight").split(",").map(s => s.trim()).filter(id => ROSTER_BY_ID[id]);
    if (ids.length >= 2) startMatch(ids.map((id, i) => ({ charId: id, team: i })));
  } else if (q.get("ffa")) {
    startMatch(ROSTER.map((c, i) => ({ charId: c.id, team: i })));
  } else if (q.get("auto")) {
    document.getElementById("btnRandom").click();
  }
}

buildMenu();
handleParams();
requestAnimationFrame(loop);
