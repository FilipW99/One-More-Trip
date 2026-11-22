/**
 * PLACEHOLDER CONTENT: prayers and spellbooks.
 *
 * Design doc §3.2 and §4.3 use the source game's named protection prayers and
 * spellbooks. The mechanics (one protection at a time, blocks a style, Prayer-rank
 * unlocks, tick-based drain) are kept; the names are generic stand-ins.
 */
import type { PrayerDef, SpellbookDef, SpellDef } from './types';
import { ph } from './placeholder';

export const PRAYERS: PrayerDef[] = [
  {
    id: 'protect_magic',
    name: 'Ward of Spells',
    description: 'Blocks magic attacks from monsters. Some boss attacks still get through.',
    protects: 'magic',
    group: 'protect',
    drain: 0.2,
    unlockFlag: 'unlockProtectMagic',
    key: 'Q',
    ph: ph('§3.2', 'Protection prayer: magic'),
  },
  {
    id: 'protect_ranged',
    name: 'Ward of Arrows',
    description: 'Blocks ranged attacks from monsters. Some boss attacks still get through.',
    protects: 'ranged',
    group: 'protect',
    drain: 0.2,
    unlockFlag: 'unlockProtectRanged',
    key: 'W',
    ph: ph('§3.2', 'Protection prayer: ranged'),
  },
  {
    id: 'protect_melee',
    name: 'Ward of Blades',
    description: 'Blocks melee attacks from monsters. Some boss attacks still get through.',
    protects: 'melee',
    group: 'protect',
    drain: 0.2,
    unlockFlag: 'unlockProtectMelee',
    key: 'E',
    ph: ph('§3.2', 'Protection prayer: melee'),
  },
  {
    id: 'keen_focus',
    name: 'Keen Focus',
    description: '+10% accuracy with every style.',
    group: 'accuracy',
    drain: 0.08,
    effects: [
      { mod: 'accMelee', value: 10 },
      { mod: 'accRanged', value: 10 },
      { mod: 'accMagic', value: 10 },
    ],
    key: 'A',
    ph: ph('§3.2', 'Offensive prayer: accuracy'),
  },
  {
    id: 'inner_fury',
    name: 'Inner Fury',
    description: '+8% damage with every style.',
    group: 'strength',
    drain: 0.08,
    effects: [{ mod: 'dmgPct', value: 8 }],
    key: 'D',
    ph: ph('§3.2', 'Offensive prayer: damage'),
  },
  {
    id: 'stoneskin',
    name: 'Stoneskin',
    description: '+10% defence against every style.',
    group: 'defence',
    drain: 0.08,
    effects: [{ mod: 'defencePct', value: 10 }],
    key: 'F',
    ph: ph('§3.2', 'Defensive prayer'),
  },
];

export const SPELLBOOKS: SpellbookDef[] = [
  {
    id: 'elemental',
    name: 'Elemental Arts',
    description: 'Straightforward damage that scales well.',
    ph: ph('§4.3', 'Standard spellbook'),
  },
  {
    id: 'shadow',
    name: 'Shadow Arts',
    description: 'Weaker hits with effects: weaken, bind and life-siphon.',
    ph: ph('§4.3', 'Alternate spellbook'),
  },
];

export const SPELLS: SpellDef[] = [
  { id: 'spark', name: 'Spark', book: 'elemental', maxHit: 6, minLevel: 1, runes: { spark_rune: 1 }, ph: ph('§4.3', 'Standard spell, tier 1') },
  { id: 'bolt', name: 'Bolt', book: 'elemental', maxHit: 10, minLevel: 8, runes: { spark_rune: 1, storm_rune: 1 }, ph: ph('§4.3', 'Standard spell, tier 2') },
  { id: 'blast', name: 'Blast', book: 'elemental', maxHit: 16, minLevel: 20, runes: { storm_rune: 2 }, ph: ph('§4.3', 'Standard spell, tier 3') },
  { id: 'surge', name: 'Surge', book: 'elemental', maxHit: 24, minLevel: 35, runes: { storm_rune: 2, void_rune: 1 }, ph: ph('§4.3', 'Standard spell, tier 4') },
  { id: 'hex', name: 'Hex', book: 'shadow', maxHit: 7, minLevel: 1, runes: { spark_rune: 1 }, effect: 'drain', ph: ph('§4.3', 'Alternate spell, tier 1 (weakens)') },
  { id: 'siphon', name: 'Siphon', book: 'shadow', maxHit: 10, minLevel: 12, runes: { spark_rune: 1, storm_rune: 1 }, effect: 'siphon', ph: ph('§4.3', 'Alternate spell, tier 2 (heals)') },
  { id: 'shackle', name: 'Shackle', book: 'shadow', maxHit: 12, minLevel: 18, runes: { storm_rune: 2 }, effect: 'bind', ph: ph('§4.3', 'Alternate spell, tier 3 (binds)') },
  { id: 'eclipse', name: 'Eclipse', book: 'shadow', maxHit: 21, minLevel: 32, runes: { void_rune: 2 }, effect: 'siphon', ph: ph('§4.3', 'Alternate spell, tier 4 (heals)') },
];
