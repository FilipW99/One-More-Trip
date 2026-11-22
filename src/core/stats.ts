/** Derived player stats for a run: bonuses from gear, mods and level. */
import { CONFIG } from '../config';
import { C } from '../content';
import type { AmmoType, CombatStyle, SpecialAttack, SpellDef, StyleTriple } from '../content/types';
import { magicMaxHit, playerAccuracyRoll, playerDefenceRoll, strengthMaxHit } from './combat/formulas';
import { mod, type Mods } from './mods';
import type { RunState } from './state';

export interface GearBonuses {
  attack: StyleTriple;
  defence: StyleTriple;
  strength: StyleTriple;
  prayer: number;
}

export function gearBonuses(run: RunState): GearBonuses {
  const b: GearBonuses = {
    attack: { melee: 0, ranged: 0, magic: 0 },
    defence: { melee: 0, ranged: 0, magic: 0 },
    strength: { melee: 0, ranged: 0, magic: 0 },
    prayer: 0,
  };
  const weapon = run.equipment.weapon ? C.item(run.equipment.weapon.id) : null;
  for (const [slot, stack] of Object.entries(run.equipment)) {
    if (!stack) continue;
    const def = C.item(stack.id);
    // Ammo strength only counts when the weapon fires that ammo type.
    if (slot === 'ammo' && (!weapon?.weapon?.ammo || weapon.weapon.ammo !== def.ammoType)) continue;
    for (const k of ['melee', 'ranged', 'magic'] as const) {
      b.attack[k] += def.attack?.[k] ?? 0;
      b.defence[k] += def.defence?.[k] ?? 0;
      b.strength[k] += def.strength?.[k] ?? 0;
    }
    b.prayer += def.prayer ?? 0;
  }
  return b;
}

export function maxHp(level: number, m: Mods): number {
  const base = CONFIG.PLAYER.baseHp + CONFIG.PLAYER.hpPerLevel * level + mod(m, 'maxHp');
  return Math.max(1, Math.round(base * (1 + mod(m, 'maxHpPct') / 100)));
}

export function maxPrayer(level: number, m: Mods): number {
  return Math.round(CONFIG.PLAYER.basePrayer + CONFIG.PLAYER.prayerPerLevel * level + mod(m, 'prayerPoints'));
}

export interface AttackProfile {
  style: CombatStyle;
  speed: number;
  range: number;
  maxHit: number;
  accuracyRoll: number;
  /** What the attack consumes. */
  ammo: AmmoType | null;
  spell: SpellDef | null;
  powered: boolean;
  special: SpecialAttack | null;
  /** Reason the player can't attack right now (no ammo, no runes...). */
  blocked: string | null;
}

export function knownSpells(run: RunState, level: number): SpellDef[] {
  return C.spells.filter((s) => s.book === run.spellbook && (s.minLevel <= level || run.learnedSpells.includes(s.id)));
}

export function runeShortfall(run: RunState, spell: SpellDef): string | null {
  for (const [rune, need] of Object.entries(spell.runes)) {
    let have = 0;
    for (const s of run.inventory) {
      if (!s) continue;
      if (s.id === rune) have += s.qty;
      // Combination runes count as spark + storm.
      if (s.id === 'tempest_rune' && (rune === 'spark_rune' || rune === 'storm_rune')) have += s.qty;
    }
    if (have < need) return `You need more ${C.item(rune).name}s to cast ${spell.name}.`;
  }
  return null;
}

export function attackProfile(run: RunState, level: number, m: Mods, freeSpell = false): AttackProfile {
  const gear = gearBonuses(run);
  const weaponStack = run.equipment.weapon;
  const weapon = weaponStack ? C.item(weaponStack.id) : null;
  const w = weapon?.weapon;
  const dmgPct = mod(m, 'dmgPct');
  const special = w?.special ?? null;

  // Magic: powered staff or autocast spell.
  if (w?.style === 'magic') {
    if (w.poweredMaxHit) {
      return {
        style: 'magic',
        speed: w.speed,
        range: w.range,
        maxHit: magicMaxHit(w.poweredMaxHit, gear.strength.magic, mod(m, 'maxHitMagic'), dmgPct),
        accuracyRoll: playerAccuracyRoll(level, gear.attack.magic, mod(m, 'accMagic')),
        ammo: null,
        spell: null,
        powered: true,
        special,
        blocked: null,
      };
    }
    const spells = knownSpells(run, level);
    const spell = spells.find((s) => s.id === run.activeSpell) ?? spells[0] ?? null;
    if (spell && w.autocast) {
      const shortfall = freeSpell ? null : runeShortfall(run, spell);
      if (!shortfall) {
        return {
          style: 'magic',
          speed: 5,
          range: w.range,
          maxHit: magicMaxHit(spell.maxHit, gear.strength.magic, mod(m, 'maxHitMagic'), dmgPct),
          accuracyRoll: playerAccuracyRoll(level, gear.attack.magic, mod(m, 'accMagic')),
          ammo: null,
          spell,
          powered: false,
          special,
          blocked: null,
        };
      }
      // Out of runes: bash with the staff.
      return {
        ...meleeProfile(level, gear, m, w.speed, special),
        blocked: null,
        spell: null,
      };
    }
  }

  // Ranged.
  if (w?.style === 'ranged') {
    let ammoStrength = 0;
    let blocked: string | null = null;
    const noAmmoNeeded = mod(m, 'ammoSave') >= 100;
    if (w.ammo === 'thrown') {
      ammoStrength = weapon?.strength?.ranged ?? 0;
    } else if (w.ammo) {
      const ammo = run.equipment.ammo ? C.item(run.equipment.ammo.id) : null;
      if (!ammo || ammo.ammoType !== w.ammo) {
        if (!noAmmoNeeded) blocked = w.ammo === 'arrow' ? 'You have no arrows equipped.' : 'You have no bolts equipped.';
      }
      ammoStrength = gear.strength.ranged; // includes matching ammo
    } else {
      ammoStrength = gear.strength.ranged;
    }
    if (w.ammo === 'thrown') ammoStrength = gear.strength.ranged;
    return {
      style: 'ranged',
      speed: w.speed,
      range: w.range,
      maxHit: strengthMaxHit(level, ammoStrength, mod(m, 'maxHitRanged'), dmgPct),
      accuracyRoll: playerAccuracyRoll(level, gear.attack.ranged, mod(m, 'accRanged')),
      ammo: noAmmoNeeded ? null : (w.ammo ?? null),
      spell: null,
      powered: false,
      special,
      blocked,
    };
  }

  return meleeProfile(level, gear, m, w?.speed ?? 4, special);
}

function meleeProfile(level: number, gear: GearBonuses, m: Mods, speed: number, special: SpecialAttack | null): AttackProfile {
  return {
    style: 'melee',
    speed,
    range: 1,
    maxHit: strengthMaxHit(level, gear.strength.melee, mod(m, 'maxHitMelee'), mod(m, 'dmgPct')),
    accuracyRoll: playerAccuracyRoll(level, gear.attack.melee, mod(m, 'accMelee')),
    ammo: null,
    spell: null,
    powered: false,
    special,
    blocked: null,
  };
}

export function defenceRolls(run: RunState, level: number, m: Mods): StyleTriple {
  const gear = gearBonuses(run);
  const pct = mod(m, 'defencePct');
  return {
    melee: playerDefenceRoll(level, gear.defence.melee, pct),
    ranged: playerDefenceRoll(level, gear.defence.ranged, pct),
    magic: playerDefenceRoll(level, gear.defence.magic, pct),
  };
}

/** Per-tick prayer drain for the active prayers. */
export function prayerDrainPerTick(run: RunState, m: Mods): number {
  if (run.activePrayers.length === 0) return 0;
  const gear = gearBonuses(run);
  const base = run.activePrayers.reduce((sum, id) => sum + C.prayer(id).drain, 0);
  const pct = Math.max(-90, mod(m, 'prayerDrain'));
  return (base * (1 + pct / 100)) / (1 + Math.max(0, gear.prayer) / 30);
}

/** Prayers the character can use, given unlock flags. */
export function availablePrayers(m: Mods): string[] {
  return C.prayers.filter((p) => !p.unlockFlag || m.flags.has(p.unlockFlag)).map((p) => p.id);
}
