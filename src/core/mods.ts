/**
 * Modifier aggregation. Skills, hub tiers, relics, omens, boons, prayers and item
 * passives all speak the same Effect vocabulary; this module folds them into one
 * Mods object the engine reads.
 */
import { C } from '../content';
import type { Effect, FlagId, ModKey, RoomUnlock } from '../content/types';
import type { CharacterSave, RunState } from './state';

export interface Mods {
  n: Partial<Record<ModKey, number>>;
  flags: Set<FlagId>;
  gates: Set<string>;
  weights: Record<string, number>;
  rooms: Set<RoomUnlock>;
}

export function emptyMods(): Mods {
  return { n: {}, flags: new Set(), gates: new Set(), weights: {}, rooms: new Set() };
}

export function mod(m: Mods, key: ModKey): number {
  return m.n[key] ?? 0;
}

export function weightOf(m: Mods, tag: string): number {
  return m.weights[tag] ?? 1;
}

export function applyEffect(m: Mods, e: Effect, times = 1): void {
  if (times <= 0) return;
  if ('mod' in e) m.n[e.mod] = (m.n[e.mod] ?? 0) + e.value * times;
  else if ('flag' in e) m.flags.add(e.flag);
  else if ('gate' in e) m.gates.add(e.gate);
  else if ('weight' in e) m.weights[e.weight] = (m.weights[e.weight] ?? 1) * Math.pow(e.mult, times);
  else if ('room' in e) m.rooms.add(e.room);
}

export function applyEffects(m: Mods, effects: readonly Effect[] | undefined, times = 1): void {
  if (!effects) return;
  for (const e of effects) applyEffect(m, e, times);
}

/** Permanent character modifiers: skill ranks and hub tiers. */
export function characterMods(ch: CharacterSave): Mods {
  const m = emptyMods();
  for (const skill of C.skills) {
    const rank = ch.skills[skill.id] ?? 0;
    if (rank <= 0) continue;
    applyEffects(m, skill.perRank, rank);
    for (const perk of skill.perks) if (rank >= perk.rank) applyEffects(m, perk.effects);
  }
  for (const feature of C.hub) {
    const tier = ch.hub[feature.id] ?? feature.startTier;
    for (let t = 0; t < tier && t < feature.tiers.length; t++) applyEffects(m, feature.tiers[t].effects);
  }
  return m;
}

/** Character mods plus everything that applies for a whole run (relics, omens, boons). */
export function runBaseMods(ch: CharacterSave, run: RunState): Mods {
  const m = characterMods(ch);
  for (const id of run.relics) applyEffects(m, C.relic(id).effects);
  for (const id of run.omens) applyEffects(m, C.omen(id).effects);
  for (const [id, count] of Object.entries(run.boons)) applyEffects(m, C.boon(id).effects, count);
  return m;
}

/**
 * Full mods for the current moment of a run: base mods + worn item passives +
 * carried passive items (e.g. rune pouch) + active prayers + room buffs.
 */
export function runMods(ch: CharacterSave, run: RunState): Mods {
  const m = runBaseMods(ch, run);
  for (const stack of Object.values(run.equipment)) {
    if (!stack) continue;
    const def = C.item(stack.id);
    if (def.passive && (def.charges === undefined || (stack.charges ?? 0) > 0)) applyEffects(m, def.passive);
  }
  const carried = new Set<string>();
  for (const stack of run.inventory) {
    if (!stack || carried.has(stack.id)) continue;
    const def = C.item(stack.id);
    if (def.kind === 'misc' && def.passive) {
      carried.add(stack.id);
      applyEffects(m, def.passive);
    }
  }
  for (const id of run.activePrayers) applyEffects(m, C.prayer(id).effects);
  if (run.roomCombatBuff || run.buffs.combatDraught) {
    const pct = 10 * (1 + mod(m, 'potionEffect') / 100);
    applyEffects(m, [
      { mod: 'accMelee', value: pct },
      { mod: 'accRanged', value: pct },
      { mod: 'accMagic', value: pct },
      { mod: 'dmgPct', value: pct },
    ]);
  }
  if (run.buffs.feast) {
    applyEffects(m, [
      { mod: 'accMelee', value: 10 },
      { mod: 'accRanged', value: 10 },
      { mod: 'accMagic', value: 10 },
      { mod: 'maxHp', value: 5 },
    ]);
  }
  if (run.buffs.brazier) applyEffects(m, [{ mod: 'dmgPct', value: 10 }]);
  return m;
}

/** Omen challenge score for a list of omen ids. */
export function omenScore(omens: readonly string[]): number {
  return omens.reduce((sum, id) => sum + C.omen(id).points, 0);
}
