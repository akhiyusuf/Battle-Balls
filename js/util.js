// Small math / geometry helpers shared by the engine.
"use strict";

const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

function circleHit(x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1, dy = y2 - y1, r = r1 + r2;
  return dx * dx + dy * dy <= r * r;
}

// Closest point on segment AB to point P.
function closestOnSeg(ax, ay, bx, by, px, py) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / len2;
  t = clamp(t, 0, 1);
  return { x: ax + abx * t, y: ay + aby * t };
}

// Capsule (segment AB with radius r) vs circle.
function capsuleCircleHit(ax, ay, bx, by, r, cx, cy, cr) {
  const p = closestOnSeg(ax, ay, bx, by, cx, cy);
  return circleHit(p.x, p.y, r, cx, cy, cr);
}

// Capsule vs capsule (coarse: sample closest points both ways).
function capsuleCapsuleHit(a, b) {
  const p1 = closestOnSeg(a.ax, a.ay, a.bx, a.by, (b.ax + b.bx) / 2, (b.ay + b.by) / 2);
  if (capsuleCircleHit(b.ax, b.ay, b.bx, b.by, b.r, p1.x, p1.y, a.r)) return p1;
  const p2 = closestOnSeg(b.ax, b.ay, b.bx, b.by, (a.ax + a.bx) / 2, (a.ay + a.by) / 2);
  if (capsuleCircleHit(a.ax, a.ay, a.bx, a.by, a.r, p2.x, p2.y, b.r)) return p2;
  // Endpoint checks catch crossings the midpoint samples miss.
  for (const [px, py] of [[a.ax, a.ay], [a.bx, a.by]]) {
    if (capsuleCircleHit(b.ax, b.ay, b.bx, b.by, b.r, px, py, a.r)) return { x: px, y: py };
  }
  for (const [px, py] of [[b.ax, b.ay], [b.bx, b.by]]) {
    if (capsuleCircleHit(a.ax, a.ay, a.bx, a.by, a.r, px, py, b.r)) return { x: px, y: py };
  }
  return null;
}

// Generic weapon-collider vs circle test. Colliders are
// {type:'capsule', ax,ay,bx,by,r} or {type:'circle', x,y,r}.
function colliderCircleHit(col, cx, cy, cr) {
  if (col.type === "capsule") return capsuleCircleHit(col.ax, col.ay, col.bx, col.by, col.r, cx, cy, cr);
  return circleHit(col.x, col.y, col.r, cx, cy, cr);
}

// Weapon collider vs weapon collider; returns a contact point or null.
function colliderColliderHit(a, b) {
  if (a.type === "circle" && b.type === "circle") {
    if (circleHit(a.x, a.y, a.r, b.x, b.y, b.r)) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return null;
  }
  if (a.type === "capsule" && b.type === "capsule") return capsuleCapsuleHit(a, b);
  const cap = a.type === "capsule" ? a : b;
  const cir = a.type === "capsule" ? b : a;
  if (capsuleCircleHit(cap.ax, cap.ay, cap.bx, cap.by, cap.r, cir.x, cir.y, cir.r)) {
    return closestOnSeg(cap.ax, cap.ay, cap.bx, cap.by, cir.x, cir.y);
  }
  return null;
}
