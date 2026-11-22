/** Reusable UI pieces: tooltips, placeholder badges, item slots, orbs, bars. */
import { C } from '../content';
import type { Placeholder } from '../content/types';
import type { ItemStack } from '../core/state';
import { itemIcon } from '../render/placeholders';
import { h, type Child } from './dom';
import { itemStatLines, phText } from './text';

export const uiPrefs = { showPlaceholderTags: true };

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

let tipEl: HTMLDivElement | null = null;

function tip(): HTMLDivElement {
  if (!tipEl) {
    tipEl = h('div', { class: 'tooltip', role: 'tooltip' });
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

export function hideTip(): void {
  if (tipEl) tipEl.style.display = 'none';
}

/** Show `content()` in a floating tooltip while the pointer is over `el`. */
export function withTip<T extends HTMLElement>(el: T, content: () => Child): T {
  const move = (e: MouseEvent) => {
    const t = tip();
    const pad = 14;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    const r = t.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 4) x = e.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 4) y = e.clientY - r.height - pad;
    t.style.left = `${Math.max(4, x)}px`;
    t.style.top = `${Math.max(4, y)}px`;
  };
  el.addEventListener('mouseenter', (e) => {
    const t = tip();
    t.replaceChildren();
    const c = content();
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach((x) => x && t.append(x as Node | string));
    else t.append(c instanceof Node ? c : String(c));
    t.style.display = 'block';
    move(e);
  });
  el.addEventListener('mousemove', move);
  el.addEventListener('mouseleave', hideTip);
  el.addEventListener('mousedown', hideTip);
  return el;
}

/* ------------------------------------------------------------------ */
/* Placeholder badge                                                   */
/* ------------------------------------------------------------------ */

/** A small "PH" badge that explains which design-doc slot a record stands in for. */
export function phBadge(p: Placeholder | null | undefined): HTMLElement | null {
  if (!p || !uiPrefs.showPlaceholderTags) return null;
  return withTip(h('span', { class: 'ph-badge', 'data-ph': p.slot }, 'PH'), () => [
    h('div', { class: 'tip-title' }, 'Placeholder content'),
    h('div', null, phText(p)),
    h('div', { class: 'tip-dim' }, 'Defined in src/content/. See docs/PLACEHOLDERS.md for how to replace it.'),
  ]);
}

/** A name followed by its placeholder badge. */
export function named(name: string, p: Placeholder | null | undefined, cls = ''): HTMLElement {
  return h('span', { class: `named ${cls}` }, name, phBadge(p));
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

export function itemTip(id: string, stack?: ItemStack | null, extra?: Child): Child {
  const def = C.item(id);
  return [
    h('div', { class: `tip-title ${def.unique ? 'rare' : ''}` }, def.name, stack && stack.qty > 1 ? ` x${stack.qty}` : ''),
    h('div', { class: 'tip-dim' }, def.examine),
    ...itemStatLines(def).map((l) => h('div', null, l)),
    stack?.charges !== undefined ? h('div', null, `Charges left: ${stack.charges}`) : null,
    def.ph && uiPrefs.showPlaceholderTags ? h('div', { class: 'tip-ph' }, phText(def.ph)) : null,
    extra ?? null,
  ];
}

export function qtyText(q: number): string {
  if (q >= 10_000_000) return `${Math.floor(q / 1_000_000)}M`;
  if (q >= 100_000) return `${Math.floor(q / 1000)}K`;
  return String(q);
}

export interface SlotOpts {
  onClick?: (e: MouseEvent) => void;
  onContext?: (e: MouseEvent) => void;
  hint?: string;
  empty?: string;
  extra?: Child;
  cls?: string;
}

export function itemSlot(stack: ItemStack | null | undefined, opts: SlotOpts = {}): HTMLElement {
  if (!stack) {
    return h('div', { class: `slot empty ${opts.cls ?? ''}`, title: opts.empty ?? '' }, opts.empty ? h('span', { class: 'slot-label' }, opts.empty) : null);
  }
  const def = C.item(stack.id);
  const el = h(
    'div',
    {
      class: `slot ${def.unique ? 'unique' : ''} ${opts.cls ?? ''}`,
      'data-item': stack.id,
      onClick: opts.onClick,
      onContextmenu: opts.onContext
        ? (e: MouseEvent) => {
            e.preventDefault();
            opts.onContext!(e);
          }
        : undefined,
    },
    h('img', { src: itemIcon(stack.id), alt: def.name, draggable: 'false' }),
    stack.qty > 1 || def.stackable ? h('span', { class: 'qty' }, qtyText(stack.qty)) : null,
    def.ph && uiPrefs.showPlaceholderTags ? h('span', { class: 'slot-ph' }) : null,
  );
  return withTip(el, () => itemTip(stack.id, stack, opts.hint ? h('div', { class: 'tip-hint' }, opts.hint) : opts.extra));
}

/* ------------------------------------------------------------------ */
/* Orbs and bars                                                       */
/* ------------------------------------------------------------------ */

export function orb(label: string, value: number, max: number, color: string, opts: { onClick?: () => void; active?: boolean; title?: string; id?: string } = {}): HTMLElement {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return h(
    'div',
    {
      class: `orb ${opts.onClick ? 'clickable' : ''} ${opts.active ? 'active' : ''}`,
      onClick: opts.onClick,
      title: opts.title ?? label,
      'data-orb': opts.id ?? label.toLowerCase(),
    },
    h('div', { class: 'orb-fill', style: { height: `${frac * 100}%`, background: color } }),
    h('div', { class: 'orb-value' }, String(Math.floor(value))),
    h('div', { class: 'orb-label' }, label),
  );
}

export function bar(value: number, max: number, color: string, label?: string): HTMLElement {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return h(
    'div',
    { class: 'bar' },
    h('div', { class: 'bar-fill', style: { width: `${frac * 100}%`, background: color } }),
    label ? h('div', { class: 'bar-label' }, label) : null,
  );
}

export function pips(n: number, max: number, color = 'var(--gold)'): HTMLElement {
  const els: HTMLElement[] = [];
  for (let i = 1; i <= max; i++) {
    const milestone = i === 3 || i === 6 || i === 10;
    els.push(h('span', { class: `pip ${i <= n ? 'on' : ''} ${milestone ? 'milestone' : ''}`, style: i <= n ? { background: color } : undefined }));
  }
  return h('span', { class: 'pips' }, els);
}

export function button(label: Child, onClick: () => void, opts: { disabled?: boolean | string; cls?: string; title?: string; id?: string } = {}): HTMLButtonElement {
  const disabledReason = typeof opts.disabled === 'string' ? opts.disabled : '';
  return h(
    'button',
    {
      class: `btn ${opts.cls ?? ''}`,
      disabled: Boolean(opts.disabled),
      title: disabledReason || opts.title,
      'data-id': opts.id,
      onClick: (e: MouseEvent) => {
        e.stopPropagation();
        hideTip();
        onClick();
      },
    },
    label,
  );
}

export function panel(title: Child, ...children: Child[]): HTMLElement {
  return h('section', { class: 'panel' }, title ? h('h3', { class: 'panel-title' }, title) : null, ...children);
}
