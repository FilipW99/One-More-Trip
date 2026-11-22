import { expect, test } from '@playwright/test';

/**
 * Smoke test: create a character, start a trip, win or lose a few rooms, and make
 * sure the game reaches the results screen and back to the hub without errors.
 * Uses ?tick=40 so fights resolve quickly, and ?seed for a reproducible trip.
 */
test('a trip can be played from character creation to the results screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/?seed=7&tick=40');
  await page.getByRole('button', { name: 'Create character' }).first().click();
  await page.locator('#char-name').fill('Smoke');
  await page.locator('[data-focus="melee"]').click();
  await page.locator('[data-id="create-submit"]').click();
  await expect(page.locator('.hub-screen')).toBeVisible();
  await expect(page.locator('.ph-badge').first()).toBeVisible();

  await page.locator('[data-id="start-trip"]').click();
  await expect(page.locator('.act-map')).toBeVisible();

  const screen = () => page.evaluate(() => (window as unknown as { __omt: { screen: { name: string } } }).__omt.screen.name);
  for (let step = 0; step < 300; step++) {
    const s = await screen();
    if (s === 'results') break;
    if (s === 'combat') {
      // Keep attacking whatever is alive and eat when low.
      await page.evaluate(() => {
        const c = (window as unknown as { __omtCombat?: { enc: { player: { target: number | null }; enemies: { id: number; dead: boolean }[]; ctx: { run: { hp: number } } } } }).__omtCombat;
        if (!c) return;
        if (c.enc.ctx.run.hp < 20) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
        if (c.enc.player.target === null) c.enc.player.target = c.enc.enemies.find((e) => !e.dead)?.id ?? null;
      });
      await page.waitForTimeout(150);
      continue;
    }
    if (s !== 'run') {
      await page.waitForTimeout(100);
      continue;
    }
    const boon = page.locator('.boon-card').first();
    if (await boon.isVisible().catch(() => false)) {
      await boon.click();
      continue;
    }
    for (const id of ['press-on', 'finish-trip', 'take-all', 'rest', 'open-chest', 'harvest', 'task-0', 'sail-drift']) {
      const b = page.locator(`[data-id="${id}"]:not([disabled])`);
      if (await b.count()) await b.first().click();
    }
    const leave = page.locator('[data-id="leave-room"]');
    if (await leave.count()) {
      await leave.click();
      const ok = page.locator('.modal .btn.primary');
      if (await ok.count()) await ok.click();
      continue;
    }
    const node = page.locator('.node.available').first();
    if (await node.count()) await node.click();
  }

  await expect(page.locator('.results-screen')).toBeVisible();
  await expect(page.locator('[data-xp]')).toHaveAttribute('data-xp', /^[1-9]\d*$/);
  await page.locator('[data-id="results-done"]').click();
  await expect(page.locator('.hub-screen')).toBeVisible();

  // Progress is saved: reload and the character is still there with XP.
  await page.reload();
  await expect(page.locator('.char-slot .slot-title').first()).toHaveText('Smoke');
  expect(errors).toEqual([]);
});
