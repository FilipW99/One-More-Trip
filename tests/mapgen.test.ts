import { describe, expect, it } from 'vitest';
import { C } from '../src/content';
import { generateActMap, reachableNodes } from '../src/core/mapgen';
import { emptyMods } from '../src/core/mods';
import { Rng } from '../src/core/rng';

describe('act maps (design doc §3.1)', () => {
  for (const act of C.acts.filter((a) => !a.gauntlet)) {
    it(`${act.id}: 8-12 rooms, every room reachable, every boss reachable`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const map = generateActMap(act, emptyMods(), new Rng(seed));
        const ids = Object.keys(map.nodes);
        expect(ids.length).toBeGreaterThanOrEqual(8);
        expect(ids.length).toBeLessThanOrEqual(12);
        // Reachability from the start.
        const seen = new Set<string>();
        const queue = reachableNodes(map, null);
        while (queue.length) {
          const id = queue.shift()!;
          if (seen.has(id)) continue;
          seen.add(id);
          queue.push(...map.nodes[id].next);
        }
        expect(seen.size, `seed ${seed}`).toBe(ids.length);
        // Every non-boss node leads somewhere.
        for (const n of Object.values(map.nodes)) if (n.type !== 'boss') expect(n.next.length, `${seed} ${n.id}`).toBeGreaterThan(0);
        const bosses = Object.values(map.nodes).filter((n) => n.type === 'boss');
        expect(bosses.map((b) => b.boss).sort()).toEqual([...act.bosses].sort());
        expect(Object.values(map.nodes).some((n) => n.type === 'elite'), `seed ${seed} has elite`).toBe(true);
      }
    });
  }

  it('two-boss acts give each boss its own route from the last row', () => {
    const act = C.act('citadel');
    for (let seed = 1; seed <= 200; seed++) {
      const map = generateActMap(act, emptyMods(), new Rng(seed));
      const last = map.rows[map.rows.length - 2];
      for (const id of last) expect(map.nodes[id].next.length).toBe(1);
    }
  });

  it('gauntlet acts are a straight line ending in the boss', () => {
    const act = C.act('cinder_pits');
    const map = generateActMap(act, emptyMods(), new Rng(5));
    expect(map.rows.every((r) => r.length === 1)).toBe(true);
    expect(map.nodes[map.rows.at(-1)![0]].type).toBe('boss');
  });
});
