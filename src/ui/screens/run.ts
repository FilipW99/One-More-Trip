/** Trip screen: act map, event rooms, loot, boons and the end-of-act choice. */
import { C } from '../../content';
import type { EquipSlot } from '../../content/types';
import {
  acceptSlayerTask,
  buy,
  canFeast,
  canHarvest,
  canLightBrazier,
  canMixPotions,
  canPickpocket,
  canRerollSlayer,
  canSwitchSpellbook,
  chestNeedsThieving,
  cookFeast,
  harvest,
  lightBrazier,
  mixPotions,
  openChest,
  pickpocket,
  potionSlots,
  rechargeJewellery,
  rechargeOptions,
  rerollSlayer,
  rest,
  sail,
  seaHasChoice,
  sell,
  sellValue,
  smithOptions,
  smithUpgrade,
  switchSpellbook,
} from '../../core/rooms';
import {
  availableMoves,
  canRestoreSpec,
  canSkipRoom,
  chooseBoon,
  closeRoom,
  continueToNextAct,
  currentAct,
  enterNode,
  isFinalAct,
  restoreSpec,
  retreat,
  routeLength,
  seaRouteMoves,
  skipRoom,
  takeAllLoot,
  takeLoot,
  type RunCtx,
} from '../../core/run';
import { CONFIG } from '../../config';
import type { LogLine, MapNode, RunState } from '../../core/state';
import type { App, ScreenView } from '../app';
import { h, type Child } from '../dom';
import { orbs, sideBody, sideTabs, type SideOpts, type SideTab } from '../sidepanel';
import { ROOM_INFO, SLOT_LABELS } from '../text';
import { button, itemSlot, named, panel, phBadge, withTip } from '../widgets';

let sideTab: SideTab = 'inventory';
let skipMode = false;

export function chatLog(lines: LogLine[], max = 60): HTMLElement {
  const el = h(
    'div',
    { class: 'chat', 'data-panel': 'chat' },
    lines.slice(-max).map((l) => h('div', { class: `chat-line ${l.kind}` }, l.text)),
  );
  requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  return el;
}

export function runScreen(app: App, slot: number): ScreenView {
  const ch = app.character(slot);
  if (!ch?.activeRun) {
    queueMicrotask(() => app.openCharacter(slot));
    return { el: h('div') };
  }
  const ctx = app.runCtx(slot);
  const run = ctx.run;
  if (run.phase === 'room') {
    queueMicrotask(() => app.go({ name: 'combat', slot }));
    return { el: h('div') };
  }

  const changed = () => {
    app.persist();
    if (!ch.activeRun) app.go({ name: 'results', slot });
    else if (run.phase === 'room') app.go({ name: 'combat', slot });
    else app.refresh();
  };

  const act = currentAct(run);
  const nextBoon = CONFIG.BOON_THRESHOLDS.find((t) => t > run.xp);

  let center: HTMLElement;
  if (run.boonOffer) center = boonView(ctx, changed);
  else if (run.phase === 'actComplete') center = actCompleteView(app, ctx, slot, changed);
  else if (run.phase === 'loot') center = lootView(app, ctx, changed, true);
  else if (run.phase === 'event') center = eventView(app, ctx, changed);
  else center = mapView(app, ctx, changed);

  const sideOpts: SideOpts = {
    app,
    ctx,
    enc: null,
    tab: sideTab,
    setTab: (t) => {
      sideTab = t;
      app.refresh();
    },
    changed,
  };
  if (run.event?.kind === 'trader' && run.phase === 'event') {
    sideOpts.inventoryClick = (i) => {
      const s = run.inventory[i];
      if (!s) return true;
      app.check(sell(ctx, i));
      return true;
    };
    sideOpts.inventoryHint = 'Click to sell to the trader.';
  }

  const el = h(
    'div',
    { class: 'screen run-screen' },
    app.topBar(slot, h('span', { class: 'run-coins' }, `Trip: ${run.coins} ${C.terms.coins}`)),
    h(
      'div',
      { class: 'run-header' },
      h('div', { class: 'act-name' }, `Act ${run.actIndex + 1}/${routeLength(run)}: `, named(act.name, act.ph)),
      h('div', { class: 'act-blurb' }, act.blurb),
      h(
        'div',
        { class: 'run-xp' },
        `Trip XP ${run.xp}`,
        nextBoon ? h('span', { class: 'dim' }, ` · next ${C.terms.boons.toLowerCase().replace(/s$/, '')} at ${nextBoon}`) : null,
      ),
    ),
    h(
      'div',
      { class: 'run-layout' },
      h('main', { class: 'run-center', 'data-scroll': 'run-center' }, center),
      h('aside', { class: 'side' }, orbs(sideOpts), sideTabs(sideOpts), h('div', { class: 'side-body' }, sideBody(sideOpts))),
    ),
    chatLog(run.log),
  );
  return { el };
}

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

function nodeTip(run: RunState, node: MapNode): Child {
  const info = ROOM_INFO[node.type];
  const extra: Child[] = [];
  if (node.type === 'boss' && node.boss) {
    const b = C.boss(node.boss);
    extra.push(h('div', null, named(b.name, b.ph)), h('div', { class: 'tip-dim' }, b.examine));
  }
  if (node.type === 'gather' && node.gather) extra.push(h('div', null, C.gatherRoom(node.gather)?.name ?? ''));
  if (node.type === 'chest' && node.chest && node.chest !== 'plain') extra.push(h('div', null, node.chest === 'locked' ? 'Locked' : 'Looks trapped'));
  if (node.wave !== undefined) {
    const waves = currentAct(run).gauntlet?.waves[node.wave] ?? [];
    extra.push(h('div', null, `Wave ${node.wave + 1}: ${waves.map((id) => C.monster(id).name).join(', ')}`));
  }
  return [h('div', { class: 'tip-title' }, info.label), h('div', null, info.hint), ...extra];
}

function mapView(app: App, ctx: RunCtx, changed: () => void): HTMLElement {
  const { run } = ctx;
  const map = run.map;
  const moves = availableMoves(run);
  const sea = seaRouteMoves(ctx).filter((id) => !moves.includes(id));
  const skippable = moves.filter((id) => canSkipRoom(ctx, id));
  if (!skippable.length) skipMode = false;
  const rows = map.rows.length;
  const W = 640;
  const rowH = 92;
  const H = rows * rowH + 40;
  const pos = (n: MapNode) => ({ x: 40 + n.x * (W - 80), y: H - 40 - n.row * rowH });
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'act-map');
  svg.setAttribute('data-map', map.actId);
  const line = (a: MapNode, b: MapNode, cls: string) => {
    const p = pos(a);
    const q = pos(b);
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', String(p.x));
    l.setAttribute('y1', String(p.y));
    l.setAttribute('x2', String(q.x));
    l.setAttribute('y2', String(q.y));
    l.setAttribute('class', cls);
    svg.appendChild(l);
  };
  const visited = new Set(run.visited);
  for (const n of Object.values(map.nodes)) {
    for (const id of n.next) line(n, map.nodes[id], visited.has(n.id) && visited.has(id) ? 'edge walked' : 'edge');
    for (const id of n.shortcuts) line(n, map.nodes[id], 'edge shortcut');
  }
  const enter = (id: string, viaSea: boolean) => {
    if (skipMode && !viaSea && canSkipRoom(ctx, id)) {
      skipRoom(ctx, id);
      skipMode = false;
      return changed();
    }
    const enc = enterNode(ctx, id, viaSea);
    if (enc) app.encounter = enc;
    changed();
  };
  for (const n of Object.values(map.nodes)) {
    const p = pos(n);
    const info = ROOM_INFO[n.type];
    const can = moves.includes(n.id);
    const bySea = sea.includes(n.id);
    const g = document.createElementNS(NS, 'g');
    const cls = ['node', n.type, visited.has(n.id) ? 'visited' : '', run.position === n.id ? 'current' : '', can ? 'available' : '', bySea ? 'by-sea' : '', skipMode && skippable.includes(n.id) ? 'skippable' : ''].filter(Boolean).join(' ');
    g.setAttribute('class', cls);
    g.setAttribute('data-node', n.id);
    g.setAttribute('data-type', n.type);
    g.setAttribute('transform', `translate(${p.x},${p.y})`);
    const r = n.type === 'boss' ? 26 : 20;
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', String(r));
    c.setAttribute('fill', info.color);
    g.appendChild(c);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'central');
    t.setAttribute('font-size', n.type === 'boss' ? '24' : '18');
    t.textContent = info.glyph;
    g.appendChild(t);
    if (can || bySea) g.addEventListener('click', () => enter(n.id, bySea && !can));
    withTip(g as unknown as HTMLElement, () => [nodeTip(run, n), bySea && !can ? h('div', { class: 'tip-hint' }, 'Reachable once per trip by sea route.') : null, can ? h('div', { class: 'tip-hint' }, skipMode && skippable.includes(n.id) ? 'Click to skip this room.' : 'Click to enter.') : null]);
    svg.appendChild(g);
  }

  const legend = h(
    'div',
    { class: 'map-legend' },
    (Object.keys(ROOM_INFO) as (keyof typeof ROOM_INFO)[]).map((k) => h('span', { class: 'legend-item' }, h('span', { class: 'legend-dot', style: { background: ROOM_INFO[k].color } }, ROOM_INFO[k].glyph), ROOM_INFO[k].label)),
  );

  return h(
    'div',
    { class: 'map-wrap' },
    h(
      'div',
      { class: 'map-toolbar' },
      h('span', null, run.position ? 'Choose your next room.' : 'Choose where to start.'),
      skippable.length
        ? button(skipMode ? 'Cancel skip' : `Skip a room (Agility, ${skippable.length} available)`, () => {
            skipMode = !skipMode;
            app.refresh();
          }, { cls: skipMode ? 'primary' : '' })
        : null,
      canRestoreSpec(ctx)
        ? button('Restore special energy', () => {
            restoreSpec(ctx);
            changed();
          })
        : null,
    ),
    h('div', { class: 'map-scroll' }, svg),
    legend,
  );
}

/* ------------------------------------------------------------------ */
/* Loot                                                                */
/* ------------------------------------------------------------------ */

function lootView(app: App, ctx: RunCtx, changed: () => void, standalone: boolean): HTMLElement {
  const { run } = ctx;
  const loot = run.pendingLoot;
  const items = loot?.items ?? [];
  const leave = async () => {
    if (items.length) {
      const ok = await app.confirm('Leave loot behind?', `${items.length} item${items.length > 1 ? 's' : ''} will be left here.`, 'Leave it');
      if (!ok) return;
    }
    closeRoom(ctx);
    changed();
  };
  const body = h(
    'div',
    { class: 'loot', 'data-panel': 'loot' },
    loot && loot.coins > 0 ? h('div', { class: 'loot-coins' }, `${loot.coins} ${C.terms.coins}`) : null,
    items.length
      ? h(
          'div',
          { class: 'loot-items' },
          items.map((d, i) =>
            h(
              'div',
              { class: `loot-item ${d.unique ? 'unique' : ''}`, 'data-loot': d.id },
              itemSlot({ id: d.id, qty: d.qty }, { onClick: () => { app.check(takeLoot(ctx, i)); changed(); }, hint: 'Click to take.' }),
              h('span', null, C.item(d.id).name, d.qty > 1 ? ` x${d.qty}` : '', phBadge(C.item(d.id).ph)),
              button('Take', () => {
                app.check(takeLoot(ctx, i));
                changed();
              }, { cls: 'small' }),
            ),
          ),
        )
      : loot && loot.coins > 0
        ? null
        : h('p', { class: 'dim' }, 'Nothing left here.'),
    h(
      'div',
      { class: 'loot-actions' },
      items.length || (loot?.coins ?? 0) > 0
        ? button('Take all', () => {
            app.check(takeAllLoot(ctx));
            changed();
          }, { cls: 'primary', id: 'take-all' })
        : null,
      standalone ? button('Continue', leave, { id: 'leave-room' }) : null,
    ),
  );
  return standalone ? panel(`Loot from ${loot?.source ?? 'the room'}`, body) : body;
}

/* ------------------------------------------------------------------ */
/* Event rooms                                                         */
/* ------------------------------------------------------------------ */

function eventView(app: App, ctx: RunCtx, changed: () => void): HTMLElement {
  const { run } = ctx;
  const e = run.event;
  const done = (label = 'Continue') =>
    button(label, async () => {
      const items = run.pendingLoot?.items.length ?? 0;
      if (items) {
        const ok = await app.confirm('Leave loot behind?', `${items} item${items > 1 ? 's' : ''} will be left here.`, 'Leave it');
        if (!ok) return;
      }
      closeRoom(ctx);
      changed();
    }, { id: 'leave-room' });
  const hasLoot = run.pendingLoot && (run.pendingLoot.items.length > 0 || run.pendingLoot.coins > 0);
  const lootBlock = hasLoot ? h('div', { class: 'event-loot' }, h('h4', null, 'Found'), lootView(app, ctx, changed, false)) : null;
  if (!e) return panel('Empty room', done());
  const act = (label: string, fn: () => void, disabled?: string, id?: string) =>
    button(label, () => {
      fn();
      changed();
    }, { disabled, id });

  switch (e.kind) {
    case 'rest': {
      const smith = smithOptions(ctx);
      const recharge = rechargeOptions(ctx);
      const pots = potionSlots(ctx);
      return panel(
        named(ROOM_INFO.rest.label, null),
        h('p', null, `Rest to heal ${CONFIG.REST_HEAL_PCT}% of your Hitpoints and refill run energy.`),
        h(
          'div',
          { class: 'event-actions' },
          act(e.rested ? 'Rested' : 'Rest', () => rest(ctx), e.rested ? 'Already rested.' : undefined, 'rest'),
          canLightBrazier(ctx) || e.brazierLit ? act(e.brazierLit ? 'Brazier lit' : 'Light the brazier (Firemaking)', () => lightBrazier(ctx), e.brazierLit ? 'Already lit.' : undefined) : null,
          canFeast(ctx) ? act('Cook a feast (Cooking)', () => cookFeast(ctx)) : null,
          canSwitchSpellbook(ctx) ? act('Switch spellbook (Magic)', () => switchSpellbook(ctx)) : null,
          canMixPotions(ctx) && pots.length >= 2 ? act(`Mix ${C.item(run.inventory[pots[0]]!.id).name} + ${C.item(run.inventory[pots[1]]!.id).name} (Herblore)`, () => mixPotions(ctx, pots[0], pots[1])) : null,
          ...smith.map((o) => act(`Smith ${C.item(o.from).name} → ${C.item(o.to).name}`, () => smithUpgrade(ctx, o.slot as EquipSlot))),
          ...recharge.map((s) => act(`Recharge ${SLOT_LABELS[s].toLowerCase()} jewellery (Crafting)`, () => rechargeJewellery(ctx, s))),
          canRestoreSpec(ctx) ? act('Restore special energy', () => restoreSpec(ctx)) : null,
        ),
        lootBlock,
        h('div', { class: 'event-footer' }, done()),
      );
    }
    case 'trader': {
      return panel(
        e.discount ? 'Hidden port' : ROOM_INFO.trader.label,
        h('p', null, `You have ${run.coins} ${C.terms.coins}. Click items in your inventory to sell them (${Math.round(CONFIG.SELL_RATE * 100)}% of value).`),
        h(
          'div',
          { class: 'shop' },
          e.stock.map((s, i) =>
            h(
              'div',
              { class: 'shop-item', 'data-stock': s.id },
              itemSlot({ id: s.id, qty: s.qty }),
              h('span', { class: 'shop-name' }, C.item(s.id).name, s.qty > 1 ? ` x${s.qty}` : '', phBadge(C.item(s.id).ph)),
              button(`Buy (${s.price})`, () => {
                app.check(buy(ctx, i));
                changed();
              }, { disabled: run.coins < s.price ? `Needs ${s.price} ${C.terms.coins}.` : undefined, cls: 'small' }),
            ),
          ),
        ),
        canPickpocket(ctx) ? h('div', { class: 'event-actions' }, act('Pickpocket the trader (Thieving)', () => pickpocket(ctx))) : null,
        lootBlock,
        h('div', { class: 'event-footer' }, done('Leave')),
        h('p', { class: 'dim small' }, `Sell values: ${run.inventory.filter(Boolean).slice(0, 3).map((s) => `${C.item(s!.id).name} ${sellValue(s!.id, s!.qty)}`).join(', ')}${run.inventory.filter(Boolean).length > 3 ? ', ...' : ''}`),
      );
    }
    case 'chest':
      return panel(
        ROOM_INFO.chest.label,
        h('p', null, e.variant === 'locked' ? (chestNeedsThieving(ctx) ? 'It is locked. Without Thieving you can only smash it open for a few coins.' : 'It is locked, but you know how to pick it.') : e.variant === 'trapped' ? 'The lid looks trapped.' : 'An old chest.'),
        !e.opened ? h('div', { class: 'event-actions' }, act('Open the chest', () => openChest(ctx), undefined, 'open-chest')) : null,
        lootBlock,
        h('div', { class: 'event-footer' }, done()),
      );
    case 'gather': {
      const room = C.gatherRoom(e.room)!;
      return panel(
        room.name,
        h('p', null, room.description),
        room.skill ? h('p', { class: 'dim' }, `Uses ${C.skill(room.skill).name}. Higher ranks yield more.`) : null,
        canHarvest(ctx) ? h('div', { class: 'event-actions' }, act(e.harvested ? 'Harvest again' : 'Harvest', () => harvest(ctx), undefined, 'harvest')) : null,
        lootBlock,
        h('div', { class: 'event-footer' }, done()),
      );
    }
    case 'slayer': {
      const master = C.slayerMaster(e.master);
      const task = run.slayerTask;
      return panel(
        named(master.name, master.ph),
        h('p', { class: 'quote' }, `"${master.greeting}"`),
        task && !task.done ? h('p', null, `Current task: ${task.label} (${task.have}/${task.need}).`) : null,
        run.slayerOffer?.length
          ? h(
              'div',
              { class: 'event-actions' },
              run.slayerOffer.map((o, i) => act(`Accept: ${o.label} (${o.points} pts)`, () => acceptSlayerTask(ctx, i), undefined, `task-${i}`)),
            )
          : null,
        canRerollSlayer(ctx) ? h('div', { class: 'event-actions' }, act('Ask for a different task', () => rerollSlayer(ctx))) : null,
        h('div', { class: 'event-footer' }, done()),
      );
    }
    case 'sea':
      return panel(
        ROOM_INFO.sea.label,
        h('p', null, 'A boat is tied up at the edge of the water.'),
        !e.resolved
          ? h(
              'div',
              { class: 'event-actions' },
              act('Drift to the far shore', () => sail(ctx, 'drift'), undefined, 'sail-drift'),
              seaHasChoice(ctx) ? act('Row to the island (loot)', () => sail(ctx, 'island')) : null,
              seaHasChoice(ctx) ? act('Row to the hidden port (cheap trader)', () => sail(ctx, 'port')) : null,
            )
          : null,
        lootBlock,
        h('div', { class: 'event-footer' }, done()),
      );
  }
}

/* ------------------------------------------------------------------ */
/* Boons and act completion                                            */
/* ------------------------------------------------------------------ */

function boonView(ctx: RunCtx, changed: () => void): HTMLElement {
  const { run } = ctx;
  return panel(
    `Choose a ${C.terms.boons.toLowerCase().replace(/s$/, '')}`,
    h('p', { class: 'dim' }, `Your kills have earned a ${C.terms.boons.toLowerCase().replace(/s$/, '')}. It lasts until the end of this trip.`),
    h(
      'div',
      { class: 'boon-choices' },
      (run.boonOffer ?? []).map((id) => {
        const b = C.boon(id);
        const have = run.boons[id] ?? 0;
        return h(
          'button',
          {
            class: 'boon-card',
            'data-boon': id,
            onClick: () => {
              chooseBoon(ctx, id);
              changed();
            },
          },
          h('div', { class: 'boon-name' }, b.name, phBadge(b.ph)),
          h('div', { class: 'boon-desc' }, b.description),
          have ? h('div', { class: 'dim small' }, `You have ${have}/${b.stack}`) : null,
        );
      }),
    ),
  );
}

function actCompleteView(app: App, ctx: RunCtx, slot: number, changed: () => void): HTMLElement {
  const { run } = ctx;
  const final = isFinalAct(run);
  const nextAct = !final ? C.act(C.route(run.routeId).acts[run.actIndex + 1]) : null;
  return panel(
    final ? 'Trip complete!' : 'Act complete',
    final
      ? h('p', null, `You have cleared every act. Finish the trip to collect the full-clear bonus (+20% XP, 50% of trip ${C.terms.coins} banked).`)
      : h('p', null, 'A portal home shimmers next to the fallen boss. Retreat to bank 25% of your trip Coins, or press on to ', named(nextAct!.name, nextAct!.ph), ' (heals 25% of your Hitpoints).'),
    h('p', { class: 'dim' }, `Trip so far: ${run.xp} XP, ${run.coins} ${C.terms.coins}, ${run.stats.kills} kills.`),
    h(
      'div',
      { class: 'event-actions' },
      final
        ? button('Finish the trip', () => {
            continueToNextAct(ctx);
            app.persist();
            app.go({ name: 'results', slot });
          }, { cls: 'primary big', id: 'finish-trip' })
        : [
            button('Press on', () => {
              continueToNextAct(ctx);
              changed();
            }, { cls: 'primary big', id: 'press-on' }),
            button('Retreat home', async () => {
              const ok = await app.confirm('Retreat?', `End the trip now. You keep your XP and bank 25% of ${run.coins} ${C.terms.coins}. Items are lost except what fits in your ${C.terms.vault}.`, 'Retreat');
              if (!ok) return;
              retreat(ctx);
              app.persist();
              app.go({ name: 'results', slot });
            }, { id: 'retreat' }),
          ],
    ),
  );
}
