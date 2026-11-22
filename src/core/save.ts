/** Save file: creation, validation, persistence and migration. */
import { CONFIG } from '../config';
import { C } from '../content';
import { SKILL_IDS, type Focus, type SkillId } from '../content/types';
import { levelForXp, skillPointsForLevel } from './progression';
import type { CharacterSave, SaveFile, Settings } from './state';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'one-more-trip.save';

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** In-memory storage for tests and for browsers without localStorage. */
export class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

export function defaultSettings(): Settings {
  return { showPlaceholderTags: true, autoRetaliate: true, tickMs: 0 };
}

export function newSave(): SaveFile {
  return {
    version: SAVE_VERSION,
    characters: Array.from({ length: CONFIG.CHARACTER_SLOTS }, () => null),
    settings: defaultSettings(),
  };
}

export function emptySkills(): Record<SkillId, number> {
  return Object.fromEntries(SKILL_IDS.map((id) => [id, 0])) as Record<SkillId, number>;
}

export function validateName(save: SaveFile, name: string, ignoreSlot = -1): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Pick a name.';
  if (trimmed.length > CONFIG.NAME_MAX_LENGTH) return `Names can be at most ${CONFIG.NAME_MAX_LENGTH} characters.`;
  if (!/^[A-Za-z0-9 _-]+$/.test(trimmed)) return 'Use letters, numbers, spaces, - or _.';
  const clash = save.characters.some(
    (c, i) => c && i !== ignoreSlot && c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (clash) return 'Another character in this save already has that name.';
  return null;
}

export function createCharacter(name: string, focus: Focus, now = Date.now()): CharacterSave {
  const hub: Record<string, number> = {};
  for (const f of C.hub) hub[f.id] = f.startTier;
  const freeRelics = C.relics.filter((r) => r.cost === 0).map((r) => r.id);
  return {
    id: `c${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: name.trim(),
    focus,
    createdAt: now,
    xp: 0,
    skills: emptySkills(),
    respecs: 0,
    coins: 0,
    slayerPoints: 0,
    leaguePoints: 0,
    hub,
    relicsUnlocked: freeRelics,
    relicsEquipped: [],
    omensSelected: [],
    vault: [],
    collection: {},
    pets: [],
    activePet: null,
    tasksDone: [],
    slayerUnlocks: [],
    bossKills: {},
    pity: {},
    stats: { runs: 0, deaths: 0, retreats: 0, clears: 0, bestDepth: 0, kills: 0 },
    spellbook: C.kit(focus).spellbook ?? C.spellbooks[0].id,
    route: C.routes[0].id,
    startAct: 0,
    activeRun: null,
    lastResult: null,
  };
}

export function characterLevel(ch: CharacterSave): number {
  return levelForXp(ch.xp);
}

export function spentPoints(ch: CharacterSave): number {
  return SKILL_IDS.reduce((sum, id) => sum + (ch.skills[id] ?? 0), 0);
}

export function unspentPoints(ch: CharacterSave): number {
  return skillPointsForLevel(characterLevel(ch)) - spentPoints(ch);
}

/** Fill in fields added after a save was written, and drop references to removed content. */
export function migrate(raw: unknown): SaveFile {
  const save = newSave();
  if (!raw || typeof raw !== 'object') return save;
  const data = raw as Partial<SaveFile>;
  save.settings = { ...defaultSettings(), ...(data.settings ?? {}) };
  const chars = Array.isArray(data.characters) ? data.characters : [];
  for (let i = 0; i < CONFIG.CHARACTER_SLOTS; i++) {
    const c = chars[i];
    if (!c) continue;
    const base = createCharacter(c.name ?? 'Adventurer', c.focus ?? 'melee', c.createdAt ?? Date.now());
    const merged: CharacterSave = { ...base, ...c, skills: { ...base.skills, ...(c.skills ?? {}) }, hub: { ...base.hub, ...(c.hub ?? {}) }, stats: { ...base.stats, ...(c.stats ?? {}) } };
    merged.vault = (merged.vault ?? []).filter((s) => C.hasItem(s.id));
    merged.relicsUnlocked = merged.relicsUnlocked.filter((id) => C.relics.some((r) => r.id === id));
    merged.relicsEquipped = merged.relicsEquipped.filter((id) => merged.relicsUnlocked.includes(id));
    merged.omensSelected = merged.omensSelected.filter((id) => C.omens.some((o) => o.id === id));
    if (merged.activeRun && !isRunCompatible(merged.activeRun)) merged.activeRun = null;
    save.characters[i] = merged;
  }
  return save;
}

function isRunCompatible(run: CharacterSave['activeRun']): boolean {
  if (!run) return false;
  try {
    for (const s of run.inventory) if (s && !C.hasItem(s.id)) return false;
    for (const s of Object.values(run.equipment)) if (s && !C.hasItem(s.id)) return false;
    C.route(run.routeId);
    return true;
  } catch {
    return false;
  }
}

export function loadSave(storage: Storage): SaveFile {
  const text = storage.getItem(SAVE_KEY);
  if (!text) return newSave();
  try {
    return migrate(JSON.parse(text));
  } catch {
    return newSave();
  }
}

export function storeSave(storage: Storage, save: SaveFile): void {
  storage.setItem(SAVE_KEY, JSON.stringify(save));
}
