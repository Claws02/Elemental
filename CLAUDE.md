# ELEMENTAL — context for Claude

High-fantasy, physics-driven mobile action-adventure: move the four elements
by touch (no element selector; material + gesture decide), and the world
remembers what you break. Storyboards the Avatar/VR game. three.js **r186** +
cannon-es 0.20 as vendored ES modules, no build, Capacitor 8. Scenes are data
(`scenes/*.json`) made in Elemental-Editor (which pins this repo as a submodule).

## Run / verify

```
npm run serve                 # python3 -m http.server 8140 → ?scene=courtyard | village | verdant …
bash qa/parsecheck.sh src     # parse + dead _refs (CI step 1)
node scripts/validate-scenes.mjs   # every scenes/*.json against the schema
node qa/unit.mjs              # saves, ledger, scene conditions
node qa/smoke.js              # boot, move, grab, flick, break, budget (needs server on :8140)
node qa/<area>.js             # lesson, core, creatures, prologue, abilities, terrain, world, movement, buildings …
?bench                        # fixed Thornwick run, frame-time card (docs/PERFORMANCE.md)
```

CI runs all of the above. A gameplay change gets a probe in `qa/`.

## Map

| Path | What |
|---|---|
| `src/Game.js` | `startGame()`: wires systems, fixed frame order, `stop()` (the editor's Play uses it) |
| `src/engine/lib.js` | **the only importer of vendor/**: re-exports THREE, CANNON |
| `src/engine/` | Physics (tiers, debris budget), Renderer (quality tier), Kit (model accumulator) |
| `src/elements/` | Earth/Fire/Water/Air systems (FireSystem 650 lines) |
| `src/input/` | Gestures (zones, flick), Intent (what a touch means), AimAssist |
| `src/core/` | EventBus, SaveGame (slots, checkpoints, .bak), Ledger, Progression |
| `src/scene/` | schema, Catalog (994 lines, every type's model), validate. **Shared with the editor** |
| `src/world/`, `src/creatures/`, `src/story/`, `src/art/` | structures/skins, creatures+behaviours, story runner, models |
| `scenes/` | every place, as JSON (`docs/SCENES.md`) |

## Rules

- Systems talk through `EventBus` (`EV` names). No system imports another to tell it something happened.
- Consequences commit only at a checkpoint (`Session.checkpoint()`). Dying restores. That's the brief's rule.
- `scene/schema.js` changes are editor changes too: run Elemental-Editor's tests after bumping it.
- File-private helpers `_`-prefixed. Hold 60 fps on iPhone 15 (`docs/PERFORMANCE.md` budgets).

## Docs — read only what the task needs

| Task | Read |
|---|---|
| Controls / touch meaning | `docs/CONTEXT_CONTROLS.md` (+ `CONTROLS_WORKSHOP.md` for the 11-02 decisions) |
| Scenes, editor format | `docs/SCENES.md` |
| Story, progression, abilities | `docs/STORY.md`, `docs/PROGRESSION.md`, `docs/ABILITIES.md` |
| Architecture / where things go | `docs/TECH_ARCHITECTURE.md` |
| What's next | `docs/ROADMAP.md`, `docs/CHECKLIST.md` |
| Vision (rarely) | `docs/DESIGN_BRIEF.md` (36 KB, written for Unity) |

`AUDIT_2026-10.md` is history. `GROWTH_AND_COMBAT.md` is a proposal, not a decision.

## Shared kit

`Claws02/claw-kit` is this repo's stack generalized (Gestures, SaveSlots, EventBus came from here) plus shared tools. New games start from it. Elemental can adopt its tools (parsecheck.mjs is the Windows-safe port of `qa/parsecheck.sh`) without touching gameplay.
