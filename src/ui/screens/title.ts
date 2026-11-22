/** Title screen: three character slots, character creation. */
import { CONFIG } from '../../config';
import { C } from '../../content';
import type { Focus } from '../../content/types';
import { routeLength } from '../../core/run';
import { characterLevel, createCharacter, validateName } from '../../core/save';
import type { App, ScreenView } from '../app';
import { h } from '../dom';
import { button, itemSlot, named, panel } from '../widgets';

const FOCUS_TEXT: Record<Focus, { role: string; emphasis: string }> = {
  melee: { role: 'Front line: high damage and defence up close.', emphasis: 'Attack, Strength, Hitpoints' },
  ranged: { role: 'Distance, ammunition and positioning.', emphasis: 'Ranged, Defence' },
  magic: { role: 'Range, utility spells and rune management.', emphasis: 'Magic, Prayer' },
};

export function titleScreen(app: App): ScreenView {
  const slots = app.save.characters.map((ch, slot) => {
    if (!ch) {
      return h(
        'div',
        { class: 'char-slot empty', 'data-slot': String(slot) },
        h('div', { class: 'slot-title' }, `Empty slot ${slot + 1}`),
        button('Create character', () => app.go({ name: 'create', slot }), { cls: 'primary', id: `create-${slot}` }),
      );
    }
    const run = ch.activeRun;
    return h(
      'div',
      { class: 'char-slot', 'data-slot': String(slot) },
      h('div', { class: 'slot-title' }, ch.name),
      h('div', { class: 'slot-sub' }, `Level ${characterLevel(ch)} · ${ch.focus[0].toUpperCase()}${ch.focus.slice(1)} focus`),
      h('div', { class: 'slot-stats' }, `${ch.stats.runs} trips · ${ch.stats.clears} clears · ${ch.coins} ${C.terms.coins}`),
      run ? h('div', { class: 'slot-run' }, `Trip in progress: act ${run.actIndex + 1} of ${routeLength(run)}`) : null,
      h(
        'div',
        { class: 'slot-actions' },
        button(run ? 'Resume trip' : 'Play', () => app.openCharacter(slot), { cls: 'primary', id: `play-${slot}` }),
        button('Delete', async () => {
          const ok = await app.confirm('Delete character', `Delete ${ch.name}? This cannot be undone.`, 'Delete', true);
          if (!ok) return;
          app.save.characters[slot] = null;
          app.persist();
          app.refresh();
        }, { cls: 'danger subtle' }),
      ),
    );
  });

  const el = h(
    'div',
    { class: 'screen title-screen' },
    app.topBar(null),
    h(
      'div',
      { class: 'title-hero' },
      h('h1', null, C.terms.gameTitle),
      h('p', { class: 'tagline' }, 'Pick a character, take a trip, bring back what you can. Then take one more.'),
    ),
    h('div', { class: 'char-slots' }, slots),
    h(
      'p',
      { class: 'dim center small' },
      'Placeholder build: every stand-in for licensed content is marked ',
      h('span', { class: 'ph-badge static' }, 'PH'),
      '. Hover a badge to see which design-doc slot it fills.',
    ),
  );
  return { el };
}

export function createScreen(app: App, slot: number): ScreenView {
  let focus: Focus = 'melee';
  const nameInput = h('input', { type: 'text', maxlength: String(CONFIG.NAME_MAX_LENGTH), placeholder: 'Name', id: 'char-name', autocomplete: 'off' });
  const error = h('div', { class: 'form-error' });
  const kitBox = h('div', { class: 'kit-box' });
  const focusRow = h('div', { class: 'focus-row' });

  const renderKit = () => {
    const kit = C.kit(focus);
    kitBox.replaceChildren(
      h('div', { class: 'kit-title' }, named('Starting kit', kit.ph)),
      h(
        'div',
        { class: 'kit-items' },
        kit.equipment.map((id) => itemSlot({ id, qty: 1 })),
        kit.ammo ? itemSlot({ id: kit.ammo[0], qty: kit.ammo[1] }) : null,
        kit.inventory.map(([id, qty]) => itemSlot({ id, qty })),
      ),
      h('p', null, FOCUS_TEXT[focus].role),
      h('p', { class: 'dim' }, `Early skill emphasis: ${FOCUS_TEXT[focus].emphasis}. Focus only sets your kit and weights weapon drops; you can train any skill and use any gear.`),
    );
    focusRow.replaceChildren(
      ...(['melee', 'ranged', 'magic'] as Focus[]).map((f) =>
        h(
          'button',
          {
            class: `focus-card ${f === focus ? 'selected' : ''}`,
            'data-focus': f,
            onClick: () => {
              focus = f;
              renderKit();
            },
          },
          h('span', { class: `focus-icon ${f}` }),
          h('span', null, `${f[0].toUpperCase()}${f.slice(1)}`),
        ),
      ),
    );
  };
  renderKit();

  const submit = () => {
    const err = validateName(app.save, nameInput.value, slot);
    if (err) {
      error.textContent = err;
      return;
    }
    app.save.characters[slot] = createCharacter(nameInput.value.trim(), focus);
    app.persist();
    app.go({ name: 'hub', slot, tab: 'trip' });
  };
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });

  const el = h(
    'div',
    { class: 'screen create-screen' },
    app.topBar(null),
    panel(
      'New character',
      h('label', { class: 'field' }, h('span', null, 'Name'), nameInput),
      error,
      h('div', { class: 'field-label' }, 'Combat focus'),
      focusRow,
      kitBox,
      h(
        'div',
        { class: 'form-actions' },
        button('Back', () => app.go({ name: 'title' })),
        button('Create', submit, { cls: 'primary', id: 'create-submit' }),
      ),
    ),
  );
  setTimeout(() => nameInput.focus(), 0);
  return { el };
}
