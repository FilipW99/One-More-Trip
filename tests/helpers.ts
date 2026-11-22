import { createCharacter } from '../src/core/save';
import { startRun, type RunCtx } from '../src/core/run';
import type { CharacterSave } from '../src/core/state';
import type { Focus, SkillId } from '../src/content/types';
import { totalXpForLevel } from '../src/core/progression';

export function makeCharacter(focus: Focus = 'melee', opts: { level?: number; skills?: Partial<Record<SkillId, number>>; hub?: Record<string, number> } = {}): CharacterSave {
  const ch = createCharacter('Tester', focus, 1);
  if (opts.level) ch.xp = totalXpForLevel(opts.level);
  Object.assign(ch.skills, opts.skills ?? {});
  Object.assign(ch.hub, opts.hub ?? {});
  return ch;
}

export function makeRun(ch: CharacterSave, seed = 42): RunCtx {
  const run = startRun(ch, seed);
  return { ch, run, autoRetaliate: true };
}
