/**
 * Act map generation (design doc §3.1): a branching map of 8-12 rooms ending in a
 * boss route. Gauntlet acts produce a straight line of waves.
 */
import { C } from '../content';
import type { ActDef } from '../content/types';
import { mod, type Mods } from './mods';
import { Rng } from './rng';
import type { ActMap, MapNode, RoomType } from './state';

export function generateActMap(act: ActDef, m: Mods, rng: Rng): ActMap {
  if (act.gauntlet) return gauntletMap(act);

  const target = rng.int(act.roomCount[0], act.roomCount[1]);
  const bossCount = act.bosses.length;
  // Distribute (target - bosses) rooms across rows of 1-3 nodes, first row 2-3.
  const counts: number[] = [];
  let remaining = target - bossCount;
  counts.push(Math.min(remaining, rng.int(2, 3)));
  remaining -= counts[0];
  while (remaining > 0) {
    const max = Math.min(3, remaining);
    const min = remaining > 3 ? 2 : 1;
    const c = rng.int(min, max);
    counts.push(c);
    remaining -= c;
  }
  // Keep maps deep enough to feel like a trip.
  while (counts.length < 4 && counts.some((c) => c > 1)) {
    const i = counts.findIndex((c) => c > 1);
    counts[i]--;
    counts.push(1);
  }
  // Two bosses need at least two rooms in the last row so each boss has its own route.
  if (bossCount > 1 && counts[counts.length - 1] < 2) {
    const donor = counts.findIndex((c, i) => c > 1 && i < counts.length - 1);
    if (donor >= 0) {
      counts[donor]--;
      counts[counts.length - 1]++;
    }
  }

  const nodes: Record<string, MapNode> = {};
  const rows: string[][] = [];
  counts.forEach((count, row) => {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = `r${row}n${i}`;
      nodes[id] = { id, row, x: (i + 1) / (count + 1), type: 'combat', next: [], shortcuts: [] };
      ids.push(id);
    }
    rows.push(ids);
  });
  const bossRow = rows.length;
  const bossIds: string[] = [];
  act.bosses.forEach((bossId, i) => {
    const id = `boss${i}`;
    nodes[id] = { id, row: bossRow, x: (i + 1) / (bossCount + 1), type: 'boss', next: [], shortcuts: [], boss: bossId };
    bossIds.push(id);
  });
  rows.push(bossIds);

  // Connect each row to the next by horizontal proximity.
  for (let r = 0; r < rows.length - 1; r++) {
    const cur = rows[r];
    const nxt = rows[r + 1];
    for (const id of cur) {
      const n = nodes[id];
      const sorted = [...nxt].sort((a, b) => Math.abs(nodes[a].x - n.x) - Math.abs(nodes[b].x - n.x));
      n.next.push(sorted[0]);
      if (sorted.length > 1 && rng.chance(0.45) && r + 1 < bossRow) n.next.push(sorted[1]);
    }
    for (const id of nxt) {
      if (cur.some((c) => nodes[c].next.includes(id))) continue;
      const nearest = [...cur].sort((a, b) => Math.abs(nodes[a].x - nodes[id].x) - Math.abs(nodes[b].x - nodes[id].x))[0];
      nodes[nearest].next.push(id);
    }
  }
  // With two bosses, make sure each last-row room only leads to one boss (a real route choice).
  if (bossCount > 1) {
    const last = rows[bossRow - 1];
    for (const id of last) {
      const n = nodes[id];
      if (n.next.length > 1) n.next = [n.next[0]];
    }
    for (const b of bossIds) {
      if (!last.some((id) => nodes[id].next.includes(b))) {
        const donor = last.find((id) => last.filter((o) => nodes[o].next[0] === nodes[id].next[0]).length > 1) ?? last[last.length - 1];
        nodes[donor].next = [b];
      }
    }
  }

  assignRoomTypes(act, nodes, rows, bossRow, m, rng);

  // Agility shortcuts: skip a row.
  if (m.rooms.has('shortcut')) {
    const count = rng.int(1, 2);
    for (let i = 0; i < count; i++) {
      const r = rng.int(0, Math.max(0, bossRow - 3));
      if (r + 2 >= bossRow) continue;
      const from = rng.pick(rows[r]);
      const to = rng.pick(rows[r + 2]);
      if (!nodes[from].shortcuts.includes(to)) nodes[from].shortcuts.push(to);
    }
  }

  return { actId: act.id, rows, nodes };
}

function assignRoomTypes(
  act: ActDef,
  nodes: Record<string, MapNode>,
  rows: string[][],
  bossRow: number,
  m: Mods,
  rng: Rng,
): void {
  const gatherRooms = [...m.rooms].filter((r) => C.gatherRoom(r));
  const restToCombat = mod(m, 'restRoomsToCombat') > 0;
  const seaChance = mod(m, 'seaRouteChance') / 100;
  const counts: Partial<Record<RoomType, number>> = {};
  const caps: Partial<Record<RoomType, number>> = { elite: 2, slayer: 1, trader: 2, rest: 2, chest: 2 };

  for (let r = 0; r < bossRow; r++) {
    for (const id of rows[r]) {
      let type: RoomType = 'combat';
      if (r === 0) type = 'combat';
      else if (r === bossRow - 1) type = rng.weighted([
        { value: 'rest' as RoomType, weight: 5 },
        { value: 'trader' as RoomType, weight: 3 },
        { value: 'combat' as RoomType, weight: 2 },
      ])!;
      else {
        const options: { value: RoomType; weight: number }[] = [
          { value: 'combat', weight: 40 },
          { value: 'elite', weight: r >= 2 ? 12 : 0 },
          { value: 'rest', weight: r >= 2 ? 8 : 0 },
          { value: 'slayer', weight: 10 },
          { value: 'trader', weight: 9 },
          { value: 'chest', weight: 9 },
          { value: 'gather', weight: gatherRooms.length ? 14 : 0 },
        ];
        type = rng.weighted(options.filter((o) => (counts[o.value] ?? 0) < (caps[o.value] ?? 99))) ?? 'combat';
      }
      if (type !== 'gather' && type !== 'elite' && r > 0 && r < bossRow - 1 && rng.chance(seaChance)) type = 'sea';
      if (type === 'rest' && restToCombat) type = 'combat';
      counts[type] = (counts[type] ?? 0) + 1;
      const node = nodes[id];
      node.type = type;
      if (type === 'gather') node.gather = rng.pick(gatherRooms);
      if (type === 'chest') node.chest = rng.weighted([
        { value: 'plain' as const, weight: 4 },
        { value: 'locked' as const, weight: 3 },
        { value: 'trapped' as const, weight: 2 },
      ]);
    }
  }
  // Every act has at least one elite (design doc room list).
  if (!counts.elite) {
    const middle = rows.slice(bossRow > 3 ? 2 : 1, bossRow).flat();
    const combat = middle.filter((id) => nodes[id].type === 'combat');
    const pool = combat.length ? combat : middle.filter((id) => nodes[id].type !== 'rest');
    const pick = pool.length ? rng.pick(pool) : middle[0];
    if (pick) {
      nodes[pick].type = 'elite';
      delete nodes[pick].gather;
      delete nodes[pick].chest;
    }
  }
  void act;
}

function gauntletMap(act: ActDef): ActMap {
  const waves = act.gauntlet!.waves;
  const nodes: Record<string, MapNode> = {};
  const rows: string[][] = [];
  const order: { type: RoomType; wave?: number }[] = [];
  waves.forEach((_, i) => {
    order.push({ type: i === waves.length - 1 || waves[i].some((id) => act.elites.includes(id)) ? 'elite' : 'combat', wave: i });
    if (i === 1) order.push({ type: 'rest' });
  });
  order.push({ type: 'boss' });
  order.forEach((o, row) => {
    const id = `g${row}`;
    nodes[id] = {
      id,
      row,
      x: 0.5,
      type: o.type,
      next: [],
      shortcuts: [],
      wave: o.wave,
      boss: o.type === 'boss' ? act.bosses[0] : undefined,
    };
    rows.push([id]);
    if (row > 0) nodes[`g${row - 1}`].next.push(id);
  });
  return { actId: act.id, rows, nodes };
}

/** Nodes the player may move to next. */
export function reachableNodes(map: ActMap, position: string | null): string[] {
  if (position === null) return [...map.rows[0]];
  const node = map.nodes[position];
  return [...node.next, ...node.shortcuts];
}
