/** Tile grid helpers: distances, line of sight and pathfinding. */

export interface Pos {
  x: number;
  y: number;
}

export interface Grid {
  w: number;
  h: number;
  /** 1 = wall/pillar. Row-major. */
  blocked: number[];
}

export function inBounds(g: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.w && y < g.h;
}

export function isBlocked(g: Grid, x: number, y: number): boolean {
  return !inBounds(g, x, y) || g.blocked[y * g.w + x] === 1;
}

/** Chebyshev distance between two rectangles (size x size footprints anchored at top-left). */
export function rectDistance(a: Pos, aSize: number, b: Pos, bSize: number): number {
  const dx = Math.max(0, a.x - (b.x + bSize - 1), b.x - (a.x + aSize - 1));
  const dy = Math.max(0, a.y - (b.y + bSize - 1), b.y - (a.y + aSize - 1));
  return Math.max(dx, dy);
}

export function center(p: Pos, size: number): Pos {
  return { x: p.x + (size - 1) / 2, y: p.y + (size - 1) / 2 };
}

/** Bresenham line of sight between tile centres; walls block. */
export function lineOfSight(g: Grid, a: Pos, b: Pos): boolean {
  let x0 = Math.round(a.x);
  let y0 = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (!(x0 === x1 && y0 === y1)) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
    if (x0 === x1 && y0 === y1) break;
    if (isBlocked(g, x0, y0)) return false;
  }
  return true;
}

/** Line of sight between two footprints: any pair of corner/centre points sees each other. */
export function footprintLos(g: Grid, a: Pos, aSize: number, b: Pos, bSize: number): boolean {
  if (rectDistance(a, aSize, b, bSize) <= 1) return true;
  return lineOfSight(g, center(a, aSize), center(b, bSize));
}

const DIRS: Pos[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

/**
 * Breadth-first path for a 1x1 walker. `goal` decides when a tile is good enough
 * (e.g. "in range of the target"). Diagonal moves can't cut wall corners.
 * Returns the steps after `start` (empty if already at a goal or unreachable).
 */
export function findPath(
  g: Grid,
  start: Pos,
  goal: (x: number, y: number) => boolean,
  occupied: (x: number, y: number) => boolean,
  maxNodes = 2000,
): Pos[] | null {
  if (goal(start.x, start.y)) return [];
  const key = (x: number, y: number) => y * g.w + x;
  const prev = new Map<number, number>();
  const queue: number[] = [key(start.x, start.y)];
  prev.set(queue[0], -1);
  let head = 0;
  while (head < queue.length && head < maxNodes) {
    const k = queue[head++];
    const x = k % g.w;
    const y = Math.floor(k / g.w);
    for (const d of DIRS) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (isBlocked(g, nx, ny)) continue;
      if (d.x !== 0 && d.y !== 0 && (isBlocked(g, x + d.x, y) || isBlocked(g, x, y + d.y))) continue;
      const nk = key(nx, ny);
      if (prev.has(nk)) continue;
      if (occupied(nx, ny) && !goal(nx, ny)) continue;
      prev.set(nk, k);
      if (goal(nx, ny) && !occupied(nx, ny)) {
        const path: Pos[] = [];
        let cur = nk;
        while (cur !== key(start.x, start.y)) {
          path.push({ x: cur % g.w, y: Math.floor(cur / g.w) });
          cur = prev.get(cur)!;
        }
        return path.reverse();
      }
      queue.push(nk);
    }
  }
  return null;
}

/**
 * One "dumb" step toward a target, the way simple monsters move: try the diagonal,
 * then each axis. Lets players use pillars as safe spots.
 */
export function dumbStep(
  g: Grid,
  from: Pos,
  size: number,
  target: Pos,
  free: (x: number, y: number) => boolean,
): Pos | null {
  const cx = from.x + (size - 1) / 2;
  const cy = from.y + (size - 1) / 2;
  const sx = Math.sign(Math.round(target.x - cx));
  const sy = Math.sign(Math.round(target.y - cy));
  const options: Pos[] = [];
  if (sx !== 0 && sy !== 0) options.push({ x: sx, y: sy });
  if (Math.abs(target.x - cx) >= Math.abs(target.y - cy)) {
    if (sx !== 0) options.push({ x: sx, y: 0 });
    if (sy !== 0) options.push({ x: 0, y: sy });
  } else {
    if (sy !== 0) options.push({ x: 0, y: sy });
    if (sx !== 0) options.push({ x: sx, y: 0 });
  }
  for (const d of options) {
    const nx = from.x + d.x;
    const ny = from.y + d.y;
    let ok = true;
    for (let ox = 0; ox < size && ok; ox++) {
      for (let oy = 0; oy < size && ok; oy++) {
        if (isBlocked(g, nx + ox, ny + oy) || !free(nx + ox, ny + oy)) ok = false;
      }
    }
    if (ok && d.x !== 0 && d.y !== 0 && size === 1 && (isBlocked(g, from.x + d.x, from.y) || isBlocked(g, from.x, from.y + d.y))) ok = false;
    if (ok) return { x: nx, y: ny };
  }
  return null;
}
