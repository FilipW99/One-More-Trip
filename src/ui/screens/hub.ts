/** The hub between trips: start a trip, skills, upgrades, relics, omens and logs. */
import { CONFIG } from '../../config';
import { C } from '../../content';
import type { Effect, SkillDef } from '../../content/types';
import {
  buildUpgrade,
  buySlayerUnlock,
  canRaiseSkill,
  nextRespecCost,
  raiseSkill,
  respec,
  setActivePet,
  setRoute,
  setSpellbook,
  setStartAct,
  toggleOmen,
  toggleRelic,
  unlockRelic,
  upgradeInfo,
} from '../../core/hub';
import { characterMods, mod, omenScore } from '../../core/mods';
import { skillPointsForLevel } from '../../core/progression';
import { availableRoutes, maxStartAct, relicSlots, startRun, vaultSlots } from '../../core/run';
import { characterLevel, spentPoints, unspentPoints } from '../../core/save';
import type { CharacterSave } from '../../core/state';
import { glyphIcon } from '../../render/placeholders';
import type { App, ScreenView } from '../app';
import { h, type Child } from '../dom';
import { ROOM_INFO } from '../text';
import { button, itemSlot, named, panel, phBadge, pips, withTip } from '../widgets';

export type HubTab = 'trip' | 'skills' | 'homestead' | 'relics' | 'omens' | 'slayer' | 'menagerie' | 'collection' | 'tasks';

const TABS: { id: HubTab; label: () => string }[] = [
  { id: 'trip', label: () => 'Trip' },
  { id: 'skills', label: () => 'Skills' },
  { id: 'homestead', label: () => C.terms.hubName },
  { id: 'relics', label: () => C.terms.relics },
  { id: 'omens', label: () => C.terms.omens },
  { id: 'slayer', label: () => 'Slayer' },
  { id: 'menagerie', label: () => 'Pets' },
  { id: 'collection', label: () => C.terms.collectionLog },
  { id: 'tasks', label: () => 'Tasks' },
];

export function hubScreen(app: App, slot: number, tab: HubTab): ScreenView {
  const ch = app.character(slot)!;
  const go = (t: HubTab) => app.go({ name: 'hub', slot, tab: t });
  const nav = h(
    'nav',
    { class: 'hub-nav' },
    TABS.map((t) =>
      h(
        'button',
        { class: `hub-tab ${t.id === tab ? 'active' : ''}`, 'data-tab': t.id, onClick: () => go(t.id) },
        t.label(),
        t.id === 'skills' && unspentPoints(ch) > 0 ? h('span', { class: 'dot' }) : null,
        t.id === 'homestead' ? phBadge(C.termPlaceholders.hubName) : null,
      ),
    ),
  );
  let content: HTMLElement;
  switch (tab) {
    case 'trip':
      content = tripTab(app, slot, ch);
      break;
    case 'skills':
      content = skillsTab(app, ch);
      break;
    case 'homestead':
      content = homesteadTab(app, ch);
      break;
    case 'relics':
      content = relicsTab(app, ch);
      break;
    case 'omens':
      content = omensTab(app, ch);
      break;
    case 'slayer':
      content = slayerTab(app, ch);
      break;
    case 'menagerie':
      content = petsTab(app, ch);
      break;
    case 'collection':
      content = collectionTab(ch);
      break;
    case 'tasks':
      content = tasksTab(ch);
      break;
  }
  const el = h(
    'div',
    { class: 'screen hub-screen' },
    app.topBar(slot),
    h('div', { class: 'hub-layout' }, nav, h('main', { class: 'hub-content', 'data-scroll': `hub-${tab}` }, content)),
  );
  return { el };
}

/* ------------------------------------------------------------------ */
/* Trip                                                                */
/* ------------------------------------------------------------------ */

function choice(label: Child, selected: boolean, onClick: () => void, opts: { disabled?: string; id?: string } = {}): HTMLElement {
  return h(
    'button',
    {
      class: `choice ${selected ? 'selected' : ''}`,
      disabled: Boolean(opts.disabled),
      title: opts.disabled ?? '',
      'data-id': opts.id,
      onClick,
    },
    label,
  );
}

function tripTab(app: App, slot: number, ch: CharacterSave): HTMLElement {
  const level = characterLevel(ch);
  const routes = availableRoutes(ch);
  const routeRow = h(
    'div',
    { class: 'choices' },
    C.routes.map((r) => {
      const ok = routes.some((x) => x.id === r.id);
      const lock = r.unlock ? `Needs ${C.feature(r.unlock.feature).name} tier ${r.unlock.tier}.` : undefined;
      return choice(
        h('span', null, named(r.name, r.ph), h('small', null, r.acts.map((a) => C.act(a).name).join(' → '))),
        ch.route === r.id && ok,
        () => {
          setRoute(ch, r.id);
          app.persist();
          app.refresh();
        },
        { disabled: ok ? undefined : lock, id: `route-${r.id}` },
      );
    }),
  );
  const maxAct = maxStartAct(ch);
  const route = routes.find((r) => r.id === ch.route) ?? C.routes[0];
  const startRow =
    maxAct > 0
      ? h(
          'div',
          { class: 'choices' },
          route.acts.slice(0, maxAct + 1).map((a, i) =>
            choice(`Start at act ${i + 1}: ${C.act(a).name}`, Math.min(ch.startAct, maxAct) === i, () => {
              setStartAct(ch, i);
              app.persist();
              app.refresh();
            }),
          ),
        )
      : h('p', { class: 'dim' }, `Build the ${C.feature('portal').name} (tier 2) to start deeper in the route.`);
  const bookRow = h(
    'div',
    { class: 'choices' },
    C.spellbooks.map((b) =>
      choice(h('span', null, named(b.name, b.ph), h('small', null, b.description)), ch.spellbook === b.id, () => {
        setSpellbook(ch, b.id);
        app.persist();
        app.refresh();
      }),
    ),
  );
  const kit = C.kit(ch.focus);
  const workshop = ch.hub.workshop ?? 0;
  const relics = ch.relicsEquipped.map((r) => C.relic(r));
  const score = omenScore(ch.omensSelected);

  const start = () => {
    startRun(ch, app.fixedSeed);
    app.persist();
    app.go({ name: 'run', slot });
  };

  const last = ch.lastResult;
  return h(
    'div',
    { class: 'tab trip-tab' },
    panel(
      'Start a trip',
      h('div', { class: 'field-label' }, 'Route'),
      routeRow,
      h('div', { class: 'field-label' }, 'Starting act'),
      startRow,
      h('div', { class: 'field-label' }, 'Spellbook'),
      bookRow,
      h(
        'div',
        { class: 'trip-summary' },
        h(
          'div',
          null,
          h('strong', null, `${C.terms.relics}: `),
          relics.length ? relics.map((r) => r.name).join(', ') : 'none',
          ` (${relics.length}/${relicSlots(ch)} slots) `,
          relics.length < relicSlots(ch) && ch.relicsUnlocked.some((r) => !ch.relicsEquipped.includes(r))
            ? button(`Choose ${C.terms.relics.toLowerCase()}`, () => app.go({ name: 'hub', slot, tab: 'relics' }), { cls: 'small', id: 'choose-relics' })
            : null,
        ),
        h('div', null, h('strong', null, `${C.terms.omens}: `), score ? `${score} points, +${(score * CONFIG.OMEN_REWARD_PER_POINT * 100).toFixed(1)}% XP and banked ${C.terms.coins}` : 'none'),
        ch.vault.length ? h('div', { class: 'vault-row' }, h('strong', null, `${C.terms.vault}: `), ch.vault.map((s) => itemSlot(s))) : null,
        h('div', { class: 'kit-row' }, h('strong', null, 'Kit: '), named(`${ch.focus[0].toUpperCase()}${ch.focus.slice(1)} kit`, kit.ph), workshop > 0 ? ` with ${workshop} ${C.feature('workshop').name} upgrade${workshop > 1 ? 's' : ''}` : ''),
      ),
      button('Start trip', start, { cls: 'primary big', id: 'start-trip' }),
    ),
    last
      ? panel(
          'Last trip',
          h(
            'p',
            null,
            `${last.outcome === 'clear' ? 'Full clear' : last.outcome === 'retreat' ? 'Retreated' : 'Died'} in act ${last.depth}. `,
            `+${last.xpEarned} XP, ${last.coinsBanked} ${C.terms.coins} banked, ${last.kills} kills.`,
          ),
        )
      : panel('How a trip works', h('ul', { class: 'howto' },
          h('li', null, 'Pick a route through the act map. Fight, rest, trade and loot along the way.'),
          h('li', null, 'Combat runs on a 0.6 s tick. Click to move and attack. Switch protection prayers (Q/W/E) when you see an attack coming.'),
          h('li', null, 'Beat the act boss to go deeper, or retreat through the portal to bank more of your Coins.'),
          h('li', null, `XP always comes home. Spend skill points here, build up your ${C.terms.hubName}, and take one more trip.`),
        )),
    panel(
      'Character',
      h('div', { class: 'stat-grid' },
        stat('Level', String(level)),
        stat('Skill points', `${spentPoints(ch)} spent / ${skillPointsForLevel(level)} earned`),
        stat('Trips', `${ch.stats.runs} (${ch.stats.clears} clears, ${ch.stats.retreats} retreats, ${ch.stats.deaths} deaths)`),
        stat('Deepest act', String(ch.stats.bestDepth || '-')),
        stat('Kills', String(ch.stats.kills)),
        stat(C.terms.leaguePoints, String(ch.leaguePoints)),
        stat(C.terms.slayerPoints, String(ch.slayerPoints)),
        stat('Vault slots', String(vaultSlots(ch))),
      ),
    ),
  );
}

function stat(label: string, value: string): HTMLElement {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value' }, value));
}

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

function skillCard(app: App, ch: CharacterSave, s: SkillDef): HTMLElement {
  const rank = ch.skills[s.id] ?? 0;
  const can = canRaiseSkill(ch, s.id);
  return h(
    'div',
    { class: `skill-card ${rank >= 10 ? 'maxed' : ''}`, 'data-skill': s.id },
    h(
      'div',
      { class: 'skill-head' },
      h('img', { class: 'skill-icon', src: glyphIcon(`skill:${s.id}`, s.name[0], s.color), alt: '' }),
      h('div', { class: 'skill-name' }, s.name, phBadge(s.ph)),
      h('div', { class: 'skill-rank' }, `${rank}/10`),
      button('+', () => {
        if (app.check(raiseSkill(ch, s.id))) {
          app.persist();
          app.refresh();
        }
      }, { disabled: !can, cls: 'small', title: `Raise ${s.name}`, id: `raise-${s.id}` }),
    ),
    pips(rank, 10, s.color),
    h('div', { class: 'skill-per' }, s.perRankText),
    h(
      'ul',
      { class: 'perks' },
      s.perks.map((p) => h('li', { class: rank >= p.rank ? 'got' : '' }, h('b', null, `R${p.rank}`), ' ', p.text)),
    ),
  );
}

function skillsTab(app: App, ch: CharacterSave): HTMLElement {
  const pts = unspentPoints(ch);
  const study = ch.hub.study ?? 0;
  const cost = nextRespecCost(ch);
  const doRespec = async () => {
    const ok = await app.confirm('Respec', `Reset all skill ranks and refund ${spentPoints(ch)} points for ${cost} ${C.terms.coins}?`, 'Respec');
    if (!ok) return;
    if (app.check(respec(ch))) {
      app.persist();
      app.refresh();
      app.toast('Skill points refunded.', 'good');
    }
  };
  const group = (g: 'combat' | 'utility') => h('div', { class: 'skill-grid' }, C.skills.filter((s) => s.group === g).map((s) => skillCard(app, ch, s)));
  return h(
    'div',
    { class: 'tab skills-tab' },
    h(
      'div',
      { class: 'tab-header' },
      h('div', null, h('span', { class: 'big-number', 'data-points': String(pts) }, String(pts)), ' unspent skill points'),
      h('div', { class: 'dim' }, 'One point per level, plus one more every 10th level. Ranks give a small bonus each, and perks at ranks 3, 6 and 10.'),
      button(cost === 0 ? 'Respec (free)' : `Respec (${cost} ${C.terms.coins})`, doRespec, {
        disabled: study < 1 ? `Build the ${C.feature('study').name} to respec.` : ch.coins < cost ? `Needs ${cost} ${C.terms.coins}.` : spentPoints(ch) === 0 ? 'No points spent.' : undefined,
      }),
    ),
    h('h3', { class: 'section-title' }, 'Combat'),
    group('combat'),
    h('h3', { class: 'section-title' }, 'Utility'),
    group('utility'),
  );
}

/* ------------------------------------------------------------------ */
/* Homestead                                                           */
/* ------------------------------------------------------------------ */

function homesteadTab(app: App, ch: CharacterSave): HTMLElement {
  const m = characterMods(ch);
  const discount = mod(m, 'pohCost');
  return h(
    'div',
    { class: 'tab homestead-tab' },
    h('div', { class: 'tab-header' },
      h('div', null, `Spend ${C.terms.coins} on lasting upgrades. Costs grow ×${CONFIG.HUB_COST_GROWTH} per tier.`),
      discount ? h('div', { class: 'dim' }, `Construction discount: ${-discount}%`) : null,
    ),
    h(
      'div',
      { class: 'feature-grid' },
      C.hub.map((f) => {
        const info = upgradeInfo(ch, f.id);
        const tier = info.currentTier;
        return h(
          'div',
          { class: 'feature-card', 'data-feature': f.id },
          h('div', { class: 'feature-head' }, named(f.name, f.ph, 'feature-name'), h('span', { class: 'tier' }, `Tier ${tier}/${info.maxTier}`)),
          h('p', { class: 'dim' }, f.description),
          h(
            'ol',
            { class: 'tiers' },
            f.tiers.map((t, i) => h('li', { class: i < tier ? 'got' : i === tier ? 'next' : '' }, t.text)),
          ),
          info.nextTier !== null
            ? button(`Build tier ${info.nextTier} (${info.cost} ${C.terms.coins})`, () => {
                if (app.check(buildUpgrade(ch, f.id))) {
                  app.persist();
                  app.refresh();
                  app.toast(`${f.name} upgraded to tier ${info.nextTier}.`, 'good');
                }
              }, { disabled: info.blocked ?? undefined, cls: 'primary', id: `build-${f.id}` })
            : h('div', { class: 'done-label' }, 'Fully built'),
          info.blocked && info.nextTier !== null ? h('div', { class: 'blocked' }, info.blocked) : null,
        );
      }),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Relics and omens                                                    */
/* ------------------------------------------------------------------ */

function relicsTab(app: App, ch: CharacterSave): HTMLElement {
  const slots = relicSlots(ch);
  return h(
    'div',
    { class: 'tab relics-tab' },
    h('div', { class: 'tab-header' },
      h('div', null, h('span', { class: 'big-number' }, String(ch.leaguePoints)), ' ', named(C.terms.leaguePoints, C.termPlaceholders.leaguePoints)),
      h('div', { class: 'dim' }, `Earn ${C.terms.leaguePoints} from Tasks. Unlock ${C.terms.relics} with them and equip up to ${slots} at a time (more slots from the ${C.feature('study').name}).`),
      phBadge(C.termPlaceholders.relics),
    ),
    h(
      'div',
      { class: 'card-list' },
      C.relics.map((r) => {
        const unlocked = ch.relicsUnlocked.includes(r.id);
        const equipped = ch.relicsEquipped.includes(r.id);
        return h(
          'div',
          { class: `power-card ${equipped ? 'equipped' : ''} ${unlocked ? '' : 'locked'}`, 'data-relic': r.id },
          h('div', { class: 'power-head' }, named(r.name, r.ph), h('span', { class: 'cost' }, r.cost ? `${r.cost} ${C.terms.leaguePoints}` : 'Free')),
          h('p', null, r.description),
          unlocked
            ? button(equipped ? 'Unequip' : 'Equip', () => {
                if (app.check(toggleRelic(ch, r.id))) {
                  app.persist();
                  app.refresh();
                }
              }, { cls: equipped ? '' : 'primary', id: `relic-${r.id}` })
            : button(`Unlock (${r.cost})`, () => {
                if (app.check(unlockRelic(ch, r.id))) {
                  app.persist();
                  app.refresh();
                }
              }, { disabled: ch.leaguePoints < r.cost ? `Needs ${r.cost} ${C.terms.leaguePoints}.` : undefined, id: `unlock-${r.id}` }),
        );
      }),
    ),
  );
}

function omensTab(app: App, ch: CharacterSave): HTMLElement {
  const score = omenScore(ch.omensSelected);
  return h(
    'div',
    { class: 'tab omens-tab' },
    h('div', { class: 'tab-header' },
      h('div', null, h('span', { class: 'big-number', 'data-omen-score': String(score) }, String(score)), ` ${C.terms.omens} points`),
      h('div', { class: 'dim' }, `Optional challenges for your next trip. Each point adds ${(CONFIG.OMEN_REWARD_PER_POINT * 100).toFixed(1)}% XP and banked ${C.terms.coins}, and a little boss unique chance.`),
      phBadge(C.termPlaceholders.omens),
    ),
    h(
      'div',
      { class: 'card-list' },
      C.omens.map((o) => {
        const on = ch.omensSelected.includes(o.id);
        return h(
          'div',
          { class: `power-card ${on ? 'equipped' : ''}`, 'data-omen': o.id },
          h('div', { class: 'power-head' }, named(o.name, o.ph), h('span', { class: 'cost' }, `${o.points} pts`)),
          h('p', null, o.description),
          button(on ? 'Turn off' : 'Turn on', () => {
            toggleOmen(ch, o.id);
            app.persist();
            app.refresh();
          }, { cls: on ? '' : 'primary', id: `omen-${o.id}` }),
        );
      }),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Slayer, pets, logs                                                  */
/* ------------------------------------------------------------------ */

function slayerTab(app: App, ch: CharacterSave): HTMLElement {
  return h(
    'div',
    { class: 'tab slayer-tab' },
    h('div', { class: 'tab-header' },
      h('div', null, h('span', { class: 'big-number' }, String(ch.slayerPoints)), ` ${C.terms.slayerPoints}`),
      h('div', { class: 'dim' }, 'Slayer masters along each route hand out tasks. Points unlock task options; they are not a building currency.'),
    ),
    panel(
      'Unlocks',
      h(
        'div',
        { class: 'card-list' },
        C.slayerUnlocks.map((u) => {
          const owned = ch.slayerUnlocks.includes(u.id);
          return h(
            'div',
            { class: `power-card ${owned ? 'equipped' : ''}` },
            h('div', { class: 'power-head' }, named(u.name, u.ph), h('span', { class: 'cost' }, `${u.cost} pts`)),
            h('p', null, u.description),
            owned
              ? h('div', { class: 'done-label' }, 'Unlocked')
              : button('Unlock', () => {
                  if (app.check(buySlayerUnlock(ch, u.id))) {
                    app.persist();
                    app.refresh();
                  }
                }, { disabled: ch.slayerPoints < u.cost ? `Needs ${u.cost} ${C.terms.slayerPoints}.` : undefined }),
          );
        }),
      ),
    ),
    panel(
      'Slayer masters',
      h('ul', { class: 'plain-list' }, C.slayerMasters.map((m) => {
        const act = C.acts.find((a) => a.slayerMaster === m.id);
        return h('li', null, named(m.name, m.ph), act ? h('span', { class: 'dim' }, ` · ${act.name}`) : null, h('div', { class: 'dim small' }, `"${m.greeting}"`));
      })),
    ),
  );
}

function petsTab(app: App, ch: CharacterSave): HTMLElement {
  const built = (ch.hub.menagerie ?? 0) >= 1;
  return h(
    'div',
    { class: 'tab pets-tab' },
    h('div', { class: 'tab-header' }, h('div', null, 'Pets are rare boss drops. ', built ? 'Pick one to follow you on trips.' : `Build the ${C.feature('menagerie').name} to bring one along.`)),
    h(
      'div',
      { class: 'card-list' },
      C.pets.map((p) => {
        const owned = ch.pets.includes(p.id);
        const active = ch.activePet === p.id;
        return h(
          'div',
          { class: `power-card ${active ? 'equipped' : ''} ${owned ? '' : 'locked'}`, 'data-pet': p.id },
          h('div', { class: 'power-head' }, owned ? itemSlot({ id: p.id, qty: 1 }) : h('div', { class: 'slot empty' }, '?'), named(owned ? p.name : '???', p.ph)),
          h('p', null, owned ? p.examine : 'Not found yet.'),
          owned && built
            ? button(active ? 'Send home' : 'Bring along', () => {
                if (app.check(setActivePet(ch, active ? null : p.id))) {
                  app.persist();
                  app.refresh();
                }
              })
            : null,
        );
      }),
    ),
  );
}

function collectionTab(ch: CharacterSave): HTMLElement {
  const groups: { title: string; ids: string[] }[] = [
    { title: 'Boss uniques', ids: C.items.filter((i) => i.unique && i.kind !== 'misc').map((i) => i.id) },
    { title: 'Pets', ids: C.pets.map((p) => p.id) },
    { title: 'Weapons', ids: C.items.filter((i) => i.kind === 'weapon' && !i.unique).map((i) => i.id) },
    { title: 'Armour and jewellery', ids: C.items.filter((i) => (i.kind === 'armour' || i.kind === 'jewellery') && !i.unique).map((i) => i.id) },
    { title: 'Supplies', ids: C.items.filter((i) => ['food', 'potion', 'rune', 'ammo', 'tome', 'casket', 'resource'].includes(i.kind) && !i.unique).map((i) => i.id) },
  ];
  const total = new Set(groups.flatMap((g) => g.ids));
  const got = [...total].filter((id) => ch.collection[id]).length;
  return h(
    'div',
    { class: 'tab collection-tab' },
    h('div', { class: 'tab-header' }, h('div', null, h('span', { class: 'big-number' }, `${got}/${total.size}`), ` items logged in the ${C.terms.collectionLog}`)),
    groups.map((g) => {
      const n = g.ids.filter((id) => ch.collection[id]).length;
      return panel(
        `${g.title} (${n}/${g.ids.length})`,
        h(
          'div',
          { class: 'collection-grid' },
          g.ids.map((id) =>
            ch.collection[id]
              ? itemSlot({ id, qty: ch.collection[id] }, { cls: 'logged' })
              : withTip(h('div', { class: 'slot empty unknown' }, '?'), () => h('div', { class: 'tip-dim' }, 'Not obtained yet')),
          ),
        ),
      );
    }),
  );
}

function tasksTab(ch: CharacterSave): HTMLElement {
  const done = ch.tasksDone.length;
  return h(
    'div',
    { class: 'tab tasks-tab' },
    h('div', { class: 'tab-header' },
      h('div', null, h('span', { class: 'big-number' }, `${done}/${C.tasks.length}`), ` tasks complete · ${ch.leaguePoints} ${C.terms.leaguePoints} unspent`),
      h('div', { class: 'dim' }, `Tasks award ${C.terms.leaguePoints}, which unlock ${C.terms.relics}.`),
    ),
    h(
      'div',
      { class: 'task-list' },
      C.tasks.map((t) =>
        h(
          'div',
          { class: `task ${ch.tasksDone.includes(t.id) ? 'done' : ''}`, 'data-task': t.id },
          h('span', { class: 'task-check' }, ch.tasksDone.includes(t.id) ? '✓' : ''),
          h('span', { class: 'task-name' }, t.name),
          h('span', { class: 'task-desc' }, t.description),
          h('span', { class: 'task-points' }, `${t.points}`),
        ),
      ),
    ),
  );
}

/** Plain-text summary of an effect list (used where content has no prose). */
export function effectsText(effects: readonly Effect[]): string {
  return effects
    .map((e) => {
      if ('mod' in e) return `${e.mod} ${e.value > 0 ? '+' : ''}${e.value}`;
      if ('flag' in e) return e.flag;
      if ('gate' in e) return `unlocks ${e.gate} drops`;
      if ('weight' in e) return `${e.weight} drops ×${e.mult}`;
      return `${ROOM_INFO.gather.label}: ${e.room}`;
    })
    .join(', ');
}
