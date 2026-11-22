/**
 * PLACEHOLDER CONTENT: regular, elite and superior monsters.
 *
 * Design doc §3.1 asks for monsters native to each act's setting. These generic
 * stand-ins keep the same roles (fodder, ranged, caster, elite, Slayer superior).
 * Stats are tuned for this game's pacing; replace names, stats and art freely,
 * keeping `id` stable or updating the references in ./acts.ts and ./bosses.ts.
 */
import type { MonsterDef, StyleTriple } from './types';
import { ph } from './placeholder';

const def = (melee: number, ranged: number, magic: number): StyleTriple => ({ melee, ranged, magic });

export const MONSTERS: MonsterDef[] = [
  /* ---------------------------------------------------------------- Act 1 */
  {
    id: 'cave_rat', name: 'Cave rat', examine: 'Bigger than a rat has any right to be.',
    hp: 6, attackLevel: 1, attackBonus: 0, maxHit: 1, defenceLevel: 1, defence: def(0, 0, 0),
    style: 'melee', speed: 4, range: 1, size: 1, xp: 20, coins: [1, 4],
    slayerCategory: 'Rats', color: '#8b7d6b', ph: ph('§3.1', 'Act 1 monster (fodder)'),
  },
  {
    id: 'hill_ogre', name: 'Hill ogre', examine: 'Slow, but each swing counts.',
    hp: 16, attackLevel: 5, attackBonus: 0, maxHit: 3, defenceLevel: 4, defence: def(4, 2, 0),
    style: 'melee', speed: 6, range: 1, size: 1, xp: 40, coins: [3, 8],
    slayerCategory: 'Ogres', superior: 'ogre_brute', color: '#9a8455', ph: ph('§3.1', 'Act 1 monster (heavy melee)'),
  },
  {
    id: 'bone_archer', name: 'Bone archer', examine: 'Rattles when it draws.',
    hp: 11, attackLevel: 5, attackBonus: 2, maxHit: 2, defenceLevel: 3, defence: def(2, 6, -2),
    style: 'ranged', speed: 5, range: 6, size: 1, xp: 36, coins: [2, 6],
    slayerCategory: 'Undead', color: '#d8d0b8', ph: ph('§3.1', 'Act 1 monster (ranged)'),
  },
  {
    id: 'lesser_fiend', name: 'Lesser fiend', examine: 'Smells of brimstone and bad decisions.',
    hp: 13, attackLevel: 6, attackBonus: 0, maxHit: 3, defenceLevel: 3, defence: def(2, 2, -6),
    style: 'magic', speed: 5, range: 6, size: 1, xp: 38, coins: [3, 7],
    slayerCategory: 'Fiends', color: '#b5443a', ph: ph('§3.1', 'Act 1 monster (caster)'),
  },
  {
    id: 'ogre_chieftain', name: 'Ogre chieftain', examine: 'Wears a crown of bent cutlery.',
    hp: 36, attackLevel: 9, attackBonus: 2, maxHit: 5, defenceLevel: 8, defence: def(10, 6, 2),
    style: 'melee', speed: 5, range: 1, size: 2, xp: 100, coins: [15, 30],
    slayerCategory: 'Ogres', color: '#7d6a3e', ph: ph('§3.1', 'Act 1 elite'),
  },
  {
    id: 'ogre_brute', name: 'Ogre brute', examine: 'A superior Slayer monster. Something fed it well.',
    hp: 34, attackLevel: 10, attackBonus: 4, maxHit: 5, defenceLevel: 8, defence: def(8, 4, 0),
    style: 'melee', speed: 5, range: 1, size: 2, xp: 100, coins: [20, 40],
    slayerCategory: 'Ogres', color: '#c8a03c', ph: ph('§4.4', 'Act 1 superior Slayer monster'),
  },

  /* ---------------------------------------------------------------- Act 2 */
  {
    id: 'oathbound_soldier', name: 'Oathbound soldier', examine: 'Sworn to a warlord, and to hitting you.',
    hp: 24, attackLevel: 12, attackBonus: 6, maxHit: 5, defenceLevel: 14, defence: def(20, 15, 5),
    style: 'melee', speed: 5, range: 1, size: 1, xp: 42, coins: [5, 12],
    slayerCategory: 'Oathbound', superior: 'oathbound_champion', color: '#8a5a44', ph: ph('§3.1', 'Act 2 monster (melee follower)'),
  },
  {
    id: 'oathbound_archer', name: 'Oathbound archer', examine: 'Keeps its distance and its oath.',
    hp: 20, attackLevel: 12, attackBonus: 8, maxHit: 4, defenceLevel: 12, defence: def(10, 25, 0),
    style: 'ranged', speed: 5, range: 7, size: 1, xp: 40, coins: [5, 12],
    slayerCategory: 'Oathbound', superior: 'oathbound_champion', color: '#6f8a44', ph: ph('§3.1', 'Act 2 monster (ranged follower)'),
  },
  {
    id: 'oathbound_hexer', name: 'Oathbound hexer', examine: 'Mutters curses under its helm.',
    hp: 18, attackLevel: 13, attackBonus: 8, maxHit: 5, defenceLevel: 10, defence: def(5, 5, 25),
    style: 'magic', speed: 5, range: 7, size: 1, xp: 42, coins: [5, 12],
    slayerCategory: 'Oathbound', superior: 'oathbound_champion', color: '#5a4a8a', ph: ph('§3.1', 'Act 2 monster (caster follower)'),
  },
  {
    id: 'gorehound', name: 'Gorehound', examine: 'All teeth, no patience.',
    hp: 18, attackLevel: 10, attackBonus: 4, maxHit: 4, defenceLevel: 8, defence: def(5, 5, 0),
    style: 'melee', speed: 4, range: 1, size: 1, xp: 34, coins: [3, 9],
    slayerCategory: 'Hounds', superior: 'gorehound_alpha', color: '#7a3030', ph: ph('§3.1', 'Act 2 monster (fast melee)'),
  },
  {
    id: 'banner_captain', name: 'Banner captain', examine: 'Rallies the others with every blow.',
    hp: 60, attackLevel: 18, attackBonus: 12, maxHit: 7, defenceLevel: 20, defence: def(30, 25, 10),
    style: 'melee', speed: 5, range: 1, size: 2, xp: 105, coins: [25, 45],
    slayerCategory: 'Oathbound', color: '#a0522d', ph: ph('§3.1', 'Act 2 elite'),
  },
  {
    id: 'oathbound_champion', name: 'Oathbound champion', examine: 'A superior Slayer monster with a polished helm.',
    hp: 55, attackLevel: 20, attackBonus: 12, maxHit: 8, defenceLevel: 20, defence: def(25, 25, 15),
    style: 'melee', speed: 5, range: 1, size: 2, xp: 110, coins: [30, 50],
    slayerCategory: 'Oathbound', color: '#d4a84a', ph: ph('§4.4', 'Act 2 superior Slayer monster'),
  },
  {
    id: 'gorehound_alpha', name: 'Gorehound alpha', examine: 'A superior Slayer monster. The pack follows it.',
    hp: 40, attackLevel: 18, attackBonus: 8, maxHit: 6, defenceLevel: 14, defence: def(10, 10, 5),
    style: 'melee', speed: 4, range: 1, size: 1, xp: 100, coins: [20, 40],
    slayerCategory: 'Hounds', color: '#b03a3a', ph: ph('§4.4', 'Act 2 superior Slayer monster'),
  },

  /* ---------------------------------------------------------------- Act 3 */
  {
    id: 'blood_leech', name: 'Blood leech', examine: 'Quick, wet and hungry.',
    hp: 26, attackLevel: 20, attackBonus: 12, maxHit: 4, defenceLevel: 18, defence: def(15, 30, 20),
    style: 'melee', speed: 3, range: 1, size: 1, xp: 28, coins: [6, 14],
    slayerCategory: 'Leeches', color: '#8b0000', ph: ph('§3.1', 'Act 3 monster (fast melee)'),
  },
  {
    id: 'spire_thrall', name: 'Spire thrall', examine: 'A servant that forgot how to stop.',
    hp: 38, attackLevel: 24, attackBonus: 14, maxHit: 8, defenceLevel: 26, defence: def(35, 30, 15),
    style: 'melee', speed: 5, range: 1, size: 1, xp: 36, coins: [8, 16],
    slayerCategory: 'Thralls', superior: 'spire_ghoul', color: '#6b5b73', ph: ph('§3.1', 'Act 3 monster (melee)'),
  },
  {
    id: 'nightling_archer', name: 'Nightling archer', examine: 'Its eyes catch the light before its arrows do.',
    hp: 30, attackLevel: 24, attackBonus: 14, maxHit: 7, defenceLevel: 20, defence: def(20, 40, 10),
    style: 'ranged', speed: 5, range: 7, size: 1, xp: 34, coins: [8, 16],
    slayerCategory: 'Nightlings', superior: 'nightling_matron', color: '#3b4a6b', ph: ph('§3.1', 'Act 3 monster (ranged)'),
  },
  {
    id: 'nightling_witch', name: 'Nightling witch', examine: 'Whispers in a voice like tearing silk.',
    hp: 28, attackLevel: 25, attackBonus: 15, maxHit: 8, defenceLevel: 18, defence: def(10, 15, 40),
    style: 'magic', speed: 5, range: 7, size: 1, xp: 36, coins: [8, 16],
    slayerCategory: 'Nightlings', superior: 'nightling_matron', color: '#5b2a6b', ph: ph('§3.1', 'Act 3 monster (caster)'),
  },
  {
    id: 'spire_duelist', name: 'Spire duelist', examine: 'Bows before every fight. Never after.',
    hp: 100, attackLevel: 32, attackBonus: 20, maxHit: 11, defenceLevel: 34, defence: def(45, 40, 25),
    style: 'melee', speed: 4, range: 1, size: 2, xp: 100, coins: [30, 60],
    slayerCategory: 'Thralls', color: '#9b2335', ph: ph('§3.1', 'Act 3 elite'),
  },
  {
    id: 'spire_ghoul', name: 'Spire ghoul', examine: 'A superior Slayer monster that has fed for centuries.',
    hp: 80, attackLevel: 30, attackBonus: 18, maxHit: 10, defenceLevel: 30, defence: def(40, 35, 20),
    style: 'melee', speed: 5, range: 1, size: 2, xp: 95, coins: [30, 60],
    slayerCategory: 'Thralls', color: '#a99bb5', ph: ph('§4.4', 'Act 3 superior Slayer monster'),
  },
  {
    id: 'nightling_matron', name: 'Nightling matron', examine: 'A superior Slayer monster draped in shadow.',
    hp: 70, attackLevel: 30, attackBonus: 18, maxHit: 10, defenceLevel: 26, defence: def(20, 30, 45),
    style: 'magic', speed: 5, range: 7, size: 2, xp: 95, coins: [30, 60],
    slayerCategory: 'Nightlings', color: '#7b3a9b', ph: ph('§4.4', 'Act 3 superior Slayer monster'),
  },

  /* ---------------------------------------------------------------- Finale */
  {
    id: 'tomb_scarab', name: 'Tomb scarab', examine: 'Its shell is harder than most shields.',
    hp: 34, attackLevel: 30, attackBonus: 18, maxHit: 8, defenceLevel: 30, defence: def(50, 20, 30),
    style: 'melee', speed: 4, range: 1, size: 1, xp: 30, coins: [8, 18],
    slayerCategory: 'Scarabs', color: '#3a6b5b', ph: ph('§3.1', 'Finale monster (melee)'),
  },
  {
    id: 'sand_sentinel', name: 'Sand sentinel', examine: 'A statue that decided to walk.',
    hp: 60, attackLevel: 34, attackBonus: 20, maxHit: 10, defenceLevel: 45, defence: def(55, 55, 20),
    style: 'melee', speed: 6, range: 1, size: 2, xp: 38, coins: [10, 22],
    slayerCategory: 'Sentinels', superior: 'gilded_sentinel', color: '#c2a66b', ph: ph('§3.1', 'Finale monster (guardian)'),
  },
  {
    id: 'sunpriest', name: 'Sunpriest', examine: 'Chants to a sun that is not there.',
    hp: 42, attackLevel: 36, attackBonus: 20, maxHit: 10, defenceLevel: 30, defence: def(30, 30, 60),
    style: 'magic', speed: 5, range: 8, size: 1, xp: 36, coins: [10, 22],
    slayerCategory: 'Tomb keepers', color: '#d9a441', ph: ph('§3.1', 'Finale monster (caster)'),
  },
  {
    id: 'tomb_archer', name: 'Tomb archer', examine: 'Wrapped in linen, aiming true.',
    hp: 42, attackLevel: 34, attackBonus: 20, maxHit: 9, defenceLevel: 32, defence: def(30, 55, 25),
    style: 'ranged', speed: 5, range: 8, size: 1, xp: 36, coins: [10, 22],
    slayerCategory: 'Tomb keepers', color: '#b5a27a', ph: ph('§3.1', 'Finale monster (ranged)'),
  },
  {
    id: 'tomb_guardian', name: 'Tomb guardian', examine: 'Built to outlast the dynasty it guards.',
    hp: 140, attackLevel: 40, attackBonus: 26, maxHit: 13, defenceLevel: 48, defence: def(60, 60, 30),
    style: 'melee', speed: 5, range: 1, size: 2, xp: 100, coins: [40, 70],
    slayerCategory: 'Sentinels', color: '#a68a4a', ph: ph('§3.1', 'Finale elite'),
  },
  {
    id: 'gilded_sentinel', name: 'Gilded sentinel', examine: 'A superior Slayer monster covered in gold leaf.',
    hp: 115, attackLevel: 40, attackBonus: 26, maxHit: 12, defenceLevel: 50, defence: def(60, 60, 25),
    style: 'melee', speed: 6, range: 1, size: 2, xp: 100, coins: [40, 70],
    slayerCategory: 'Sentinels', color: '#ffd700', ph: ph('§4.4', 'Finale superior Slayer monster'),
  },

  /* ---------------------------------------------------------------- Volcanic route */
  {
    id: 'ember_bat', name: 'Ember bat', examine: 'Leaves a trail of sparks.',
    hp: 22, attackLevel: 22, attackBonus: 10, maxHit: 5, defenceLevel: 15, defence: def(10, 30, 10),
    style: 'ranged', speed: 4, range: 5, size: 1, xp: 26, coins: [5, 10],
    slayerCategory: 'Fire creatures', color: '#ff7f50', ph: ph('§3.1', 'Volcanic route monster (fast ranged)'),
  },
  {
    id: 'magma_crawler', name: 'Magma crawler', examine: 'The floor moves. No, that is a crawler.',
    hp: 38, attackLevel: 24, attackBonus: 12, maxHit: 8, defenceLevel: 22, defence: def(30, 20, 10),
    style: 'melee', speed: 4, range: 1, size: 1, xp: 34, coins: [6, 12],
    slayerCategory: 'Fire creatures', color: '#cf4a1a', ph: ph('§3.1', 'Volcanic route monster (melee)'),
  },
  {
    id: 'obsidian_mage', name: 'Obsidian mage', examine: 'Glass-skinned and burning inside.',
    hp: 40, attackLevel: 26, attackBonus: 15, maxHit: 9, defenceLevel: 22, defence: def(20, 30, 45),
    style: 'magic', speed: 5, range: 7, size: 1, xp: 36, coins: [8, 14],
    slayerCategory: 'Fire creatures', color: '#4a2a3a', ph: ph('§3.1', 'Volcanic route monster (caster)'),
  },
  {
    id: 'obsidian_brute', name: 'Obsidian brute', examine: 'Each step cracks the stone.',
    hp: 95, attackLevel: 28, attackBonus: 18, maxHit: 12, defenceLevel: 30, defence: def(45, 40, 25),
    style: 'melee', speed: 6, range: 1, size: 2, xp: 95, coins: [25, 45],
    slayerCategory: 'Fire creatures', color: '#2f1f2a', ph: ph('§3.1', 'Volcanic route elite'),
  },
  {
    id: 'cinder_mender', name: 'Cinder mender', examine: 'Heals its master. Hit it to distract it.',
    hp: 30, attackLevel: 0, attackBonus: 0, maxHit: 0, defenceLevel: 10, defence: def(0, 0, 0),
    style: 'magic', speed: 4, range: 1, size: 1, xp: 10, coins: [0, 0],
    behaviour: 'healer', color: '#ffb347', ph: ph('§3.1', 'Volcanic boss healer'),
  },
];
