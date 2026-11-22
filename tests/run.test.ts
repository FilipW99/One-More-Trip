import { describe, expect, it } from 'vitest';
import { C } from '../src/content';
import { botPlayRun, DEFAULT_BOT } from '../src/core/bot';
import { countItem } from '../src/core/inventory';
import { storeVault, endRun, startRun, takeAllLoot } from '../src/core/run';
import { makeCharacter, makeRun } from './helpers';

describe('starting a run (design doc §2)', () => {
  it('melee kit: iron scimitar, wooden shield, iron chainbody, 4 trout', () => {
    const { run } = makeRun(makeCharacter('melee'));
    expect(run.equipment.weapon?.id).toBe('iron_scimitar');
    expect(run.equipment.shield?.id).toBe('wooden_shield');
    expect(run.equipment.body?.id).toBe('iron_chainbody');
    expect(countItem(run, 'trout')).toBe(4);
    expect(run.inventory.length).toBe(28);
  });

  it('ranged kit: shortbow, 50 bronze arrows, leather body and chaps', () => {
    const { run } = makeRun(makeCharacter('ranged'));
    expect(run.equipment.weapon?.id).toBe('shortbow');
    expect(run.equipment.ammo).toEqual({ id: 'bronze_arrows', qty: 50 });
    expect(run.equipment.legs?.id).toBe('leather_chaps');
  });

  it('magic kit: air staff, hat, robe, 100 spark runes', () => {
    const { run } = makeRun(makeCharacter('magic'));
    expect(run.equipment.weapon?.id).toBe('air_staff');
    expect(countItem(run, 'spark_rune')).toBe(100);
    expect(run.activeSpell).toBe('spark');
  });

  it('applies Hitpoints rank 3 and Herblore rank 3 starting supplies', () => {
    const { run } = makeRun(makeCharacter('melee', { level: 10, skills: { hitpoints: 3, herblore: 3 } }));
    expect(countItem(run, 'trout')).toBe(6);
    expect(countItem(run, 'devotion_draught')).toBe(1);
  });

  it('Workshop upgrades the starting weapon when the level allows', () => {
    const low = makeRun(makeCharacter('melee', { level: 1, hub: { workshop: 1 } }));
    expect(low.run.equipment.weapon?.id).toBe('iron_scimitar');
    const high = makeRun(makeCharacter('melee', { level: 10, hub: { workshop: 1 } }));
    expect(high.run.equipment.weapon?.id).toBe('steel_scimitar');
  });
});

describe('end of run (design doc §3.3)', () => {
  it('death keeps 100% XP and loses coins', () => {
    const ctx = makeRun(makeCharacter());
    ctx.run.xp = 400;
    ctx.run.coins = 200;
    const res = endRun(ctx, 'death');
    expect(res.xpEarned).toBe(400);
    expect(res.coinsBanked).toBe(0);
    expect(ctx.ch.xp).toBe(400);
    expect(ctx.ch.coins).toBe(0);
    expect(ctx.ch.activeRun).toBeNull();
  });

  it('retreat banks 25% of coins, full clear banks 50% and adds 20% XP', () => {
    const a = makeRun(makeCharacter());
    a.run.xp = 1000;
    a.run.coins = 200;
    a.run.phase = 'actComplete';
    expect(endRun(a, 'retreat').coinsBanked).toBe(50);
    const b = makeRun(makeCharacter());
    b.run.xp = 1000;
    b.run.coins = 200;
    const res = endRun(b, 'clear');
    expect(res.coinsBanked).toBe(100);
    expect(res.xpEarned).toBe(1200);
  });

  it('keeps only Vault-slot items', () => {
    const ch = makeCharacter('melee', { hub: { vault: 2 } });
    const ctx = makeRun(ch);
    const res = endRun(ctx, 'death');
    expect(res.vaultSlots).toBe(2);
    storeVault(ch, res.keepable.slice(0, 5));
    expect(ch.vault.length).toBe(2);
    const next = startRun(ch, 7);
    expect(ch.vault.length).toBe(0);
    expect(Object.values(next.equipment).length + next.inventory.filter(Boolean).length).toBeGreaterThan(0);
  });

  it('records received items in the Collection Log even if the run is lost', () => {
    const ctx = makeRun(makeCharacter());
    ctx.run.pendingLoot = { items: [{ id: 'steel_scimitar', qty: 1 }], coins: 0, source: 'test' };
    ctx.run.phase = 'loot';
    expect(ctx.ch.collection.steel_scimitar).toBeUndefined();
    takeAllLoot(ctx);
    expect(ctx.ch.collection.steel_scimitar).toBe(1);
    endRun(ctx, 'death');
    expect(ctx.ch.collection.steel_scimitar).toBe(1);
  });

  it('puts arrows matching the quiver straight into the quiver', () => {
    const ctx = makeRun(makeCharacter('ranged'));
    const before = ctx.run.equipment.ammo!.qty;
    ctx.run.pendingLoot = { items: [{ id: 'bronze_arrows', qty: 12 }], coins: 0, source: 'test' };
    ctx.run.phase = 'loot';
    takeAllLoot(ctx);
    expect(ctx.run.equipment.ammo!.qty).toBe(before + 12);
    expect(countItem(ctx.run, 'bronze_arrows')).toBe(0);
  });
});

describe('autoplayed runs never get stuck', () => {
  for (const focus of ['melee', 'ranged', 'magic'] as const) {
    it(`${focus}: 40 seeded runs at mixed levels finish cleanly`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const level = [1, 10, 25, 45, 60][seed % 5];
        const ch = makeCharacter(focus, {
          level,
          skills: level >= 25 ? { prayer: 10, hitpoints: 6, agility: 10, thieving: 6, slayer: 10, sailing: 10, fishing: 3, mining: 10, hunter: 10 } : {},
          hub: level >= 25 ? { vault: 3, chapel: 4, portal: 1, workshop: 2 } : {},
        });
        ch.route = seed % 3 === 0 ? 'volcanic' : 'main';
        const ctx = makeRun(ch, seed * 7919);
        const res = botPlayRun(ctx, DEFAULT_BOT, seed);
        expect(['death', 'retreat', 'clear']).toContain(res.outcome);
        expect(res.xpEarned).toBeGreaterThanOrEqual(0);
        expect(ch.activeRun).toBeNull();
        for (const id of res.newCollection) expect(C.hasItem(id)).toBe(true);
      }
    });
  }
});
