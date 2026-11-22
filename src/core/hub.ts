/** Hub (design doc §6) and between-run character management. */
import { CONFIG } from '../config';
import { C } from '../content';
import type { SkillId } from '../content/types';
import { characterMods, mod } from './mods';
import { hubCost, respecCost } from './progression';
import { emptySkills, unspentPoints } from './save';
import type { CharacterSave } from './state';
import { availableRoutes, maxStartAct, relicSlots } from './run';

export interface UpgradeInfo {
  featureId: string;
  currentTier: number;
  maxTier: number;
  nextTier: number | null;
  cost: number | null;
  /** Why the next tier can't be built, if it can't. */
  blocked: string | null;
}

export function upgradeInfo(ch: CharacterSave, featureId: string): UpgradeInfo {
  const f = C.feature(featureId);
  const current = ch.hub[featureId] ?? f.startTier;
  const max = f.tiers.length;
  if (current >= max) return { featureId, currentTier: current, maxTier: max, nextTier: null, cost: null, blocked: 'Fully built.' };
  const next = current + 1;
  const m = characterMods(ch);
  const cost = hubCost(f.baseCost, next, mod(m, 'pohCost'));
  const tier = f.tiers[next - 1];
  let blocked: string | null = null;
  if (tier.requiresFlag && !m.flags.has(tier.requiresFlag)) {
    const skill = C.skills.find((s) => s.perks.some((p) => p.effects.some((e) => 'flag' in e && e.flag === tier.requiresFlag)));
    const perk = skill?.perks.find((p) => p.effects.some((e) => 'flag' in e && e.flag === tier.requiresFlag));
    blocked = skill && perk ? `Needs ${skill.name} rank ${perk.rank}.` : 'Locked.';
  } else if (ch.coins < cost) blocked = `Needs ${cost} ${C.terms.coins}.`;
  return { featureId, currentTier: current, maxTier: max, nextTier: next, cost, blocked };
}

export function buildUpgrade(ch: CharacterSave, featureId: string): string | null {
  const info = upgradeInfo(ch, featureId);
  if (info.blocked || info.cost === null || info.nextTier === null) return info.blocked ?? 'Cannot build.';
  ch.coins -= info.cost;
  ch.hub[featureId] = info.nextTier;
  return null;
}

export function canRaiseSkill(ch: CharacterSave, skill: SkillId): boolean {
  return unspentPoints(ch) > 0 && (ch.skills[skill] ?? 0) < 10;
}

export function raiseSkill(ch: CharacterSave, skill: SkillId): string | null {
  if (!canRaiseSkill(ch, skill)) return unspentPoints(ch) <= 0 ? 'No skill points to spend.' : 'That skill is maxed.';
  ch.skills[skill] = (ch.skills[skill] ?? 0) + 1;
  return null;
}

export function nextRespecCost(ch: CharacterSave): number {
  return respecCost(ch.respecs);
}

export function respec(ch: CharacterSave): string | null {
  if ((ch.hub.study ?? 0) < 1) return 'Build the Study first.';
  const cost = nextRespecCost(ch);
  if (ch.coins < cost) return `Respec costs ${cost} ${C.terms.coins}.`;
  ch.coins -= cost;
  ch.respecs++;
  ch.skills = emptySkills();
  ch.relicsEquipped = ch.relicsEquipped.slice(0, relicSlots(ch));
  return null;
}

export function unlockRelic(ch: CharacterSave, id: string): string | null {
  const relic = C.relic(id);
  if (ch.relicsUnlocked.includes(id)) return null;
  if (ch.leaguePoints < relic.cost) return `Needs ${relic.cost} ${C.terms.leaguePoints}.`;
  ch.leaguePoints -= relic.cost;
  ch.relicsUnlocked.push(id);
  return null;
}

export function toggleRelic(ch: CharacterSave, id: string): string | null {
  if (!ch.relicsUnlocked.includes(id)) return 'Unlock it first.';
  if (ch.relicsEquipped.includes(id)) {
    ch.relicsEquipped = ch.relicsEquipped.filter((r) => r !== id);
    return null;
  }
  const slots = relicSlots(ch);
  if (ch.relicsEquipped.length >= slots) {
    if (slots === 1) ch.relicsEquipped = [id];
    else return `You only have ${slots} relic slots.`;
    return null;
  }
  ch.relicsEquipped.push(id);
  return null;
}

export function toggleOmen(ch: CharacterSave, id: string): void {
  C.omen(id);
  ch.omensSelected = ch.omensSelected.includes(id) ? ch.omensSelected.filter((o) => o !== id) : [...ch.omensSelected, id];
}

export function buySlayerUnlock(ch: CharacterSave, id: string): string | null {
  const u = C.slayerUnlock(id);
  if (ch.slayerUnlocks.includes(id)) return null;
  if (ch.slayerPoints < u.cost) return `Needs ${u.cost} ${C.terms.slayerPoints}.`;
  ch.slayerPoints -= u.cost;
  ch.slayerUnlocks.push(id);
  return null;
}

export function setActivePet(ch: CharacterSave, id: string | null): string | null {
  if (id && (ch.hub.menagerie ?? 0) < 1) return 'Build the Menagerie to bring a pet along.';
  if (id && !ch.pets.includes(id)) return 'You have not found that pet yet.';
  ch.activePet = id;
  return null;
}

export function setRoute(ch: CharacterSave, routeId: string): void {
  if (availableRoutes(ch).some((r) => r.id === routeId)) ch.route = routeId;
}

export function setStartAct(ch: CharacterSave, act: number): void {
  ch.startAct = Math.max(0, Math.min(maxStartAct(ch), act));
}

export function setSpellbook(ch: CharacterSave, book: string): void {
  if (C.spellbooks.some((b) => b.id === book)) ch.spellbook = book;
}

export const MAX_OMEN_POINTS = () => C.omens.reduce((s, o) => s + o.points, 0);
export const REWARD_PER_OMEN_POINT = CONFIG.OMEN_REWARD_PER_POINT;
