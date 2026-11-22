/**
 * Pre-run powers and in-run power-ups.
 *
 * - RELICS (PLACEHOLDER): design doc §7.1 uses named relics from a source-game League.
 *   These stand-ins keep the slot structure (1-3 slots, unlocked with league points).
 * - OMENS (PLACEHOLDER): design doc §7.2 uses named raid Invocations for opt-in
 *   difficulty. These stand-ins add challenge points that raise rewards.
 * - BOONS (original): design doc §3.1 describes Boons as original roguelike effects.
 */
import type { BoonDef, OmenDef, RelicDef } from './types';
import { ph } from './placeholder';

export const RELICS: RelicDef[] = [
  {
    id: 'quartermaster',
    name: 'Quartermaster',
    description: 'Start every trip with 3 extra food and a prayer potion.',
    cost: 0,
    effects: [{ mod: 'startFood', value: 3 }, { mod: 'startPrayerPotions', value: 1 }],
    ph: ph('§7.1', 'League relic: production/supply relic'),
  },
  {
    id: 'deep_pockets',
    name: 'Deep Pockets',
    description: '+10% Coins found and +20% of carried Coins banked when you retreat or clear.',
    cost: 0,
    effects: [{ mod: 'coinFind', value: 10 }, { mod: 'bankBonus', value: 20 }],
    ph: ph('§7.1', 'League relic: banking relic'),
  },
  {
    id: 'hawkeye',
    name: 'Hawkeye',
    description: '+15% Ranged accuracy and a 25% chance to save ammunition.',
    cost: 30,
    effects: [{ mod: 'accRanged', value: 15 }, { mod: 'ammoSave', value: 25 }],
    ph: ph('§7.1', 'League relic: ranged relic'),
  },
  {
    id: 'iron_will',
    name: 'Iron Will',
    description: '+10% Melee accuracy and +2 Melee max hit.',
    cost: 30,
    effects: [{ mod: 'accMelee', value: 10 }, { mod: 'maxHitMelee', value: 2 }],
    ph: ph('§7.1', 'League relic: melee relic'),
  },
  {
    id: 'arcane_tide',
    name: 'Arcane Tide',
    description: '+10% Magic accuracy, +2 Magic max hit and a 30% chance to save runes.',
    cost: 30,
    effects: [{ mod: 'accMagic', value: 10 }, { mod: 'maxHitMagic', value: 2 }, { mod: 'runeSave', value: 30 }],
    ph: ph('§7.1', 'League relic: magic relic'),
  },
  {
    id: 'blood_pact',
    name: 'Blood Pact',
    description: '+10 Prayer points and prayers drain 30% slower.',
    cost: 40,
    effects: [{ mod: 'prayerPoints', value: 10 }, { mod: 'prayerDrain', value: -30 }],
    ph: ph('§7.1', 'League relic: prayer relic'),
  },
  {
    id: 'soul_harvest',
    name: 'Soul Harvest',
    description: 'Heal 4 Hitpoints whenever you kill a monster.',
    cost: 40,
    effects: [{ mod: 'healOnKill', value: 4 }],
    ph: ph('§7.1', 'League relic: life-steal relic'),
  },
  {
    id: 'bulwark',
    name: 'Bulwark',
    description: '+10 maximum Hitpoints and 8% damage reduction.',
    cost: 50,
    effects: [{ mod: 'maxHp', value: 10 }, { mod: 'damageReduction', value: 8 }],
    ph: ph('§7.1', 'League relic: defensive relic'),
  },
];

export const OMENS: OmenDef[] = [
  {
    id: 'lean_rations',
    name: 'Lean Rations',
    description: 'Start the trip with no food.',
    points: 20,
    effects: [{ mod: 'noFood', value: 1 }],
    ph: ph('§7.2', 'Invocation: food restriction'),
  },
  {
    id: 'muted_shrines',
    name: 'Muted Shrines',
    description: 'Prayers drain twice as fast.',
    points: 20,
    effects: [{ mod: 'prayerDrain', value: 100 }],
    ph: ph('§7.2', 'Invocation: prayer restriction'),
  },
  {
    id: 'hardened_foes',
    name: 'Hardened Foes',
    description: 'Monsters have 25% more Hitpoints.',
    points: 15,
    effects: [{ mod: 'enemyHp', value: 25 }],
    ph: ph('§7.2', 'Invocation: tougher monsters'),
  },
  {
    id: 'keen_foes',
    name: 'Keen Foes',
    description: 'Monsters are 20% more accurate.',
    points: 15,
    effects: [{ mod: 'enemyAcc', value: 20 }],
    ph: ph('§7.2', 'Invocation: accurate monsters'),
  },
  {
    id: 'brutal_foes',
    name: 'Brutal Foes',
    description: 'Monsters hit 20% harder.',
    points: 20,
    effects: [{ mod: 'enemyDmg', value: 20 }],
    ph: ph('§7.2', 'Invocation: harder-hitting monsters'),
  },
  {
    id: 'glass_bones',
    name: 'Glass Bones',
    description: '20% less maximum Hitpoints.',
    points: 20,
    effects: [{ mod: 'maxHpPct', value: -20 }],
    ph: ph('§7.2', 'Invocation: player frailty'),
  },
  {
    id: 'no_respite',
    name: 'No Respite',
    description: 'Rest altars are replaced by fights.',
    points: 25,
    effects: [{ mod: 'restRoomsToCombat', value: 1 }],
    ph: ph('§7.2', 'Invocation: path restriction'),
  },
  {
    id: 'quickened_bosses',
    name: 'Quickened Bosses',
    description: 'Bosses attack one tick faster.',
    points: 30,
    effects: [{ mod: 'bossSpeed', value: 1 }],
    ph: ph('§7.2', 'Invocation: boss speed'),
  },
];

export const BOONS: BoonDef[] = [
  { id: 'sharpened_edge', name: 'Sharpened Edge', description: '+2 max hit with every style.', stack: 3, effects: [{ mod: 'maxHitMelee', value: 2 }, { mod: 'maxHitRanged', value: 2 }, { mod: 'maxHitMagic', value: 2 }], ph: null },
  { id: 'true_aim', name: 'True Aim', description: '+8% accuracy with every style.', stack: 3, effects: [{ mod: 'accMelee', value: 8 }, { mod: 'accRanged', value: 8 }, { mod: 'accMagic', value: 8 }], ph: null },
  { id: 'thick_skin', name: 'Thick Skin', description: '+8 maximum Hitpoints.', stack: 3, effects: [{ mod: 'maxHp', value: 8 }], ph: null },
  { id: 'quiet_mind', name: 'Quiet Mind', description: 'Prayers drain 20% slower.', stack: 2, effects: [{ mod: 'prayerDrain', value: -20 }], ph: null },
  { id: 'bloodthirst', name: 'Bloodthirst', description: 'Heal 2 Hitpoints per kill.', stack: 3, effects: [{ mod: 'healOnKill', value: 2 }], ph: null },
  { id: 'second_wind', name: 'Second Wind', description: 'Heal 4 Hitpoints after each room.', stack: 2, effects: [{ mod: 'healPerRoom', value: 4 }], ph: null },
  { id: 'hearty_meals', name: 'Hearty Meals', description: 'Food heals 20% more.', stack: 2, effects: [{ mod: 'foodHeal', value: 20 }], ph: null },
  { id: 'lucky_find', name: 'Lucky Find', description: '+4% item drop chance from monsters.', stack: 2, effects: [{ mod: 'dropChance', value: 4 }], ph: null },
  { id: 'coin_sense', name: 'Coin Sense', description: '+25% Coins found.', stack: 2, effects: [{ mod: 'coinFind', value: 25 }], ph: null },
  { id: 'thorns', name: 'Thorns', description: 'Reflect 10% of damage taken.', stack: 2, effects: [{ mod: 'reflectPct', value: 10 }], ph: null },
  { id: 'flurry', name: 'Flurry', description: '8% chance for an attack to hit twice.', stack: 2, effects: [{ mod: 'doubleHitChance', value: 8 }], ph: null },
  { id: 'guarded', name: 'Guarded', description: '4% damage reduction.', stack: 3, effects: [{ mod: 'damageReduction', value: 4 }], ph: null },
  { id: 'opening_ward', name: 'Opening Ward', description: 'Start each room with a 6-point damage shield.', stack: 2, effects: [{ mod: 'roomShield', value: 6 }], ph: null },
  { id: 'thrift', name: 'Thrift', description: '15% chance to save ammunition and runes.', stack: 2, effects: [{ mod: 'ammoSave', value: 15 }, { mod: 'runeSave', value: 15 }], ph: null },
  { id: 'devout', name: 'Devout', description: '+8 Prayer points and 10% slower drain.', stack: 2, requiresFlag: 'prayerBoons', effects: [{ mod: 'prayerPoints', value: 8 }, { mod: 'prayerDrain', value: -10 }], ph: null },
  { id: 'blessed_strikes', name: 'Blessed Strikes', description: '+6% damage with every style.', stack: 2, requiresFlag: 'prayerBoons', effects: [{ mod: 'dmgPct', value: 6 }], ph: null },
];
