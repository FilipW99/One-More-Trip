/** Character side panel (orbs + inventory/equipment/prayer/magic/stats tabs), used on the map and in combat. */
import { CONFIG } from '../config';
import { C } from '../content';
import { EQUIP_SLOTS, type EquipSlot } from '../content/types';
import { setSpell, toggleRun, toggleSpecial, togglePrayer, unequipSlot, useItem, type Encounter } from '../core/combat/engine';
import { removeAt } from '../core/inventory';
import { mod, runMods } from '../core/mods';
import { openCasket } from '../core/rooms';
import { log, type RunCtx } from '../core/run';
import { characterLevel } from '../core/save';
import { attackProfile, availablePrayers, defenceRolls, knownSpells, maxHp, maxPrayer, prayerDrainPerTick } from '../core/stats';
import { glyphIcon } from '../render/placeholders';
import type { App } from './app';
import { h, type Child } from './dom';
import { SLOT_LABELS } from './text';
import { button, itemSlot, named, orb, phBadge, withTip } from './widgets';

export type SideTab = 'inventory' | 'equipment' | 'prayer' | 'magic' | 'stats';

export interface SideOpts {
  app: App;
  ctx: RunCtx;
  enc: Encounter | null;
  tab: SideTab;
  setTab: (t: SideTab) => void;
  /** Called after any state change so the owner can re-render. */
  changed: () => void;
  /** Optional override for inventory clicks (e.g. selling at a trader). Return true if handled. */
  inventoryClick?: (slot: number) => boolean;
  inventoryHint?: string;
}

export function orbs(o: SideOpts): HTMLElement {
  const { ctx, enc } = o;
  const { run, ch } = ctx;
  const level = characterLevel(ch);
  const m = runMods(ch, run);
  const profile = attackProfile(run, level, m);
  const specLabel = profile.special ? `Special: ${profile.special.name} (${profile.special.cost}%). ${profile.special.description}` : mod(m, 'empoweredStrikes') > 0 ? 'Empowered strike (Strength perk)' : 'Your weapon has no special attack';
  return h(
    'div',
    { class: 'orbs' },
    orb('HP', run.hp, maxHp(level, m), 'var(--hp)', { id: 'hp', title: `Hitpoints ${run.hp}/${maxHp(level, m)}` }),
    orb('Prayer', run.prayer, maxPrayer(level, m), 'var(--prayer)', { id: 'prayer', title: `Prayer ${Math.floor(run.prayer)}/${maxPrayer(level, m)}${run.activePrayers.length ? ` · draining ${(prayerDrainPerTick(run, m) * 100 / 1).toFixed(0)}/100 per tick` : ''}` }),
    orb('Run', run.runEnergy, CONFIG.RUN_ENERGY.max, 'var(--run)', {
      id: 'run',
      active: run.running,
      title: 'Run energy (R). Running moves 2 tiles per tick.',
      onClick: enc ? () => {
        toggleRun(enc);
        o.changed();
      } : undefined,
    }),
    orb('Spec', run.spec, CONFIG.SPEC.max, 'var(--spec)', {
      id: 'spec',
      active: Boolean(enc?.player.specArmed || enc?.player.empowerArmed),
      title: `${specLabel} (S)`,
      onClick: enc ? () => {
        o.app.check(toggleSpecial(enc));
        o.changed();
      } : undefined,
    }),
  );
}

export function sideTabs(o: SideOpts): HTMLElement {
  const tabs: { id: SideTab; label: string; glyph: string }[] = [
    { id: 'inventory', label: 'Inventory', glyph: '▤' },
    { id: 'equipment', label: 'Equipment', glyph: '⛨' },
    { id: 'prayer', label: 'Prayer', glyph: '✚' },
    { id: 'magic', label: 'Magic', glyph: '✦' },
    { id: 'stats', label: 'Stats', glyph: '≡' },
  ];
  return h(
    'div',
    { class: 'side-tabs', role: 'tablist' },
    tabs.map((t) => h('button', { class: `side-tab ${o.tab === t.id ? 'active' : ''}`, title: t.label, 'data-side': t.id, onClick: () => o.setTab(t.id) }, t.glyph)),
  );
}

export function sideBody(o: SideOpts): HTMLElement {
  switch (o.tab) {
    case 'inventory':
      return inventoryView(o);
    case 'equipment':
      return equipmentView(o);
    case 'prayer':
      return prayerView(o);
    case 'magic':
      return magicView(o);
    case 'stats':
      return statsView(o);
  }
}

/** Something that changes whenever the side body needs rebuilding (cheap check per tick). */
export function sideSignature(o: SideOpts): string {
  const { run } = o.ctx;
  return JSON.stringify([o.tab, run.inventory, run.equipment, run.activePrayers, run.activeSpell, run.prayer > 0, run.spellbook, run.boons, run.slayerTask?.have, o.inventoryHint]);
}

/* ------------------------------------------------------------------ */

function useInventory(o: SideOpts, slot: number): void {
  const { ctx, enc, app } = o;
  const { run, ch } = ctx;
  if (o.inventoryClick?.(slot)) return o.changed();
  const stack = run.inventory[slot];
  if (!stack) return;
  const def = C.item(stack.id);
  if (def.kind === 'casket') {
    if (enc) return app.toast('Open it after the fight.', 'bad');
    app.check(openCasket(ctx, slot));
    return o.changed();
  }
  const msg = useItem(enc, run, ch, characterLevel(ch), slot);
  if (msg) {
    if (def.slot) app.toast(msg, 'bad');
    else if (def.kind === 'misc' || def.kind === 'resource') log(run, msg, 'info');
    else if (!enc) log(run, msg, 'info');
    else enc.events.push({ t: 'msg', text: msg, kind: 'info' });
  }
  o.changed();
}

function inventoryMenu(o: SideOpts, slot: number, e: MouseEvent): void {
  const { run } = o.ctx;
  const stack = run.inventory[slot];
  if (!stack) return;
  const def = C.item(stack.id);
  const verb = def.kind === 'food' ? 'Eat' : def.kind === 'potion' ? 'Drink' : def.kind === 'tome' ? 'Read' : def.kind === 'casket' ? 'Open' : def.slot ? 'Equip' : null;
  const menu = h(
    'div',
    { class: 'context-menu', style: { left: `${e.clientX}px`, top: `${e.clientY}px` } },
    h('div', { class: 'menu-title' }, def.name),
    verb ? h('button', { onClick: () => { close(); useInventory(o, slot); } }, verb) : null,
    h('button', {
      onClick: () => {
        close();
        removeAt(run, slot);
        log(run, `You drop the ${def.name.toLowerCase()}.`, 'info');
        o.changed();
      },
    }, 'Drop'),
    h('button', { onClick: () => { close(); log(run, def.examine, 'info'); o.changed(); } }, 'Examine'),
    h('button', { onClick: () => close() }, 'Cancel'),
  );
  const close = () => {
    menu.remove();
    document.removeEventListener('mousedown', outside, true);
  };
  const outside = (ev: MouseEvent) => {
    if (!menu.contains(ev.target as Node)) close();
  };
  document.addEventListener('mousedown', outside, true);
  document.body.appendChild(menu);
}

function inventoryView(o: SideOpts): HTMLElement {
  const { run } = o.ctx;
  return h(
    'div',
    { class: 'inventory-grid', 'data-panel': 'inventory' },
    run.inventory.map((s, i) =>
      s
        ? itemSlot(s, {
            onClick: () => useInventory(o, i),
            onContext: (e) => inventoryMenu(o, i, e),
            hint: o.inventoryHint ?? 'Click to use. Right-click for more options.',
          })
        : itemSlot(null),
    ),
  );
}

function equipmentView(o: SideOpts): HTMLElement {
  const { run } = o.ctx;
  const layout: (EquipSlot | null)[] = ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring', null];
  void EQUIP_SLOTS;
  return h(
    'div',
    { class: 'equipment-grid', 'data-panel': 'equipment' },
    layout.map((slot) =>
      slot === null
        ? h('div', { class: 'slot-spacer' })
        : h(
            'div',
            { class: 'equip-cell', 'data-slot': slot },
            itemSlot(run.equipment[slot] ?? null, {
              empty: SLOT_LABELS[slot],
              hint: 'Click to remove.',
              onClick: () => {
                o.app.check(unequipSlot(o.enc, run, slot));
                o.changed();
              },
            }),
          ),
    ),
  );
}

function prayerView(o: SideOpts): HTMLElement {
  const { ctx, enc } = o;
  const { run, ch } = ctx;
  const m = runMods(ch, run);
  const avail = availablePrayers(m);
  return h(
    'div',
    { class: 'prayer-list', 'data-panel': 'prayer' },
    !enc ? h('p', { class: 'dim small' }, 'Prayers can only be used during fights. They switch off when a room ends.') : null,
    C.prayers.map((p) => {
      const unlocked = avail.includes(p.id);
      const on = run.activePrayers.includes(p.id);
      const lockText = p.unlockFlag
        ? (() => {
            const skill = C.skills.find((s) => s.perks.some((k) => k.effects.some((e) => 'flag' in e && e.flag === p.unlockFlag)));
            const perk = skill?.perks.find((k) => k.effects.some((e) => 'flag' in e && e.flag === p.unlockFlag));
            return skill && perk ? `Unlocks at ${skill.name} rank ${perk.rank}.` : 'Locked.';
          })()
        : '';
      return withTip(
        h(
          'button',
          {
            class: `prayer ${on ? 'on' : ''} ${unlocked ? '' : 'locked'}`,
            disabled: !unlocked || !enc,
            'data-prayer': p.id,
            onClick: () => {
              if (!enc) return;
              o.app.check(togglePrayer(enc, p.id));
              o.changed();
            },
          },
          h('img', { src: glyphIcon(`prayer:${p.id}`, p.protects ? p.protects[0].toUpperCase() : p.name[0], p.protects ? '#e8e0a0' : '#a0c8e8'), alt: '' }),
          h('span', { class: 'prayer-name' }, p.name),
          p.key ? h('kbd', null, p.key) : null,
        ),
        () => [h('div', { class: 'tip-title' }, p.name, phBadge(p.ph)), h('div', null, p.description), h('div', { class: 'tip-dim' }, `Drain ${p.drain} per tick`), unlocked ? null : h('div', { class: 'blocked' }, lockText)],
      );
    }),
  );
}

function magicView(o: SideOpts): HTMLElement {
  const { ctx } = o;
  const { run, ch } = ctx;
  const level = characterLevel(ch);
  const known = knownSpells(run, level);
  const book = C.spellbook(run.spellbook);
  const runeCount = (id: string) => run.inventory.reduce((n, s) => n + (s?.id === id ? s.qty : 0), 0);
  return h(
    'div',
    { class: 'spell-list', 'data-panel': 'magic' },
    h('div', { class: 'spellbook-name' }, named(book.name, book.ph)),
    C.spells
      .filter((s) => s.book === run.spellbook)
      .map((s) => {
        const ok = known.some((k) => k.id === s.id);
        const active = run.activeSpell === s.id;
        const runes = Object.entries(s.runes).map(([id, n]) => `${n} ${C.item(id).name} (${runeCount(id)})`).join(', ');
        return withTip(
          h(
            'button',
            {
              class: `spell ${active ? 'on' : ''} ${ok ? '' : 'locked'}`,
              disabled: !ok,
              'data-spell': s.id,
              onClick: () => {
                o.app.check(setSpell(run, level, s.id));
                o.changed();
              },
            },
            h('span', { class: 'spell-name' }, s.name),
            h('span', { class: 'spell-hit' }, `max ${s.maxHit}`),
          ),
          () => [
            h('div', { class: 'tip-title' }, s.name, phBadge(s.ph)),
            h('div', null, `Max hit ${s.maxHit}${s.effect ? ` · ${s.effect}` : ''}`),
            h('div', null, `Runes: ${runes}`),
            ok ? h('div', { class: 'tip-hint' }, active ? 'Selected for casting.' : 'Click to cast this spell when attacking with Magic.') : h('div', { class: 'blocked' }, `Needs level ${s.minLevel} (or a tome).`),
          ],
        );
      }),
    h('p', { class: 'dim small' }, 'The selected spell is used whenever you attack with a magic weapon that has no built-in spell.'),
  );
}

function statsView(o: SideOpts): HTMLElement {
  const { ctx } = o;
  const { run, ch } = ctx;
  const level = characterLevel(ch);
  const m = runMods(ch, run);
  const p = attackProfile(run, level, m);
  const d = defenceRolls(run, level, m);
  const row = (k: string, v: Child) => h('div', { class: 'kv' }, h('span', null, k), h('span', null, v));
  const task = run.slayerTask;
  return h(
    'div',
    { class: 'stats-view', 'data-panel': 'stats' },
    h('h4', null, 'Attack'),
    row('Style', `${p.style}${p.spell ? ` (${p.spell.name})` : ''}`),
    row('Max hit', String(p.maxHit)),
    row('Accuracy', String(Math.round(p.accuracyRoll))),
    row('Speed', `${p.speed} ticks`),
    row('Range', String(p.range)),
    p.blocked ? h('div', { class: 'blocked' }, p.blocked) : null,
    h('h4', null, 'Defence'),
    row('vs Melee', String(Math.round(d.melee))),
    row('vs Ranged', String(Math.round(d.ranged))),
    row('vs Magic', String(Math.round(d.magic))),
    h('h4', null, C.terms.boons),
    Object.keys(run.boons).length
      ? h('ul', { class: 'plain-list small' }, Object.entries(run.boons).map(([id, n]) => withTip(h('li', null, `${C.boon(id).name}${n > 1 ? ` x${n}` : ''}`), () => [h('div', { class: 'tip-title' }, C.boon(id).name), h('div', null, C.boon(id).description)])))
      : h('p', { class: 'dim small' }, 'None yet. Kill monsters to earn them.'),
    h('h4', null, 'Slayer task'),
    task ? h('p', { class: 'small' }, `${task.label}: ${task.have}/${task.need}${task.done ? ' (done)' : ''}`) : h('p', { class: 'dim small' }, 'No task.'),
    run.relics.length ? [h('h4', null, C.terms.relics), h('p', { class: 'small' }, run.relics.map((r) => C.relic(r).name).join(', '))] : null,
    run.omens.length ? [h('h4', null, C.terms.omens), h('p', { class: 'small' }, run.omens.map((r) => C.omen(r).name).join(', '))] : null,
    run.buffs.mixed.length || run.buffs.feast || run.buffs.brazier || run.buffs.combatDraught
      ? [h('h4', null, 'Next room'), h('p', { class: 'small' }, [run.buffs.feast && 'Feast', run.buffs.brazier && 'Brazier', run.buffs.combatDraught && 'Combat draught', ...run.buffs.mixed.map((id) => C.item(id).name)].filter(Boolean).join(', '))]
      : null,
    button('Inventory', () => o.setTab('inventory'), { cls: 'small subtle' }),
  );
}
