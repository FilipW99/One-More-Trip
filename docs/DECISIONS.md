# Decisions and defaults

Choices made while building the first version, so they are easy to find and change. Section numbers refer to the design doc, `meta-progression.md`.

## Content

- **Placeholders for all source-game content.** Bosses, locations, monsters, items, prayers, spells, relics, pets, system names and art are generic stand-ins, each tagged with the design-doc slot it fills. Nothing is imported or recreated from the source game, and there is no cache loader. See [PLACEHOLDERS.md](PLACEHOLDERS.md) and [REPLACING_CONTENT.md](REPLACING_CONTENT.md).
- **Original systems are built as designed:** run loop, three combat focuses and starting kits, the act route, end-of-run table, 24 skill tracks with perks at ranks 3/6/10, level 60 and 65 points, the XP curve, drop rules, hub upgrades and costs, relics, omens, boons, pets and tasks.

## Open questions (§10): defaults used

| # | Question | Default in this build | Where to change it |
|---|---|---|---|
| 1 | Item persistence | Items are lost at the end of a trip except what fits in the Vault (0 slots until the Vault room is built, up to 3). | `HUB_FEATURES` vault tiers in `src/content/hub.ts` |
| 2 | Off-focus equipment | Any character can equip any item if they meet its level requirement. Focus only picks the kit and weights weapon drops (80% focus share). | `CONFIG.FOCUS_WEAPON_SHARE`, `equipReason` in `src/core/inventory.ts` |
| 3 | Unique protection | Pity on: each dry boss kill adds 2 percentage points to that boss's unique chance until a unique drops. | `CONFIG.PITY_ENABLED`, `CONFIG.PITY_PER_KILL` |
| 4 | Max level and points | Level 60, 65 points (one per level plus one every 10th level). | `CONFIG.MAX_LEVEL`, `CONFIG.BONUS_POINT_EVERY` |
| 5 | Respec | As in §4.1: first respec free, then 100 Coins per previous respec, capped at 1,000. Needs the Study. | `CONFIG.RESPEC_COST_*` |
| 6 | Combat feel | 0.6 s tick by default. Settings offer slower or faster ticks for accessibility and testing. | `CONFIG.TICK_MS`, Settings |
| 7 | Route choice | The finale is the tomb raid (act 4). The volcanic route swaps act 3 for a wave gauntlet and unlocks with the Portal Chamber. | `ROUTES` in `src/content/acts.ts` |
| 8 | Cache baseline | Not applicable: no cache data is used. | |

## Rules filled in where the doc is silent

- **Map size.** Each act map has 8 to 12 rooms in 4 or more rows, and a trip passes through one room per row (about 5 rooms per act). Two-boss acts give each boss its own final row so the route choice is real.
- **Coins on death.** Trip Coins are lost on death, 25% are banked on retreat and 50% on a full clear, per the §3.3 table.
- **Retreat.** Only through the portal after an act boss (§3.3).
- **Fights are not saved mid-way.** The trip is saved after every room. If the page is reloaded during a fight, that room's fight starts over with your current HP and supplies.
- **Ammunition.** The ranged kit keeps the doc's 50 bronze arrows. To keep ranged viable, kills drop a few arrows matching your quiver (70% chance, 6 to 14, doubled for elites and bosses), half of fired arrows are recovered after each room (plus 4% per Fletching rank), and traders stock arrows.
- **Run XP.** Monster XP is roughly flat across acts, so that deaths in act 1 and 2 and full clears land in the §8.2 ranges. A full clear adds 20%.
- **Boons** are offered at trip-XP thresholds (`CONFIG.BOON_THRESHOLDS`), three choices each.
- **Pause.** Fights can be paused (P). This is a single-player game, so pausing costs nothing and helps accessibility.
- **Saves** live in the browser's localStorage under `one-more-trip.save`, with a version number and a migration hook.

## Balance (first pass)

Measured with the autoplayer (`npm run sim`, 60 trips per profile, bot reacts correctly to 85% of attacks):

| Profile | Deaths | Clears | Avg act reached | XP if died in act 1 | XP if died in act 2 | XP on clear |
|---|---|---|---|---|---|---|
| Level 1 melee | 100% | 0% | 1.8 | 312 | 525 | - |
| Level 1 ranged | 100% | 0% | 1.9 | 264 | 553 | - |
| Level 1 magic | 100% | 0% | 1.8 | 349 | 516 | - |
| Level 10 melee | 100% | 0% | 2.2 | - | 749 | - |
| Level 20 ranged | 100% | 0% | 2.9 | - | 846 | - |
| Level 30 melee | 98% | 2% | 3.6 | - | - | 2,225 |
| Level 45 magic | 83% | 17% | 3.6 | - | - | 2,155 |
| Level 60 melee | 5% | 95% | 3.9 | - | 344 | 2,313 |

Design targets (§8.2): died in act 1, 300 to 500 XP; died in act 2, 800 to 1,200; full clear, 2,000 to 2,800. A single bot character reaches level 30 in about 7 trips and level 60 in about 32 (target: 8 to 10 and 40 to 50). People will die more than the bot early on, so real pacing should be slower. The bot never retreats, so its Coin income (and hub progress) is lower than a careful player's.

Known balance gaps worth a look: act 2 bosses and the act 3 boss are the main walls for mid-level characters, and the level 30 to 45 band rarely clears.
