/** Human-readable text for content records (tooltips, labels). */
import { C } from '../content';
import type { ItemDef, Placeholder, StyleTriple } from '../content/types';
import type { RoomType } from '../core/state';

export const ROOM_INFO: Record<RoomType, { label: string; glyph: string; color: string; hint: string }> = {
  combat: { label: 'Combat', glyph: '⚔', color: '#b84a3a', hint: 'A fight with a few monsters.' },
  elite: { label: 'Elite', glyph: '☠', color: '#8e44ad', hint: 'A tough monster with better drops.' },
  rest: { label: 'Rest altar', glyph: '✚', color: '#3a9a5a', hint: 'Heal, restore Prayer, and use skill perks.' },
  slayer: { label: 'Slayer master', glyph: '⚑', color: '#7f8c8d', hint: 'Take a Slayer task for bonus points.' },
  trader: { label: 'Trader', glyph: '$', color: '#c9a227', hint: 'Buy supplies and sell loot.' },
  chest: { label: 'Chest', glyph: '▣', color: '#a0743c', hint: 'Might be locked or trapped.' },
  gather: { label: 'Gathering', glyph: '⛏', color: '#4a8a9a', hint: 'Harvest supplies with a gathering skill.' },
  sea: { label: 'Sea route', glyph: '⚓', color: '#2e6ea6', hint: 'Sail across dark water.' },
  boss: { label: 'Boss', glyph: '♛', color: '#d35400', hint: 'The act boss.' },
};

export const SLOT_LABELS: Record<string, string> = {
  head: 'Head',
  cape: 'Cape',
  neck: 'Neck',
  ammo: 'Ammo',
  weapon: 'Weapon',
  body: 'Body',
  shield: 'Shield',
  legs: 'Legs',
  hands: 'Hands',
  feet: 'Feet',
  ring: 'Ring',
};

function triText(label: string, t: Partial<StyleTriple> | undefined): string | null {
  if (!t) return null;
  const parts = (['melee', 'ranged', 'magic'] as const)
    .filter((k) => t[k])
    .map((k) => `${k[0].toUpperCase()}${k.slice(1)} ${t[k]! > 0 ? '+' : ''}${t[k]}`);
  return parts.length ? `${label}: ${parts.join(', ')}` : null;
}

export function itemStatLines(def: ItemDef): string[] {
  const lines: string[] = [];
  if (def.weapon) {
    const w = def.weapon;
    lines.push(`${w.style[0].toUpperCase()}${w.style.slice(1)} weapon · speed ${w.speed} ticks · range ${w.range}${w.twoHanded ? ' · two-handed' : ''}`);
    if (w.ammo) lines.push(`Uses ${w.ammo === 'thrown' ? 'itself as ammunition' : `${w.ammo}s`}`);
    if (w.poweredMaxHit) lines.push(`Built-in spell, max hit ${w.poweredMaxHit}`);
    if (w.special) lines.push(`Special (${w.special.cost}%): ${w.special.name}. ${w.special.description}`);
  }
  const a = triText('Attack', def.attack);
  const s = triText('Strength', def.strength);
  const d = triText('Defence', def.defence);
  if (a) lines.push(a);
  if (s) lines.push(s);
  if (d) lines.push(d);
  if (def.prayer) lines.push(`Prayer +${def.prayer}`);
  if (def.heal) lines.push(`Heals ${def.heal}`);
  if (def.potion) {
    const p = def.potion;
    const text: Record<typeof p.effect, string> = {
      prayer: `Restores ${p.amount} Prayer`,
      restore: `Restores ${p.amount} Prayer and lowered stats`,
      heal: `Heals ${p.amount}`,
      stamina: `Restores ${p.amount}% run energy`,
      combat: 'Boosts accuracy and damage for the current room',
    };
    lines.push(text[p.effect]);
  }
  if (def.teaches) lines.push(`Read to learn ${C.spell(def.teaches).name} for this trip`);
  if (def.charges) lines.push(`Charged: lasts ${def.charges} rooms, then needs recharging`);
  if (def.req?.level && def.req.level > 1) lines.push(`Requires character level ${def.req.level}`);
  if (def.req?.skills) for (const [k, v] of Object.entries(def.req.skills)) lines.push(`Requires ${C.skill(k as never).name} rank ${v}`);
  lines.push(`Value ${def.value}`);
  return lines;
}

export function phText(p: Placeholder): string {
  return `Placeholder for: ${p.slot} (design doc ${p.plan})`;
}

export function styleName(s: string): string {
  return s === 'typeless' ? 'Typeless' : `${s[0].toUpperCase()}${s.slice(1)}`;
}
