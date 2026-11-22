/** Persistent and in-run state shapes. Everything here is plain JSON so it can be saved. */
import type { CombatStyle, EquipSlot, Focus, SkillId } from '../content/types';

export interface ItemStack {
  id: string;
  qty: number;
  /** Remaining rooms of charge for charged jewellery. */
  charges?: number;
}

export type Equipment = Partial<Record<EquipSlot, ItemStack>>;

export interface CharacterStats {
  runs: number;
  deaths: number;
  retreats: number;
  clears: number;
  bestDepth: number;
  kills: number;
}

export interface CharacterSave {
  id: string;
  name: string;
  focus: Focus;
  createdAt: number;
  /** Total character XP (one shared pool). */
  xp: number;
  /** Skill ranks 0-10. */
  skills: Record<SkillId, number>;
  respecs: number;
  coins: number;
  slayerPoints: number;
  leaguePoints: number;
  /** Hub feature tiers by feature id. */
  hub: Record<string, number>;
  relicsUnlocked: string[];
  relicsEquipped: string[];
  omensSelected: string[];
  /** Items kept between runs (Vault slots). */
  vault: ItemStack[];
  /** Collection Log: item id -> times received. */
  collection: Record<string, number>;
  pets: string[];
  activePet: string | null;
  tasksDone: string[];
  slayerUnlocks: string[];
  bossKills: Record<string, number>;
  /** Kills since last unique, per boss (pity counter). */
  pity: Record<string, number>;
  stats: CharacterStats;
  /** Preferred spellbook for Magic. */
  spellbook: string;
  /** Preferred route id. */
  route: string;
  /** Act index a trip starts at (Portal Chamber). */
  startAct: number;
  activeRun: RunState | null;
  lastResult: RunResult | null;
}

export interface Settings {
  showPlaceholderTags: boolean;
  autoRetaliate: boolean;
  /** Override the tick length (ms); 0 = default. Only for testing and accessibility. */
  tickMs: number;
}

export interface SaveFile {
  version: number;
  characters: (CharacterSave | null)[];
  settings: Settings;
}

/* ------------------------------------------------------------------ */
/* Run state                                                           */
/* ------------------------------------------------------------------ */

export type RoomType =
  | 'combat'
  | 'elite'
  | 'rest'
  | 'slayer'
  | 'trader'
  | 'chest'
  | 'gather'
  | 'sea'
  | 'boss';

export interface MapNode {
  id: string;
  row: number;
  /** Horizontal position 0-1 for drawing. */
  x: number;
  type: RoomType;
  next: string[];
  /** Edges that are Agility shortcuts (skip a row). */
  shortcuts: string[];
  /** Boss id for boss nodes, gather room id for gather nodes, wave index for gauntlets. */
  boss?: string;
  gather?: string;
  wave?: number;
  /** Chest variant. */
  chest?: 'plain' | 'locked' | 'trapped';
}

export interface ActMap {
  actId: string;
  rows: string[][];
  nodes: Record<string, MapNode>;
}

export interface SlayerTask {
  master: string;
  category: string | null;
  bossId: string | null;
  label: string;
  need: number;
  have: number;
  points: number;
  done: boolean;
}

export interface LootDrop {
  id: string;
  qty: number;
  unique?: boolean;
  pet?: boolean;
}

export interface PendingLoot {
  items: LootDrop[];
  coins: number;
  source: string;
}

export interface RunStats {
  kills: number;
  roomsCleared: number;
  damageTaken: number;
  bossesKilled: string[];
  uniques: string[];
  pets: string[];
  itemsReceived: Record<string, number>;
  deepestAct: number;
  slayerTasksDone: number;
}

export interface ActUses {
  roomSkips: number;
  specRestore: boolean;
  empowered: number;
  harvestTwice: string[];
  smith: boolean;
  recharge: boolean;
  spellbookSwitch: boolean;
  slayerReroll: boolean;
}

export interface NextRoomBuffs {
  combatDraught: boolean;
  feast: boolean;
  brazier: boolean;
  /** Potion ids mixed at a rest altar; their effects apply when the next room starts. */
  mixed: string[];
}

export type RunPhase =
  | 'map'
  | 'room'
  | 'loot'
  | 'event'
  | 'boon'
  | 'actComplete'
  | 'over';

export interface RunState {
  seed: number;
  rng: number;
  routeId: string;
  actIndex: number;
  startActIndex: number;
  map: ActMap;
  /** Node the player currently stands on (null = act start). */
  position: string | null;
  visited: string[];

  hp: number;
  prayer: number;
  runEnergy: number;
  spec: number;
  running: boolean;
  activePrayers: string[];

  inventory: (ItemStack | null)[];
  equipment: Equipment;

  coins: number;
  xp: number;
  boons: Record<string, number>;
  boonsEarned: number;
  boonOffer: string[] | null;

  relics: string[];
  omens: string[];
  spellbook: string;
  activeSpell: string;
  learnedSpells: string[];

  slayerTask: SlayerTask | null;
  slayerOffer: SlayerTask[] | null;
  acts: ActUses;
  cheatDeathUsed: number;
  altSeaRouteUsed: boolean;
  buffs: NextRoomBuffs;
  /** Room-scoped combat buff from a combat draught drunk mid-fight. */
  roomCombatBuff: boolean;

  phase: RunPhase;
  /** Current room node id while phase is room/event/loot. */
  roomNode: string | null;
  pendingLoot: PendingLoot | null;
  /** Shown when a room is a trader/rest/chest/etc. */
  event: RoomEvent | null;
  stats: RunStats;
  /** Run tasks completed during this trip. */
  tasksThisRun: string[];
  /** Messages to show in the chat box (most recent last). */
  log: LogLine[];
  outcome: RunOutcome | null;
}

export type RunOutcome = 'death' | 'retreat' | 'clear';

export interface LogLine {
  text: string;
  kind: 'info' | 'good' | 'bad' | 'loot' | 'rare' | 'system';
}

export type RoomEvent =
  | { kind: 'rest'; rested: boolean; brazierLit: boolean }
  | { kind: 'trader'; stock: { id: string; qty: number; price: number }[]; discount: number; pickpocketed: boolean }
  | { kind: 'chest'; variant: 'plain' | 'locked' | 'trapped'; opened: boolean }
  | { kind: 'gather'; room: string; harvested: number }
  | { kind: 'slayer'; master: string }
  | { kind: 'sea'; resolved: boolean };

export interface RunResult {
  outcome: RunOutcome;
  xpEarned: number;
  xpBreakdown: { label: string; value: number }[];
  levelBefore: number;
  levelAfter: number;
  pointsGained: number;
  coinsBanked: number;
  slayerPoints: number;
  leaguePoints: number;
  tasksCompleted: string[];
  newCollection: string[];
  bossesKilled: string[];
  uniques: string[];
  pets: string[];
  depth: number;
  rooms: number;
  kills: number;
  /** Items the player may keep in the Vault (chosen on the results screen). */
  keepable: ItemStack[];
  vaultSlots: number;
}

export interface CombatStatsView {
  style: CombatStyle;
  maxHit: number;
  accuracy: number;
  speed: number;
  range: number;
}
