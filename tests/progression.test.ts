import { describe, expect, it } from 'vitest';
import { hubCost, levelForXp, respecCost, skillPointsForLevel, totalXpForLevel, xpToNext } from '../src/core/progression';

describe('character XP curve (design doc §8.1)', () => {
  it('matches the design doc table', () => {
    const table: [number, number, number | null][] = [
      [2, 60, 64],
      [5, 268, 80],
      [10, 734, 115],
      [20, 2363, 237],
      [30, 5718, 489],
      [40, 12632, 1007],
      [50, 26880, 2076],
      [60, 56246, null],
    ];
    for (const [level, total, next] of table) {
      expect(totalXpForLevel(level)).toBe(total);
      if (next !== null) expect(xpToNext(level)).toBe(next);
    }
  });

  it('maps XP back to levels and caps at 60', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(59)).toBe(1);
    expect(levelForXp(60)).toBe(2);
    expect(levelForXp(56245)).toBe(59);
    expect(levelForXp(56246)).toBe(60);
    expect(levelForXp(10_000_000)).toBe(60);
  });
});

describe('skill points (design doc §4.1-4.2)', () => {
  it('gives 65 points at level 60', () => {
    expect(skillPointsForLevel(1)).toBe(0);
    expect(skillPointsForLevel(2)).toBe(1);
    expect(skillPointsForLevel(10)).toBe(10);
    expect(skillPointsForLevel(60)).toBe(65);
  });
});

describe('respec and hub costs', () => {
  it('first respec is free, then 100 x respecs capped at 1,000', () => {
    expect(respecCost(0)).toBe(0);
    expect(respecCost(1)).toBe(100);
    expect(respecCost(5)).toBe(500);
    expect(respecCost(30)).toBe(1000);
  });

  it('hub cost = base x 2.5^(tier-1), reduced by Construction', () => {
    expect(hubCost(150, 1)).toBe(150);
    expect(hubCost(150, 2)).toBe(375);
    expect(hubCost(150, 3)).toBe(938);
    expect(hubCost(200, 1, -30)).toBe(140);
  });
});
