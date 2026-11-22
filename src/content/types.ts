/**
 * Content schema for One More Trip.
 *
 * Every piece of game content (items, monsters, bosses, locations, prayers, relics,
 * difficulty modifiers, pets, spells, hub rooms, terminology) is plain data that
 * follows these types. The engine never hard-codes content names, so swapping the
 * placeholder content pack for licensed content only touches files in src/content/.
 *
 * See docs/REPLACING_CONTENT.md for the replacement workflow.
 */

export type CombatStyle = 'melee' | 'ranged' | 'magic';
export type DamageStyle = CombatStyle | 'typeless';
export type Focus = CombatStyle;

/**
 * Marks a record as a stand-in for content named in the design doc.
 * `null` means the record is original game content and needs no replacement.
 */
export interface Placeholder {
  /** Section of the design doc (meta-progression.md) this record stands in for, e.g. "§3.1". */
  plan: string;
  /** What the design doc calls for in this slot, described generically, e.g. "Act 1 boss". */
  slot: string;
}

export const SKILL_IDS = [
  'attack',
  'strength',
  'defence',
  'ranged',
  'magic',
  'hitpoints',
  'prayer',
  'agility',
  'thieving',
  'slayer',
  'herblore',
  'cooking',
  'construction',
  'crafting',
  'fletching',
  'runecraft',
  'mining',
  'smithing',
  'fishing',
  'farming',
  'firemaking',
  'woodcutting',
  'hunter',
  'sailing',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const EQUIP_SLOTS = [
  'head',
  'cape',
  'neck',
  'ammo',
  'weapon',
  'body',
  'shield',
  'legs',
  'hands',
  'feet',
  'ring',
] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

export interface StyleTriple {
  melee: number;
  ranged: number;
  magic: number;
}

/* ------------------------------------------------------------------ */
/* Effects: the one vocabulary shared by skills, boons, relics, omens, */
/* prayers, hub upgrades and item passives.                            */
/* ------------------------------------------------------------------ */

/** Numeric modifiers. Percent values are whole percents (10 = +10%). */
export type ModKey =
  | 'maxHp'
  | 'maxHpPct'
  | 'prayerPoints'
  | 'accMelee'
  | 'accRanged'
  | 'accMagic'
  | 'maxHitMelee'
  | 'maxHitRanged'
  | 'maxHitMagic'
  | 'dmgPct'
  | 'defencePct'
  | 'damageReduction'
  | 'prayerDrain'
  | 'foodHeal'
  | 'potionEffect'
  | 'coinFind'
  | 'dropChance'
  | 'ammoRecovery'
  | 'runeRecovery'
  | 'ammoSave'
  | 'runeSave'
  | 'healOnKill'
  | 'healPerRoom'
  | 'startFood'
  | 'startPrayerPotions'
  | 'startStamina'
  | 'startLogs'
  | 'cheatDeath'
  | 'firstHitReduction'
  | 'runRegen'
  | 'slayerReward'
  | 'specRestore'
  | 'empoweredStrikes'
  | 'freeSpellsPerRoom'
  | 'freeShotsPerRoom'
  | 'roomSkipsPerAct'
  | 'seaRouteChance'
  | 'pohCost'
  | 'enemyHp'
  | 'enemyAcc'
  | 'enemyDmg'
  | 'bossSpeed'
  | 'xpBonus'
  | 'bankBonus'
  | 'vaultSlots'
  | 'relicSlots'
  | 'restHeal'
  | 'restPrayer'
  | 'superiorChance'
  | 'doubleHitChance'
  | 'reflectPct'
  | 'roomShield'
  | 'boonChoices'
  | 'specRegen'
  | 'uniqueChance'
  | 'yieldMining'
  | 'yieldWoodcutting'
  | 'yieldFishing'
  | 'yieldFarming'
  | 'yieldHunter'
  | 'yieldFiremaking'
  | 'restRoomsToCombat'
  | 'noFood';

/**
 * Behaviour switches. The engine registry in src/core/flags.ts lists which flags
 * are implemented; content validation fails on unknown flags.
 */
export type FlagId =
  | 'unlockProtectMagic'
  | 'unlockProtectRanged'
  | 'unlockProtectMelee'
  | 'chooseSlayerTask'
  | 'superiorSlayer'
  | 'slayerBossTask'
  | 'openLockedChests'
  | 'disarmTraps'
  | 'pickpocket'
  | 'spellbookSwitch'
  | 'potionMix'
  | 'feast'
  | 'brazier'
  | 'brazierBuff'
  | 'smithUpgrade'
  | 'jewelleryRecharge'
  | 'harvestTwiceMining'
  | 'harvestTwiceFishing'
  | 'harvestTwiceFarming'
  | 'harvestTwiceWoodcutting'
  | 'hunterClueRoll'
  | 'miningBonusRoll'
  | 'pohWorkshop'
  | 'pohPortal'
  | 'pohChapelAltar'
  | 'seaRouteChoice'
  | 'altSeaRoute'
  | 'prayerBoons'
  | 'foodOverTime';

/** Room types that skill perks can add to act maps. */
export type RoomUnlock = 'ore' | 'tree' | 'fishing' | 'herb' | 'trap' | 'shortcut' | 'salvage' | 'island';

export type Effect =
  | { mod: ModKey; value: number }
  | { flag: FlagId }
  /** Adds every item carrying this tag to drop pools. */
  | { gate: string }
  /** Multiplies the drop weight of items carrying this tag. */
  | { weight: string; mult: number }
  | { room: RoomUnlock };

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

export type ItemKind =
  | 'weapon'
  | 'armour'
  | 'ammo'
  | 'food'
  | 'potion'
  | 'rune'
  | 'jewellery'
  | 'resource'
  | 'tome'
  | 'casket'
  | 'misc';

export type AmmoType = 'arrow' | 'bolt' | 'thrown';

export type SpecialEffect = 'double' | 'sure' | 'drain' | 'heal' | 'stun';

export interface SpecialAttack {
  name: string;
  /** Percent of special-attack energy spent. */
  cost: number;
  effect: SpecialEffect;
  description: string;
}

export interface WeaponInfo {
  style: CombatStyle;
  /** Ticks between attacks. */
  speed: number;
  /** Attack range in tiles (Chebyshev distance). Melee is 1. */
  range: number;
  twoHanded?: boolean;
  /** Ranged weapons: ammunition type required in the ammo slot (thrown weapons are their own ammo). */
  ammo?: AmmoType;
  /** Powered staves: built-in spell max hit, no runes needed. */
  poweredMaxHit?: number;
  /** Staves can autocast spells from the active spellbook. */
  autocast?: boolean;
  special?: SpecialAttack;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  /** Short flavour/examine text. */
  examine: string;
  slot?: EquipSlot;
  attack?: Partial<StyleTriple>;
  defence?: Partial<StyleTriple>;
  /** melee = melee strength, ranged = ranged strength (ammo/thrown), magic = magic damage %. */
  strength?: Partial<StyleTriple>;
  prayer?: number;
  weapon?: WeaponInfo;
  /** For ammunition (and thrown weapons). */
  ammoType?: AmmoType;
  stackable?: boolean;
  /** Food: hitpoints healed. */
  heal?: number;
  /** Food: bites/doses are not modelled; one item = one use. */
  potion?: { effect: 'prayer' | 'restore' | 'heal' | 'stamina' | 'combat'; amount: number };
  /** Spell tomes teach this spell id for the rest of the run. */
  teaches?: string;
  /** Trader buy price in coins (sell price is 40% of this). */
  value: number;
  /** Requirements to equip: character level and/or skill ranks. */
  req?: { level?: number; skills?: Partial<Record<SkillId, number>> };
  /** Drop-pool tags (gates and weights match on these). */
  tags: string[];
  /** Combat focus used for the 80% focus weighting of weapon drops. */
  focus?: Focus;
  /** Rough power tier 1-6, used to cap what an act can drop. */
  tier: number;
  /** Boss unique: always logged with a reward presentation. */
  unique?: boolean;
  /** Charged jewellery: number of rooms the passive lasts. */
  charges?: number;
  /** Passive effects while equipped. */
  passive?: Effect[];
  /** Asset key, see src/content/assets.ts. Defaults to `item:<id>`. */
  asset?: string;
  ph: Placeholder | null;
}

/* ------------------------------------------------------------------ */
/* Monsters and bosses                                                 */
/* ------------------------------------------------------------------ */

export interface MonsterDef {
  id: string;
  name: string;
  examine: string;
  hp: number;
  attackLevel: number;
  attackBonus: number;
  maxHit: number;
  defenceLevel: number;
  defence: StyleTriple;
  style: CombatStyle;
  /** Ticks between attacks. */
  speed: number;
  range: number;
  /** Footprint in tiles (1, 2 or 3). */
  size: number;
  xp: number;
  coins: [number, number];
  /** Slayer tasks group monsters by category. */
  slayerCategory?: string;
  /** Stronger variant that can replace this monster on a Slayer task (Slayer rank 6). */
  superior?: string;
  /** Visual tint used by the placeholder renderer. */
  color: string;
  /** 'healer' monsters walk to the boss and heal it instead of attacking. */
  behaviour?: 'normal' | 'healer';
  asset?: string;
  ph: Placeholder | null;
}

export type AoeShape =
  /** Square of `size` tiles centred on the player's position at launch. */
  | 'target'
  /** `count` random tiles across the arena. */
  | 'scatter'
  /** Full rows/columns through the player's position. */
  | 'cross'
  /** Ring of tiles around the boss. */
  | 'ring';

export interface BossAttack {
  id: string;
  name: string;
  style: DamageStyle;
  maxHit: number;
  /** Ticks the attack is telegraphed before it launches. */
  windup: number;
  /** Projectile travel ticks after launch (0 = instant). Prayer is checked on impact. */
  travel?: number;
  range?: number;
  /** How a matching protection prayer handles it. Default 'full'. */
  protection?: 'full' | 'half' | 'none';
  aoe?: { shape: AoeShape; size?: number; count?: number };
  /** Drain this many prayer points on hit. */
  drainPrayer?: number;
  /** Summon monsters (ids) instead of dealing damage. */
  summon?: string[];
  /** Heal the boss by this much. */
  heal?: number;
  weight?: number;
}

export interface BossPhase {
  /** Phase applies while boss HP is above this percent (last phase should be 0). */
  untilHpPct: number;
  speed: number;
  /** 'cycle' plays attacks in order; 'random' picks by weight. */
  pattern: 'cycle' | 'random';
  attacks: BossAttack[];
  /** Line shown in the chat box when the phase starts. */
  message?: string;
  /** Monsters summoned once when the phase starts. */
  summonOnEnter?: string[];
}

export interface UniqueEntry {
  item: string;
  weight: number;
}

export interface BossDef extends MonsterDef {
  phases: BossPhase[];
  /** Number of regular item rolls on kill (2 for act bosses, 3 for finale). */
  drops: number;
  /** Chance (0-1) per kill to roll the unique table. Roguelike tuning, not a source rate. */
  uniqueChance: number;
  uniques: UniqueEntry[];
  /** Pet item id and chance per kill (0-1). Pets are cosmetic. */
  pet?: { id: string; chance: number };
  /** Monsters present when the fight starts. */
  minions?: string[];
  /** Arena size override. */
  arena?: { w: number; h: number };
}

/* ------------------------------------------------------------------ */
/* World                                                               */
/* ------------------------------------------------------------------ */

export interface ActTheme {
  floor: string;
  floorAlt: string;
  wall: string;
  accent: string;
  fog: string;
}

export interface ActDef {
  id: string;
  name: string;
  /** One-line description shown on the act intro card. */
  blurb: string;
  /** Position in a route (1-4). Drives XP/coin scaling and drop tier caps. */
  depth: number;
  theme: ActTheme;
  monsters: string[];
  elites: string[];
  /** Boss ids. If more than one, the act map ends in branching boss routes. */
  bosses: string[];
  /** Always-available drop pool for this location (item ids). */
  dropPool: string[];
  /** Highest item tier that gated drop-pool items may have in this act. */
  maxTier: number;
  slayerMaster: string;
  /** Inclusive range of map nodes (the design doc asks for 8-12). */
  roomCount: [number, number];
  enemiesPerRoom: [number, number];
  /** Volcanic-style acts run as a wave gauntlet instead of a branching map. */
  gauntlet?: { waves: string[][] };
  ph: Placeholder | null;
}

export interface RouteDef {
  id: string;
  name: string;
  description: string;
  acts: string[];
  /** Hub feature tier needed to pick this route. */
  unlock?: { feature: string; tier: number };
  ph: Placeholder | null;
}

export interface SlayerMasterDef {
  id: string;
  name: string;
  greeting: string;
  ph: Placeholder | null;
}

/* ------------------------------------------------------------------ */
/* Character systems                                                   */
/* ------------------------------------------------------------------ */

export interface PrayerDef {
  id: string;
  name: string;
  description: string;
  /** Protection prayers block one style; only one protection may be active. */
  protects?: CombatStyle;
  /** Prayers in the same group replace each other. */
  group: 'protect' | 'accuracy' | 'strength' | 'defence';
  /** Prayer points drained per tick before prayer bonus. */
  drain: number;
  effects?: Effect[];
  /** Flag that unlocks it (from the Prayer skill track). Absent = always available. */
  unlockFlag?: FlagId;
  /** Hotkey shown in the UI. */
  key?: string;
  ph: Placeholder | null;
}

export interface SpellbookDef {
  id: string;
  name: string;
  description: string;
  ph: Placeholder | null;
}

export interface SpellDef {
  id: string;
  name: string;
  book: string;
  maxHit: number;
  minLevel: number;
  /** Rune item id -> count per cast. */
  runes: Record<string, number>;
  /** Extra on-hit effect. */
  effect?: 'bind' | 'drain' | 'siphon';
  ph: Placeholder | null;
}

export interface RelicDef {
  id: string;
  name: string;
  description: string;
  /** League-point cost to unlock (once per character). */
  cost: number;
  effects: Effect[];
  ph: Placeholder | null;
}

export interface OmenDef {
  id: string;
  name: string;
  description: string;
  /** Challenge points added to the run's score. */
  points: number;
  effects: Effect[];
  ph: Placeholder | null;
}

export interface BoonDef {
  id: string;
  name: string;
  description: string;
  effects: Effect[];
  /** Only offered when the hub Chapel grants prayer boons. */
  requiresFlag?: FlagId;
  /** Max times this boon can be taken in one run. */
  stack: number;
  ph: Placeholder | null;
}

export interface PetDef {
  id: string;
  name: string;
  examine: string;
  color: string;
  ph: Placeholder | null;
}

export interface SkillPerk {
  rank: 3 | 6 | 10;
  text: string;
  effects: Effect[];
}

export interface SkillDef {
  id: SkillId;
  name: string;
  group: 'combat' | 'utility';
  perRankText: string;
  perRank: Effect[];
  perks: SkillPerk[];
  color: string;
  ph: Placeholder | null;
}

export interface HubTier {
  text: string;
  effects: Effect[];
  /** Flag the character must have (e.g. from Construction) to build this tier. */
  requiresFlag?: FlagId;
}

export interface HubFeatureDef {
  id: string;
  name: string;
  description: string;
  /** Base coin cost; tier N costs base x 2.5^(N-1). */
  baseCost: number;
  tiers: HubTier[];
  /** Tier the feature starts at for a new character. */
  startTier: number;
  ph: Placeholder | null;
}

export interface StartingKit {
  focus: Focus;
  /** Item ids worn at the start of a run. */
  equipment: string[];
  /** Ammunition placed in the ammo slot: [item id, quantity]. */
  ammo?: [string, number];
  /** [item id, quantity] in the inventory. */
  inventory: [string, number][];
  spellbook?: string;
  /** Workshop upgrades: replacements applied per Workshop tier (tier index -> [from, to]). */
  workshop: [string, string][];
  ph: Placeholder | null;
}

export interface RunTaskDef {
  id: string;
  name: string;
  description: string;
  points: number;
  ph: Placeholder | null;
}

export interface SlayerUnlockDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  ph: Placeholder | null;
}

/** Player-facing names for systems whose design-doc names are placeholders. */
export interface Terms {
  gameTitle: string;
  hubName: string;
  leaguePoints: string;
  relics: string;
  omens: string;
  collectionLog: string;
  vault: string;
  coins: string;
  slayerPoints: string;
  boons: string;
}

export interface GatherRoomDef {
  id: RoomUnlock;
  name: string;
  skill: SkillId | null;
  description: string;
  /** Item yields by tier: [base tier pool, higher tier pool unlocked by the skill's rank-6 gate]. */
  yields: { item: string; qty: [number, number] }[];
  highYields: { item: string; qty: [number, number] }[];
  highGate: string;
  ph: Placeholder | null;
}
