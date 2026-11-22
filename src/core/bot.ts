/**
 * A simple autoplayer used by the balance simulator (`npm run sim`) and the test
 * suite. It plays reasonably: targets the nearest monster, eats when low, flicks
 * protection prayers at incoming attacks if unlocked, and steps out of hazards.
 */
import { C } from '../content';
import type { CombatStyle, EquipSlot } from '../content/types';
import {
  commandAttack,
  commandMove,
  stepEncounter,
  togglePrayer,
  useItem,
  type Encounter,
} from './combat/engine';
import { isBlocked, rectDistance } from './combat/geometry';
import { equipReason } from './inventory';
import { runMods } from './mods';
import {
  acceptSlayerTask,
  canHarvest,
  harvest,
  openChest,
  rest,
  sail,
  seaHasChoice,
  buy,
  lightBrazier,
  canLightBrazier,
} from './rooms';
import {
  availableMoves,
  chooseBoon,
  closeRoom,
  continueToNextAct,
  enterNode,
  finishEncounter,
  processKills,
  takeAllLoot,
  type RunCtx,
} from './run';
import { characterLevel } from './save';
import type { RunResult } from './state';
import { availablePrayers, maxHp } from './stats';
import { Rng } from './rng';

export interface BotOptions {
  /** 0-1: how reliably the bot flicks prayers and dodges (1 = perfect). */
  skill: number;
  maxTicks: number;
  retreatBelowHpPct: number;
}

export const DEFAULT_BOT: BotOptions = { skill: 0.85, maxTicks: 4000, retreatBelowHpPct: 0 };

export function botPlayRun(ctx: RunCtx, opts: BotOptions = DEFAULT_BOT, rngSeed = 1): RunResult {
  const rng = new Rng(rngSeed);
  const { run, ch } = ctx;
  let guard = 0;
  while (run.phase !== 'over' && guard++ < 400) {
    if (run.boonOffer) {
      chooseBoon(ctx, run.boonOffer[0]);
      continue;
    }
    if (run.phase === 'map') {
      const moves = availableMoves(run);
      if (!moves.length) throw new Error('Bot stuck: no moves on the map');
      const level = characterLevel(ch);
      const hpPct = run.hp / maxHp(level, runMods(ch, run));
      const rest = moves.find((id) => run.map.nodes[id].type === 'rest');
      const pick = hpPct < 0.6 && rest ? rest : moves[rng.int(0, moves.length - 1)];
      const enc = enterNode(ctx, pick);
      if (enc) {
        const res = botFight(ctx, enc, opts, rng);
        if (res) return res;
      }
      continue;
    }
    if (run.phase === 'loot') {
      takeAllLoot(ctx);
      autoEquip(ctx);
      closeRoom(ctx);
      continue;
    }
    if (run.phase === 'event') {
      botEvent(ctx);
      takeAllLoot(ctx);
      autoEquip(ctx);
      closeRoom(ctx);
      continue;
    }
    if (run.phase === 'actComplete') {
      const res = continueToNextAct(ctx);
      if (res) return res;
      continue;
    }
    throw new Error(`Bot stuck in phase ${run.phase}`);
  }
  if (ch.lastResult && run.phase === 'over') return ch.lastResult;
  throw new Error('Bot did not finish the run');
}

function botEvent(ctx: RunCtx): void {
  const e = ctx.run.event;
  if (!e) return;
  if (e.kind === 'rest') {
    rest(ctx);
    if (canLightBrazier(ctx)) lightBrazier(ctx);
  } else if (e.kind === 'trader') {
    for (let i = e.stock.length - 1; i >= 0; i--) {
      const def = C.item(e.stock[i].id);
      if ((def.kind === 'food' || def.kind === 'ammo' || def.kind === 'rune') && ctx.run.coins >= e.stock[i].price) buy(ctx, i);
    }
  } else if (e.kind === 'chest') openChest(ctx);
  else if (e.kind === 'gather') {
    while (canHarvest(ctx)) harvest(ctx);
  } else if (e.kind === 'slayer') {
    if (ctx.run.slayerOffer?.length) acceptSlayerTask(ctx, 0);
  } else if (e.kind === 'sea') sail(ctx, seaHasChoice(ctx) ? 'island' : 'drift');
}

function itemScore(id: string, focus: CombatStyle): number {
  const d = C.item(id);
  const a = d.attack ?? {};
  const s = d.strength ?? {};
  const df = d.defence ?? {};
  const off = (a[focus] ?? 0) + (s[focus] ?? 0) * 1.5;
  const def = ((df.melee ?? 0) + (df.ranged ?? 0) + (df.magic ?? 0)) / 3;
  return off * 2 + def + (d.prayer ?? 0);
}

/** Equip strictly better gear for the character's focus. */
export function autoEquip(ctx: RunCtx): void {
  const { run, ch } = ctx;
  const level = characterLevel(ch);
  for (let i = 0; i < run.inventory.length; i++) {
    const s = run.inventory[i];
    if (!s) continue;
    const d = C.item(s.id);
    if (!d.slot || d.kind === 'ammo' || d.stackable) continue;
    if (equipReason(ch, level, d)) continue;
    if (d.slot === 'weapon') {
      if (d.weapon?.style !== ch.focus) continue;
      if (d.weapon?.ammo && d.weapon.ammo !== 'thrown') {
        const ammo = run.equipment.ammo ? C.item(run.equipment.ammo.id) : null;
        if (!ammo || ammo.ammoType !== d.weapon.ammo) continue;
      }
      if (d.weapon?.twoHanded && run.equipment.shield && run.inventory.indexOf(null) < 0) continue;
    }
    const worn = run.equipment[d.slot as EquipSlot];
    if (!worn || itemScore(s.id, ch.focus) > itemScore(worn.id, ch.focus) + 0.5) useItem(null, run, ch, level, i);
  }
  // Equip matching ammo from the inventory.
  const weapon = run.equipment.weapon ? C.item(run.equipment.weapon.id).weapon : undefined;
  if (weapon?.ammo && weapon.ammo !== 'thrown') {
    for (let i = 0; i < run.inventory.length; i++) {
      const s = run.inventory[i];
      if (s && C.item(s.id).ammoType === weapon.ammo) {
        const worn = run.equipment.ammo;
        if (!worn || worn.id === s.id || C.item(s.id).tier >= C.item(worn.id).tier) useItem(null, run, ch, level, i);
      }
    }
  }
}

export function botFight(ctx: RunCtx, enc: Encounter, opts: BotOptions, rng: Rng): RunResult | null {
  const { run, ch } = ctx;
  const level = characterLevel(ch);
  let seen = 0;
  for (let t = 0; t < opts.maxTicks && !enc.result; t++) {
    botCombatTick(ctx, enc, opts, rng, level);
    stepEncounter(enc);
    seen = processKills(ctx, enc, seen);
  }
  if (!enc.result) enc.result = 'lost';
  const res = finishEncounter(ctx, enc);
  void run;
  return res;
}

function botCombatTick(ctx: RunCtx, enc: Encounter, opts: BotOptions, rng: Rng, level: number): void {
  const { run, ch } = ctx;
  const m = runMods(ch, run);
  const hpMax = maxHp(level, m);

  // Eat when low.
  if (run.hp < hpMax * 0.45) {
    const slot = run.inventory.findIndex((s) => s && (C.item(s.id).kind === 'food' || C.item(s.id).potion?.effect === 'heal'));
    if (slot >= 0) useItem(enc, run, ch, level, slot);
  }
  // Drink prayer potions.
  const prayers = availablePrayers(m).filter((p) => C.prayer(p).protects);
  if (prayers.length && run.prayer < 5) {
    const slot = run.inventory.findIndex((s) => s && (C.item(s.id).potion?.effect === 'prayer' || C.item(s.id).potion?.effect === 'restore'));
    if (slot >= 0) useItem(enc, run, ch, level, slot);
  }

  // Protection prayer: protect against the next landing attack.
  if (prayers.length && run.prayer > 0 && rng.chance(opts.skill)) {
    const incoming = nextIncomingStyle(enc);
    if (incoming) {
      const want = prayers.find((p) => C.prayer(p).protects === incoming);
      if (want && !run.activePrayers.includes(want)) togglePrayer(enc, want);
    }
  }

  // Dodge hazards.
  const danger = new Set(enc.hazards.flatMap((h) => h.tiles.map((t) => `${t.x},${t.y}`)));
  const p = enc.player;
  if (danger.has(`${p.pos.x},${p.pos.y}`) && rng.chance(opts.skill)) {
    let best: { x: number; y: number } | null = null;
    let bestD = 99;
    for (let dx = -3; dx <= 3; dx++)
      for (let dy = -3; dy <= 3; dy++) {
        const x = p.pos.x + dx;
        const y = p.pos.y + dy;
        if (isBlocked(enc.grid, x, y) || danger.has(`${x},${y}`)) continue;
        if (enc.enemies.some((e) => !e.dead && x >= e.pos.x && x < e.pos.x + e.size && y >= e.pos.y && y < e.pos.y + e.size)) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    if (best) {
      commandMove(enc, best.x, best.y);
      return;
    }
  }

  // Attack the nearest monster (prefer healers' boss... keep it simple: nearest non-healer, then healers).
  if (p.target === null && p.path.length === 0) {
    const alive = enc.enemies.filter((e) => !e.dead);
    alive.sort((a, b) => {
      const ha = a.def.behaviour === 'healer' ? 1 : 0;
      const hb = b.def.behaviour === 'healer' ? 1 : 0;
      if (ha !== hb) return hb - ha; // hit healers first so they stop healing
      return rectDistance(p.pos, 1, a.pos, a.size) - rectDistance(p.pos, 1, b.pos, b.size);
    });
    if (alive[0]) commandAttack(enc, alive[0].id);
  }
}

function nextIncomingStyle(enc: Encounter): CombatStyle | null {
  const toPlayer = enc.projectiles.filter((pr) => pr.to === 0 && pr.style !== 'typeless').sort((a, b) => a.impactTick - b.impactTick);
  if (toPlayer[0]) return toPlayer[0].style as CombatStyle;
  for (const e of enc.enemies) {
    if (e.dead || !e.windup) continue;
    if (e.windup.attack.style !== 'typeless') return e.windup.attack.style as CombatStyle;
  }
  const adjacent = enc.enemies.find((e) => !e.dead && e.def.behaviour !== 'healer' && e.def.style === 'melee' && rectDistance(e.pos, e.size, enc.player.pos, 1) <= 1);
  if (adjacent) return 'melee';
  const ranged = enc.enemies.find((e) => !e.dead && e.def.behaviour !== 'healer' && !e.boss);
  return ranged ? ranged.def.style : null;
}
