# Agent notes

Read [docs/HANDOVER.md](docs/HANDOVER.md) first. It covers what's built, the code map, known gaps and next steps.

## Rules

- **Placeholder content only.** All content derived from the source game (bosses, places, monsters, items, prayers, spells, relics, pets, system names, art) is a generic placeholder. Do not add real names, art or data from the source game, and do not extract its cache. The owner swaps real content in themselves.
- **Content is data.** New or changed content goes in `src/content/`. Tag every stand-in record with `ph: ph('§x', 'slot')`, using the design-doc slot it fills. The engine must not hard-code content names.
- **Core stays headless.** `src/core` must not touch the DOM. UI code in `src/ui` reads state and calls core functions.
- **Use the run's RNG** (`withRng` in `src/core/run.ts`) for anything random during a trip.
- **New effect flags** need an entry in `src/core/flags.ts`.
- **Save shape changes** need a `SAVE_VERSION` bump and a step in `migrate()` (`src/core/save.ts`).
- **Tuning numbers** live in `src/config.ts`. Note balance changes in `docs/DECISIONS.md`.

## Before you finish

```sh
npm run placeholders   # after any content change: regenerates docs/PLACEHOLDERS.md
npm run check          # typecheck + unit tests + placeholder report up to date
npm run e2e            # Playwright smoke test (builds first)
npm run sim -- 60      # after balance changes: compare with the table in docs/DECISIONS.md
```

There is no CI, so these are the only gate.
