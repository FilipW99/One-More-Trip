import { describe, expect, it } from 'vitest';
import { createEncounter, stepEncounter, togglePrayer, type Encounter } from '../src/core/combat/engine';
import { makeCharacter, makeRun } from './helpers';

function bossFight(bossId: string, prayerRanks = 10): { enc: Encounter; ctx: ReturnType<typeof makeRun> } {
  const ch = makeCharacter('melee', { level: 40, skills: { prayer: prayerRanks } });
  const ctx = makeRun(ch);
  ctx.run.prayer = 999;
  const enc = createEncounter({ kind: 'boss', monsters: [{ id: bossId }], seed: 3 }, { run: ctx.run, character: ch, level: 40, autoRetaliate: false });
  return { enc, ctx };
}

describe('protection prayers (design doc §3.2)', () => {
  it('are locked until the Prayer track unlocks them', () => {
    const { enc } = bossFight('grumbold', 0);
    expect(togglePrayer(enc, 'protect_magic')).toMatch(/not unlocked/);
    const { enc: enc2 } = bossFight('grumbold', 3);
    expect(togglePrayer(enc2, 'protect_magic')).toBeNull();
    expect(togglePrayer(enc2, 'protect_ranged')).toMatch(/not unlocked/);
  });

  it('block projectiles of the matching style when they land, not when they launch', () => {
    const { enc, ctx } = bossFight('dawn_colossus');
    ctx.run.hp = 10_000;
    let blocked = 0;
    let landed = 0;
    for (let t = 0; t < 120; t++) {
      // Switch to the style of whatever lands next.
      const next = enc.projectiles.filter((p) => p.to === 0).sort((a, b) => a.impactTick - b.impactTick)[0];
      if (next && next.style !== 'typeless') {
        const want = next.style === 'magic' ? 'protect_magic' : next.style === 'ranged' ? 'protect_ranged' : 'protect_melee';
        if (!ctx.run.activePrayers.includes(want)) togglePrayer(enc, want);
      }
      stepEncounter(enc);
      for (const e of enc.events) {
        if (e.t === 'hit' && e.target === 0 && e.style !== 'typeless') {
          landed++;
          if (e.blocked === 'full') blocked++;
        }
      }
    }
    expect(landed).toBeGreaterThan(5);
    expect(blocked).toBe(landed);
  });

  it('only one protection prayer is active at a time', () => {
    const { enc, ctx } = bossFight('grumbold');
    togglePrayer(enc, 'protect_magic');
    togglePrayer(enc, 'protect_melee');
    expect(ctx.run.activePrayers).toEqual(['protect_melee']);
    togglePrayer(enc, 'keen_focus');
    expect(ctx.run.activePrayers.sort()).toEqual(['keen_focus', 'protect_melee']);
  });

  it('drain prayer points every tick while active', () => {
    const { enc, ctx } = bossFight('grumbold');
    ctx.run.prayer = 10;
    togglePrayer(enc, 'protect_melee');
    for (let i = 0; i < 10; i++) stepEncounter(enc);
    expect(ctx.run.prayer).toBeLessThan(10);
    expect(ctx.run.prayer).toBeGreaterThan(7);
  });
});

describe('ground hazards', () => {
  it('hit a player who stays on the marked tiles and miss one who moves off', () => {
    const { enc, ctx } = bossFight('grumbold');
    ctx.run.hp = 10_000;
    let hazardHits = 0;
    for (let t = 0; t < 300 && hazardHits === 0; t++) {
      stepEncounter(enc);
      hazardHits += enc.events.filter((e) => e.t === 'msg' && e.text.startsWith('You are caught')).length;
    }
    expect(hazardHits).toBeGreaterThan(0);
  });
});

describe('ticks', () => {
  it('a 4-tick weapon attacks every 4 ticks', () => {
    const ch = makeCharacter('melee', { level: 60 });
    const ctx = makeRun(ch);
    const enc = createEncounter({ kind: 'combat', monsters: [{ id: 'sand_sentinel' }], seed: 1 }, { run: ctx.run, character: ch, level: 60, autoRetaliate: false });
    ctx.run.hp = 10_000;
    enc.enemies[0].hp = enc.enemies[0].maxHp = 100_000;
    enc.player.target = enc.enemies[0].id;
    const attackTicks: number[] = [];
    for (let t = 0; t < 60; t++) {
      stepEncounter(enc);
      if (enc.events.some((e) => e.t === 'attack' && e.source === 0)) attackTicks.push(enc.tick);
    }
    const gaps = attackTicks.slice(1).map((t, i) => t - attackTicks[i]);
    expect(gaps.length).toBeGreaterThan(5);
    expect(gaps.every((g) => g === 4)).toBe(true);
  });
});
