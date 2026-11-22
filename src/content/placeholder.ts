import type { Placeholder } from './types';

/**
 * Tag a content record as a stand-in for content named in the design doc.
 *
 *   ph('§3.1', 'Act 1 boss')
 *
 * `npm run placeholders` collects every tagged record into docs/PLACEHOLDERS.md,
 * and the in-game "Show placeholder tags" setting marks them with a PH badge.
 */
export function ph(plan: string, slot: string): Placeholder {
  return { plan, slot };
}
