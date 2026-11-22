/**
 * Registry of behaviour flags the engine understands. Content validation fails if a
 * content file uses a flag that is not listed here, and the Skills screen marks any
 * perk whose flag is not implemented yet.
 */
import type { FlagId } from '../content/types';

export const FLAG_STATUS: Record<FlagId, { implemented: boolean; where: string }> = {
  unlockProtectMagic: { implemented: true, where: 'core/combat/engine.ts (prayer unlocks)' },
  unlockProtectRanged: { implemented: true, where: 'core/combat/engine.ts (prayer unlocks)' },
  unlockProtectMelee: { implemented: true, where: 'core/combat/engine.ts (prayer unlocks)' },
  chooseSlayerTask: { implemented: true, where: 'core/rooms.ts (slayer offers)' },
  superiorSlayer: { implemented: true, where: 'core/encounters.ts (superior spawns)' },
  slayerBossTask: { implemented: true, where: 'core/rooms.ts + core/loot.ts' },
  openLockedChests: { implemented: true, where: 'core/rooms.ts (chests)' },
  disarmTraps: { implemented: true, where: 'core/rooms.ts (chests)' },
  pickpocket: { implemented: true, where: 'core/rooms.ts (trader)' },
  spellbookSwitch: { implemented: true, where: 'core/rooms.ts (rest altar)' },
  potionMix: { implemented: true, where: 'core/rooms.ts (rest altar)' },
  feast: { implemented: true, where: 'core/rooms.ts (rest altar)' },
  brazier: { implemented: true, where: 'core/rooms.ts (rest altar)' },
  brazierBuff: { implemented: true, where: 'core/rooms.ts (rest altar)' },
  smithUpgrade: { implemented: true, where: 'core/rooms.ts (rest altar)' },
  jewelleryRecharge: { implemented: true, where: 'core/rooms.ts (rest altar)' },
  harvestTwiceMining: { implemented: true, where: 'core/rooms.ts (gather)' },
  harvestTwiceFishing: { implemented: true, where: 'core/rooms.ts (gather)' },
  harvestTwiceFarming: { implemented: true, where: 'core/rooms.ts (gather)' },
  harvestTwiceWoodcutting: { implemented: true, where: 'core/rooms.ts (gather)' },
  hunterClueRoll: { implemented: true, where: 'core/rooms.ts (gather)' },
  miningBonusRoll: { implemented: true, where: 'core/rooms.ts (gather)' },
  pohWorkshop: { implemented: true, where: 'core/hub.ts (build requirements)' },
  pohPortal: { implemented: true, where: 'core/hub.ts (build requirements)' },
  pohChapelAltar: { implemented: true, where: 'core/hub.ts (build requirements)' },
  seaRouteChoice: { implemented: true, where: 'core/rooms.ts (sea route)' },
  altSeaRoute: { implemented: true, where: 'core/run.ts (map travel)' },
  prayerBoons: { implemented: true, where: 'core/run.ts (boon offers)' },
  foodOverTime: { implemented: true, where: 'core/combat/engine.ts (eating)' },
};
