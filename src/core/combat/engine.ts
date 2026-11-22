/**
 * Tick-based combat simulation. Headless: the renderer and the balance simulator
 * both drive it through `stepEncounter` and read `events` after each tick.
 *
 * Tick order: player inputs -> player movement -> player attack -> monsters act ->
 * projectiles land -> ground hazards land -> prayer drain / regen -> win/loss.
 * Protection prayers are checked when an attack lands, so switching after seeing a
 * projectile launch works, as the design doc's prayer-switching test intends.
 */
import { CONFIG } from '../../config';
import { C } from '../../content';
import type { BossAttack, BossDef, CombatStyle, DamageStyle, EquipSlot, MonsterDef } from '../../content/types';
import { consumeItem, equipFromInventory, unequip } from '../inventory';
import { mod, runMods, type Mods } from '../mods';
import { Rng } from '../rng';
import type { CharacterSave, RunState } from '../state';
import {
  attackProfile,
  availablePrayers,
  defenceRolls,
  knownSpells,
  maxHp,
  maxPrayer,
  prayerDrainPerTick,
  type AttackProfile,
} from '../stats';
import { hitChance, monsterAccuracyRoll, monsterDefenceRoll, projectileTravel } from './formulas';
import {
  center,
  dumbStep,
  findPath,
  footprintLos,
  inBounds,
  isBlocked,
  rectDistance,
  type Grid,
  type Pos,
} from './geometry';

export const PLAYER_ID = 0;

export interface Enemy {
  id: number;
  def: MonsterDef;
  boss: BossDef | null;
  pos: Pos;
  prevPos: Pos;
  size: number;
  hp: number;
  maxHp: number;
  attackTimer: number;
  phase: number;
  cycle: number;
  windup: { attack: BossAttack; ticks: number; total: number; tiles: Pos[] | null } | null;
  drain: number;
  bound: number;
  distracted: boolean;
  superior: boolean;
  elite: boolean;
  healTimer: number;
  dead: boolean;
  /** Summoned minions give no rewards. */
  summoned: boolean;
}

export interface Projectile {
  id: number;
  from: number;
  to: number;
  style: DamageStyle;
  launchTick: number;
  impactTick: number;
  fromPos: Pos;
  toPos: Pos;
  /** Enemy -> player: pre-rolled damage (0 = miss). Player -> enemy: one entry per hit. */
  hits: number[];
  protection: 'full' | 'half' | 'none';
  drainPrayer: number;
  spellEffect: 'bind' | 'drain' | 'siphon' | null;
  special: string | null;
  label: string;
}

export interface Hazard {
  id: number;
  source: number;
  name: string;
  tiles: Pos[];
  impactTick: number;
  startTick: number;
  maxHit: number;
}

export type CombatEvent =
  | { t: 'hit'; target: number; amount: number; style: DamageStyle; blocked?: 'full' | 'half' }
  | { t: 'miss'; target: number }
  | { t: 'heal'; target: number; amount: number }
  | { t: 'attack'; source: number; style: DamageStyle; name?: string }
  | { t: 'projectile'; id: number }
  | { t: 'telegraph'; source: number; name: string; style: DamageStyle; ticks: number }
  | { t: 'hazard'; id: number }
  | { t: 'death'; id: number }
  | { t: 'spawn'; id: number }
  | { t: 'msg'; text: string; kind: 'info' | 'good' | 'bad' | 'rare' }
  | { t: 'special'; name: string };

export type PlayerAction =
  | { type: 'move'; x: number; y: number }
  | { type: 'attack'; target: number };

export interface KillRecord {
  monsterId: string;
  boss: boolean;
  elite: boolean;
  superior: boolean;
  summoned: boolean;
}

export interface PlayerCombatState {
  pos: Pos;
  prevPos: Pos;
  path: Pos[];
  target: number | null;
  attackTimer: number;
  shield: number;
  firstHitTaken: boolean;
  freeShots: number;
  freeSpells: number;
  hot: { ticks: number; per: number }[];
  specArmed: boolean;
  empowerArmed: boolean;
  damageTaken: number;
  ateThisTick: boolean;
  drankThisTick: boolean;
  specTicks: number;
  pending: PlayerAction | null;
}

export interface EncounterContext {
  run: RunState;
  character: CharacterSave;
  level: number;
  autoRetaliate: boolean;
}

export interface Encounter {
  kind: 'combat' | 'elite' | 'boss';
  grid: Grid;
  tick: number;
  player: PlayerCombatState;
  enemies: Enemy[];
  projectiles: Projectile[];
  hazards: Hazard[];
  events: CombatEvent[];
  result: 'won' | 'lost' | null;
  kills: KillRecord[];
  ammoFired: Record<string, number>;
  runesSpent: Record<string, number>;
  nextId: number;
  rng: Rng;
  ctx: EncounterContext;
}

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

export interface EncounterSpec {
  kind: 'combat' | 'elite' | 'boss';
  monsters: { id: string; superior?: boolean; elite?: boolean }[];
  arena?: { w: number; h: number };
  seed: number;
}

export function createEncounter(spec: EncounterSpec, ctx: EncounterContext): Encounter {
  const rng = new Rng(spec.seed);
  const w = spec.arena?.w ?? 13;
  const h = spec.arena?.h ?? 11;
  const grid: Grid = { w, h, blocked: new Array(w * h).fill(0) };
  const m = runMods(ctx.character, ctx.run);

  // Pillars give the player cover and safe spots.
  if (spec.kind === 'boss') {
    for (const [px, py] of [
      [2, 2],
      [w - 3, 2],
      [2, h - 3],
      [w - 3, h - 3],
    ])
      grid.blocked[py * w + px] = 1;
  } else {
    const pillars = rng.int(2, 4);
    for (let i = 0; i < pillars; i++) {
      const px = rng.int(1, w - 2);
      const py = rng.int(3, h - 4);
      grid.blocked[py * w + px] = 1;
    }
  }

  const playerPos = { x: Math.floor(w / 2), y: h - 2 };
  grid.blocked[playerPos.y * w + playerPos.x] = 0;
  const enc: Encounter = {
    kind: spec.kind,
    grid,
    tick: 0,
    player: {
      pos: { ...playerPos },
      prevPos: { ...playerPos },
      path: [],
      target: null,
      attackTimer: 0,
      shield: mod(m, 'roomShield'),
      firstHitTaken: false,
      freeShots: mod(m, 'freeShotsPerRoom'),
      freeSpells: mod(m, 'freeSpellsPerRoom'),
      hot: [],
      specArmed: false,
      empowerArmed: false,
      damageTaken: 0,
      ateThisTick: false,
      drankThisTick: false,
      specTicks: 0,
      pending: null,
    },
    enemies: [],
    projectiles: [],
    hazards: [],
    events: [],
    result: null,
    kills: [],
    ammoFired: {},
    runesSpent: {},
    nextId: 1,
    rng,
    ctx,
  };

  for (const mon of spec.monsters) {
    const def = C.monster(mon.id);
    const pos = findSpawn(enc, def.size, spec.kind === 'boss' && C.isBoss(mon.id));
    if (pos) spawnEnemy(enc, mon.id, pos, { superior: mon.superior, elite: mon.elite });
  }
  return enc;
}

function findSpawn(enc: Encounter, size: number, centred: boolean): Pos | null {
  const { w, h } = enc.grid;
  if (centred) {
    const p = { x: Math.floor((w - size) / 2), y: 2 };
    if (areaFree(enc, p, size, -1)) return p;
  }
  for (let attempt = 0; attempt < 200; attempt++) {
    const p = { x: enc.rng.int(1, w - size - 1), y: enc.rng.int(1, Math.max(1, Math.floor(h / 2) - 1)) };
    if (areaFree(enc, p, size, -1)) return p;
  }
  for (let y = 0; y < h - size; y++) for (let x = 0; x < w - size; x++) if (areaFree(enc, { x, y }, size, -1)) return { x, y };
  return null;
}

function spawnEnemy(enc: Encounter, id: string, pos: Pos, opts: { superior?: boolean; elite?: boolean; summoned?: boolean } = {}): Enemy {
  const def = C.monster(id);
  const boss = C.isBoss(id) ? C.boss(id) : null;
  const m = runMods(enc.ctx.character, enc.ctx.run);
  const hp = Math.round(def.hp * (1 + mod(m, 'enemyHp') / 100));
  const enemy: Enemy = {
    id: enc.nextId++,
    def,
    boss,
    pos: { ...pos },
    prevPos: { ...pos },
    size: def.size,
    hp,
    maxHp: hp,
    attackTimer: boss ? 3 : enc.rng.int(2, def.speed + 1),
    phase: 0,
    cycle: 0,
    windup: null,
    drain: 0,
    bound: 0,
    distracted: false,
    superior: !!opts.superior,
    elite: !!opts.elite,
    healTimer: CONFIG.HEALER_EVERY,
    dead: false,
    summoned: !!opts.summoned,
  };
  enc.enemies.push(enemy);
  enc.events.push({ t: 'spawn', id: enemy.id });
  return enemy;
}

/* ------------------------------------------------------------------ */
/* Occupancy                                                           */
/* ------------------------------------------------------------------ */

function occupiedBy(enc: Encounter, x: number, y: number, ignore: number): number | null {
  if (ignore !== PLAYER_ID && enc.player.pos.x === x && enc.player.pos.y === y) return PLAYER_ID;
  for (const e of enc.enemies) {
    if (e.dead || e.id === ignore) continue;
    if (x >= e.pos.x && x < e.pos.x + e.size && y >= e.pos.y && y < e.pos.y + e.size) return e.id;
  }
  return null;
}

function areaFree(enc: Encounter, p: Pos, size: number, ignore: number): boolean {
  for (let ox = 0; ox < size; ox++)
    for (let oy = 0; oy < size; oy++) {
      const x = p.x + ox;
      const y = p.y + oy;
      if (isBlocked(enc.grid, x, y)) return false;
      if (occupiedBy(enc, x, y, ignore) !== null) return false;
    }
  // Keep the player's spawn column clear at the bottom.
  return true;
}

export function enemyAt(enc: Encounter, x: number, y: number): Enemy | null {
  for (const e of enc.enemies) {
    if (e.dead) continue;
    if (x >= e.pos.x && x < e.pos.x + e.size && y >= e.pos.y && y < e.pos.y + e.size) return e;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Player commands (called from UI or simulator between ticks)         */
/* ------------------------------------------------------------------ */

export function commandMove(enc: Encounter, x: number, y: number): void {
  if (!inBounds(enc.grid, x, y)) return;
  const target = enemyAt(enc, x, y);
  if (target) {
    commandAttack(enc, target.id);
    return;
  }
  enc.player.target = null;
  enc.player.pending = { type: 'move', x, y };
}

export function commandAttack(enc: Encounter, enemyId: number): void {
  const e = enc.enemies.find((x) => x.id === enemyId && !x.dead);
  if (!e) return;
  enc.player.target = e.id;
  enc.player.path = [];
  enc.player.pending = null;
}

export function togglePrayer(enc: Encounter, id: string): string | null {
  const run = enc.ctx.run;
  const m = runMods(enc.ctx.character, run);
  if (!availablePrayers(m).includes(id)) return 'You have not unlocked that prayer yet.';
  if (run.activePrayers.includes(id)) {
    run.activePrayers = run.activePrayers.filter((p) => p !== id);
    return null;
  }
  if (run.prayer <= 0) return 'You have run out of Prayer points.';
  const group = C.prayer(id).group;
  run.activePrayers = run.activePrayers.filter((p) => C.prayer(p).group !== group);
  run.activePrayers.push(id);
  return null;
}

export function toggleRun(enc: Encounter): void {
  enc.ctx.run.running = !enc.ctx.run.running;
}

export function toggleSpecial(enc: Encounter): string | null {
  const run = enc.ctx.run;
  const m = runMods(enc.ctx.character, run);
  const profile = attackProfile(run, enc.ctx.level, m);
  if (profile.special) {
    if (run.spec < profile.special.cost && !enc.player.specArmed) return 'Not enough special-attack energy.';
    enc.player.specArmed = !enc.player.specArmed;
    return null;
  }
  const strikes = mod(m, 'empoweredStrikes');
  if (strikes > 0) {
    if (run.acts.empowered >= strikes && !enc.player.empowerArmed) return 'Your empowered strike for this act is spent.';
    enc.player.empowerArmed = !enc.player.empowerArmed;
    return null;
  }
  return 'Your weapon has no special attack.';
}

/** Use an inventory item: eat, drink, equip or read. */
export function useItem(enc: Encounter | null, run: RunState, ch: CharacterSave, level: number, slot: number): string | null {
  const stack = run.inventory[slot];
  if (!stack) return null;
  const def = C.item(stack.id);
  const m = runMods(ch, run);
  const hpMax = maxHp(level, m);
  if (def.kind === 'food' && def.heal) {
    if (enc?.player.ateThisTick) return null;
    const heal = Math.round(def.heal * (1 + mod(m, 'foodHeal') / 100));
    const before = run.hp;
    run.hp = Math.min(hpMax, run.hp + heal);
    run.inventory[slot] = stack.qty > 1 ? { ...stack, qty: stack.qty - 1 } : null;
    if (enc) {
      enc.player.ateThisTick = true;
      enc.player.attackTimer = Math.max(enc.player.attackTimer, 0) + CONFIG.EAT_DELAY;
      if (m.flags.has('foodOverTime')) enc.player.hot.push({ ticks: 5, per: Math.max(1, Math.round(heal * 0.06)) });
      enc.events.push({ t: 'heal', target: PLAYER_ID, amount: run.hp - before });
    }
    return `You eat the ${def.name.toLowerCase()}.`;
  }
  if (def.kind === 'potion' && def.potion) {
    if (enc?.player.drankThisTick) return null;
    drinkPotion(run, ch, level, def.potion.effect, def.potion.amount, m, enc);
    run.inventory[slot] = stack.qty > 1 ? { ...stack, qty: stack.qty - 1 } : null;
    if (enc) enc.player.drankThisTick = true;
    return `You drink the ${def.name.toLowerCase()}.`;
  }
  if (def.kind === 'tome' && def.teaches) {
    if (!run.learnedSpells.includes(def.teaches)) run.learnedSpells.push(def.teaches);
    run.inventory[slot] = null;
    const spell = C.spell(def.teaches);
    if (spell.book !== run.spellbook) return `You learn ${spell.name}. It belongs to ${C.spellbook(spell.book).name}, which you are not using.`;
    run.activeSpell = spell.id;
    return `You learn ${spell.name} for the rest of this trip.`;
  }
  if (def.slot) {
    const err = equipFromInventory(run, ch, level, slot);
    if (err) return err;
    if (enc) enc.player.specArmed = false;
    // Equipment can change max HP via passives; clamp.
    const m2 = runMods(ch, run);
    run.hp = Math.min(run.hp, maxHp(level, m2));
    return null;
  }
  return def.examine;
}

export function drinkPotion(
  run: RunState,
  ch: CharacterSave,
  level: number,
  effect: 'prayer' | 'restore' | 'heal' | 'stamina' | 'combat',
  amount: number,
  m: Mods,
  enc: Encounter | null,
): void {
  const boost = 1 + mod(m, 'potionEffect') / 100;
  const value = Math.round(amount * boost);
  if (effect === 'prayer' || effect === 'restore') run.prayer = Math.min(maxPrayer(level, m), run.prayer + value);
  else if (effect === 'heal') {
    const before = run.hp;
    run.hp = Math.min(maxHp(level, m), run.hp + value);
    enc?.events.push({ t: 'heal', target: PLAYER_ID, amount: run.hp - before });
  } else if (effect === 'stamina') run.runEnergy = Math.min(CONFIG.RUN_ENERGY.max, run.runEnergy + value);
  else if (effect === 'combat') run.roomCombatBuff = true;
  void ch;
}

export function unequipSlot(enc: Encounter | null, run: RunState, slot: EquipSlot): string | null {
  const err = unequip(run, slot);
  if (enc) enc.player.specArmed = false;
  return err;
}

export function setSpell(run: RunState, level: number, id: string): string | null {
  const spells = knownSpells(run, level);
  if (!spells.some((s) => s.id === id)) return 'You do not know that spell.';
  run.activeSpell = id;
  return null;
}

/* ------------------------------------------------------------------ */
/* Tick                                                                */
/* ------------------------------------------------------------------ */

export function stepEncounter(enc: Encounter): void {
  if (enc.result) return;
  enc.events = [];
  enc.tick++;
  const { run, character, level } = enc.ctx;
  const p = enc.player;
  p.ateThisTick = false;
  p.drankThisTick = false;
  p.prevPos = { ...p.pos };
  for (const e of enc.enemies) e.prevPos = { ...e.pos };

  let m = runMods(character, run);

  if (p.attackTimer > 0) p.attackTimer--;
  for (const e of enc.enemies) {
    if (e.dead) continue;
    if (e.attackTimer > 0) e.attackTimer--;
    if (e.bound > 0) e.bound--;
  }

  // Heal over time.
  for (const h of p.hot) {
    if (h.ticks <= 0) continue;
    h.ticks--;
    run.hp = Math.min(maxHp(level, m), run.hp + h.per);
  }
  p.hot = p.hot.filter((h) => h.ticks > 0);

  // Drop a dead target.
  if (p.target !== null && !enc.enemies.some((e) => e.id === p.target && !e.dead)) p.target = null;

  playerMove(enc, m);
  m = runMods(character, run);
  playerAttack(enc, m);

  for (const e of enc.enemies) {
    if (e.dead || enc.result) continue;
    if (e.def.behaviour === 'healer') healerAct(enc, e);
    else if (e.boss) bossAct(enc, e, m);
    else monsterAct(enc, e, m);
  }

  resolveProjectiles(enc, m);
  resolveHazards(enc, m);

  // Prayer drain.
  const drain = prayerDrainPerTick(run, m);
  if (drain > 0) {
    run.prayer = Math.max(0, run.prayer - drain);
    if (run.prayer <= 0) {
      run.activePrayers = [];
      enc.events.push({ t: 'msg', text: 'You have run out of Prayer points.', kind: 'bad' });
    }
  }

  // Special-attack energy.
  p.specTicks += 1 + mod(m, 'specRegen') / 100;
  if (p.specTicks >= CONFIG.SPEC.regenEveryTicks) {
    p.specTicks -= CONFIG.SPEC.regenEveryTicks;
    run.spec = Math.min(CONFIG.SPEC.max, run.spec + CONFIG.SPEC.regenAmount);
  }

  // Run energy.
  const moved = Math.max(Math.abs(p.pos.x - p.prevPos.x), Math.abs(p.pos.y - p.prevPos.y));
  if (moved >= 2) run.runEnergy = Math.max(0, run.runEnergy - CONFIG.RUN_ENERGY.drainPerRunTick);
  else run.runEnergy = Math.min(CONFIG.RUN_ENERGY.max, run.runEnergy + CONFIG.RUN_ENERGY.regenPerTick * (1 + mod(m, 'runRegen') / 100));
  if (run.runEnergy <= 0) run.running = false;

  checkEnd(enc);
}

function checkEnd(enc: Encounter): void {
  if (enc.result) return;
  if (enc.ctx.run.hp <= 0) {
    enc.result = 'lost';
    return;
  }
  const bossAlive = enc.enemies.some((e) => e.boss && !e.dead);
  if (enc.kind === 'boss' && !bossAlive) {
    for (const e of enc.enemies) if (!e.dead) killEnemy(enc, e, true);
    enc.result = 'won';
    return;
  }
  if (enc.enemies.every((e) => e.dead)) enc.result = 'won';
}

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */

function inAttackRange(enc: Encounter, from: Pos, target: Enemy, profile: AttackProfile): boolean {
  const d = rectDistance(from, 1, target.pos, target.size);
  if (d > profile.range) return false;
  if (profile.range <= 1) return d <= 1;
  return footprintLos(enc.grid, from, 1, target.pos, target.size);
}

function playerMove(enc: Encounter, m: Mods): void {
  const p = enc.player;
  const run = enc.ctx.run;
  const occupied = (x: number, y: number) => occupiedBy(enc, x, y, PLAYER_ID) !== null;

  if (p.pending?.type === 'move') {
    const goal = { x: p.pending.x, y: p.pending.y };
    const path = findPath(enc.grid, p.pos, (x, y) => x === goal.x && y === goal.y, occupied);
    p.path = path ?? [];
    p.pending = null;
  }

  if (p.target !== null) {
    const target = enc.enemies.find((e) => e.id === p.target)!;
    const profile = attackProfile(run, enc.ctx.level, m, p.freeSpells > 0);
    if (inAttackRange(enc, p.pos, target, profile)) {
      p.path = [];
    } else {
      const path = findPath(
        enc.grid,
        p.pos,
        (x, y) => inAttackRange(enc, { x, y }, target, profile),
        occupied,
      );
      p.path = path ?? [];
    }
  }

  const steps = run.running && run.runEnergy > 0 ? 2 : 1;
  for (let i = 0; i < steps && p.path.length > 0; i++) {
    const next = p.path[0];
    if (occupied(next.x, next.y)) {
      p.path = [];
      break;
    }
    p.pos = next;
    p.path.shift();
    if (p.target !== null) {
      const target = enc.enemies.find((e) => e.id === p.target)!;
      const profile = attackProfile(run, enc.ctx.level, m, p.freeSpells > 0);
      if (inAttackRange(enc, p.pos, target, profile)) {
        p.path = [];
        break;
      }
    }
  }
}

function playerAttack(enc: Encounter, m: Mods): void {
  const p = enc.player;
  if (p.target === null || p.attackTimer > 0) return;
  const run = enc.ctx.run;
  const target = enc.enemies.find((e) => e.id === p.target && !e.dead);
  if (!target) return;
  const freeSpell = p.freeSpells > 0;
  const profile = attackProfile(run, enc.ctx.level, m, freeSpell);
  if (profile.blocked) {
    enc.events.push({ t: 'msg', text: profile.blocked, kind: 'bad' });
    p.target = null;
    return;
  }
  if (!inAttackRange(enc, p.pos, target, profile)) return;

  // Special attack / empowered strike.
  let special = null as null | NonNullable<AttackProfile['special']>;
  if (p.specArmed && profile.special && run.spec >= profile.special.cost) {
    special = profile.special;
    run.spec -= special.cost;
    enc.events.push({ t: 'special', name: special.name });
  }
  p.specArmed = false;
  let empower = false;
  if (p.empowerArmed && run.acts.empowered < mod(m, 'empoweredStrikes')) {
    empower = true;
    run.acts.empowered++;
    enc.events.push({ t: 'msg', text: 'You put everything into the strike!', kind: 'good' });
  }
  p.empowerArmed = false;

  // Consume ammunition or runes.
  if (profile.ammo) {
    if (p.freeShots > 0) p.freeShots--;
    else if (!enc.rng.chance(mod(m, 'ammoSave') / 100)) {
      const slot: EquipSlot = profile.ammo === 'thrown' ? 'weapon' : 'ammo';
      const stack = run.equipment[slot];
      if (stack) {
        enc.ammoFired[stack.id] = (enc.ammoFired[stack.id] ?? 0) + 1;
        stack.qty--;
        if (stack.qty <= 0) {
          delete run.equipment[slot];
          enc.events.push({ t: 'msg', text: 'You have run out of ammunition!', kind: 'bad' });
        }
      }
    }
  } else if (profile.spell) {
    if (freeSpell) p.freeSpells--;
    else if (!enc.rng.chance(mod(m, 'runeSave') / 100)) {
      for (const [rune, count] of Object.entries(profile.spell.runes)) {
        let left = count;
        left -= consumeItem(run, rune, left);
        if (left > 0 && (rune === 'spark_rune' || rune === 'storm_rune')) left -= consumeItem(run, 'tempest_rune', left);
        enc.runesSpent[rune] = (enc.runesSpent[rune] ?? 0) + count;
      }
    }
  }

  const hits: number[] = [];
  const rollHit = (accMult: number, dmgMult: number) => {
    const def = monsterDefenceRoll(target.def, profile.style, target.drain);
    if (!enc.rng.chance(hitChance(profile.accuracyRoll * accMult, def))) return 0;
    const max = Math.max(1, Math.floor(profile.maxHit * dmgMult));
    return enc.rng.int(1, max);
  };
  const dmgMult = empower ? 1.5 : 1;
  if (special?.effect === 'sure') hits.push(rollHit(2, 1.25 * dmgMult));
  else hits.push(rollHit(1, dmgMult));
  if (special?.effect === 'double') hits.push(rollHit(1, dmgMult));
  if (enc.rng.chance(mod(m, 'doubleHitChance') / 100)) hits.push(rollHit(1, 1));

  p.attackTimer = profile.speed;
  enc.events.push({ t: 'attack', source: PLAYER_ID, style: profile.style });

  const spellEffect = profile.spell?.effect ?? null;
  if (profile.style === 'melee') {
    applyPlayerHits(enc, target, hits, spellEffect, special?.effect ?? null, m);
  } else {
    const dist = rectDistance(p.pos, 1, target.pos, target.size);
    const proj: Projectile = {
      id: enc.nextId++,
      from: PLAYER_ID,
      to: target.id,
      style: profile.style,
      launchTick: enc.tick,
      impactTick: enc.tick + projectileTravel(dist),
      fromPos: { ...p.pos },
      toPos: center(target.pos, target.size),
      hits,
      protection: 'none',
      drainPrayer: 0,
      spellEffect,
      special: special?.effect ?? null,
      label: profile.spell?.name ?? '',
    };
    enc.projectiles.push(proj);
    enc.events.push({ t: 'projectile', id: proj.id });
  }
}

function applyPlayerHits(
  enc: Encounter,
  target: Enemy,
  hits: number[],
  spellEffect: Projectile['spellEffect'],
  special: string | null,
  m: Mods,
): void {
  if (target.dead) return;
  const run = enc.ctx.run;
  let total = 0;
  for (const dmg of hits) {
    if (target.dead) break;
    if (dmg <= 0) {
      enc.events.push({ t: 'miss', target: target.id });
      continue;
    }
    const dealt = Math.min(target.hp, dmg);
    target.hp -= dealt;
    total += dealt;
    enc.events.push({ t: 'hit', target: target.id, amount: dmg, style: 'melee' });
    if (target.hp <= 0) killEnemy(enc, target, false);
  }
  if (target.def.behaviour === 'healer') target.distracted = true;
  if (total > 0) {
    if (special === 'drain') target.drain = Math.min(60, target.drain + 30);
    if (special === 'stun') target.attackTimer += target.def.speed;
    if (special === 'heal' || spellEffect === 'siphon') {
      const heal = Math.max(1, Math.floor(total * (special === 'heal' ? 0.5 : 0.25)));
      const level = enc.ctx.level;
      run.hp = Math.min(maxHp(level, m), run.hp + heal);
      enc.events.push({ t: 'heal', target: PLAYER_ID, amount: heal });
    }
    if (spellEffect === 'drain') target.drain = Math.min(30, target.drain + 10);
    if (spellEffect === 'bind' && !target.boss) target.bound = 8;
  }
}

function killEnemy(enc: Encounter, e: Enemy, silent: boolean): void {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  e.windup = null;
  enc.events.push({ t: 'death', id: e.id });
  const run = enc.ctx.run;
  enc.hazards = enc.hazards.filter((h) => h.source !== e.id);
  enc.projectiles = enc.projectiles.filter((pr) => pr.from !== e.id);
  if (silent) return;
  enc.kills.push({ monsterId: e.def.id, boss: !!e.boss, elite: e.elite, superior: e.superior, summoned: e.summoned });
  const m = runMods(enc.ctx.character, run);
  const heal = mod(m, 'healOnKill');
  if (heal > 0 && run.hp > 0) {
    run.hp = Math.min(maxHp(enc.ctx.level, m), run.hp + heal);
    enc.events.push({ t: 'heal', target: PLAYER_ID, amount: heal });
  }
  if (enc.player.target === e.id) enc.player.target = null;
}

/* ------------------------------------------------------------------ */
/* Monsters                                                            */
/* ------------------------------------------------------------------ */

function moveToward(enc: Encounter, e: Enemy, goal: Pos): void {
  if (e.bound > 0) return;
  const step = dumbStep(enc.grid, e.pos, e.size, goal, (x, y) => occupiedBy(enc, x, y, e.id) === null);
  if (step) e.pos = step;
}

function enemyInRange(enc: Encounter, e: Enemy, range: number): boolean {
  const d = rectDistance(e.pos, e.size, enc.player.pos, 1);
  if (d > range) return false;
  if (range <= 1) return d <= 1;
  return footprintLos(enc.grid, e.pos, e.size, enc.player.pos, 1);
}

function monsterAct(enc: Encounter, e: Enemy, m: Mods): void {
  if (!enemyInRange(enc, e, e.def.range)) {
    moveToward(enc, e, enc.player.pos);
    return;
  }
  if (rectDistance(e.pos, e.size, enc.player.pos, 1) === 0) {
    // Standing on the player (can happen with big monsters): step off.
    moveToward(enc, e, { x: enc.player.pos.x, y: enc.player.pos.y - 3 });
    return;
  }
  if (e.attackTimer > 0) return;
  e.attackTimer = e.def.speed;
  const dmg = rollMonsterHit(enc, e.def, e.def.style, e.def.maxHit, m);
  launchAtPlayer(enc, e, e.def.style, dmg, 'full', 0, e.def.name);
}

function rollMonsterHit(enc: Encounter, def: MonsterDef, style: CombatStyle, maxHit: number, m: Mods): number {
  const acc = monsterAccuracyRoll(def, mod(m, 'enemyAcc'));
  const defRoll = defenceRolls(enc.ctx.run, enc.ctx.level, m)[style];
  if (!enc.rng.chance(hitChance(acc, defRoll))) return 0;
  const max = Math.max(1, Math.round(maxHit * (1 + mod(m, 'enemyDmg') / 100)));
  return enc.rng.int(1, max);
}

function launchAtPlayer(
  enc: Encounter,
  e: Enemy,
  style: CombatStyle,
  dmg: number,
  protection: 'full' | 'half' | 'none',
  drainPrayer: number,
  label: string,
  travelOverride?: number,
): void {
  enc.events.push({ t: 'attack', source: e.id, style, name: label });
  const p = enc.player;
  if (p.target === null && p.path.length === 0 && enc.ctx.autoRetaliate) p.target = e.id;
  if (style === 'melee') {
    landOnPlayer(enc, e, style, dmg, protection, drainPrayer);
    return;
  }
  const dist = rectDistance(e.pos, e.size, p.pos, 1);
  const travel = travelOverride ?? projectileTravel(dist);
  const proj: Projectile = {
    id: enc.nextId++,
    from: e.id,
    to: PLAYER_ID,
    style,
    launchTick: enc.tick,
    impactTick: enc.tick + Math.max(1, travel),
    fromPos: center(e.pos, e.size),
    toPos: { ...p.pos },
    hits: [dmg],
    protection,
    drainPrayer,
    spellEffect: null,
    special: null,
    label,
  };
  enc.projectiles.push(proj);
  enc.events.push({ t: 'projectile', id: proj.id });
}

function protectedStyle(run: RunState): CombatStyle | null {
  for (const id of run.activePrayers) {
    const pr = C.prayer(id);
    if (pr.protects) return pr.protects;
  }
  return null;
}

function landOnPlayer(
  enc: Encounter,
  source: Enemy | null,
  style: DamageStyle,
  rawDmg: number,
  protection: 'full' | 'half' | 'none',
  drainPrayer: number,
): void {
  const run = enc.ctx.run;
  const m = runMods(enc.ctx.character, run);
  let dmg = rawDmg;
  let blocked: 'full' | 'half' | undefined;
  if (style !== 'typeless' && protectedStyle(run) === style) {
    if (protection === 'full') {
      dmg = 0;
      blocked = 'full';
    } else if (protection === 'half') {
      dmg = Math.floor(dmg / 2);
      blocked = 'half';
    }
  }
  if (dmg <= 0) {
    if (blocked) enc.events.push({ t: 'hit', target: PLAYER_ID, amount: 0, style, blocked });
    else enc.events.push({ t: 'miss', target: PLAYER_ID });
    return;
  }
  dealToPlayer(enc, source, style, dmg, m, blocked);
  if (drainPrayer > 0) run.prayer = Math.max(0, run.prayer - drainPrayer);
}

function dealToPlayer(enc: Encounter, source: Enemy | null, style: DamageStyle, raw: number, m: Mods, blocked?: 'full' | 'half'): void {
  const run = enc.ctx.run;
  const p = enc.player;
  const dr = Math.min(60, mod(m, 'damageReduction'));
  let dmg = enc.rng.round(raw * (1 - dr / 100));
  if (!p.firstHitTaken) {
    p.firstHitTaken = true;
    const red = mod(m, 'firstHitReduction');
    if (red > 0) dmg = Math.floor(dmg * (1 - red / 100));
  }
  if (p.shield > 0 && dmg > 0) {
    const absorbed = Math.min(p.shield, dmg);
    p.shield -= absorbed;
    dmg -= absorbed;
  }
  run.hp -= dmg;
  p.damageTaken += dmg;
  run.stats.damageTaken += dmg;
  enc.events.push({ t: 'hit', target: PLAYER_ID, amount: dmg, style, blocked });
  const reflect = mod(m, 'reflectPct');
  if (reflect > 0 && source && !source.dead && dmg > 0) {
    const back = Math.max(1, Math.floor((dmg * reflect) / 100));
    source.hp -= back;
    enc.events.push({ t: 'hit', target: source.id, amount: back, style: 'typeless' });
    if (source.hp <= 0) killEnemy(enc, source, false);
  }
  if (run.hp <= 0) {
    const charges = mod(m, 'cheatDeath');
    if (run.cheatDeathUsed < charges) {
      run.cheatDeathUsed++;
      run.hp = 1;
      enc.events.push({ t: 'msg', text: 'You refuse to fall! (1 Hitpoint)', kind: 'rare' });
    } else {
      run.hp = 0;
    }
  }
}

function healerAct(enc: Encounter, e: Enemy): void {
  if (e.distracted) {
    if (rectDistance(e.pos, e.size, enc.player.pos, 1) > 1) moveToward(enc, e, enc.player.pos);
    return;
  }
  const boss = enc.enemies.find((x) => x.boss && !x.dead);
  if (!boss) return;
  if (rectDistance(e.pos, e.size, boss.pos, boss.size) > 1) {
    moveToward(enc, e, center(boss.pos, boss.size));
    return;
  }
  e.healTimer--;
  if (e.healTimer <= 0) {
    e.healTimer = CONFIG.HEALER_EVERY;
    const amount = Math.min(CONFIG.HEALER_AMOUNT, boss.maxHp - boss.hp);
    if (amount > 0) {
      boss.hp += amount;
      enc.events.push({ t: 'heal', target: boss.id, amount });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Bosses                                                              */
/* ------------------------------------------------------------------ */

function bossAct(enc: Encounter, e: Enemy, m: Mods): void {
  const boss = e.boss!;
  // Phase transitions.
  const hpPct = (e.hp / e.maxHp) * 100;
  while (e.phase < boss.phases.length - 1 && hpPct <= boss.phases[e.phase].untilHpPct) {
    e.phase++;
    e.cycle = 0;
    const ph = boss.phases[e.phase];
    if (ph.message) enc.events.push({ t: 'msg', text: ph.message, kind: 'bad' });
    for (const id of ph.summonOnEnter ?? []) {
      const pos = nearFree(enc, e, C.monster(id).size);
      if (pos) spawnEnemy(enc, id, pos, { summoned: true });
    }
  }
  const phase = boss.phases[e.phase];
  const speed = Math.max(2, phase.speed - mod(m, 'bossSpeed'));

  if (e.windup) {
    e.windup.ticks--;
    if (e.windup.ticks <= 0) {
      const w = e.windup;
      e.windup = null;
      executeBossAttack(enc, e, w.attack, w.tiles, m);
      e.attackTimer = speed;
    }
    return;
  }

  const dist = rectDistance(e.pos, e.size, enc.player.pos, 1);
  if (e.attackTimer <= 0) {
    const attack = chooseBossAttack(enc, e, phase.attacks, phase.pattern, dist);
    if (attack) {
      if (attack.windup > 0) {
        const tiles = attack.aoe ? aoeTiles(enc, e, attack) : null;
        e.windup = { attack, ticks: attack.windup, total: attack.windup, tiles };
        enc.events.push({ t: 'telegraph', source: e.id, name: attack.name, style: attack.style, ticks: attack.windup });
        if (tiles) {
          const hz: Hazard = {
            id: enc.nextId++,
            source: e.id,
            name: attack.name,
            tiles,
            startTick: enc.tick,
            impactTick: enc.tick + attack.windup,
            maxHit: attack.maxHit,
          };
          enc.hazards.push(hz);
          enc.events.push({ t: 'hazard', id: hz.id });
        }
      } else {
        executeBossAttack(enc, e, attack, null, m);
        e.attackTimer = speed;
      }
      return;
    }
  }
  // Close the distance when no attack reaches.
  const maxRange = Math.max(...phase.attacks.filter((a) => !a.aoe && !a.summon).map((a) => a.range ?? 1), 1);
  const preferred = dist > maxRange || !footprintLos(enc.grid, e.pos, e.size, enc.player.pos, 1);
  if (preferred || dist === 0) moveToward(enc, e, enc.player.pos);
}

function chooseBossAttack(enc: Encounter, e: Enemy, attacks: BossAttack[], pattern: 'cycle' | 'random', dist: number): BossAttack | null {
  const usable = (a: BossAttack) => {
    if (a.aoe || a.summon) return true;
    const range = a.range ?? 1;
    if (dist > range) return false;
    return range <= 1 ? dist <= 1 && dist > 0 : footprintLos(enc.grid, e.pos, e.size, enc.player.pos, 1);
  };
  if (pattern === 'cycle') {
    for (let i = 0; i < attacks.length; i++) {
      const a = attacks[(e.cycle + i) % attacks.length];
      if (usable(a)) {
        e.cycle = (e.cycle + i + 1) % attacks.length;
        return a;
      }
    }
    return null;
  }
  return enc.rng.weighted(attacks.filter(usable).map((a) => ({ value: a, weight: a.weight ?? 1 }))) ?? null;
}

function aoeTiles(enc: Encounter, e: Enemy, attack: BossAttack): Pos[] {
  const g = enc.grid;
  const tiles: Pos[] = [];
  const pp = enc.player.pos;
  const add = (x: number, y: number) => {
    if (!isBlocked(g, x, y) && !tiles.some((t) => t.x === x && t.y === y)) tiles.push({ x, y });
  };
  const shape = attack.aoe!.shape;
  if (shape === 'target') {
    const r = Math.floor((attack.aoe!.size ?? 3) / 2);
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) add(pp.x + dx, pp.y + dy);
  } else if (shape === 'scatter') {
    const count = attack.aoe!.count ?? 8;
    add(pp.x, pp.y);
    for (let i = 0; i < count * 3 && tiles.length < count; i++) add(enc.rng.int(0, g.w - 1), enc.rng.int(0, g.h - 1));
  } else if (shape === 'cross') {
    for (let x = 0; x < g.w; x++) add(x, pp.y);
    for (let y = 0; y < g.h; y++) add(pp.x, y);
  } else if (shape === 'ring') {
    const r = attack.aoe!.size ?? 1;
    for (let x = e.pos.x - r; x < e.pos.x + e.size + r; x++)
      for (let y = e.pos.y - r; y < e.pos.y + e.size + r; y++) {
        const inside = x >= e.pos.x && x < e.pos.x + e.size && y >= e.pos.y && y < e.pos.y + e.size;
        if (!inside) add(x, y);
      }
  }
  return tiles;
}

function executeBossAttack(enc: Encounter, e: Enemy, attack: BossAttack, _tiles: Pos[] | null, m: Mods): void {
  if (attack.summon) {
    for (const id of attack.summon) {
      const pos = nearFree(enc, e, C.monster(id).size);
      if (pos) spawnEnemy(enc, id, pos, { summoned: true });
    }
    enc.events.push({ t: 'msg', text: `${e.def.name} uses ${attack.name}!`, kind: 'bad' });
    return;
  }
  if (attack.aoe) {
    // Hazard resolves on its own impact tick (same tick as the windup ends).
    enc.events.push({ t: 'attack', source: e.id, style: 'typeless', name: attack.name });
    return;
  }
  if (attack.heal) {
    const amount = Math.min(attack.heal, e.maxHp - e.hp);
    if (amount > 0) {
      e.hp += amount;
      enc.events.push({ t: 'heal', target: e.id, amount });
    }
  }
  const style = attack.style as CombatStyle;
  const dmg = rollMonsterHit(enc, e.def, style, attack.maxHit, m);
  launchAtPlayer(enc, e, style, dmg, attack.protection ?? 'full', attack.drainPrayer ?? 0, attack.name, attack.travel);
}

function nearFree(enc: Encounter, e: Enemy, size: number): Pos | null {
  for (let r = 1; r < 6; r++) {
    for (let dx = -r; dx <= r + e.size - 1; dx++)
      for (let dy = -r; dy <= r + e.size - 1; dy++) {
        const p = { x: e.pos.x + dx, y: e.pos.y + dy };
        if (areaFree(enc, p, size, -1)) return p;
      }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

function resolveProjectiles(enc: Encounter, m: Mods): void {
  const landing = enc.projectiles.filter((p) => p.impactTick <= enc.tick);
  enc.projectiles = enc.projectiles.filter((p) => p.impactTick > enc.tick);
  for (const pr of landing) {
    if (pr.to === PLAYER_ID) {
      const source = enc.enemies.find((e) => e.id === pr.from) ?? null;
      landOnPlayer(enc, source, pr.style, pr.hits[0], pr.protection, pr.drainPrayer);
    } else {
      const target = enc.enemies.find((e) => e.id === pr.to);
      if (target && !target.dead) applyPlayerHits(enc, target, pr.hits, pr.spellEffect, pr.special, m);
    }
    if (enc.ctx.run.hp <= 0) break;
  }
}

function resolveHazards(enc: Encounter, m: Mods): void {
  const landing = enc.hazards.filter((h) => h.impactTick <= enc.tick);
  enc.hazards = enc.hazards.filter((h) => h.impactTick > enc.tick);
  for (const hz of landing) {
    const hit = hz.tiles.some((t) => t.x === enc.player.pos.x && t.y === enc.player.pos.y);
    if (!hit) continue;
    const source = enc.enemies.find((e) => e.id === hz.source) ?? null;
    const scaled = Math.round(hz.maxHit * (1 + mod(m, 'enemyDmg') / 100));
    const dmg = enc.rng.int(Math.ceil(scaled / 2), scaled);
    dealToPlayer(enc, source, 'typeless', dmg, m);
    enc.events.push({ t: 'msg', text: `You are caught by ${hz.name}!`, kind: 'bad' });
    if (enc.ctx.run.hp <= 0) break;
  }
}
