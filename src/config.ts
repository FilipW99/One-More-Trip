/**
 * Tuning numbers. Values marked "design doc" come straight from meta-progression.md;
 * the rest are first-pass tuning for this build (see docs/DECISIONS.md).
 */
export const CONFIG = {
  /** Game tick in ms. Design doc §3.2: 0.6 s reference tick. */
  TICK_MS: 600,
  /** Design doc §3.2: 28 inventory slots. */
  INVENTORY_SIZE: 28,
  /** Design doc §2. */
  CHARACTER_SLOTS: 3,
  NAME_MAX_LENGTH: 12,

  /** Design doc §4.2 and §8.1: XP from L to L+1 = round(60 x 1.075^(L-1)), cap 60. */
  MAX_LEVEL: 60,
  XP_BASE: 60,
  XP_GROWTH: 1.075,
  /** Design doc §4.1: 1 point per level, +1 extra every 10th level. */
  BONUS_POINT_EVERY: 10,
  /** Design doc §4.1: respec free once, then 100 x respecs, capped at 1,000. */
  RESPEC_COST_STEP: 100,
  RESPEC_COST_CAP: 1000,

  /** Design doc §6: upgrade cost = base x 2.5^(tier-1). */
  HUB_COST_GROWTH: 2.5,

  /** Design doc §2: about 80% of weapon drops follow the combat focus. */
  FOCUS_WEAPON_SHARE: 0.8,
  /** Design doc §5.1 drop chances (roguelike tuning). */
  DROP_CHANCE_NORMAL: 0.08,
  DROP_ROLLS_ELITE: 1,
  CHEST_ITEM_CHANCE: 0.5,
  /** Optional unique pity (design doc §5.3, open question 3): +2 percentage points per dry kill. */
  PITY_ENABLED: true,
  PITY_PER_KILL: 0.02,

  /** Design doc §3.3 end-of-run rules. */
  OUTCOMES: {
    death: { xp: 1, coins: 0 },
    retreat: { xp: 1, coins: 0.25 },
    clear: { xp: 1.2, coins: 0.5 },
  },

  /** Omens: each challenge point adds this much to XP and banked coins. */
  OMEN_REWARD_PER_POINT: 0.005,
  /** Omens: each challenge point adds this much unique chance (fraction of a percent). */
  OMEN_UNIQUE_PER_POINT: 0.0005,

  /** In-run Boon thresholds (run XP). */
  BOON_THRESHOLDS: [100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700],
  BOON_CHOICES: 3,

  BASE_RELIC_SLOTS: 1,

  PLAYER: {
    baseHp: 50,
    hpPerLevel: 1,
    basePrayer: 10,
    prayerPerLevel: 0.5,
    /** Effective combat level = offset + character level. */
    levelOffset: 20,
  },

  SPEC: { max: 100, regenEveryTicks: 50, regenAmount: 10 },
  RUN_ENERGY: { max: 100, drainPerRunTick: 1.2, regenPerTick: 0.35 },
  /** Ticks added to the attack timer when eating food. */
  EAT_DELAY: 3,
  /** Base share of fired arrows/bolts recovered after a room (Fletching adds 4% per rank). */
  AMMO_BASE_RECOVERY: 50,
  /** Chance that a kill drops a few of the arrows/bolts you are using (doubled for elites and bosses). */
  AMMO_DROP: { chance: 0.7, min: 6, max: 14 },
  /** Rest altar heal, percent of max HP. */
  REST_HEAL_PCT: 35,
  BRAZIER_HEAL_PCT: 20,

  SLAYER: { killsMin: 3, killsMax: 5, basePoints: 10, pointsPerDepth: 5, coins: 25, superiorChance: 0.12 },

  /** Trader: sell price as a share of value. */
  SELL_RATE: 0.4,
  PORT_DISCOUNT: 0.25,

  /** Combat: projectile travel = 1 + floor(distance / 3) ticks. */
  PROJECTILE_TILES_PER_TICK: 3,
  /** Healer monsters heal this much every few ticks. */
  HEALER_AMOUNT: 4,
  HEALER_EVERY: 4,
} as const;

export type Config = typeof CONFIG;
