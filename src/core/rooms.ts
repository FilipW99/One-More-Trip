/**
 * Non-combat rooms: rest altar, trader, chest, gathering, Slayer master and sea
 * routes. Many skill perks (design doc §4.3-§4.4) plug in here.
 */
import { CONFIG } from '../config';
import { C } from '../content';
import type { EquipSlot, ItemDef } from '../content/types';
import { addItem, consumeItem, countItem, removeAt } from './inventory';
import { rollCasket, rollCoins, rollItem, eligiblePool } from './loot';
import { characterMods, mod, runMods } from './mods';
import { characterLevel } from './save';
import type { MapNode, RoomEvent, SlayerTask } from './state';
import { maxHp, maxPrayer } from './stats';
import { currentAct, log, withRng, type RunCtx } from './run';

export function enterEventRoom(ctx: RunCtx, node: MapNode): void {
  const { run } = ctx;
  run.phase = 'event';
  run.pendingLoot = null;
  switch (node.type) {
    case 'rest':
      run.event = { kind: 'rest', rested: false, brazierLit: false };
      log(run, 'You find a quiet altar. A good place to catch your breath.', 'info');
      break;
    case 'trader':
      run.event = makeTrader(ctx, 0);
      log(run, 'A travelling trader waves you over.', 'info');
      break;
    case 'chest':
      run.event = { kind: 'chest', variant: node.chest ?? 'plain', opened: false };
      log(run, node.chest === 'locked' ? 'A locked chest sits in the corner.' : node.chest === 'trapped' ? 'A chest. Something about the lid looks wrong.' : 'An old chest sits in the corner.', 'info');
      break;
    case 'gather': {
      const room = C.gatherRoom(node.gather!)!;
      run.event = { kind: 'gather', room: room.id, harvested: 0 };
      log(run, room.description, 'info');
      break;
    }
    case 'slayer': {
      const master = C.slayerMaster(currentAct(run).slayerMaster);
      run.event = { kind: 'slayer', master: master.id };
      log(run, `${master.name}: "${master.greeting}"`, 'info');
      if (!run.slayerTask || run.slayerTask.done) run.slayerOffer = slayerOffers(ctx);
      break;
    }
    case 'sea':
      run.event = { kind: 'sea', resolved: false };
      log(run, 'The tunnel opens onto dark water. A boat is tied up here.', 'info');
      break;
    default:
      run.event = null;
  }
}

/* ------------------------------------------------------------------ */
/* Rest altar                                                          */
/* ------------------------------------------------------------------ */

function restEvent(ctx: RunCtx): Extract<RoomEvent, { kind: 'rest' }> | null {
  const e = ctx.run.event;
  return e && e.kind === 'rest' ? e : null;
}

export function rest(ctx: RunCtx): void {
  const e = restEvent(ctx);
  if (!e || e.rested) return;
  const { run, ch } = ctx;
  const level = characterLevel(ch);
  const m = runMods(ch, run);
  const hpMax = maxHp(level, m);
  run.hp = Math.min(hpMax, run.hp + Math.round((hpMax * CONFIG.REST_HEAL_PCT) / 100));
  const prayerPct = mod(m, 'restPrayer');
  if (prayerPct > 0) run.prayer = Math.min(maxPrayer(level, m), run.prayer + Math.round((maxPrayer(level, m) * prayerPct) / 100));
  run.runEnergy = CONFIG.RUN_ENERGY.max;
  e.rested = true;
  log(run, prayerPct > 0 ? 'You rest and pray at the altar.' : 'You rest for a while.', 'good');
}

export function canLightBrazier(ctx: RunCtx): boolean {
  const e = restEvent(ctx);
  const { run, ch } = ctx;
  return !!e && !e.brazierLit && characterMods(ch).flags.has('brazier') && (countItem(run, 'logs') > 0 || countItem(run, 'ashwood_logs') > 0);
}

export function lightBrazier(ctx: RunCtx): void {
  if (!canLightBrazier(ctx)) return;
  const e = restEvent(ctx)!;
  const { run, ch } = ctx;
  const ash = countItem(run, 'ashwood_logs') > 0;
  consumeItem(run, ash ? 'ashwood_logs' : 'logs', 1);
  const level = characterLevel(ch);
  const m = runMods(ch, run);
  const hpMax = maxHp(level, m);
  const pct = CONFIG.BRAZIER_HEAL_PCT * (ash ? 1.5 : 1);
  run.hp = Math.min(hpMax, run.hp + Math.round((hpMax * pct) / 100));
  e.brazierLit = true;
  if (m.flags.has('brazierBuff')) run.buffs.brazier = true;
  log(run, m.flags.has('brazierBuff') ? 'The brazier roars. You feel ready for anything (+10% damage next room).' : 'You warm yourself by the brazier.', 'good');
}

function foodSlots(ctx: RunCtx): number[] {
  return ctx.run.inventory.map((s, i) => (s && C.item(s.id).kind === 'food' ? i : -1)).filter((i) => i >= 0);
}

export function canFeast(ctx: RunCtx): boolean {
  return !!restEvent(ctx) && characterMods(ctx.ch).flags.has('feast') && !ctx.run.buffs.feast && foodSlots(ctx).length >= 2;
}

export function cookFeast(ctx: RunCtx): void {
  if (!canFeast(ctx)) return;
  const { run } = ctx;
  const slots = foodSlots(ctx).sort((a, b) => (C.item(run.inventory[a]!.id).heal ?? 0) - (C.item(run.inventory[b]!.id).heal ?? 0));
  removeAt(run, slots[0], 1);
  removeAt(run, slots[1], 1);
  run.buffs.feast = true;
  log(run, 'You cook a feast. +10% accuracy and +5 Hitpoints for the next room.', 'good');
}

/** Equipped metal items that can be upgraded a tier, with their upgrade. */
export function smithOptions(ctx: RunCtx): { slot: EquipSlot; from: string; to: string }[] {
  const { run, ch } = ctx;
  if (!restEvent(ctx) || run.acts.smith || !characterMods(ch).flags.has('smithUpgrade')) return [];
  const metals = ['bronze', 'iron', 'steel', 'cobalt', 'orichalcum', 'starmetal'];
  const out: { slot: EquipSlot; from: string; to: string }[] = [];
  for (const [slot, stack] of Object.entries(run.equipment)) {
    if (!stack || !C.item(stack.id).tags.includes('metal')) continue;
    const [metal, ...rest] = stack.id.split('_');
    const i = metals.indexOf(metal);
    if (i < 0 || i >= metals.length - 1) continue;
    const next = `${metals[i + 1]}_${rest.join('_')}`;
    if (C.hasItem(next)) out.push({ slot: slot as EquipSlot, from: stack.id, to: next });
  }
  return out;
}

export function smithUpgrade(ctx: RunCtx, slot: EquipSlot): void {
  const opt = smithOptions(ctx).find((o) => o.slot === slot);
  if (!opt) return;
  const { run } = ctx;
  run.equipment[slot] = { id: opt.to, qty: 1 };
  run.acts.smith = true;
  log(run, `You hammer your ${C.item(opt.from).name.toLowerCase()} into ${C.item(opt.to).name.toLowerCase()}.`, 'good');
}

export function canSwitchSpellbook(ctx: RunCtx): boolean {
  return !!restEvent(ctx) && !ctx.run.acts.spellbookSwitch && characterMods(ctx.ch).flags.has('spellbookSwitch');
}

export function switchSpellbook(ctx: RunCtx): void {
  if (!canSwitchSpellbook(ctx)) return;
  const { run, ch } = ctx;
  const books = C.spellbooks.map((b) => b.id);
  run.spellbook = books[(books.indexOf(run.spellbook) + 1) % books.length];
  const level = characterLevel(ch);
  const spells = C.spells.filter((s) => s.book === run.spellbook && (s.minLevel <= level || run.learnedSpells.includes(s.id)));
  run.activeSpell = spells.at(-1)?.id ?? '';
  run.acts.spellbookSwitch = true;
  log(run, `You attune to ${C.spellbook(run.spellbook).name}.`, 'good');
}

export function potionSlots(ctx: RunCtx): number[] {
  return ctx.run.inventory.map((s, i) => (s && C.item(s.id).kind === 'potion' ? i : -1)).filter((i) => i >= 0);
}

export function canMixPotions(ctx: RunCtx): boolean {
  return !!restEvent(ctx) && characterMods(ctx.ch).flags.has('potionMix') && ctx.run.buffs.mixed.length === 0 && potionSlots(ctx).length >= 2;
}

export function mixPotions(ctx: RunCtx, a: number, b: number): void {
  if (!canMixPotions(ctx) || a === b) return;
  const { run } = ctx;
  const sa = run.inventory[a];
  const sb = run.inventory[b];
  if (!sa || !sb || C.item(sa.id).kind !== 'potion' || C.item(sb.id).kind !== 'potion') return;
  run.buffs.mixed = [sa.id, sb.id];
  removeAt(run, a, 1);
  removeAt(run, b, 1);
  log(run, `You mix ${C.item(run.buffs.mixed[0]).name} with ${C.item(run.buffs.mixed[1]).name}. Both take effect when the next room starts.`, 'good');
}

export function rechargeOptions(ctx: RunCtx): EquipSlot[] {
  const { run, ch } = ctx;
  if (!restEvent(ctx) || run.acts.recharge || !characterMods(ch).flags.has('jewelleryRecharge')) return [];
  return (Object.entries(run.equipment) as [EquipSlot, { id: string; charges?: number }][])
    .filter(([, s]) => s && C.item(s.id).charges !== undefined && (s.charges ?? 0) < C.item(s.id).charges!)
    .map(([slot]) => slot);
}

export function rechargeJewellery(ctx: RunCtx, slot: EquipSlot): void {
  if (!rechargeOptions(ctx).includes(slot)) return;
  const { run } = ctx;
  const stack = run.equipment[slot]!;
  stack.charges = C.item(stack.id).charges;
  run.acts.recharge = true;
  log(run, `You recharge your ${C.item(stack.id).name.toLowerCase()}.`, 'good');
}

/* ------------------------------------------------------------------ */
/* Trader                                                              */
/* ------------------------------------------------------------------ */

function makeTrader(ctx: RunCtx, discount: number): Extract<RoomEvent, { kind: 'trader' }> {
  const { run, ch } = ctx;
  const act = currentAct(run);
  const m = runMods(ch, run);
  const pool = eligiblePool(act, m);
  const price = (def: ItemDef, qty: number) => Math.max(1, Math.round(def.value * qty * (1 - discount)));
  const stock: { id: string; qty: number; price: number }[] = [];
  const foods = pool.filter((i) => i.kind === 'food').sort((a, b) => (b.heal ?? 0) - (a.heal ?? 0)).slice(0, 2);
  for (const f of foods) stock.push({ id: f.id, qty: 1, price: price(f, 1) });
  const potions = pool.filter((i) => i.kind === 'potion').slice(0, 2);
  for (const p of potions) stock.push({ id: p.id, qty: 1, price: price(p, 1) });
  const weapon = run.equipment.weapon ? C.item(run.equipment.weapon.id).weapon : undefined;
  if (weapon?.ammo && weapon.ammo !== 'thrown') {
    const ammo = pool.filter((i) => i.ammoType === weapon.ammo).sort((a, b) => b.tier - a.tier)[0];
    if (ammo) stock.push({ id: ammo.id, qty: 30, price: price(ammo, 30) });
  }
  if (weapon?.style === 'magic' || ch.focus === 'magic') {
    stock.push({ id: 'spark_rune', qty: 50, price: price(C.item('spark_rune'), 50) });
    if (act.depth >= 2) stock.push({ id: 'storm_rune', qty: 30, price: price(C.item('storm_rune'), 30) });
    if (act.depth >= 3) stock.push({ id: 'void_rune', qty: 20, price: price(C.item('void_rune'), 20) });
  }
  withRng(run, (rng) => {
    const gear = pool.filter((i) => i.slot && i.kind !== 'ammo' && !i.stackable);
    for (let n = 0; n < 2 && gear.length; n++) {
      const g = rng.pick(gear);
      if (!stock.some((s) => s.id === g.id)) stock.push({ id: g.id, qty: 1, price: price(g, 1) });
    }
  });
  return { kind: 'trader', stock, discount, pickpocketed: false };
}

export function buy(ctx: RunCtx, index: number): string | null {
  const { run } = ctx;
  const e = run.event;
  if (!e || e.kind !== 'trader') return null;
  const offer = e.stock[index];
  if (!offer) return null;
  if (run.coins < offer.price) return `You need ${offer.price} ${C.terms.coins}.`;
  const def = C.item(offer.id);
  const needs = def.stackable ? (run.inventory.some((s) => s?.id === def.id) ? 0 : 1) : offer.qty;
  if (needs > run.inventory.filter((s) => s === null).length) return 'Your inventory is full.';
  run.coins -= offer.price;
  addItem(run, offer.id, offer.qty);
  ctx.ch.collection[offer.id] = (ctx.ch.collection[offer.id] ?? 0) + 1;
  if (def.slot && !def.stackable) e.stock.splice(index, 1);
  log(run, `You buy ${offer.qty > 1 ? `${offer.qty} x ` : ''}${def.name} for ${offer.price} ${C.terms.coins}.`, 'info');
  return null;
}

export function sellValue(id: string, qty: number): number {
  return Math.max(1, Math.floor(C.item(id).value * CONFIG.SELL_RATE * qty));
}

export function sell(ctx: RunCtx, slot: number): string | null {
  const { run } = ctx;
  const e = run.event;
  if (!e || e.kind !== 'trader') return null;
  const stack = run.inventory[slot];
  if (!stack) return null;
  const def = C.item(stack.id);
  if (def.value <= 0) return 'The trader is not interested in that.';
  const value = sellValue(stack.id, stack.qty);
  run.inventory[slot] = null;
  run.coins += value;
  log(run, `You sell ${stack.qty > 1 ? `${stack.qty} x ` : ''}${def.name} for ${value} ${C.terms.coins}.`, 'info');
  return null;
}

export function canPickpocket(ctx: RunCtx): boolean {
  const e = ctx.run.event;
  return !!e && e.kind === 'trader' && !e.pickpocketed && characterMods(ctx.ch).flags.has('pickpocket');
}

export function pickpocket(ctx: RunCtx): void {
  if (!canPickpocket(ctx)) return;
  const { run, ch } = ctx;
  const e = run.event as Extract<RoomEvent, { kind: 'trader' }>;
  e.pickpocketed = true;
  const m = runMods(ch, run);
  const drop = withRng(run, (rng) => rollItem(run, ch.focus, currentAct(run), m, rng));
  run.pendingLoot = { items: drop ? [drop] : [], coins: withRng(run, (rng) => rollCoins([5, 20], m, rng)), source: 'pickpocketing' };
  log(run, 'You lift something from the trader’s pockets while they are distracted.', 'good');
}

/* ------------------------------------------------------------------ */
/* Chest                                                               */
/* ------------------------------------------------------------------ */

export function chestNeedsThieving(ctx: RunCtx): boolean {
  const e = ctx.run.event;
  return !!e && e.kind === 'chest' && e.variant === 'locked' && !characterMods(ctx.ch).flags.has('openLockedChests');
}

export function openChest(ctx: RunCtx): void {
  const { run, ch } = ctx;
  const e = run.event;
  if (!e || e.kind !== 'chest' || e.opened) return;
  e.opened = true;
  const m = runMods(ch, run);
  const act = currentAct(run);
  const level = characterLevel(ch);
  withRng(run, (rng) => {
    const loot = { items: [] as { id: string; qty: number }[], coins: rollCoins([10 * act.depth, 25 * act.depth], m, rng), source: 'the chest' };
    if (e.variant === 'locked' && !m.flags.has('openLockedChests')) {
      loot.coins = Math.round(loot.coins / 2);
      log(run, 'You can’t pick the lock, so you smash the lid. A few coins spill out.', 'info');
    } else {
      if (rng.chance(CONFIG.CHEST_ITEM_CHANCE) || e.variant === 'locked') {
        const d = rollItem(run, ch.focus, act, m, rng);
        if (d) loot.items.push(d);
      }
      if (e.variant === 'trapped') {
        if (m.flags.has('disarmTraps')) {
          const d = rollItem(run, ch.focus, act, m, rng);
          if (d) loot.items.push(d);
          log(run, 'You disarm the trap and find a hidden compartment.', 'good');
        } else {
          const dmg = Math.max(1, Math.round(maxHp(level, m) * 0.12));
          run.hp = Math.max(1, run.hp - dmg);
          log(run, `A dart shoots out of the lock! You take ${dmg} damage.`, 'bad');
        }
      }
      log(run, 'You open the chest.', 'info');
    }
    run.pendingLoot = loot;
  });
}

/* ------------------------------------------------------------------ */
/* Gathering                                                           */
/* ------------------------------------------------------------------ */

const HARVEST_TWICE_FLAG: Record<string, string> = {
  ore: 'harvestTwiceMining',
  fishing: 'harvestTwiceFishing',
  herb: 'harvestTwiceFarming',
  tree: 'harvestTwiceWoodcutting',
};

const YIELD_MOD: Record<string, 'yieldMining' | 'yieldWoodcutting' | 'yieldFishing' | 'yieldFarming' | 'yieldHunter' | null> = {
  ore: 'yieldMining',
  tree: 'yieldWoodcutting',
  fishing: 'yieldFishing',
  herb: 'yieldFarming',
  trap: 'yieldHunter',
  salvage: null,
};

export function canHarvest(ctx: RunCtx): boolean {
  const e = ctx.run.event;
  if (!e || e.kind !== 'gather') return false;
  if (e.harvested === 0) return true;
  if (e.harvested >= 2) return false;
  const flag = HARVEST_TWICE_FLAG[e.room];
  return !!flag && characterMods(ctx.ch).flags.has(flag as never) && !ctx.run.acts.harvestTwice.includes(e.room);
}

export function harvest(ctx: RunCtx): void {
  if (!canHarvest(ctx)) return;
  const { run, ch } = ctx;
  const e = run.event as Extract<RoomEvent, { kind: 'gather' }>;
  if (e.harvested === 1) run.acts.harvestTwice.push(e.room);
  e.harvested++;
  const room = C.gatherRoom(e.room)!;
  const m = runMods(ch, run);
  const act = currentAct(run);
  const yieldKey = YIELD_MOD[e.room];
  const boost = 1 + (yieldKey ? mod(m, yieldKey) : 0) / 100;
  const loot = run.pendingLoot ?? { items: [], coins: 0, source: room.name };
  withRng(run, (rng) => {
    const table = room.highGate && m.gates.has(room.highGate) ? [...room.yields, ...room.highYields] : room.yields;
    for (const y of table) {
      const qty = rng.round(rng.int(y.qty[0], y.qty[1]) * boost);
      if (qty > 0) loot.items.push({ id: y.item, qty });
    }
    if (e.room === 'ore' && m.flags.has('miningBonusRoll')) {
      const metal = eligiblePool(act, m).filter((i) => i.tags.includes('metal') && i.slot);
      if (metal.length) loot.items.push({ id: rng.pick(metal).id, qty: 1 });
    }
    if (e.room === 'trap' && m.flags.has('hunterClueRoll')) loot.items.push({ id: 'sealed_casket', qty: 1 });
    if (e.room === 'salvage') loot.coins += rollCoins([15, 40], m, rng);
  });
  run.pendingLoot = loot;
  log(run, e.harvested > 1 ? `You harvest the ${room.name.toLowerCase()} again.` : `You work the ${room.name.toLowerCase()}.`, 'good');
}

/** Open a casket or impling jar from the inventory. */
export function openCasket(ctx: RunCtx, slot: number): string | null {
  const { run, ch } = ctx;
  const stack = run.inventory[slot];
  if (!stack || C.item(stack.id).kind !== 'casket') return null;
  const small = stack.id === 'impling_jar';
  removeAt(run, slot, 1);
  const m = runMods(ch, run);
  const res = withRng(run, (rng) => rollCasket(run, ch.focus, currentAct(run), m, rng, small));
  run.coins += res.coins;
  const lost: string[] = [];
  for (const d of res.items) {
    const left = addItem(run, d.id, d.qty);
    ch.collection[d.id] = (ch.collection[d.id] ?? 0) + 1;
    if (left > 0) lost.push(C.item(d.id).name);
  }
  const names = res.items.map((d) => `${d.qty > 1 ? `${d.qty} x ` : ''}${C.item(d.id).name}`).join(', ');
  log(run, `You open the ${small ? 'jar' : 'casket'}: ${res.coins} ${C.terms.coins}${names ? `, ${names}` : ''}.`, 'loot');
  return lost.length ? `No room for: ${lost.join(', ')}.` : null;
}

/* ------------------------------------------------------------------ */
/* Slayer                                                              */
/* ------------------------------------------------------------------ */

export function slayerOffers(ctx: RunCtx): SlayerTask[] {
  const { run, ch } = ctx;
  const act = currentAct(run);
  const m = characterMods(ch);
  const longer = ch.slayerUnlocks.includes('longer_tasks');
  const categories = [...new Set(act.monsters.map((id) => C.monster(id).slayerCategory).filter((c): c is string => !!c))];
  const count = m.flags.has('chooseSlayerTask') ? 2 : 1;
  const offers: SlayerTask[] = [];
  withRng(run, (rng) => {
    const picks = rng.shuffle([...categories]).slice(0, count);
    for (const category of picks) {
      const need = rng.int(CONFIG.SLAYER.killsMin, CONFIG.SLAYER.killsMax) + (longer ? 2 : 0);
      const points = Math.round((CONFIG.SLAYER.basePoints + CONFIG.SLAYER.pointsPerDepth * act.depth) * (longer ? 1.5 : 1));
      offers.push({ master: act.slayerMaster, category, bossId: null, label: `Kill ${need} ${category}`, need, have: 0, points, done: false });
    }
    if (m.flags.has('slayerBossTask') && !act.gauntlet) {
      const bossId = rng.pick(act.bosses);
      const points = Math.round((CONFIG.SLAYER.basePoints + CONFIG.SLAYER.pointsPerDepth * act.depth) * 2);
      offers.push({ master: act.slayerMaster, category: null, bossId, label: `Defeat ${C.boss(bossId).name}`, need: 1, have: 0, points, done: false });
    }
  });
  return offers;
}

export function acceptSlayerTask(ctx: RunCtx, index: number): void {
  const { run } = ctx;
  const offer = run.slayerOffer?.[index];
  if (!offer) return;
  run.slayerTask = offer;
  run.slayerOffer = null;
  log(run, `New Slayer task: ${offer.label}.`, 'good');
}

export function canRerollSlayer(ctx: RunCtx): boolean {
  const { run, ch } = ctx;
  return run.event?.kind === 'slayer' && ch.slayerUnlocks.includes('task_reroll') && !run.acts.slayerReroll;
}

export function rerollSlayer(ctx: RunCtx): void {
  if (!canRerollSlayer(ctx)) return;
  ctx.run.acts.slayerReroll = true;
  ctx.run.slayerTask = null;
  ctx.run.slayerOffer = slayerOffers(ctx);
  log(ctx.run, 'The Slayer master scratches out your task and writes a new one.', 'info');
}

/* ------------------------------------------------------------------ */
/* Sea routes                                                          */
/* ------------------------------------------------------------------ */

export function seaHasChoice(ctx: RunCtx): boolean {
  return characterMods(ctx.ch).flags.has('seaRouteChoice');
}

export function sail(ctx: RunCtx, choice: 'drift' | 'island' | 'port'): void {
  const { run, ch } = ctx;
  const e = run.event;
  if (!e || e.kind !== 'sea' || e.resolved) return;
  if (choice !== 'drift' && !seaHasChoice(ctx)) return;
  e.resolved = true;
  const m = runMods(ch, run);
  const act = currentAct(run);
  if (choice === 'port') {
    run.event = makeTrader(ctx, CONFIG.PORT_DISCOUNT);
    log(run, 'You row to a hidden port. Prices are better here.', 'good');
    return;
  }
  withRng(run, (rng) => {
    if (choice === 'island') {
      const items = [rollItem(run, ch.focus, act, m, rng), rollItem(run, ch.focus, act, m, rng)].filter((d): d is NonNullable<typeof d> => !!d);
      run.pendingLoot = { items, coins: rollCoins([20, 50], m, rng), source: 'the island' };
      log(run, 'You beach the boat on a small island and find a stash.', 'good');
    } else {
      run.pendingLoot = { items: rng.chance(0.5) ? [{ id: 'trout', qty: 2 }] : [], coins: rollCoins([10, 30], m, rng), source: 'the shore' };
      log(run, 'You drift to the far shore and find a few supplies.', 'info');
    }
  });
}

/** Item ids that count as runes for the spell UI. */
export function runeCount(ctx: RunCtx, id: string): number {
  return countItem(ctx.run, id);
}

export function prayerMax(ctx: RunCtx): number {
  return maxPrayer(characterLevel(ctx.ch), runMods(ctx.ch, ctx.run));
}
