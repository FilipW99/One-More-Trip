/**
 * PLACEHOLDER CONTENT: act bosses, raid bosses and the volcanic-route boss.
 *
 * Design doc §3.1 and §5.3 name specific bosses with their own mechanics and unique
 * tables. These stand-ins keep the structure the design needs: telegraphed attacks
 * that reward prayer switching, ground hazards that reward movement, phase changes,
 * minions, a unique table per boss and a cosmetic pet. Unique and pet chances are
 * roguelike tuning, labelled as such in the UI.
 */
import type { BossDef } from './types';
import { ph } from './placeholder';

export const BOSSES: BossDef[] = [
  /* ---------------------------------------------------------------- Act 1 */
  {
    id: 'grumbold', name: 'Grumbold, the Hill Brute', examine: 'He has never lost an argument, mostly by sitting on people.',
    hp: 80, attackLevel: 9, attackBonus: 4, maxHit: 6, defenceLevel: 8, defence: { melee: 8, ranged: 4, magic: 2 },
    style: 'melee', speed: 5, range: 1, size: 2, xp: 210, coins: [30, 50], color: '#8f7a4a',
    drops: 2, uniqueChance: 0.15,
    uniques: [{ item: 'brutes_cudgel', weight: 1 }],
    phases: [
      {
        untilHpPct: 50, speed: 5, pattern: 'random',
        attacks: [
          { id: 'smash', name: 'Club smash', style: 'melee', maxHit: 6, windup: 1, range: 1, weight: 3 },
          { id: 'boulder', name: 'Boulder toss', style: 'ranged', maxHit: 5, windup: 1, travel: 2, range: 8, weight: 2 },
          { id: 'slam', name: 'Ground slam', style: 'typeless', maxHit: 9, windup: 3, aoe: { shape: 'target', size: 3 }, weight: 1 },
        ],
      },
      {
        untilHpPct: 0, speed: 4, pattern: 'random', message: 'Grumbold roars and stamps the ground!',
        attacks: [
          { id: 'smash', name: 'Club smash', style: 'melee', maxHit: 7, windup: 1, range: 1, weight: 3 },
          { id: 'boulder', name: 'Boulder toss', style: 'ranged', maxHit: 6, windup: 1, travel: 2, range: 8, weight: 2 },
          { id: 'rockfall', name: 'Rockfall', style: 'typeless', maxHit: 7, windup: 3, aoe: { shape: 'scatter', count: 10 }, weight: 1 },
        ],
      },
    ],
    ph: ph('§3.1', 'Act 1 boss'),
  },

  /* ---------------------------------------------------------------- Act 2, route A */
  {
    id: 'warlord_brakka', name: 'Warlord Brakka', examine: 'His bodyguards are almost as large as his ego.',
    hp: 185, attackLevel: 20, attackBonus: 12, maxHit: 10, defenceLevel: 26, defence: { melee: 35, ranged: 30, magic: 15 },
    style: 'melee', speed: 6, range: 1, size: 2, xp: 230, coins: [45, 70], color: '#6b4a2b',
    drops: 2, uniqueChance: 0.12,
    uniques: [
      { item: 'warplate_chestplate', weight: 1 },
      { item: 'warplate_tassets', weight: 1 },
    ],
    pet: { id: 'pet_brakka_whelp', chance: 0.03 },
    minions: ['oathbound_archer', 'oathbound_hexer'],
    arena: { w: 15, h: 13 },
    phases: [
      {
        untilHpPct: 0, speed: 6, pattern: 'random',
        attacks: [
          { id: 'warblade', name: 'Warblade', style: 'melee', maxHit: 10, windup: 1, range: 1, weight: 3 },
          { id: 'stomp', name: 'Tremor stomp', style: 'ranged', maxHit: 8, windup: 2, travel: 1, range: 12, weight: 2 },
          { id: 'cleave', name: 'Whirling cleave', style: 'typeless', maxHit: 12, windup: 2, aoe: { shape: 'ring', size: 2 }, weight: 1 },
        ],
      },
    ],
    ph: ph('§3.1', 'Act 2 boss, route A (melee/ranged general with bodyguards)'),
  },

  /* ---------------------------------------------------------------- Act 2, route B */
  {
    id: 'hellwarden_zarkoth', name: 'Hellwarden Zarkoth', examine: 'The air around it shimmers with heat and malice.',
    hp: 170, attackLevel: 20, attackBonus: 12, maxHit: 10, defenceLevel: 22, defence: { melee: 30, ranged: 25, magic: 30 },
    style: 'melee', speed: 5, range: 1, size: 2, xp: 230, coins: [45, 70], color: '#7a1f1f',
    drops: 2, uniqueChance: 0.12,
    uniques: [{ item: 'hellforged_spear', weight: 1 }],
    minions: ['gorehound'],
    arena: { w: 15, h: 13 },
    phases: [
      {
        untilHpPct: 0, speed: 5, pattern: 'random',
        attacks: [
          { id: 'hellblade', name: 'Hellblade', style: 'melee', maxHit: 10, windup: 1, range: 1, weight: 3 },
          { id: 'sear', name: 'Soul sear', style: 'magic', maxHit: 9, windup: 2, travel: 2, range: 10, protection: 'half', drainPrayer: 4, weight: 2 },
          { id: 'brimstone', name: 'Brimstone', style: 'typeless', maxHit: 11, windup: 3, aoe: { shape: 'target', size: 3 }, weight: 1 },
        ],
      },
    ],
    ph: ph('§3.1', 'Act 2 boss, route B (melee/magic demon general)'),
  },

  /* ---------------------------------------------------------------- Act 3 */
  {
    id: 'countess_vesperine', name: 'Countess Vesperine', examine: 'The hostess of the Crimson Spire. She has been expecting you.',
    hp: 340, attackLevel: 32, attackBonus: 20, maxHit: 12, defenceLevel: 36, defence: { melee: 50, ranged: 45, magic: 40 },
    style: 'magic', speed: 5, range: 8, size: 2, xp: 210, coins: [60, 90], color: '#7b1030',
    drops: 2, uniqueChance: 0.12,
    uniques: [
      { item: 'crimson_reaper', weight: 1 },
      { item: 'crimson_rapier', weight: 2 },
      { item: 'bloodglass_staff', weight: 2 },
      { item: 'vesper_defender', weight: 3 },
    ],
    pet: { id: 'pet_little_vesper', chance: 0.03 },
    arena: { w: 15, h: 13 },
    phases: [
      {
        untilHpPct: 60, speed: 5, pattern: 'cycle', message: 'The Countess rises from her throne.',
        attacks: [
          { id: 'volley', name: 'Blood volley', style: 'magic', maxHit: 12, windup: 2, travel: 2, range: 10 },
          { id: 'rain', name: 'Crimson rain', style: 'typeless', maxHit: 12, windup: 3, aoe: { shape: 'scatter', count: 10 } },
          { id: 'volley', name: 'Blood volley', style: 'magic', maxHit: 12, windup: 2, travel: 2, range: 10 },
          { id: 'nightshot', name: 'Night shot', style: 'ranged', maxHit: 12, windup: 2, travel: 2, range: 10 },
        ],
      },
      {
        untilHpPct: 25, speed: 4, pattern: 'random', message: 'The Countess draws her claws.',
        attacks: [
          { id: 'claws', name: 'Rending claws', style: 'melee', maxHit: 14, windup: 1, range: 1, weight: 2 },
          { id: 'nightshot', name: 'Night shot', style: 'ranged', maxHit: 12, windup: 2, travel: 2, range: 10, weight: 2 },
          { id: 'volley', name: 'Blood volley', style: 'magic', maxHit: 12, windup: 2, travel: 2, range: 10, weight: 2 },
          { id: 'rain', name: 'Crimson rain', style: 'typeless', maxHit: 12, windup: 3, aoe: { shape: 'scatter', count: 10 }, weight: 1 },
        ],
      },
      {
        untilHpPct: 0, speed: 4, pattern: 'random', message: 'The Countess feeds!',
        attacks: [
          { id: 'sanguine', name: 'Sanguine bolt', style: 'magic', maxHit: 14, windup: 1, travel: 1, range: 10, heal: 8, weight: 2 },
          { id: 'nightshot', name: 'Night shot', style: 'ranged', maxHit: 13, windup: 1, travel: 2, range: 10, weight: 2 },
          { id: 'cross', name: 'Crimson cross', style: 'typeless', maxHit: 16, windup: 3, aoe: { shape: 'cross' }, weight: 1 },
        ],
      },
    ],
    ph: ph('§3.1', 'Act 3 raid final boss'),
  },

  /* ---------------------------------------------------------------- Finale */
  {
    id: 'dawn_colossus', name: 'The Dawn Colossus', examine: 'A god-sized statue of the sun, awake and furious.',
    hp: 650, attackLevel: 44, attackBonus: 30, maxHit: 16, defenceLevel: 55, defence: { melee: 70, ranged: 60, magic: 60 },
    style: 'magic', speed: 5, range: 10, size: 3, xp: 230, coins: [80, 120], color: '#d4a017',
    drops: 3, uniqueChance: 0.15,
    uniques: [
      { item: 'eclipse_staff', weight: 1 },
      { item: 'jackal_fang', weight: 2 },
      { item: 'sunflare_bow', weight: 1 },
      { item: 'sunweave_cowl', weight: 3 },
      { item: 'sunweave_body', weight: 3 },
      { item: 'sunweave_chaps', weight: 3 },
      { item: 'tidestone_ward', weight: 2 },
      { item: 'dawnlit_ring', weight: 3 },
    ],
    pet: { id: 'pet_colossus_pup', chance: 0.03 },
    arena: { w: 17, h: 13 },
    phases: [
      {
        untilHpPct: 66, speed: 5, pattern: 'cycle', message: 'The Colossus turns its burning gaze on you.',
        attacks: [
          { id: 'lance', name: 'Sun lance', style: 'ranged', maxHit: 16, windup: 2, travel: 2, range: 12 },
          { id: 'orb', name: 'Solar orb', style: 'magic', maxHit: 16, windup: 2, travel: 2, range: 12 },
        ],
      },
      {
        untilHpPct: 33, speed: 5, pattern: 'random', message: 'Sand pours from the ceiling.',
        attacks: [
          { id: 'lance', name: 'Sun lance', style: 'ranged', maxHit: 16, windup: 2, travel: 2, range: 12, weight: 2 },
          { id: 'orb', name: 'Solar orb', style: 'magic', maxHit: 16, windup: 2, travel: 2, range: 12, weight: 2 },
          { id: 'sunfall', name: 'Sunfall', style: 'typeless', maxHit: 20, windup: 3, aoe: { shape: 'cross' }, weight: 1 },
          { id: 'sandstorm', name: 'Sandstorm', style: 'typeless', maxHit: 12, windup: 3, aoe: { shape: 'scatter', count: 16 }, weight: 1 },
        ],
      },
      {
        untilHpPct: 0, speed: 4, pattern: 'random', message: 'The Colossus blazes with noon light!',
        attacks: [
          { id: 'lance', name: 'Sun lance', style: 'ranged', maxHit: 18, windup: 1, travel: 2, range: 12, weight: 2 },
          { id: 'orb', name: 'Solar orb', style: 'magic', maxHit: 18, windup: 1, travel: 2, range: 12, weight: 2 },
          { id: 'searing', name: 'Searing slam', style: 'melee', maxHit: 22, windup: 1, range: 1, weight: 1 },
          { id: 'sunfall', name: 'Sunfall', style: 'typeless', maxHit: 20, windup: 3, aoe: { shape: 'cross' }, weight: 1 },
        ],
      },
    ],
    ph: ph('§3.1', 'Finale raid boss'),
  },

  /* ---------------------------------------------------------------- Volcanic route */
  {
    id: 'magmaw', name: 'Magmaw the Molten', examine: 'The thing at the bottom of the Cinder Pits. Watch its mouth.',
    hp: 420, attackLevel: 38, attackBonus: 25, maxHit: 20, defenceLevel: 42, defence: { melee: 55, ranged: 55, magic: 55 },
    style: 'magic', speed: 6, range: 10, size: 3, xp: 210, coins: [70, 110], color: '#e25822',
    drops: 2, uniqueChance: 1,
    uniques: [{ item: 'ember_cape', weight: 1 }],
    pet: { id: 'pet_cinder_cub', chance: 0.05 },
    arena: { w: 15, h: 13 },
    phases: [
      {
        untilHpPct: 50, speed: 6, pattern: 'random', message: 'Magmaw drags itself out of the lava.',
        attacks: [
          { id: 'magma', name: 'Magma bolt', style: 'magic', maxHit: 20, windup: 2, travel: 2, range: 12, weight: 1 },
          { id: 'spit', name: 'Rock spit', style: 'ranged', maxHit: 20, windup: 2, travel: 2, range: 12, weight: 1 },
          { id: 'bite', name: 'Molten bite', style: 'melee', maxHit: 20, windup: 1, range: 1, weight: 1 },
        ],
      },
      {
        untilHpPct: 0, speed: 6, pattern: 'random', message: 'Magmaw calls its menders!',
        summonOnEnter: ['cinder_mender', 'cinder_mender'],
        attacks: [
          { id: 'magma', name: 'Magma bolt', style: 'magic', maxHit: 20, windup: 2, travel: 2, range: 12, weight: 1 },
          { id: 'spit', name: 'Rock spit', style: 'ranged', maxHit: 20, windup: 2, travel: 2, range: 12, weight: 1 },
          { id: 'bite', name: 'Molten bite', style: 'melee', maxHit: 20, windup: 1, range: 1, weight: 1 },
        ],
      },
    ],
    ph: ph('§3.1', 'Volcanic route boss (prayer-switch test)'),
  },
];
