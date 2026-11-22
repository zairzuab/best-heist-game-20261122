// vision.js — line of sight and vision-cone math.
// Pure functions, no DOM: the headless playtest imports these directly.

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

// Angle from (ax, ay) to (bx, by), in radians.
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Smallest absolute difference between two angles, 0..PI.
export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// Does segment (x1,y1)-(x2,y2) cross rectangle r? Used for sight lines.
export function segmentHitsRect(x1, y1, x2, y2, r) {
  // Quick reject: both ends on one side of the rect.
  if (Math.max(x1, x2) < r.x || Math.min(x1, x2) > r.x + r.w) return false;
  if (Math.max(y1, y2) < r.y || Math.min(y1, y2) > r.y + r.h) return false;
  // An endpoint inside the rect counts as a hit.
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  // Otherwise test the four edges.
  return (
    segmentsCross(x1, y1, x2, y2, r.x, r.y, r.x + r.w, r.y) ||
    segmentsCross(x1, y1, x2, y2, r.x + r.w, r.y, r.x + r.w, r.y + r.h) ||
    segmentsCross(x1, y1, x2, y2, r.x + r.w, r.y + r.h, r.x, r.y + r.h) ||
    segmentsCross(x1, y1, x2, y2, r.x, r.y + r.h, r.x, r.y)
  );
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = side(dx, dy, ax, ay, bx, by);
  const d2 = side(cx, cy, ax, ay, bx, by);
  const d3 = side(bx, by, cx, cy, dx, dy);
  const d4 = side(ax, ay, cx, cy, dx, dy);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function side(px, py, ax, ay, bx, by) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

// True when nothing (no wall) stands between the two points.
export function hasLineOfSight(ax, ay, bx, by, walls) {
  for (const wall of walls) {
    if (segmentHitsRect(ax, ay, bx, by, wall)) return false;
  }
  return true;
}

// Is the target inside the watcher's vision cone (range + angle + sight line)?
export function inVisionCone(watcher, target, range, halfAngle, walls) {
  const d = dist(watcher.x, watcher.y, target.x, target.y);
  if (d > range) return false;
  if (d < 1) return true;
  if (angleDiff(angleTo(watcher.x, watcher.y, target.x, target.y), watcher.angle) > halfAngle) {
    return false;
  }
  return hasLineOfSight(watcher.x, watcher.y, target.x, target.y, walls);
}

// Circle (x, y, radius) vs rectangle collision — used for wall sliding.
export function circleHitsRect(x, y, radius, r) {
  const cx = clamp(x, r.x, r.x + r.w);
  const cy = clamp(y, r.y, r.y + r.h);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < radius * radius;
}

// Does the circle overlap any wall? Returns the first wall hit, or null.
export function circleHitsAnyWall(x, y, radius, walls) {
  for (const wall of walls) {
    if (circleHitsRect(x, y, radius, wall)) return wall;
  }
  return null;
}

// Do the two segments cross (for trip-laser trips)? Inclusive of touching.
export function segmentsTouch(ax, ay, bx, by, cx, cy, dx, dy) {
  if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) return true;
  // Touching at an endpoint or collinear overlap also trips the beam.
  return (
    onSegment(ax, ay, cx, cy, dx, dy) ||
    onSegment(bx, by, cx, cy, dx, dy) ||
    onSegment(cx, cy, ax, ay, bx, by) ||
    onSegment(dx, dy, ax, ay, bx, by)
  );
}

function onSegment(px, py, ax, ay, bx, by) {
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  if (Math.abs(cross) > 1e-9) return false;
  const dot = (px - ax) * (px - bx) + (py - ay) * (py - by);
  return dot <= 0;
}
