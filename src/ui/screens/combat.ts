/** Combat screen: the arena canvas, side panel, chat and the tick loop. */
import { C } from '../../content';
import type { CombatStyle } from '../../content/types';
import {
  commandMove,
  enemyAt,
  stepEncounter,
  toggleRun,
  toggleSpecial,
  togglePrayer,
  useItem,
  type Encounter,
} from '../../core/combat/engine';
import type { Pos } from '../../core/combat/geometry';
import { runMods } from '../../core/mods';
import { currentAct, finishEncounter, log, processKills, startEncounter } from '../../core/run';
import { characterLevel } from '../../core/save';
import { maxHp } from '../../core/stats';
import { ArenaRenderer } from '../../render/arena';
import type { App, ScreenView } from '../app';
import { h, mount } from '../dom';
import { orbs, sideBody, sideSignature, sideTabs, type SideOpts, type SideTab } from '../sidepanel';
import { ROOM_INFO, styleName } from '../text';
import { chatLog } from './run';
import { bar, button, named, withTip } from '../widgets';

let sideTab: SideTab = 'inventory';

export function combatScreen(app: App, slot: number): ScreenView {
  const ch = app.character(slot);
  if (!ch?.activeRun || ch.activeRun.phase !== 'room') {
    queueMicrotask(() => app.openCharacter(slot));
    return { el: h('div') };
  }
  const ctx = app.runCtx(slot);
  const run = ctx.run;
  const node = run.map.nodes[run.roomNode!];
  let enc: Encounter;
  if (app.encounter && app.encounter.ctx.run === run) enc = app.encounter;
  else {
    // Fights are not saved mid-way: after a reload the room's fight starts over.
    enc = startEncounter(ctx, node);
    app.encounter = enc;
    log(run, 'The fight begins anew.', 'system');
  }
  enc.ctx.autoRetaliate = app.save.settings.autoRetaliate;
  const level = characterLevel(ch);
  const act = currentAct(run);
  let seen = enc.kills.length;
  let paused = false;
  let hover: Pos | null = null;
  let finished = false;
  let timer = 0;
  let raf = 0;

  const canvas = h('canvas', { class: 'arena', 'data-arena': '1' });
  const renderer = new ArenaRenderer(canvas, app.tickMs);
  const status = h('div', { class: 'arena-status' });
  const bossBar = h('div', { class: 'boss-bar' });
  const orbsBox = h('div', { class: 'orbs-box' });
  const tabsBox = h('div', { class: 'tabs-box' });
  const bodyBox = h('div', { class: 'side-body' });
  const chatBox = h('div', { class: 'chat-box' });
  let lastSig = '';
  let lastLog = -1;

  const sideOpts: SideOpts = {
    app,
    ctx,
    enc,
    tab: sideTab,
    setTab: (t) => {
      sideTab = t;
      sideOpts.tab = t;
      updatePanels(true);
    },
    changed: () => updatePanels(true),
  };

  const updatePanels = (force = false) => {
    mount(orbsBox, orbs(sideOpts));
    const sig = sideSignature(sideOpts);
    if (force || sig !== lastSig) {
      lastSig = sig;
      mount(tabsBox, sideTabs(sideOpts));
      mount(bodyBox, sideBody(sideOpts));
    }
    if (run.log.length !== lastLog || force) {
      lastLog = run.log.length;
      mount(chatBox, chatLog(run.log));
    }
    // Boss / target health.
    const boss = enc.enemies.find((e) => e.boss && !e.dead);
    const target = boss ?? enc.enemies.find((e) => e.id === enc.player.target && !e.dead);
    if (target) mount(bossBar, h('div', { class: 'boss-name' }, target.def.name), bar(target.hp, target.maxHp, boss ? '#c0392b' : '#27ae60', `${target.hp} / ${target.maxHp}`));
    else mount(bossBar);
    if (pauseBtn) pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    const alive = enc.enemies.filter((e) => !e.dead && !e.summoned).length;
    mount(status, hoverText(), h('span', { class: 'dim' }, ` · ${alive} left · tick ${enc.tick}`));
  };

  const hoverText = () => {
    if (!hover) return h('span', null, 'Click a tile to move, a monster to attack. Q/W/E protection prayers, X eat, R run, S special, P pause.');
    const e = enemyAt(enc, hover.x, hover.y);
    if (e) return h('span', null, h('b', null, 'Attack '), `${e.def.name} (${e.hp}/${e.maxHp} HP, ${styleName(e.def.style)})`);
    return h('span', null, 'Walk here');
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    setTimeout(() => {
      const res = finishEncounter(ctx, enc);
      app.encounter = null;
      app.persist();
      if (res) app.go({ name: 'results', slot });
      else app.go({ name: 'run', slot });
    }, enc.result === 'won' ? 700 : 1200);
  };

  const tick = () => {
    if (paused || finished) return;
    stepEncounter(enc);
    seen = processKills(ctx, enc, seen);
    for (const ev of enc.events) {
      if (ev.t === 'msg') log(run, ev.text, ev.kind);
    }
    renderer.onTick(enc);
    updatePanels();
    if (enc.result) finish();
  };

  const frame = () => {
    const m = runMods(ch, run);
    const protect = run.activePrayers.map((p) => C.prayer(p).protects).find((x): x is CombatStyle => !!x) ?? null;
    renderer.draw(enc, performance.now(), {
      theme: act.theme,
      actId: act.id,
      focus: ch.focus,
      pet: ch.activePet,
      protect,
      playerMaxHp: maxHp(level, m),
      hover,
      paused,
    });
    raf = requestAnimationFrame(frame);
  };

  canvas.addEventListener('mousemove', (e) => {
    const t = renderer.tileAt(e.clientX, e.clientY, enc);
    if (t?.x !== hover?.x || t?.y !== hover?.y) {
      hover = t;
      canvas.style.cursor = t && enemyAt(enc, t.x, t.y) ? 'crosshair' : 'pointer';
      updatePanels();
    }
  });
  canvas.addEventListener('mouseleave', () => {
    hover = null;
    updatePanels();
  });
  canvas.addEventListener('click', (e) => {
    if (finished) return;
    const t = renderer.tileAt(e.clientX, e.clientY, enc);
    if (!t) return;
    commandMove(enc, t.x, t.y);
    if (!enemyAt(enc, t.x, t.y)) renderer.setMarker(t);
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const t = renderer.tileAt(e.clientX, e.clientY, enc);
    const m = t ? enemyAt(enc, t.x, t.y) : null;
    if (m) log(run, `${m.def.name}: ${m.def.examine}`, 'info');
    updatePanels();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toUpperCase();
    const prayer = C.prayers.find((p) => p.key === key);
    if (prayer) {
      app.check(togglePrayer(enc, prayer.id));
    } else if (key === 'R') toggleRun(enc);
    else if (key === 'S') app.check(toggleSpecial(enc));
    else if (key === 'X') {
      const i = run.inventory.findIndex((s) => s && (C.item(s.id).kind === 'food' || C.item(s.id).potion?.effect === 'heal'));
      if (i >= 0) useItem(enc, run, ch, level, i);
      else app.toast('You have no food.', 'bad');
    } else if (key === 'C') {
      const i = run.inventory.findIndex((s) => s && (C.item(s.id).potion?.effect === 'prayer' || C.item(s.id).potion?.effect === 'restore'));
      if (i >= 0) useItem(enc, run, ch, level, i);
      else app.toast('You have no prayer potions.', 'bad');
    } else if (key === 'P' || key === 'ESCAPE') {
      paused = !paused;
    } else return;
    e.preventDefault();
    updatePanels(true);
  };
  document.addEventListener('keydown', onKey);

  const pauseBtn: HTMLButtonElement = withTip(button('Pause', () => {
    paused = !paused;
    updatePanels(true);
  }, { cls: 'small', id: 'pause' }), () => 'Pause the fight (P).');

  const info = ROOM_INFO[node.type];
  const title =
    node.type === 'boss' && node.boss
      ? named(C.boss(node.boss).name, C.boss(node.boss).ph)
      : h('span', null, info.label, node.wave !== undefined ? ` · wave ${node.wave + 1}` : '');
  const el = h(
    'div',
    { class: 'screen combat-screen' },
    app.topBar(slot, h('span', { class: 'room-title' }, title)),
    h(
      'div',
      { class: 'combat-layout' },
      h(
        'main',
        { class: 'arena-wrap' },
        bossBar,
        h('div', { class: 'arena-box' }, canvas),
        status,
        chatBox,
      ),
      h(
        'aside',
        { class: 'side' },
        orbsBox,
        tabsBox,
        bodyBox,
        h(
          'div',
          { class: 'combat-actions' },
          pauseBtn,
          h('span', { class: 'dim small' }, `${app.tickMs} ms ticks`),
        ),
      ),
    ),
  );

  updatePanels(true);
  timer = window.setInterval(tick, app.tickMs);
  raf = requestAnimationFrame(frame);

  // Test hook: lets automated tests drive fights quickly.
  (window as unknown as { __omtCombat?: unknown }).__omtCombat = {
    enc,
    tick,
    pause: (v: boolean) => (paused = v),
  };

  return {
    el,
    cleanup: () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      delete (window as unknown as { __omtCombat?: unknown }).__omtCombat;
    },
  };
}
