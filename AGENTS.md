# Agent notes

Read [docs/HANDOVER.md](docs/HANDOVER.md) first. It covers what's built, the code map, known gaps and next steps.

## Rules

- **Content is data.** Game content lives in `src/content/`, and the engine must not hard-code content names.
- **Placeholders** mark where the real content goes. Each one carries a `ph` tag and is listed in `docs/PLACEHOLDERS.md`. To replace one, follow `docs/REPLACING_CONTENT.md` and set `ph: null`. Tag any new stand-in with `ph('§x', 'slot')` so it shows up in the report.
- **Core stays headless.** `src/core` must not touch the DOM. UI code in `src/ui` reads state and calls core functions.
- **Use the run's RNG** (`withRng` in `src/core/run.ts`) for anything random during a trip.
- **New effect flags** need an entry in `src/core/flags.ts`.
- **Save shape changes** need a `SAVE_VERSION` bump and a step in `migrate()` (`src/core/save.ts`).
- **Tuning numbers** live in `src/config.ts`. Note balance changes in `docs/DECISIONS.md`.

## Before you finish

```sh
npm run placeholders   # after content changes: regenerates docs/PLACEHOLDERS.md
npm run check          # typecheck + unit tests + placeholder report up to date
npm run e2e            # Playwright smoke test (builds first)
npm run sim -- 60      # after balance changes: compare with the table in docs/DECISIONS.md
```

There is no CI, so these are the only gate.
