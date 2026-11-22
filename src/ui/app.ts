/** App shell: owns the save file, navigation between screens, toasts and modals. */
import { CONFIG } from '../config';
import { C } from '../content';
import type { Encounter } from '../core/combat/engine';
import type { RunCtx } from '../core/run';
import { characterLevel, loadSave, storeSave, unspentPoints, type Storage } from '../core/save';
import type { CharacterSave, SaveFile } from '../core/state';
import { totalXpForLevel, xpToNext } from '../core/progression';
import { h, mount, type Child } from './dom';
import { bar, button, hideTip, uiPrefs } from './widgets';
import { titleScreen, createScreen } from './screens/title';
import { hubScreen, type HubTab } from './screens/hub';
import { runScreen } from './screens/run';
import { combatScreen } from './screens/combat';
import { resultsScreen } from './screens/results';

export type Screen =
  | { name: 'title' }
  | { name: 'create'; slot: number }
  | { name: 'hub'; slot: number; tab: HubTab }
  | { name: 'run'; slot: number }
  | { name: 'combat'; slot: number }
  | { name: 'results'; slot: number };

export interface ScreenView {
  el: HTMLElement;
  cleanup?: () => void;
}

export class App {
  save: SaveFile;
  screen: Screen = { name: 'title' };
  /** The live fight, if the current screen is combat (not saved; see docs/DECISIONS.md). */
  encounter: Encounter | null = null;
  private view: ScreenView | null = null;
  private toasts: HTMLElement;
  private modalRoot: HTMLElement;
  private body: HTMLElement;
  readonly params = new URLSearchParams(location.search);

  constructor(
    readonly root: HTMLElement,
    readonly storage: Storage,
  ) {
    this.save = loadSave(storage);
    uiPrefs.showPlaceholderTags = this.save.settings.showPlaceholderTags;
    this.body = h('div', { class: 'app-body' });
    this.toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
    this.modalRoot = h('div', { class: 'modal-root' });
    mount(root, this.body, this.toasts, this.modalRoot);
  }

  /* ---------------------------------------------------------------- navigation */

  go(screen: Screen): void {
    this.view?.cleanup?.();
    this.view = null;
    hideTip();
    this.screen = screen;
    this.render();
  }

  /** Rebuild the current screen (after state changes). Keeps scroll positions. */
  refresh(): void {
    const scrolls = [...this.body.querySelectorAll<HTMLElement>('[data-scroll]')].map((el) => [el.dataset.scroll!, el.scrollTop] as const);
    this.view?.cleanup?.();
    hideTip();
    this.render();
    for (const [key, top] of scrolls) {
      const el = this.body.querySelector<HTMLElement>(`[data-scroll="${key}"]`);
      if (el) el.scrollTop = top;
    }
  }

  private render(): void {
    const s = this.screen;
    let view: ScreenView;
    switch (s.name) {
      case 'title':
        view = titleScreen(this);
        break;
      case 'create':
        view = createScreen(this, s.slot);
        break;
      case 'hub':
        view = hubScreen(this, s.slot, s.tab);
        break;
      case 'run':
        view = runScreen(this, s.slot);
        break;
      case 'combat':
        view = combatScreen(this, s.slot);
        break;
      case 'results':
        view = resultsScreen(this, s.slot);
        break;
    }
    this.view = view;
    mount(this.body, view.el);
    this.root.dataset.screen = s.name;
  }

  /** Go to the right screen for a character (resumes a saved trip). */
  openCharacter(slot: number): void {
    const ch = this.character(slot);
    if (!ch) return this.go({ name: 'create', slot });
    const run = ch.activeRun;
    if (run) {
      if (run.phase === 'room') return this.go({ name: 'combat', slot });
      return this.go({ name: 'run', slot });
    }
    if (ch.lastResult && ch.lastResult.keepable.length > 0 && ch.lastResult.vaultSlots > 0) return this.go({ name: 'results', slot });
    this.go({ name: 'hub', slot, tab: 'trip' });
  }

  character(slot: number): CharacterSave | null {
    return this.save.characters[slot] ?? null;
  }

  runCtx(slot: number): RunCtx {
    const ch = this.character(slot)!;
    return { ch, run: ch.activeRun!, autoRetaliate: this.save.settings.autoRetaliate };
  }

  get tickMs(): number {
    const p = Number(this.params.get('tick'));
    if (p > 0) return p;
    return this.save.settings.tickMs > 0 ? this.save.settings.tickMs : CONFIG.TICK_MS;
  }

  /** Optional fixed seed from the URL (?seed=123), for reproducible testing. */
  get fixedSeed(): number | undefined {
    const s = Number(this.params.get('seed'));
    return Number.isFinite(s) && s > 0 ? s : undefined;
  }

  persist(): void {
    try {
      storeSave(this.storage, this.save);
    } catch (e) {
      console.error(e);
      this.toast('Could not save the game (storage full or blocked).', 'bad');
    }
  }

  /* ---------------------------------------------------------------- feedback */

  toast(text: string, kind: 'info' | 'good' | 'bad' | 'rare' = 'info'): void {
    const t = h('div', { class: `toast ${kind}` }, text);
    this.toasts.appendChild(t);
    setTimeout(() => t.classList.add('fade'), 2600);
    setTimeout(() => t.remove(), 3200);
  }

  /** Show `err` as a toast if it is a message; returns true when there was no error. */
  check(err: string | null | undefined): boolean {
    if (err) {
      this.toast(err, 'bad');
      return false;
    }
    return true;
  }

  modal(title: Child, body: Child, actions: { label: string; onClick: () => void; cls?: string }[] = [], opts: { dismissable?: boolean; wide?: boolean } = {}): () => void {
    const dismissable = opts.dismissable ?? true;
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) close();
    };
    const overlay = h(
      'div',
      {
        class: 'modal-overlay',
        onClick: (e: MouseEvent) => {
          if (e.target === overlay && dismissable) close();
        },
      },
      h(
        'div',
        { class: `modal ${opts.wide ? 'wide' : ''}`, role: 'dialog' },
        title ? h('h2', { class: 'modal-title' }, title) : null,
        h('div', { class: 'modal-body' }, body),
        actions.length
          ? h(
              'div',
              { class: 'modal-actions' },
              actions.map((a) =>
                button(a.label, () => {
                  close();
                  a.onClick();
                }, { cls: a.cls }),
              ),
            )
          : null,
      ),
    );
    document.addEventListener('keydown', onKey);
    this.modalRoot.appendChild(overlay);
    return close;
  }

  confirm(title: string, text: string, okLabel = 'OK', danger = false): Promise<boolean> {
    return new Promise((resolve) => {
      this.modal(title, h('p', null, text), [
        { label: 'Cancel', onClick: () => resolve(false) },
        { label: okLabel, onClick: () => resolve(true), cls: danger ? 'danger' : 'primary' },
      ], { dismissable: false });
    });
  }

  settingsModal(): void {
    const st = this.save.settings;
    const row = (label: string, input: HTMLElement, hint?: string) =>
      h('label', { class: 'setting-row' }, h('span', null, label, hint ? h('small', null, hint) : null), input);
    const ph = h('input', { type: 'checkbox', checked: st.showPlaceholderTags });
    const ar = h('input', { type: 'checkbox', checked: st.autoRetaliate });
    const tick = h(
      'select',
      null,
      [0, 300, 450, 900, 1200].map((v) => h('option', { value: String(v), selected: st.tickMs === v }, v === 0 ? `Default (${CONFIG.TICK_MS} ms)` : `${v} ms`)),
    );
    this.modal(
      'Settings',
      h(
        'div',
        { class: 'settings' },
        row('Show placeholder tags', ph, 'Marks every stand-in for licensed content with a PH badge.'),
        row('Auto retaliate', ar, 'Fight back automatically when attacked.'),
        row('Tick length', tick, 'Slower ticks make prayer switching easier.'),
        h('p', { class: 'dim' }, 'Saves are kept in this browser (localStorage).'),
      ),
      [
        {
          label: 'Save',
          cls: 'primary',
          onClick: () => {
            st.showPlaceholderTags = ph.checked;
            st.autoRetaliate = ar.checked;
            st.tickMs = Number(tick.value);
            uiPrefs.showPlaceholderTags = st.showPlaceholderTags;
            this.persist();
            this.refresh();
          },
        },
      ],
    );
  }

  /* ---------------------------------------------------------------- shared chrome */

  topBar(slot: number | null, extra?: Child): HTMLElement {
    const ch = slot !== null ? this.character(slot) : null;
    let info: Child = null;
    if (ch) {
      const level = characterLevel(ch);
      const prog = { into: ch.xp - totalXpForLevel(level), needed: xpToNext(level) };
      const pts = unspentPoints(ch);
      info = h(
        'div',
        { class: 'topbar-char' },
        h('span', { class: 'char-name' }, ch.name),
        h('span', { class: 'char-level', 'data-level': String(level) }, `Level ${level}`),
        h('div', { class: 'xp-bar' }, bar(prog.into, prog.needed || 1, 'var(--gold)', level >= CONFIG.MAX_LEVEL ? 'Max level' : `${prog.into} / ${prog.needed} XP`)),
        pts > 0 ? h('span', { class: 'badge-points', title: 'Unspent skill points' }, `${pts} point${pts > 1 ? 's' : ''}`) : null,
        h('span', { class: 'currency', title: C.terms.coins }, `${ch.coins} ${C.terms.coins}`),
      );
    }
    return h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'brand', onClick: () => this.go({ name: 'title' }), title: 'Back to character select' }, C.terms.gameTitle),
      info,
      h('div', { class: 'topbar-extra' }, extra ?? null),
      button('⚙', () => this.settingsModal(), { cls: 'icon-btn', title: 'Settings' }),
    );
  }
}
