/**
 * Drop pools and rolls (design doc §5). Location pools are always available;
 * skill-perk gates add tagged items from the whole catalogue (up to the act's tier
 * cap); weights from perks bias the roll; ~80% of weapon drops follow the focus.
 */
import { CONFIG } from '../config';
import { C } from '../content';
import type { ActDef, Focus, ItemDef } from '../content/types';
import { mod, weightOf, type Mods } from './mods';
import { Rng } from './rng';
import type { LootDrop, RunState } from './state';

type Category = 'weapon' | 'armour' | 'supply' | 'other';

const CATEGORY_WEIGHTS: Record<Category, number> = { weapon: 22, armour: 30, supply: 38, other: 10 };

function categoryOf(item: ItemDef): Category {
  if (item.kind === 'weapon') return 'weapon';
  if (item.kind === 'armour' || item.kind === 'jewellery') return 'armour';
  if (item.kind === 'food' || item.kind === 'potion' || item.kind === 'ammo' || item.kind === 'rune') return 'supply';
  return 'other';
}

/** Every item that can drop in an act for a character with these mods. */
export function eligiblePool(act: ActDef, m: Mods): ItemDef[] {
  const seen = new Set<string>();
  const pool: ItemDef[] = [];
  for (const id of act.dropPool) {
    if (seen.has(id)) continue;
    seen.add(id);
    pool.push(C.item(id));
  }
  if (m.gates.size > 0) {
    for (const item of C.items) {
      if (seen.has(item.id) || item.unique || item.tags.includes('pet')) continue;
      if (item.tier > act.maxTier) continue;
      if (item.tags.some((t) => m.gates.has(t))) {
        seen.add(item.id);
        pool.push(item);
      }
    }
  }
  return pool;
}

function itemWeight(item: ItemDef, m: Mods): number {
  let w = 1;
  for (const tag of item.tags) w *= weightOf(m, tag);
  if (item.tags.includes('log')) w *= 1 + mod(m, 'yieldFiremaking') / 100;
  return w;
}

function supplyQty(item: ItemDef, rng: Rng, depth: number): number {
  if (item.kind === 'ammo') return rng.int(10, 25) + depth * 4;
  if (item.kind === 'rune') return rng.int(15, 35) + depth * 5;
  if (item.kind === 'resource' && item.stackable) return rng.int(1, 3);
  if (item.kind === 'weapon' && item.stackable) return rng.int(15, 30);
  return 1;
}

/** One item roll from an act's pool. */
export function rollItem(run: RunState, focus: Focus, act: ActDef, m: Mods, rng: Rng): LootDrop | null {
  const pool = eligiblePool(act, m);
  const weaponStyle = run.equipment.weapon ? C.item(run.equipment.weapon.id).weapon : undefined;
  const byCat: Record<Category, ItemDef[]> = { weapon: [], armour: [], supply: [], other: [] };
  for (const item of pool) {
    const cat = categoryOf(item);
    if (cat === 'supply' && (item.kind === 'ammo' || item.kind === 'rune')) {
      // Ammunition and runes follow the weapon in hand.
      if (item.kind === 'ammo' && weaponStyle?.ammo !== item.ammoType) continue;
      if (item.kind === 'rune' && !(weaponStyle?.style === 'magic' && weaponStyle.autocast) && focus !== 'magic') continue;
    }
    byCat[cat].push(item);
  }
  const cat = rng.weighted(
    (Object.keys(CATEGORY_WEIGHTS) as Category[]).map((c) => ({ value: c, weight: byCat[c].length ? CATEGORY_WEIGHTS[c] : 0 })),
  );
  if (!cat) return null;
  let candidates = byCat[cat];
  if (cat === 'weapon') {
    const onFocus = candidates.filter((i) => i.focus === focus);
    const offFocus = candidates.filter((i) => i.focus !== focus);
    if (onFocus.length && offFocus.length) candidates = rng.chance(CONFIG.FOCUS_WEAPON_SHARE) ? onFocus : offFocus;
  }
  const item = rng.weighted(candidates.map((i) => ({ value: i, weight: itemWeight(i, m) })));
  if (!item) return null;
  return { id: item.id, qty: supplyQty(item, rng, act.depth) };
}

export interface BossRollResult {
  drops: LootDrop[];
  gotUnique: boolean;
  gotPet: boolean;
}

/** Unique and pet rolls for a boss kill. Updates nothing; caller updates pity. */
export function rollBossSpecials(bossId: string, pity: number, omenPoints: number, m: Mods, rng: Rng): BossRollResult {
  const boss = C.boss(bossId);
  const drops: LootDrop[] = [];
  let chance = boss.uniqueChance + mod(m, 'uniqueChance') / 100 + omenPoints * CONFIG.OMEN_UNIQUE_PER_POINT;
  if (CONFIG.PITY_ENABLED) chance += pity * CONFIG.PITY_PER_KILL;
  let gotUnique = false;
  if (boss.uniques.length && rng.chance(Math.min(1, chance))) {
    const pick = rng.weighted(boss.uniques.map((u) => ({ value: u.item, weight: u.weight })));
    if (pick) {
      drops.push({ id: pick, qty: 1, unique: true });
      gotUnique = true;
    }
  }
  let gotPet = false;
  if (boss.pet && rng.chance(boss.pet.chance)) {
    drops.push({ id: boss.pet.id, qty: 1, pet: true });
    gotPet = true;
  }
  return { drops, gotUnique, gotPet };
}

export function rollCoins(range: [number, number], m: Mods, rng: Rng, mult = 1): number {
  const base = rng.int(range[0], range[1]) * mult;
  return Math.round(base * (1 + mod(m, 'coinFind') / 100));
}

export function normalDropChance(m: Mods): number {
  return CONFIG.DROP_CHANCE_NORMAL + mod(m, 'dropChance') / 100;
}

/** Contents of a sealed casket or impling jar. */
export function rollCasket(run: RunState, focus: Focus, act: ActDef, m: Mods, rng: Rng, small: boolean): { items: LootDrop[]; coins: number } {
  const items: LootDrop[] = [];
  const rolls = small ? 1 : 2;
  for (let i = 0; i < rolls; i++) {
    const drop = rollItem(run, focus, act, m, rng);
    if (drop) items.push(drop);
  }
  const coins = rollCoins(small ? [10, 30] : [25, 60], m, rng);
  return { items, coins };
}
