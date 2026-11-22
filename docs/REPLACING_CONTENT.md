# Replacing placeholder content

This build uses generic placeholders for everything the design doc (`meta-progression.md`) takes from the source game. The engine never hard-codes content names: all content lives as plain data in `src/content/`, and all art goes through asset keys. Replacing a placeholder is a data change, not a code change.

The full list of placeholders, with file and line for each, is in [PLACEHOLDERS.md](PLACEHOLDERS.md). Regenerate it after any content change:

```sh
npm run placeholders            # rewrite docs/PLACEHOLDERS.md
npm run placeholders -- --check # fail if it is out of date
```

## Where things live

| What | File | Notes |
|---|---|---|
| System names (hub, points, relics, omens...) | `src/content/terms.ts` | One place; every screen reads from here. |
| Acts, routes, Slayer masters | `src/content/acts.ts` | Each act lists monsters, elites, bosses, drop pool, max item tier, theme colours. |
| Monsters | `src/content/monsters.ts` | Stats, attack style, XP, coins, Slayer category. |
| Bosses | `src/content/bosses.ts` | Phases, telegraphed attacks (windup, travel, AoE, protection), uniques, pets. |
| Items | `src/content/items.ts` | Tiered gear is generated from the tables at the top (metals, woods, staves). Uniques and supplies are listed individually. |
| Prayers, spellbooks, spells | `src/content/prayers.ts` | Protection prayers keep their `protects` style and hotkey. |
| Relics, Omens, Boons | `src/content/powers.ts` | Effects use the shared effect vocabulary (see below). |
| Hub rooms, starting kits, tasks, pets, gathering rooms | `src/content/hub.ts` | |
| Skill tracks and perks | `src/content/skills.ts` | 24 tracks, perks at ranks 3, 6 and 10. |
| Art overrides | `src/content/assets.ts` or `public/assets/manifest.json` | See "Art" below. |
| Tuning numbers | `src/config.ts` | XP curve, drop rates, costs, tick length. |

## Renaming or reworking a record

1. Find the record in [PLACEHOLDERS.md](PLACEHOLDERS.md) and open the file and line listed.
2. Change `name`, `examine`, `description` or stats as needed.
3. Once the record holds the real content, set `ph: null` (or delete the `ph:` line's call and use `null`). The PH badge disappears and the record drops out of the report.
4. Keep the `id` unless you also update every reference to it. Ids are what saves, drop tables, act lists and art keys use. If you must change an id, search the repo for the old id (`grep -rn "'old_id'" src tests`) and update each use; existing saves holding the old id will drop that item on load.
5. Run `npm test` (content tests check that every reference resolves) and `npm run placeholders`.

Generated item tiers (for example the six metal tiers of every melee weapon) are built from the tables near the top of `items.ts` (`METALS`, `SCIM_ATT`, `BOWS`, ...). Rename a tier by editing its row; the ids follow the `key` column.

## Effects vocabulary

Skills, hub tiers, relics, omens, boons, prayers and item passives all describe what they do with the same small set of effects (`src/content/types.ts`):

- `{ mod: 'accMelee', value: 5 }` adds to a numeric modifier (see `ModKey`).
- `{ flag: 'unlockProtectMelee' }` switches on a rule (see `FlagId`; `src/core/flags.ts` lists where each is implemented).
- `{ gate: 'crossbow' }` lets items tagged `crossbow` into drop pools.
- `{ weight: 'shield', mult: 2 }` makes tagged items drop more often.
- `{ room: 'ore' }` adds a gathering room type to act maps.

Swapping a placeholder for licensed content normally keeps the same effects and only changes names, descriptions and stats.

## Art

Every image is requested by an asset key:

| Key | Used for | Recommended size |
|---|---|---|
| `item:<itemId>` | inventory, equipment, loot icons | 32x32 or 64x64 |
| `monster:<monsterId>` | monster and boss sprites | 64 px per tile of footprint (a size-2 boss is 128x128) |
| `player:<melee\|ranged\|magic>` | player sprite | 64x64 |
| `pet:<petId>` | pet sprite | 64x64 |
| `tile:<actId>:floor`, `tile:<actId>:wall` | arena tiles | 64x64 |
| `prayer:<prayerId>`, `skill:<skillId>` | icons | 64x64 |

To use real art:

1. Put the files under `public/assets/` (for example `public/assets/items/iron_scimitar.png`).
2. Map keys to paths in `public/assets/manifest.json` (loaded at start-up, no rebuild needed):

   ```json
   {
     "item:iron_scimitar": "items/iron_scimitar.png",
     "monster:grumbold": "monsters/grumbold.png",
     "tile:undercroft:floor": "tiles/undercroft_floor.png"
   }
   ```

   Or add the same entries to `ASSET_FILES` in `src/content/assets.ts` to bake them into the build. The manifest wins when both map a key.
3. Reload. Any key without a file keeps its procedural placeholder, so art can be swapped in gradually. A file that fails to load logs a warning and falls back to the placeholder.

Monsters and items can also set `asset: '<otherId>'` to share another record's art key.

## Checklist for a content swap

- [ ] Names, descriptions and stats updated in `src/content/*.ts`.
- [ ] `ph` set to `null` on each replaced record.
- [ ] Art files added and mapped.
- [ ] `npm test` passes.
- [ ] `npm run placeholders` re-run and `docs/PLACEHOLDERS.md` committed.
- [ ] `npm run sim` re-run if stats changed, to check the XP and survival numbers against the design doc's targets.
