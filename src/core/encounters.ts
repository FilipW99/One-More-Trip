/** Builds the monster line-up for a combat, elite, boss or gauntlet room. */
import { CONFIG } from '../config';
import { C } from '../content';
import type { EncounterSpec } from './combat/engine';
import type { Mods } from './mods';
import { Rng } from './rng';
import type { CharacterSave, MapNode, RunState } from './state';

export function encounterSpec(run: RunState, ch: CharacterSave, m: Mods, node: MapNode, rng: Rng): EncounterSpec {
  const act = C.act(run.map.actId);
  const seed = rng.int(1, 0x7fffffff);

  if (node.type === 'boss') {
    const boss = C.boss(node.boss ?? act.bosses[0]);
    return {
      kind: 'boss',
      monsters: [{ id: boss.id }, ...(boss.minions ?? []).map((id) => ({ id }))],
      arena: boss.arena,
      seed,
    };
  }

  let ids: string[];
  let kind: EncounterSpec['kind'] = node.type === 'elite' ? 'elite' : 'combat';
  if (act.gauntlet && node.wave !== undefined) {
    ids = [...act.gauntlet.waves[node.wave]];
    if (ids.some((id) => act.elites.includes(id))) kind = 'elite';
  } else if (node.type === 'elite') {
    ids = [rng.pick(act.elites), rng.pick(act.monsters)];
  } else {
    const [min, max] = act.enemiesPerRoom;
    const count = node.row === 0 ? min : rng.int(min, max);
    ids = Array.from({ length: count }, () => rng.pick(act.monsters));
    // Slayer tasks make their monsters show up more often.
    const task = run.slayerTask;
    if (task && !task.done && task.category) {
      const taskMonsters = act.monsters.filter((id) => C.monster(id).slayerCategory === task.category);
      if (taskMonsters.length && !ids.some((id) => taskMonsters.includes(id))) ids[0] = rng.pick(taskMonsters);
    }
  }

  const task = run.slayerTask;
  const superiorChance =
    CONFIG.SLAYER.superiorChance * (ch.slayerUnlocks.includes('superior_boost') ? 2 : 1) * (1 + (m.n.superiorChance ?? 0) / 100);
  const monsters = ids.map((id) => {
    const def = C.monster(id);
    const elite = act.elites.includes(id);
    if (
      m.flags.has('superiorSlayer') &&
      task &&
      !task.done &&
      task.category &&
      def.slayerCategory === task.category &&
      def.superior &&
      rng.chance(superiorChance)
    ) {
      return { id: def.superior, superior: true, elite: false };
    }
    return { id, elite };
  });
  return { kind, monsters, seed };
}
