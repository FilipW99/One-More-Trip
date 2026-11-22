# Architecture

One More Trip is a browser game written in TypeScript and built with Vite. There is no server: saves are kept in localStorage.

```
src/
  config.ts          tuning numbers (XP curve, drop rates, costs, tick length)
  content/           all game content as plain data (placeholders live here)
  core/              game rules, no DOM: runs headless in tests and the simulator
    combat/          tick engine, hit formulas, grid geometry and pathing
  render/            canvas drawing: procedural placeholder art and the arena
  ui/                DOM screens (title, hub, trip map, combat, results)
scripts/             balance simulator and placeholder report
tests/               Vitest unit tests (tests/*.test.ts) and Playwright e2e (tests/e2e)
docs/                these documents
```

## Layers

- **content** knows nothing about rules. Records reference each other by id. `src/content/index.ts` exposes everything as `C` with lookups like `C.item(id)`.
- **core** holds all rules and state changes. State is plain JSON (`src/core/state.ts`): a `SaveFile` with up to three `CharacterSave`s, each with an optional `activeRun: RunState`. Randomness comes from a seeded generator whose state is stored in the run, so trips are reproducible from a seed.
- **render** and **ui** read state and call core functions. They never change state directly, apart from calling those functions.

## Modifiers

Skills, hub tiers, relics, omens, boons, prayers and item passives all produce `Effect`s. `src/core/mods.ts` folds the ones that apply into a `Mods` object (numbers, flags, drop gates, drop weights, room unlocks). Rules ask `mod(m, 'accMelee')` or `m.flags.has('pickpocket')` rather than checking where a bonus came from. `src/core/flags.ts` records where each flag is implemented, and a test checks every flag in content is known.

## A trip

1. `startRun` builds the kit (with Workshop upgrades), pulls in Vault items, applies starting supplies and generates the first act map.
2. On the map the player picks a reachable node. `enterNode` either starts an `Encounter` (combat, elite, boss) or opens an event room (rest, trader, chest, gathering, Slayer master, sea route).
3. Fights run in `src/core/combat/engine.ts`. Each `stepEncounter` call is one 0.6 s tick: player input, movement, player attack, monster and boss actions, projectiles landing, ground hazards landing, prayer drain, then win or loss. Protection prayers are checked when an attack lands, so switching after seeing a projectile launch works.
4. `processKills` turns kills into XP, coins, drops and Slayer progress. `finishEncounter` handles ammo recovery, charges and room-end effects, then moves to the loot phase.
5. Beating the act boss offers "press on" or "retreat". The last act ends the trip with a full clear.
6. `endRun` applies the end-of-run table (§3.3) and writes a `RunResult`; the results screen lets the player pick Vault items.

## UI

`src/ui/app.ts` owns the save and switches between screens. Each screen is a function that builds DOM and returns an optional cleanup. The combat screen runs a `setInterval` at the tick length for the simulation and a `requestAnimationFrame` loop for drawing, interpolating positions between ticks.

Test hooks: `window.__omt` is the app; `window.__omtCombat` exposes the live fight. URL parameters `?seed=123` (fixed trip seed) and `?tick=100` (tick length in ms) make automated runs reproducible and fast.

## Tools

- `npm run sim` plays many trips with the autoplayer (`src/core/bot.ts`) and prints death rates, depth and XP per profile; `npm run sim -- 60 progress` levels one character from scratch.
- `npm run placeholders` regenerates `docs/PLACEHOLDERS.md`.
