/** Inventory (28 slots) and equipment operations on a run. */
import { C } from '../content';
import type { EquipSlot, ItemDef, SkillId } from '../content/types';
import type { CharacterSave, ItemStack, RunState } from './state';

export function freeSlots(run: RunState): number {
  return run.inventory.filter((s) => s === null).length;
}

export function countItem(run: RunState, id: string): number {
  let n = 0;
  for (const s of run.inventory) if (s?.id === id) n += s.qty;
  return n;
}

/** Room an item would need: 0 if it stacks onto an existing stack. */
export function slotsNeeded(run: RunState, id: string, qty: number): number {
  const def = C.item(id);
  if (def.stackable) return run.inventory.some((s) => s?.id === id) ? 0 : 1;
  return qty;
}

/** Add items; returns how many did not fit. */
export function addItem(run: RunState, id: string, qty = 1, charges?: number): number {
  const def = C.item(id);
  if (qty <= 0) return 0;
  if (def.stackable) {
    const existing = run.inventory.find((s) => s?.id === id);
    if (existing) {
      existing.qty += qty;
      return 0;
    }
    const free = run.inventory.indexOf(null);
    if (free < 0) return qty;
    run.inventory[free] = { id, qty };
    return 0;
  }
  let left = qty;
  while (left > 0) {
    const free = run.inventory.indexOf(null);
    if (free < 0) break;
    run.inventory[free] = charges !== undefined || def.charges !== undefined ? { id, qty: 1, charges: charges ?? def.charges } : { id, qty: 1 };
    left--;
  }
  return left;
}

/** Remove up to qty of an item id from the inventory; returns how many were removed. */
export function consumeItem(run: RunState, id: string, qty = 1): number {
  let left = qty;
  for (let i = 0; i < run.inventory.length && left > 0; i++) {
    const s = run.inventory[i];
    if (!s || s.id !== id) continue;
    const take = Math.min(s.qty, left);
    s.qty -= take;
    left -= take;
    if (s.qty <= 0) run.inventory[i] = null;
  }
  return qty - left;
}

export function removeAt(run: RunState, slot: number, qty?: number): ItemStack | null {
  const s = run.inventory[slot];
  if (!s) return null;
  const take = Math.min(s.qty, qty ?? s.qty);
  if (take >= s.qty) {
    run.inventory[slot] = null;
    return s;
  }
  s.qty -= take;
  return { ...s, qty: take };
}

export function equipReason(ch: CharacterSave, level: number, def: ItemDef): string | null {
  if (!def.slot) return `${def.name} can't be worn.`;
  if (def.req?.level && level < def.req.level) return `You need character level ${def.req.level} to wear ${def.name}.`;
  if (def.req?.skills) {
    for (const [skill, rank] of Object.entries(def.req.skills)) {
      if ((ch.skills[skill as SkillId] ?? 0) < (rank ?? 0)) return `You need ${C.skill(skill as SkillId).name} rank ${rank} to wear ${def.name}.`;
    }
  }
  return null;
}

/**
 * Equip the item in an inventory slot. Handles two-handed weapons, stacking ammo and
 * thrown weapons. Returns an error message or null on success.
 */
export function equipFromInventory(run: RunState, ch: CharacterSave, level: number, invSlot: number): string | null {
  const stack = run.inventory[invSlot];
  if (!stack) return null;
  const def = C.item(stack.id);
  const reason = equipReason(ch, level, def);
  if (reason) return reason;
  const slot = def.slot as EquipSlot;
  const current = run.equipment[slot];

  // Stack onto matching ammo / thrown weapons already worn.
  if (def.stackable && current?.id === stack.id) {
    current.qty += stack.qty;
    run.inventory[invSlot] = null;
    return null;
  }

  const toInventory: ItemStack[] = [];
  if (current) toInventory.push(current);
  if (slot === 'weapon' && def.weapon?.twoHanded && run.equipment.shield) toInventory.push(run.equipment.shield);
  if (slot === 'shield') {
    const weapon = run.equipment.weapon;
    if (weapon && C.item(weapon.id).weapon?.twoHanded) toInventory.push(weapon);
  }
  // The equipped item's slot frees up, so only extra items need space.
  const spaceNeeded = toInventory.length - 1;
  if (spaceNeeded > 0 && freeSlots(run) < spaceNeeded) return 'Not enough inventory space.';

  run.inventory[invSlot] = null;
  run.equipment[slot] = stack;
  if (slot === 'weapon' && def.weapon?.twoHanded && run.equipment.shield) delete run.equipment.shield;
  if (slot === 'shield' && run.equipment.weapon && C.item(run.equipment.weapon.id).weapon?.twoHanded) delete run.equipment.weapon;

  for (const s of toInventory) {
    if (run.inventory[invSlot] === null) run.inventory[invSlot] = s;
    else {
      const free = run.inventory.indexOf(null);
      if (free >= 0) run.inventory[free] = s;
    }
  }
  return null;
}

export function unequip(run: RunState, slot: EquipSlot): string | null {
  const stack = run.equipment[slot];
  if (!stack) return null;
  const def = C.item(stack.id);
  if (def.stackable) {
    const existing = run.inventory.find((s) => s?.id === stack.id);
    if (existing) {
      existing.qty += stack.qty;
      delete run.equipment[slot];
      return null;
    }
  }
  const free = run.inventory.indexOf(null);
  if (free < 0) return 'Not enough inventory space.';
  run.inventory[free] = stack;
  delete run.equipment[slot];
  return null;
}

/** All items the player holds (inventory + equipment), for Vault selection. */
export function allHeldItems(run: RunState): ItemStack[] {
  const out: ItemStack[] = [];
  for (const s of Object.values(run.equipment)) if (s) out.push({ ...s });
  for (const s of run.inventory) if (s) out.push({ ...s });
  return out;
}
