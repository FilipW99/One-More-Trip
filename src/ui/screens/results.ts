/** End-of-trip results: XP, level ups, rewards and Vault picks. */
import { C } from '../../content';
import { storeVault } from '../../core/run';
import { characterLevel, unspentPoints } from '../../core/save';
import type { ItemStack } from '../../core/state';
import type { App, ScreenView } from '../app';
import { h } from '../dom';
import { button, itemSlot, named, panel } from '../widgets';

export function resultsScreen(app: App, slot: number): ScreenView {
  const ch = app.character(slot);
  const res = ch?.lastResult;
  if (!ch || !res) {
    queueMicrotask(() => app.openCharacter(slot));
    return { el: h('div') };
  }
  const picks = new Set<number>();
  const slots = res.vaultSlots;
  const keep = res.keepable;
  const pickBox = h('div', { class: 'vault-picks' });
  const renderPicks = () => {
    pickBox.replaceChildren(
      ...keep.map((s, i) =>
        h(
          'div',
          { class: `vault-pick ${picks.has(i) ? 'picked' : ''}`, 'data-keep': s.id },
          itemSlot(s, {
            hint: picks.has(i) ? 'Click to put back.' : 'Click to keep in the Vault.',
            onClick: () => {
              if (picks.has(i)) picks.delete(i);
              else if (picks.size < slots) picks.add(i);
              else app.toast(`Your ${C.terms.vault} only has ${slots} slot${slots === 1 ? '' : 's'}.`, 'bad');
              renderPicks();
            },
          }),
        ),
      ),
    );
  };
  renderPicks();

  const done = () => {
    const chosen: ItemStack[] = [...picks].map((i) => keep[i]);
    storeVault(ch, chosen);
    app.persist();
    app.go({ name: 'hub', slot, tab: unspentPoints(ch) > 0 ? 'skills' : 'trip' });
  };

  const title = res.outcome === 'clear' ? 'Full clear!' : res.outcome === 'retreat' ? 'You made it home' : 'Oh dear, you are dead!';
  const leveled = res.levelAfter > res.levelBefore;
  const el = h(
    'div',
    { class: `screen results-screen ${res.outcome}` },
    app.topBar(slot),
    h('div', { class: 'results-hero' }, h('h1', { 'data-outcome': res.outcome }, title), h('p', null, `Reached act ${res.depth} · ${res.rooms} rooms cleared · ${res.kills} kills`)),
    h(
      'div',
      { class: 'results-grid' },
      panel(
        'Experience',
        h('table', { class: 'xp-table' },
          res.xpBreakdown.map((r) => h('tr', null, h('td', null, r.label), h('td', { class: 'num' }, `+${r.value}`))),
          h('tr', { class: 'total' }, h('td', null, 'Total'), h('td', { class: 'num', 'data-xp': String(res.xpEarned) }, `+${res.xpEarned}`)),
        ),
        leveled
          ? h('div', { class: 'level-up' }, `Level up! ${res.levelBefore} → ${res.levelAfter}. +${res.pointsGained} skill point${res.pointsGained === 1 ? '' : 's'}.`)
          : h('p', { class: 'dim' }, `Level ${characterLevel(ch)}.`),
      ),
      panel(
        'Rewards',
        h('ul', { class: 'plain-list' },
          h('li', null, `${res.coinsBanked} ${C.terms.coins} banked`, res.outcome === 'death' ? h('span', { class: 'dim' }, ' (coins are lost on death)') : null),
          res.leaguePoints ? h('li', null, `+${res.leaguePoints} `, named(C.terms.leaguePoints, C.termPlaceholders.leaguePoints), ` from ${res.tasksCompleted.length} task${res.tasksCompleted.length === 1 ? '' : 's'}: ${res.tasksCompleted.map((t) => C.task(t).name).join(', ')}`) : null,
          res.slayerPoints ? h('li', null, `+${res.slayerPoints} ${C.terms.slayerPoints} (full-clear Slayer bonus)`) : null,
          res.bossesKilled.length ? h('li', null, `Bosses: ${res.bossesKilled.map((b) => C.boss(b).name).join(', ')}`) : null,
          res.uniques.length ? h('li', { class: 'rare' }, `Uniques: ${res.uniques.map((u) => C.item(u).name).join(', ')}`) : null,
          res.pets.length ? h('li', { class: 'rare' }, `Pets: ${res.pets.map((p) => C.item(p).name).join(', ')}`) : null,
          h('li', null, `${res.newCollection.length} item type${res.newCollection.length === 1 ? '' : 's'} logged in the ${C.terms.collectionLog}`),
        ),
      ),
      panel(
        C.terms.vault,
        slots > 0
          ? [
              h('p', null, `Pick up to ${slots} item${slots === 1 ? '' : 's'} to keep for your next trip. Everything else is lost.`),
              keep.length ? pickBox : h('p', { class: 'dim' }, 'You came back with nothing worth keeping.'),
            ]
          : h('p', { class: 'dim' }, `Items are lost at the end of a trip. Build the ${C.feature('vault').name} in your ${C.terms.hubName} to keep some.`),
      ),
    ),
    h('div', { class: 'results-actions' }, button(`Return to ${C.terms.hubName}`, done, { cls: 'primary big', id: 'results-done' })),
  );
  return { el };
}
