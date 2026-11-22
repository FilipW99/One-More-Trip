# One More Trip

A short-run roguelike with tick-based combat and long-term meta progression. Pick a character, take a trip through four acts of branching rooms, fight on a 0.6-second tick with protection prayers and telegraphed boss attacks, then bring your XP home, spend skill points, build up your hub, and take one more trip.

The design is in `meta-progression.md` (the project's design doc).

> **Placeholder build.** Everything the design doc takes from the source game (bosses, places, monsters, items, prayers, spells, relics, pets, system names and all art) is a generic placeholder, marked in-game with a purple **PH** badge. [docs/PLACEHOLDERS.md](docs/PLACEHOLDERS.md) lists every one with its file and line, and [docs/REPLACING_CONTENT.md](docs/REPLACING_CONTENT.md) explains how to swap in the real content and art.

## Play

```sh
npm install
npm run dev        # http://localhost:5173
```

Or build a static site with `npm run build` (output in `dist/`, works from any static host or sub-path).

**Controls (combat):** click a tile to walk, click a monster to attack. `Q` `W` `E` toggle the magic, ranged and melee protection prayers once unlocked; `A` `D` `F` toggle boost prayers; `X` eats food; `C` drinks a prayer potion; `R` toggles run; `S` arms the special attack; `P` pauses. Right-click items for more options. Hover anything for details.

## Develop

```sh
npm test               # unit tests (Vitest)
npm run typecheck
npm run e2e            # browser smoke test (Playwright; builds first)
npm run sim            # balance simulator: autoplays trips and prints XP/death stats
npm run placeholders   # regenerate docs/PLACEHOLDERS.md
```

Useful URL parameters: `?seed=123` fixes the trip seed, `?tick=100` speeds up combat.

## Docs

- [docs/HANDOVER.md](docs/HANDOVER.md): start here if you are picking the project up: status, code map, known gaps and next steps.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the code is laid out and how a trip flows.
- [docs/DECISIONS.md](docs/DECISIONS.md): defaults chosen for the design doc's open questions, rules filled in, and first-pass balance numbers.
- [docs/PLACEHOLDERS.md](docs/PLACEHOLDERS.md): every placeholder record (generated).
- [docs/REPLACING_CONTENT.md](docs/REPLACING_CONTENT.md): how to replace placeholders and add art.
