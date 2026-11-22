/**
 * PLACEHOLDER CONTENT: player-facing names for systems.
 * The design doc names several systems after their source-game equivalents; these
 * generic terms stand in until licensed names are dropped in. Change a value here
 * and every screen picks it up.
 */
import type { Terms } from './types';
import { ph } from './placeholder';

export const TERMS: Terms = {
  gameTitle: 'One More Trip',
  hubName: 'Homestead',
  leaguePoints: 'Renown',
  relics: 'Relics',
  omens: 'Omens',
  collectionLog: 'Collection Log',
  vault: 'Vault',
  coins: 'Coins',
  slayerPoints: 'Slayer points',
  boons: 'Boons',
};

/** Which terms stand in for named content in the design doc. */
export const TERMS_PLACEHOLDERS: Partial<Record<keyof Terms, ReturnType<typeof ph>>> = {
  hubName: ph('§6', 'Player-owned house (the hub)'),
  leaguePoints: ph('§7.1', 'League points'),
  relics: ph('§7.1', 'League relics (system name)'),
  omens: ph('§7.2', 'Raid invocations (system name)'),
};
