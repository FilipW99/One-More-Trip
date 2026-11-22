import { describe, expect, it } from 'vitest';
import { C } from '../src/content';
import { FLAG_STATUS } from '../src/core/flags';
import { SKILL_IDS, type Effect } from '../src/content/types';

function allEffects(): Effect[] {
  return [
    ...C.skills.flatMap((s) => [...s.perRank, ...s.perks.flatMap((p) => p.effects)]),
    ...C.relics.flatMap((r) => r.effects),
    ...C.omens.flatMap((o) => o.effects),
    ...C.boons.flatMap((b) => b.effects),
    ...C.prayers.flatMap((p) => p.effects ?? []),
    ...C.hub.flatMap((f) => f.tiers.flatMap((t) => t.effects)),
    ...C.items.flatMap((i) => i.passive ?? []),
  ];
}

describe('content pack integrity', () => {
  it('has all 24 skills with perks at ranks 3, 6 and 10', () => {
    expect(C.skills.map((s) => s.id).sort()).toEqual([...SKILL_IDS].sort());
    for (const s of C.skills) expect(s.perks.map((p) => p.rank)).toEqual([3, 6, 10]);
  });

  it('references only items that exist', () => {
    for (const act of C.acts) for (const id of act.dropPool) expect(C.hasItem(id), `${act.id} pool: ${id}`).toBe(true);
    for (const boss of C.bosses) {
      for (const u of boss.uniques) expect(C.hasItem(u.item), `${boss.id} unique ${u.item}`).toBe(true);
      if (boss.pet) expect(C.hasItem(boss.pet.id)).toBe(true);
    }
    for (const kit of C.kits) {
      for (const id of kit.equipment) expect(C.hasItem(id), id).toBe(true);
      for (const [id] of kit.inventory) expect(C.hasItem(id), id).toBe(true);
      for (const [from, to] of kit.workshop) if (from) expect(C.hasItem(from) && C.hasItem(to), `${from}->${to}`).toBe(true);
    }
    for (const g of C.gatherRooms) for (const y of [...g.yields, ...g.highYields]) expect(C.hasItem(y.item), y.item).toBe(true);
    for (const item of C.items) if (item.teaches) expect(() => C.spell(item.teaches!)).not.toThrow();
    for (const spell of C.spells) for (const rune of Object.keys(spell.runes)) expect(C.hasItem(rune), rune).toBe(true);
  });

  it('references only monsters, bosses and masters that exist', () => {
    for (const act of C.acts) {
      for (const id of [...act.monsters, ...act.elites]) expect(() => C.monster(id)).not.toThrow();
      for (const id of act.bosses) expect(() => C.boss(id)).not.toThrow();
      expect(() => C.slayerMaster(act.slayerMaster)).not.toThrow();
      for (const wave of act.gauntlet?.waves ?? []) for (const id of wave) expect(() => C.monster(id)).not.toThrow();
    }
    for (const m of C.monsters) if (m.superior) expect(() => C.monster(m.superior!)).not.toThrow();
    for (const b of C.bosses) {
      for (const id of b.minions ?? []) expect(() => C.monster(id)).not.toThrow();
      for (const ph of b.phases) for (const id of ph.summonOnEnter ?? []) expect(() => C.monster(id)).not.toThrow();
      expect(b.phases.at(-1)!.untilHpPct).toBe(0);
    }
    for (const r of C.routes) for (const id of r.acts) expect(() => C.act(id)).not.toThrow();
  });

  it('uses only flags the engine knows and implements', () => {
    for (const e of allEffects()) {
      if ('flag' in e) {
        expect(FLAG_STATUS[e.flag], e.flag).toBeDefined();
        expect(FLAG_STATUS[e.flag].implemented, e.flag).toBe(true);
      }
    }
  });

  it('has a gather room for every room unlock that needs one', () => {
    const rooms = new Set(allEffects().filter((e): e is Extract<Effect, { room: string }> => 'room' in e).map((e) => e.room));
    for (const r of rooms) if (r !== 'shortcut' && r !== 'island') expect(C.gatherRoom(r), r).toBeDefined();
  });

  it('every skill gate unlocks at least one item', () => {
    const gates = new Set(allEffects().filter((e): e is Extract<Effect, { gate: string }> => 'gate' in e).map((e) => e.gate));
    for (const g of gates) expect(C.items.some((i) => i.tags.includes(g)), `gate ${g}`).toBe(true);
  });

  it('marks placeholder content with a design-doc slot', () => {
    const tagged = [...C.items, ...C.monsters, ...C.bosses, ...C.acts, ...C.prayers, ...C.relics, ...C.omens, ...C.pets].filter((r) => r.ph);
    expect(tagged.length).toBeGreaterThan(150);
    for (const r of tagged) {
      expect(r.ph!.plan).toMatch(/^§\d/);
      expect(r.ph!.slot.length).toBeGreaterThan(3);
    }
    // Every item, monster and boss stands in for design-doc content.
    for (const r of [...C.items, ...C.monsters, ...C.bosses]) expect(r.ph, r.id).not.toBeNull();
  });
});
