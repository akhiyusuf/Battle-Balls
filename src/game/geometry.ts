/** Small geometry helpers for reliable weapon hit-testing. */

/** Closest point on segment AB to point P. */
export function closestOnSeg(ax: number, ay: number, bx: number, by: number, px: number, py: number) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { x: ax + abx * t, y: ay + aby * t };
}

/** Does capsule (segment AB, radius r) overlap circle (cx,cy,cr)? */
export function capsuleHitsCircle(
  ax: number, ay: number, bx: number, by: number, r: number,
  cx: number, cy: number, cr: number,
): boolean {
  const p = closestOnSeg(ax, ay, bx, by, cx, cy);
  const dx = cx - p.x, dy = cy - p.y;
  const rr = r + cr;
  return dx * dx + dy * dy <= rr * rr;
}
