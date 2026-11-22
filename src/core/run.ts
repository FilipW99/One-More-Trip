/**
 * Run lifecycle: start a trip, move across the act map, fight, loot, earn Boons,
 * advance acts, and resolve the end of the run (design doc §3).
 */
import { CONFIG } from '../config';
import { C } from '../content';
import type { ItemDef } from '../content/types';
import { createEncounter, drinkPotion, type Encounter, type KillRecord } from './combat/engine';
import { encounterSpec } from './encounters';
import { addItem, allHeldItems, slotsNeeded } from './inventory';
import { normalDropChance, rollBossSpecials, rollCoins, rollItem } from './loot';
import { generateActMap, reachableNodes } from './mapgen';
import { characterMods, mod, omenScore, runBaseMods, runMods } from './mods';
import { levelForXp, skillPointsForLevel } from './progression';
import { Rng, randomSeed } from './rng';
import { characterLevel } from './save';
import type {
  ActMap,
  CharacterSave,
  ItemStack,
  LogLine,
  LootDrop,
  MapNode,
  RunOutcome,
  RunResult,
  RunState,
} from './state';
import { maxHp, maxPrayer } from './stats';
import { enterEventRoom } from './rooms';

export interface RunCtx {
  ch: CharacterSave;
  run: RunState;
  autoRetaliate: boolean;
}

export function log(run: RunState, text: string, kind: LogLine['kind'] = 'info'): void {
  run.log.push({ text, kind });
  if (run.log.length > 120) run.log.splice(0, run.log.length - 120);
}

export function withRng<T>(run: RunState, fn: (rng: Rng) => T): T {
  const rng = new Rng(run.rng);
  const out = fn(rng);
  run.rng = rng.state;
  return out;
}

export function currentAct(run: RunState) {
  return C.act(C.route(run.routeId).acts[run.actIndex]);
}

export function routeLength(run: RunState): number {
  return C.route(run.routeId).acts.length;
}

/** Routes the character can pick right now. */
export function availableRoutes(ch: CharacterSave) {
  return C.routes.filter((r) => !r.unlock || (ch.hub[r.unlock.feature] ?? 0) >= r.unlock.tier);
}

/** Highest act index a trip may start at (Portal Chamber tiers 2 and 4). */
export function maxStartAct(ch: CharacterSave): number {
  const portal = ch.hub.portal ?? 0;
  if (portal >= 4) return 2;
  if (portal >= 2) return 1;
  return 0;
}

export function relicSlots(ch: CharacterSave): number {
  return CONFIG.BASE_RELIC_SLOTS + mod(characterMods(ch), 'relicSlots');
}

export function vaultSlots(ch: CharacterSave): number {
  return mod(characterMods(ch), 'vaultSlots');
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

export function startRun(ch: CharacterSave, seed: number = randomSeed()): RunState {
  const level = characterLevel(ch);
  const route = availableRoutes(ch).find((r) => r.id === ch.route) ?? C.routes[0];
  const startAct = Math.min(ch.startAct, maxStartAct(ch));
  const kit = C.kit(ch.focus);
  const run: RunState = {
    seed,
    rng: seed,
    routeId: route.id,
    actIndex: startAct,
    startActIndex: startAct,
    map: { actId: '', rows: [], nodes: {} },
    position: null,
    visited: [],
    hp: 1,
    prayer: 0,
    runEnergy: CONFIG.RUN_ENERGY.max,
    spec: CONFIG.SPEC.max,
    running: false,
    activePrayers: [],
    inventory: Array.from({ length: CONFIG.INVENTORY_SIZE }, () => null),
    equipment: {},
    coins: 0,
    xp: 0,
    boons: {},
    boonsEarned: 0,
    boonOffer: null,
    relics: ch.relicsEquipped.slice(0, relicSlots(ch)),
    omens: [...ch.omensSelected],
    spellbook: ch.spellbook,
    activeSpell: '',
    learnedSpells: [],
    slayerTask: null,
    slayerOffer: null,
    acts: freshActUses(),
    cheatDeathUsed: 0,
    altSeaRouteUsed: false,
    buffs: { combatDraught: false, feast: false, brazier: false, mixed: [] },
    roomCombatBuff: false,
    phase: 'map',
    roomNode: null,
    pendingLoot: null,
    event: null,
    stats: {
      kills: 0,
      roomsCleared: 0,
      damageTaken: 0,
      bossesKilled: [],
      uniques: [],
      pets: [],
      itemsReceived: {},
      deepestAct: startAct + 1,
      slayerTasksDone: 0,
    },
    tasksThisRun: [],
    log: [],
    outcome: null,
  };

  // Starting kit, with Workshop upgrades applied where the character meets the level.
  const workshopTier = ch.hub.workshop ?? 0;
  const swaps = new Map<string, string>();
  for (let t = 0; t < workshopTier && t < kit.workshop.length; t++) {
    const [from, to] = kit.workshop[t];
    if (!from || !to) continue;
    const origin = [...swaps.entries()].find(([, v]) => v === from)?.[0] ?? from;
    if ((C.item(to).req?.level ?? 1) <= level) swaps.set(origin, to);
  }
  const resolve = (id: string) => swaps.get(id) ?? id;
  for (const id of kit.equipment) {
    const def = C.item(resolve(id));
    if (def.slot) run.equipment[def.slot] = { id: def.id, qty: 1 };
  }
  if (kit.ammo) run.equipment.ammo = { id: resolve(kit.ammo[0]), qty: kit.ammo[1] };
  for (const [id, qty] of kit.inventory) addItem(run, resolve(id), qty);

  // Vault items come along.
  for (const stack of ch.vault) {
    const def = C.item(stack.id);
    if (def.slot && !run.equipment[def.slot] && !(def.slot === 'shield' && run.equipment.weapon && C.item(run.equipment.weapon.id).weapon?.twoHanded)) {
      run.equipment[def.slot] = { ...stack };
    } else addItem(run, stack.id, stack.qty, stack.charges);
  }
  ch.vault = [];

  const m = runBaseMods(ch, run);
  const extraFood = mod(m, 'startFood');
  if (extraFood > 0) addItem(run, 'trout', extraFood);
  if (mod(m, 'startPrayerPotions') > 0) addItem(run, 'devotion_draught', mod(m, 'startPrayerPotions'));
  if (mod(m, 'startStamina') > 0) addItem(run, 'stamina_draught', mod(m, 'startStamina'));
  if (mod(m, 'startLogs') > 0) addItem(run, 'logs', mod(m, 'startLogs'));
  if (mod(m, 'noFood') > 0) {
    run.inventory = run.inventory.map((s) => (s && C.item(s.id).kind === 'food' ? null : s));
  }

  // Spellbook and spells.
  const spells = C.spells.filter((s) => s.book === run.spellbook && s.minLevel <= level);
  run.activeSpell = spells.at(-1)?.id ?? '';

  const full = runMods(ch, run);
  run.hp = maxHp(level, full);
  run.prayer = maxPrayer(level, full);

  newActMap(ch, run);
  const act = currentAct(run);
  log(run, `You set out for ${act.name}. ${act.blurb}`, 'system');
  if (run.relics.length) log(run, `Relics: ${run.relics.map((r) => C.relic(r).name).join(', ')}.`, 'info');
  if (run.omens.length) log(run, `Omens: ${run.omens.map((o) => C.omen(o).name).join(', ')} (${omenScore(run.omens)} points).`, 'info');

  ch.stats.runs++;
  ch.activeRun = run;
  return run;
}

function freshActUses(): RunState['acts'] {
  return {
    roomSkips: 0,
    specRestore: false,
    empowered: 0,
    harvestTwice: [],
    smith: false,
    recharge: false,
    spellbookSwitch: false,
    slayerReroll: false,
  };
}

export function newActMap(ch: CharacterSave, run: RunState): ActMap {
  const act = currentAct(run);
  const m = runBaseMods(ch, run);
  run.map = withRng(run, (rng) => generateActMap(act, m, rng));
  run.position = null;
  run.visited = [];
  run.acts = freshActUses();
  return run.map;
}

/* ------------------------------------------------------------------ */
/* Map movement                                                        */
/* ------------------------------------------------------------------ */

export function availableMoves(run: RunState): string[] {
  if (run.phase !== 'map') return [];
  return reachableNodes(run.map, run.position);
}

/** Nodes reachable with the once-per-run alternate sea route (Sailing rank 10). */
export function seaRouteMoves(ctx: RunCtx): string[] {
  const { run, ch } = ctx;
  if (run.phase !== 'map' || run.altSeaRouteUsed) return [];
  if (!characterMods(ch).flags.has('altSeaRoute')) return [];
  const row = run.position === null ? 0 : run.map.nodes[run.position].row + 1;
  const ids = run.map.rows[row] ?? [];
  const normal = new Set(availableMoves(run));
  return ids.filter((id) => !normal.has(id) && run.map.nodes[id].type !== 'boss');
}

export function canSkipRoom(ctx: RunCtx, nodeId: string): boolean {
  const { run, ch } = ctx;
  const node = run.map.nodes[nodeId];
  if (!node || node.type === 'boss') return false;
  if (!availableMoves(run).includes(nodeId)) return false;
  return run.acts.roomSkips < mod(characterMods(ch), 'roomSkipsPerAct');
}

/** Agility rank 10: pass through a room without resolving it. */
export function skipRoom(ctx: RunCtx, nodeId: string): void {
  if (!canSkipRoom(ctx, nodeId)) return;
  const { run } = ctx;
  run.acts.roomSkips++;
  run.position = nodeId;
  run.visited.push(nodeId);
  log(run, 'You slip past the room using an agility shortcut.', 'info');
}

/**
 * Enter a map node. Returns an Encounter for fights, or null for event rooms
 * (the run's `event` is set).
 */
export function enterNode(ctx: RunCtx, nodeId: string, viaSeaRoute = false): Encounter | null {
  const { run } = ctx;
  const allowed = viaSeaRoute ? seaRouteMoves(ctx) : availableMoves(run);
  if (!allowed.includes(nodeId)) return null;
  if (viaSeaRoute) {
    run.altSeaRouteUsed = true;
    log(run, 'You take a sea route to a room you could not otherwise reach.', 'good');
  }
  const node = run.map.nodes[nodeId];
  run.position = nodeId;
  run.visited.push(nodeId);
  run.roomNode = nodeId;

  if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') {
    return startEncounter(ctx, node);
  }
  enterEventRoom(ctx, node);
  return null;
}

export function startEncounter(ctx: RunCtx, node: MapNode): Encounter {
  const { run, ch } = ctx;
  run.phase = 'room';
  run.roomCombatBuff = false;
  run.pendingLoot = { items: [], coins: 0, source: node.type === 'boss' ? C.boss(node.boss!).name : 'the fight' };
  // Mixed potions from a rest altar take effect now.
  if (run.buffs.mixed.length) {
    const level = characterLevel(ch);
    const m = runMods(ch, run);
    for (const id of run.buffs.mixed) {
      const p = C.item(id).potion;
      if (p) drinkPotion(run, ch, level, p.effect, p.amount, m, null);
    }
    log(run, 'Your mixed draught kicks in.', 'good');
    run.buffs.mixed = [];
  }
  const m = runMods(ch, run);
  const spec = withRng(run, (rng) => encounterSpec(run, ch, m, node, rng));
  const enc = createEncounter(spec, { run, character: ch, level: characterLevel(ch), autoRetaliate: ctx.autoRetaliate });
  if (node.type === 'boss') {
    const boss = C.boss(node.boss!);
    log(run, `${boss.name}: ${boss.examine}`, 'bad');
  }
  return enc;
}

/* ------------------------------------------------------------------ */
/* Combat bookkeeping                                                  */
/* ------------------------------------------------------------------ */

/** Call after every combat tick: awards XP, coins, drops and Slayer progress for new kills. */
export function processKills(ctx: RunCtx, enc: Encounter, from: number): number {
  for (let i = from; i < enc.kills.length; i++) onKill(ctx, enc.kills[i]);
  return enc.kills.length;
}

function onKill(ctx: RunCtx, k: KillRecord): void {
  const { run, ch } = ctx;
  if (k.summoned) return;
  const def = C.monster(k.monsterId);
  const act = currentAct(run);
  const m = runMods(ch, run);
  run.stats.kills++;
  ch.stats.kills++;
  run.xp += def.xp;
  const loot = run.pendingLoot ?? (run.pendingLoot = { items: [], coins: 0, source: 'the fight' });

  withRng(run, (rng) => {
    loot.coins += rollCoins(def.coins, m, rng, k.superior ? 2 : 1);
    let rolls = 0;
    if (k.boss) rolls = C.boss(def.id).drops;
    else if (k.elite || k.superior) rolls = CONFIG.DROP_ROLLS_ELITE;
    else if (rng.chance(normalDropChance(m))) rolls = 1;

    if (k.boss) {
      const boss = C.boss(def.id);
      // Slayer rank 10: boss task grants an extra roll.
      const task = run.slayerTask;
      if (task && !task.done && task.bossId === def.id) rolls++;
      const special = rollBossSpecials(def.id, ch.pity[def.id] ?? 0, omenScore(run.omens), m, rng);
      if (special.gotUnique) ch.pity[def.id] = 0;
      else ch.pity[def.id] = (ch.pity[def.id] ?? 0) + 1;
      for (const d of special.drops) {
        if (d.pet) {
          if (!ch.pets.includes(d.id)) ch.pets.push(d.id);
          ch.collection[d.id] = (ch.collection[d.id] ?? 0) + 1;
          run.stats.pets.push(d.id);
          log(run, `You have a funny feeling you're being followed... ${C.item(d.id).name} joins you!`, 'rare');
          completeTask(ctx, 'pet_drop');
        } else {
          loot.items.push(d);
          log(run, `Unique drop: ${C.item(d.id).name}!`, 'rare');
        }
      }
      ch.bossKills[def.id] = (ch.bossKills[def.id] ?? 0) + 1;
      run.stats.bossesKilled.push(def.id);
      log(run, `${boss.name} is defeated! (kill count: ${ch.bossKills[def.id]})`, 'good');
    }
    for (let r = 0; r < rolls; r++) {
      const drop = rollItem(run, ch.focus, act, m, rng);
      if (drop) loot.items.push(drop);
    }
    // Ammunition users find arrows/bolts on what they kill, matching their quiver.
    const ammo = run.equipment.ammo;
    const weapon = run.equipment.weapon ? C.item(run.equipment.weapon.id).weapon : undefined;
    if (ammo && weapon?.ammo && C.item(ammo.id).ammoType === weapon.ammo && rng.chance(CONFIG.AMMO_DROP.chance)) {
      const qty = rng.int(CONFIG.AMMO_DROP.min, CONFIG.AMMO_DROP.max) * (k.boss || k.elite ? 2 : 1);
      const existing = loot.items.find((d) => d.id === ammo.id);
      if (existing) existing.qty += qty;
      else loot.items.push({ id: ammo.id, qty });
    }
  });

  // Slayer progress.
  const task = run.slayerTask;
  if (task && !task.done) {
    const matches = task.bossId ? task.bossId === def.id : task.category !== null && def.slayerCategory === task.category;
    if (matches) {
      task.have++;
      if (task.have >= task.need) completeSlayerTask(ctx);
    }
  }
  checkBoonThresholds(ctx);
}

export function completeSlayerTask(ctx: RunCtx): void {
  const { run, ch } = ctx;
  const task = run.slayerTask;
  if (!task || task.done) return;
  task.done = true;
  const m = runMods(ch, run);
  const points = Math.round(task.points * (1 + mod(m, 'slayerReward') / 100));
  ch.slayerPoints += points;
  run.stats.slayerTasksDone++;
  const coins = Math.round(CONFIG.SLAYER.coins * (1 + mod(m, 'slayerReward') / 100));
  run.coins += coins;
  log(run, `Slayer task complete! +${points} ${C.terms.slayerPoints}, +${coins} ${C.terms.coins}.`, 'good');
  completeTask(ctx, 'slayer_task');
}

function checkBoonThresholds(ctx: RunCtx): void {
  const { run } = ctx;
  const earned = CONFIG.BOON_THRESHOLDS.filter((t) => run.xp >= t).length;
  if (earned > run.boonsEarned) run.boonsEarned = earned;
}

export function pendingBoons(run: RunState): number {
  const taken = Object.values(run.boons).reduce((a, b) => a + b, 0);
  return run.boonsEarned - taken;
}

/** Called when an encounter ends. Moves the run to loot or ends it on death. */
export function finishEncounter(ctx: RunCtx, enc: Encounter): RunResult | null {
  const { run, ch } = ctx;
  if (enc.result === 'lost') {
    log(run, 'Oh dear, you are dead!', 'bad');
    return endRun(ctx, 'death');
  }
  const node = run.map.nodes[run.roomNode!];
  const m = runMods(ch, run);
  const level = characterLevel(ch);
  run.stats.roomsCleared++;
  if (node.type !== 'boss') completeTask(ctx, 'first_room');
  if (enc.player.damageTaken === 0 && node.type !== 'boss') completeTask(ctx, 'untouched');

  // Boss tasks.
  if (node.type === 'boss') {
    const depth = currentAct(run).depth;
    if (depth === 1) completeTask(ctx, 'boss_act1');
    if (depth === 2) completeTask(ctx, 'boss_act2');
    if (depth === 3) completeTask(ctx, 'boss_act3');
    if (enc.player.damageTaken === 0) completeTask(ctx, 'flawless_boss');
    if (omenScore(run.omens) >= 30) completeTask(ctx, 'omen_boss');
    if ((ch.bossKills.warlord_brakka ?? 0) > 0 && (ch.bossKills.hellwarden_zarkoth ?? 0) > 0) completeTask(ctx, 'both_generals');
  }

  // After-room effects.
  const heal = mod(m, 'healPerRoom');
  if (heal > 0) run.hp = Math.min(maxHp(level, m), run.hp + heal);

  const recovery = (CONFIG.AMMO_BASE_RECOVERY + mod(m, 'ammoRecovery')) / 100;
  for (const [id, fired] of Object.entries(enc.ammoFired)) {
    if (C.item(id).ammoType === 'thrown' && !C.item(id).slot) continue;
    const back = Math.floor(fired * Math.min(1, recovery));
    if (back <= 0) continue;
    const slot = C.item(id).ammoType === 'thrown' ? 'weapon' : 'ammo';
    const worn = run.equipment[slot];
    if (worn?.id === id) worn.qty += back;
    else if (!worn) run.equipment[slot] = { id, qty: back };
    else addItem(run, id, back);
    log(run, `You recover ${back} ${C.item(id).name.toLowerCase()}.`, 'info');
  }
  const runeBack = mod(m, 'runeRecovery') / 100;
  for (const [id, spent] of Object.entries(enc.runesSpent)) {
    const back = Math.floor(spent * Math.min(1, runeBack));
    if (back > 0) addItem(run, id, back);
  }

  // Charged jewellery loses a charge per room.
  for (const stack of Object.values(run.equipment)) {
    if (!stack) continue;
    const def = C.item(stack.id);
    if (def.charges !== undefined && (stack.charges ?? 0) > 0) {
      stack.charges = (stack.charges ?? 0) - 1;
      if (stack.charges === 0) log(run, `Your ${def.name.toLowerCase()} has run out of charge.`, 'bad');
    }
  }

  run.activePrayers = [];
  run.roomCombatBuff = false;
  run.buffs.combatDraught = false;
  run.buffs.feast = false;
  run.buffs.brazier = false;
  run.phase = 'loot';
  return null;
}

/* ------------------------------------------------------------------ */
/* Loot                                                                */
/* ------------------------------------------------------------------ */

function receive(ctx: RunCtx, drop: LootDrop): void {
  const { run, ch } = ctx;
  const first = !ch.collection[drop.id];
  ch.collection[drop.id] = (ch.collection[drop.id] ?? 0) + 1;
  run.stats.itemsReceived[drop.id] = (run.stats.itemsReceived[drop.id] ?? 0) + 1;
  if (drop.unique) {
    run.stats.uniques.push(drop.id);
    completeTask(ctx, 'unique_drop');
  }
  if (first) log(run, `New item collected: ${C.item(drop.id).name}`, drop.unique ? 'rare' : 'loot');
  const logged = Object.keys(ch.collection).length;
  if (logged >= 10) completeTask(ctx, 'collector_10');
  if (logged >= 50) completeTask(ctx, 'collector_50');
}

export function collectCoins(ctx: RunCtx): void {
  const { run } = ctx;
  if (!run.pendingLoot || run.pendingLoot.coins <= 0) return;
  run.coins += run.pendingLoot.coins;
  log(run, `You pick up ${run.pendingLoot.coins} ${C.terms.coins}.`, 'loot');
  run.pendingLoot.coins = 0;
}

export function takeLoot(ctx: RunCtx, index: number): string | null {
  const { run } = ctx;
  const loot = run.pendingLoot;
  if (!loot) return null;
  const drop = loot.items[index];
  if (!drop) return null;
  const quiver = run.equipment.ammo;
  if (quiver && quiver.id === drop.id) {
    // Matching arrows/bolts go straight into the quiver.
    quiver.qty += drop.qty;
  } else {
    if (slotsNeeded(run, drop.id, drop.qty) > run.inventory.filter((s) => s === null).length) return 'Your inventory is too full to hold that.';
    addItem(run, drop.id, drop.qty);
  }
  receive(ctx, drop);
  loot.items.splice(index, 1);
  return null;
}

export function takeAllLoot(ctx: RunCtx): string | null {
  const { run } = ctx;
  collectCoins(ctx);
  const loot = run.pendingLoot;
  if (!loot) return null;
  let blocked = false;
  for (let i = 0; i < loot.items.length; ) {
    const err = takeLoot(ctx, i);
    if (err) {
      blocked = true;
      i++;
    }
  }
  return blocked ? 'Some items did not fit in your inventory.' : null;
}

/** Leave the current room (after loot or an event). */
export function closeRoom(ctx: RunCtx): void {
  const { run } = ctx;
  collectCoins(ctx);
  const node = run.roomNode ? run.map.nodes[run.roomNode] : null;
  run.pendingLoot = null;
  run.event = null;
  run.roomNode = null;
  if (node?.type === 'boss') {
    run.phase = 'actComplete';
    run.stats.deepestAct = Math.max(run.stats.deepestAct, run.actIndex + 1);
  } else run.phase = 'map';
  maybeOfferBoon(ctx);
}

export function maybeOfferBoon(ctx: RunCtx): void {
  const { run, ch } = ctx;
  if (run.boonOffer || pendingBoons(run) <= 0 || run.phase === 'over') return;
  const m = runBaseMods(ch, run);
  const choices = CONFIG.BOON_CHOICES + mod(m, 'boonChoices');
  const pool = C.boons.filter((b) => (run.boons[b.id] ?? 0) < b.stack && (!b.requiresFlag || m.flags.has(b.requiresFlag)));
  run.boonOffer = withRng(run, (rng) => rng.shuffle([...pool]).slice(0, choices).map((b) => b.id));
}

export function chooseBoon(ctx: RunCtx, id: string): void {
  const { run, ch } = ctx;
  if (!run.boonOffer?.includes(id)) return;
  const before = maxHp(characterLevel(ch), runMods(ch, run));
  run.boons[id] = (run.boons[id] ?? 0) + 1;
  run.boonOffer = null;
  const after = maxHp(characterLevel(ch), runMods(ch, run));
  if (after > before) run.hp += after - before;
  log(run, `Boon gained: ${C.boon(id).name}.`, 'good');
  maybeOfferBoon(ctx);
}

/* ------------------------------------------------------------------ */
/* Acts and the end of a run                                           */
/* ------------------------------------------------------------------ */

export function isFinalAct(run: RunState): boolean {
  return run.actIndex >= routeLength(run) - 1;
}

export function continueToNextAct(ctx: RunCtx): RunResult | null {
  const { run, ch } = ctx;
  if (run.phase !== 'actComplete') return null;
  if (isFinalAct(run)) return endRun(ctx, 'clear');
  run.actIndex++;
  run.stats.deepestAct = Math.max(run.stats.deepestAct, run.actIndex + 1);
  const level = characterLevel(ch);
  const m = runMods(ch, run);
  run.hp = Math.min(maxHp(level, m), run.hp + Math.round(maxHp(level, m) * 0.25));
  run.spec = CONFIG.SPEC.max;
  run.slayerTask = run.slayerTask?.done ? null : run.slayerTask;
  if (run.slayerTask) {
    log(run, 'Your Slayer task expires as you leave the act.', 'info');
    run.slayerTask = null;
  }
  newActMap(ch, run);
  run.phase = 'map';
  const act = currentAct(run);
  log(run, `Act ${run.actIndex + 1}: ${act.name}. ${act.blurb}`, 'system');
  return null;
}

/** Attack rank 10: restore special-attack energy once per act. */
export function canRestoreSpec(ctx: RunCtx): boolean {
  const { run, ch } = ctx;
  return !run.acts.specRestore && mod(characterMods(ch), 'specRestore') > 0 && run.spec < CONFIG.SPEC.max;
}

export function restoreSpec(ctx: RunCtx): void {
  if (!canRestoreSpec(ctx)) return;
  const { run, ch } = ctx;
  run.acts.specRestore = true;
  run.spec = Math.min(CONFIG.SPEC.max, run.spec + mod(characterMods(ch), 'specRestore'));
  log(run, 'You catch your breath. Special-attack energy restored.', 'good');
}

export function retreat(ctx: RunCtx): RunResult | null {
  if (ctx.run.phase !== 'actComplete') return null;
  completeTask(ctx, 'retreat');
  return endRun(ctx, 'retreat');
}

export function completeTask(ctx: RunCtx, id: string): void {
  const { ch, run } = ctx;
  if (ch.tasksDone.includes(id)) return;
  const task = C.task(id);
  ch.tasksDone.push(id);
  ch.leaguePoints += task.points;
  log(run, `Task complete: ${task.name} (+${task.points} ${C.terms.leaguePoints})`, 'rare');
  run.tasksThisRun.push(id);
}

export function endRun(ctx: RunCtx, outcome: RunOutcome): RunResult {
  const { run, ch } = ctx;
  const rules = CONFIG.OUTCOMES[outcome];
  const base = runBaseMods(ch, run);
  const omenMult = 1 + omenScore(run.omens) * CONFIG.OMEN_REWARD_PER_POINT;
  const xpBonus = 1 + mod(base, 'xpBonus') / 100;

  if (outcome === 'clear') completeTask(ctx, 'full_clear');
  const coinsBanked = Math.round(run.coins * rules.coins * (1 + mod(base, 'bankBonus') / 100) * omenMult);
  if (coinsBanked >= 150) completeTask(ctx, 'wealthy');

  const breakdown: RunResult['xpBreakdown'] = [{ label: 'Monsters and rooms', value: run.xp }];
  let xp = run.xp;
  if (rules.xp !== 1) {
    const bonus = Math.round(xp * (rules.xp - 1));
    breakdown.push({ label: 'Full clear bonus (+20%)', value: bonus });
    xp += bonus;
  }
  if (omenMult > 1) {
    const bonus = Math.round(xp * (omenMult - 1));
    breakdown.push({ label: `${C.terms.omens} (${omenScore(run.omens)} points)`, value: bonus });
    xp += bonus;
  }
  if (xpBonus > 1) {
    const bonus = Math.round(xp * (xpBonus - 1));
    breakdown.push({ label: 'XP bonus', value: bonus });
    xp += bonus;
  }
  xp = Math.round(xp);

  let slayerBonus = 0;
  if (outcome === 'clear' && run.stats.slayerTasksDone > 0) {
    slayerBonus = 10 * run.stats.slayerTasksDone;
    ch.slayerPoints += slayerBonus;
  }

  const levelBefore = levelForXp(ch.xp);
  ch.xp += xp;
  const levelAfter = levelForXp(ch.xp);
  ch.coins += coinsBanked;
  ch.stats.bestDepth = Math.max(ch.stats.bestDepth, run.stats.deepestAct);
  if (outcome === 'death') ch.stats.deaths++;
  if (outcome === 'retreat') ch.stats.retreats++;
  if (outcome === 'clear') ch.stats.clears++;

  const tasks = run.tasksThisRun;
  const leaguePoints = tasks.reduce((s, id) => s + C.task(id).points, 0);
  const result: RunResult = {
    outcome,
    xpEarned: xp,
    xpBreakdown: breakdown,
    levelBefore,
    levelAfter,
    pointsGained: skillPointsForLevel(levelAfter) - skillPointsForLevel(levelBefore),
    coinsBanked,
    slayerPoints: slayerBonus,
    leaguePoints,
    tasksCompleted: tasks,
    newCollection: Object.keys(run.stats.itemsReceived),
    bossesKilled: run.stats.bossesKilled,
    uniques: run.stats.uniques,
    pets: run.stats.pets,
    depth: run.stats.deepestAct,
    rooms: run.stats.roomsCleared,
    kills: run.stats.kills,
    keepable: allHeldItems(run).filter((s) => isKeepable(C.item(s.id))),
    vaultSlots: vaultSlots(ch),
  };
  run.phase = 'over';
  run.outcome = outcome;
  ch.activeRun = null;
  ch.lastResult = result;
  return result;
}

function isKeepable(def: ItemDef): boolean {
  return def.kind !== 'tome';
}

/** Store the chosen items in the Vault (replaces previous contents). */
export function storeVault(ch: CharacterSave, picks: ItemStack[]): void {
  const slots = vaultSlots(ch);
  ch.vault = picks.slice(0, slots).map((s) => ({ ...s }));
  if (ch.lastResult) ch.lastResult.keepable = [];
}
