/**
 * The persistent hub (design doc §6), starting kits (§2), run tasks (§7.1),
 * Slayer unlocks (§6), gathering rooms (§4.4) and pets (§7.3).
 *
 * Hub room names and pets are PLACEHOLDERS for the source game's house rooms and
 * boss pets. Tier effects, costs and gating follow the design doc; anything the doc
 * leaves open is noted in docs/DECISIONS.md.
 */
import type {
  GatherRoomDef,
  HubFeatureDef,
  PetDef,
  RunTaskDef,
  SlayerUnlockDef,
  StartingKit,
} from './types';
import { ph } from './placeholder';

export const HUB_FEATURES: HubFeatureDef[] = [
  {
    id: 'workshop',
    name: 'Workshop',
    description: 'Improves your starting equipment.',
    baseCost: 150,
    startTier: 0,
    tiers: [
      { text: 'Starting weapon improves one tier (if you meet its level).', effects: [], requiresFlag: 'pohWorkshop' },
      { text: 'Starting body armour improves one tier.', effects: [], requiresFlag: 'pohWorkshop' },
      { text: '+1 food and +1 stamina draught at the start of each trip.', effects: [{ mod: 'startFood', value: 1 }, { mod: 'startStamina', value: 1 }], requiresFlag: 'pohWorkshop' },
      { text: 'Starting weapon or ammunition improves again.', effects: [], requiresFlag: 'pohWorkshop' },
      { text: 'Another piece of starting armour improves.', effects: [], requiresFlag: 'pohWorkshop' },
    ],
    ph: ph('§6', 'House room: workshop'),
  },
  {
    id: 'chapel',
    name: 'Chapel',
    description: 'Restores Prayer at rest altars and unlocks prayer boons.',
    baseCost: 120,
    startTier: 0,
    tiers: [
      { text: 'Rest altars restore 50% of your Prayer.', effects: [{ mod: 'restPrayer', value: 50 }] },
      { text: 'Rest altars restore all of your Prayer.', effects: [{ mod: 'restPrayer', value: 50 }] },
      { text: 'Prayer boons can be offered during trips.', effects: [{ flag: 'prayerBoons' }] },
      { text: '+5 Prayer points.', effects: [{ mod: 'prayerPoints', value: 5 }] },
      { text: 'Altar upgrade: prayers drain 25% slower.', effects: [{ mod: 'prayerDrain', value: -25 }], requiresFlag: 'pohChapelAltar' },
    ],
    ph: ph('§6', 'House room: chapel'),
  },
  {
    id: 'vault',
    name: 'Vault room',
    description: 'Keep items between trips.',
    baseCost: 200,
    startTier: 0,
    tiers: [
      { text: 'Keep 1 item between trips.', effects: [{ mod: 'vaultSlots', value: 1 }] },
      { text: 'Keep 2 items between trips.', effects: [{ mod: 'vaultSlots', value: 1 }] },
      { text: 'Keep 3 items between trips.', effects: [{ mod: 'vaultSlots', value: 1 }] },
    ],
    ph: ph('§6', 'House room: costume room (vault storage)'),
  },
  {
    id: 'portal',
    name: 'Portal Chamber',
    description: 'Opens alternate routes and later starting points.',
    baseCost: 200,
    startTier: 0,
    tiers: [
      { text: 'Unlock the volcanic route.', effects: [], requiresFlag: 'pohPortal' },
      { text: 'Begin trips at Act 2 (Act 1 rewards are skipped).', effects: [], requiresFlag: 'pohPortal' },
      { text: 'Sea routes appear 10% more often.', effects: [{ mod: 'seaRouteChance', value: 10 }], requiresFlag: 'pohPortal' },
      { text: 'Begin trips at Act 3.', effects: [], requiresFlag: 'pohPortal' },
    ],
    ph: ph('§6', 'House room: portal chamber'),
  },
  {
    id: 'study',
    name: 'Study',
    description: 'Respec skills, read the Collection Log, and add relic slots.',
    baseCost: 150,
    startTier: 1,
    tiers: [
      { text: 'Respec skill points and browse the Collection Log.', effects: [] },
      { text: 'A second relic slot.', effects: [{ mod: 'relicSlots', value: 1 }] },
      { text: 'A third relic slot.', effects: [{ mod: 'relicSlots', value: 1 }] },
    ],
    ph: ph('§6', 'House room: study'),
  },
  {
    id: 'menagerie',
    name: 'Menagerie',
    description: 'Show off pets and bring one along on trips.',
    baseCost: 100,
    startTier: 0,
    tiers: [{ text: 'Pick a pet to follow you (cosmetic).', effects: [] }],
    ph: ph('§6', 'House room: menagerie'),
  },
  {
    id: 'trophy',
    name: 'Trophy room',
    description: 'Displays boss kill counts and uniques.',
    baseCost: 100,
    startTier: 0,
    tiers: [{ text: 'Display your boss trophies.', effects: [] }],
    ph: ph('§6', 'House room: trophy room'),
  },
];

export const STARTING_KITS: StartingKit[] = [
  {
    focus: 'melee',
    equipment: ['iron_scimitar', 'wooden_shield', 'iron_chainbody'],
    inventory: [['trout', 4]],
    workshop: [
      ['iron_scimitar', 'steel_scimitar'],
      ['iron_chainbody', 'steel_platebody'],
      ['', ''],
      ['steel_scimitar', 'cobalt_scimitar'],
      ['wooden_shield', 'steel_kiteshield'],
    ],
    ph: ph('§2', 'Melee starting kit'),
  },
  {
    focus: 'ranged',
    equipment: ['shortbow', 'leather_body', 'leather_chaps'],
    ammo: ['bronze_arrows', 50],
    inventory: [['trout', 4]],
    workshop: [
      ['shortbow', 'ashwood_shortbow'],
      ['leather_body', 'studded_body'],
      ['', ''],
      ['bronze_arrows', 'iron_arrows'],
      ['leather_chaps', 'studded_chaps'],
    ],
    ph: ph('§2', 'Ranged starting kit'),
  },
  {
    focus: 'magic',
    equipment: ['air_staff', 'apprentice_hat', 'apprentice_robe'],
    inventory: [['spark_rune', 100], ['trout', 4]],
    spellbook: 'elemental',
    workshop: [
      ['air_staff', 'fire_staff'],
      ['apprentice_robe', 'adept_robe'],
      ['', ''],
      ['fire_staff', 'battlestaff'],
      ['apprentice_hat', 'adept_hood'],
    ],
    ph: ph('§2', 'Magic starting kit'),
  },
];

export const RUN_TASKS: RunTaskDef[] = [
  { id: 'first_room', name: 'First Steps', description: 'Clear your first combat room.', points: 5, ph: null },
  { id: 'boss_act1', name: 'Hill Toppled', description: 'Defeat the Act 1 boss.', points: 10, ph: null },
  { id: 'boss_act2', name: 'General Disarray', description: 'Defeat an Act 2 boss.', points: 15, ph: null },
  { id: 'both_generals', name: 'Both Sides', description: 'Defeat both Act 2 bosses (across any trips).', points: 20, ph: null },
  { id: 'boss_act3', name: 'Lights Out', description: 'Defeat an Act 3 boss.', points: 25, ph: null },
  { id: 'full_clear', name: 'One More Trip', description: 'Complete a full clear.', points: 40, ph: null },
  { id: 'slayer_task', name: 'On Assignment', description: 'Complete a Slayer task.', points: 10, ph: null },
  { id: 'untouched', name: 'Untouched', description: 'Clear a combat room without taking damage.', points: 10, ph: null },
  { id: 'flawless_boss', name: 'Flawless', description: 'Defeat a boss without taking damage.', points: 30, ph: null },
  { id: 'omen_boss', name: 'Tempting Fate', description: 'Defeat a boss with at least 30 Omen points active.', points: 20, ph: null },
  { id: 'collector_10', name: 'Collector', description: 'Log 10 different items in the Collection Log.', points: 10, ph: null },
  { id: 'collector_50', name: 'Hoarder', description: 'Log 50 different items in the Collection Log.', points: 25, ph: null },
  { id: 'unique_drop', name: 'Shiny', description: 'Receive a boss unique.', points: 20, ph: null },
  { id: 'pet_drop', name: 'Best Friend', description: 'Receive a pet.', points: 25, ph: null },
  { id: 'wealthy', name: 'Nest Egg', description: 'Bank 150 Coins from a single trip.', points: 15, ph: null },
  { id: 'retreat', name: 'Live to Fight', description: 'Retreat through a portal after an act boss.', points: 5, ph: null },
];

export const SLAYER_UNLOCKS: SlayerUnlockDef[] = [
  { id: 'task_reroll', name: 'Second Opinion', description: 'Reroll a Slayer task once per act.', cost: 30, ph: null },
  { id: 'longer_tasks', name: 'Extended Contracts', description: 'Tasks ask for 2 more kills and pay 50% more points.', cost: 50, ph: null },
  { id: 'superior_boost', name: 'Bigger Game', description: 'Superior Slayer monsters appear twice as often.', cost: 80, ph: null },
];

export const GATHER_ROOMS: GatherRoomDef[] = [
  {
    id: 'ore', name: 'Ore vein', skill: 'mining', description: 'A seam of ore glints in the rock.',
    yields: [{ item: 'iron_ore', qty: [2, 4] }, { item: 'uncut_gem', qty: [0, 1] }],
    highYields: [{ item: 'cobalt_ore', qty: [1, 3] }, { item: 'uncut_gem', qty: [1, 2] }],
    highGate: 'ore-high', ph: null,
  },
  {
    id: 'tree', name: 'Grove', skill: 'woodcutting', description: 'Hardy trees grow in a shaft of light.',
    yields: [{ item: 'logs', qty: [3, 5] }],
    highYields: [{ item: 'ashwood_logs', qty: [2, 4] }],
    highGate: 'log-high', ph: null,
  },
  {
    id: 'fishing', name: 'Fishing spot', skill: 'fishing', description: 'Fish rise in an underground pool. They come out cooked, somehow.',
    yields: [{ item: 'trout', qty: [2, 3] }, { item: 'salmon', qty: [1, 2] }],
    highYields: [{ item: 'swordfish', qty: [2, 3] }, { item: 'shark', qty: [1, 2] }],
    highGate: 'fish-high', ph: null,
  },
  {
    id: 'herb', name: 'Herb patch', skill: 'farming', description: 'A patch of herbs, already brewed into draughts by a helpful hermit.',
    yields: [{ item: 'devotion_draught', qty: [1, 1] }, { item: 'healing_brew', qty: [0, 1] }],
    highYields: [{ item: 'restoration_draught', qty: [1, 2] }],
    highGate: 'herb-high', ph: null,
  },
  {
    id: 'trap', name: 'Trap run', skill: 'hunter', description: 'Set traps and see what wanders in.',
    yields: [{ item: 'bread', qty: [1, 2] }, { item: 'sealed_casket', qty: [0, 1] }],
    highYields: [{ item: 'impling_jar', qty: [1, 2] }],
    highGate: 'impling-jar', ph: null,
  },
  {
    id: 'salvage', name: 'Shipwreck', skill: 'sailing', description: 'A wreck on an underground lake, still full of cargo.',
    yields: [{ item: 'iron_ore', qty: [1, 2] }, { item: 'uncut_gem', qty: [0, 1] }, { item: 'sealed_casket', qty: [0, 1] }],
    highYields: [],
    highGate: '', ph: null,
  },
];

export const PETS: PetDef[] = [
  { id: 'pet_brakka_whelp', name: 'Brakka whelp', examine: 'A tiny warlord with a tiny axe.', color: '#6b4a2b', ph: ph('§7.3', 'Act 2 boss pet') },
  { id: 'pet_little_vesper', name: 'Little Vesper', examine: 'She is very polite and slightly bitey.', color: '#7b1030', ph: ph('§7.3', 'Act 3 raid pet') },
  { id: 'pet_colossus_pup', name: 'Colossus pup', examine: 'A pocket-sized sun.', color: '#d4a017', ph: ph('§7.3', 'Finale raid pet') },
  { id: 'pet_cinder_cub', name: 'Cinder cub', examine: 'Warm. Very warm. Ouch.', color: '#e25822', ph: ph('§7.3', 'Volcanic route pet') },
];
