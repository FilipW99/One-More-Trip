/** Character XP curve, skill points, respec and hub costs (design doc §4, §6, §8). */
import { CONFIG } from '../config';

/** Round half to even, which is how the design doc's XP table was computed (64.5 -> 64). */
function roundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (Math.abs(diff - 0.5) < 1e-9) return floor % 2 === 0 ? floor : floor + 1;
  return Math.round(x);
}

/** XP needed to go from level L to L+1: round(60 x 1.075^(L-1)). */
export function xpToNext(level: number): number {
  return roundHalfEven(CONFIG.XP_BASE * Math.pow(CONFIG.XP_GROWTH, level - 1));
}

const TOTALS: number[] = (() => {
  const totals = [0, 0]; // index = level; totals[1] = 0
  for (let l = 1; l < CONFIG.MAX_LEVEL; l++) totals.push(totals[l] + xpToNext(l));
  return totals;
})();

/** Total XP required to reach a level. */
export function totalXpForLevel(level: number): number {
  const l = Math.max(1, Math.min(CONFIG.MAX_LEVEL, Math.floor(level)));
  return TOTALS[l];
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < CONFIG.MAX_LEVEL && xp >= TOTALS[level + 1]) level++;
  return level;
}

/** Progress through the current level, 0-1 (1 at max level). */
export function levelProgress(xp: number): number {
  const level = levelForXp(xp);
  if (level >= CONFIG.MAX_LEVEL) return 1;
  const start = TOTALS[level];
  return (xp - start) / (TOTALS[level + 1] - start);
}

/** Skill points earned by a level: 1 per level gained, +1 every 10th level. */
export function skillPointsForLevel(level: number): number {
  return level - 1 + Math.floor(level / CONFIG.BONUS_POINT_EVERY);
}

/** Cost of the next respec given how many respecs were already made. First is free. */
export function respecCost(respecsDone: number): number {
  return Math.min(CONFIG.RESPEC_COST_CAP, CONFIG.RESPEC_COST_STEP * respecsDone);
}

/** Hub feature cost: base x 2.5^(tier-1), adjusted by Construction (pohCost is a negative percent). */
export function hubCost(baseCost: number, tier: number, pohCostPct = 0): number {
  const raw = baseCost * Math.pow(CONFIG.HUB_COST_GROWTH, tier - 1);
  return Math.max(1, Math.round(raw * (1 + pohCostPct / 100)));
}
