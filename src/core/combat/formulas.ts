/**
 * Combat formulas. These are this game's own accuracy and damage curves, tuned for
 * a 1-60 character level range plus equipment bonuses.
 */
import { CONFIG } from '../../config';
import type { CombatStyle, MonsterDef } from '../../content/types';

export function effectiveLevel(level: number): number {
  return CONFIG.PLAYER.levelOffset + level;
}

export function playerAccuracyRoll(level: number, attackBonus: number, accPct: number): number {
  return effectiveLevel(level) * (64 + attackBonus) * (1 + accPct / 100);
}

export function playerDefenceRoll(level: number, defenceBonus: number, defencePct: number): number {
  return effectiveLevel(level) * Math.max(8, 64 + defenceBonus) * (1 + defencePct / 100);
}

export function monsterAccuracyRoll(m: MonsterDef, accPct: number): number {
  return (8 + m.attackLevel) * (64 + m.attackBonus) * (1 + accPct / 100);
}

export function monsterDefenceRoll(m: MonsterDef, style: CombatStyle, drainPct: number): number {
  return (8 + m.defenceLevel) * Math.max(8, 64 + m.defence[style]) * Math.max(0.2, 1 - drainPct / 100);
}

export function hitChance(attackRoll: number, defenceRoll: number): number {
  const p = attackRoll / (attackRoll + defenceRoll);
  return Math.min(0.97, Math.max(0.05, p));
}

/** Melee or ranged max hit from a strength bonus (melee strength or ammo strength). */
export function strengthMaxHit(level: number, strengthBonus: number, flat: number, dmgPct: number): number {
  const base = 1 + (effectiveLevel(level) * (64 + strengthBonus)) / 300;
  return Math.max(1, Math.floor(base * (1 + dmgPct / 100)) + flat);
}

/** Magic max hit from a spell or powered staff base. */
export function magicMaxHit(base: number, magicDmgPct: number, flat: number, dmgPct: number): number {
  return Math.max(1, Math.floor(base * (1 + (magicDmgPct + dmgPct) / 100)) + flat);
}

export function projectileTravel(distance: number): number {
  return 1 + Math.floor(distance / CONFIG.PROJECTILE_TILES_PER_TICK);
}
