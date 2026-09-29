# Technical architecture

The design brief was written for Unity. Elemental runs on Hundred Block Dash's stack instead. This document maps one onto the other, and records how the pieces that exist today fit together.

## 1. The stack, and why

| | |
|---|---|
| Rendering | three.js r186, vendored ES module, imported through `src/engine/lib.js` |
| Physics | cannon-es 0.20 (the maintained fork of cannon.js), same way |
| Language | Plain ES modules. No bundler, no build step: the repo root *is* the web build |
| Native shell | Capacitor 8 (`capacitor.config.json`), `www/` produced by `scripts/build-web.js` |
| Tests | Headless Chromium through Playwright (`qa/smoke.js`, `qa/modelsheet.js`), plus a static parse and dead-reference check (`qa/parsecheck.sh`) |

**Why not Unity:** HBD already ships to iOS and Android on this stack, its model toolkit and QA tooling carry straight over, and every change can be built, run and screenshotted in CI and in a cloud session. Unity can't be run or tested in either.

**The cost, stated plainly:** Unity would handle streaming, skinned characters, profiling and a large physics budget more easily. An 8–12 hour 3D action RPG in a web view on a mid-range phone is a stretch goal. The mitigation is the brief's own roadmap: Phase 2's "20 minutes of fun" test and Phase 4's destruction test are where the web stack proves itself or doesn't. If it doesn't, the design, data and model knowledge transfer to Unity; the code doesn't.

## 2. Unity terms → Elemental

| Brief (Unity) | Elemental |
|---|---|
| `Assets/Scripts/<System>/` | `src/<system>/` (see §3) |
| MonoBehaviour | A plain class with `update(dt)`, called in a fixed order from `src/main.js` |
| ScriptableObject | A data module: a frozen object exported from `src/data/*.js` (planned). Designers edit data; systems read it. The Phase 1 constants (`EARTH` in `EarthSystem.js`, `BUDGET` in `Physics.js`) move there when the second element arrives |
| Prefab | A builder function returning `{ group, …collider dimensions }` (`src/art/*.js`) |
| Scene / additive loading | A region module that builds its content into the scene and registers its bodies; streaming by region (planned, Phase 8) |
| Rigidbody | A `cannon.Body` registered through `Physics.add()` with a **tier** |
| Interfaces (`IGrabbable`, `IFlammable`, …) | **Capabilities on the physics entry's `data`** (planned): a rock is `{ grabbable, throwable }`, a plank panel `{ breakable, flammable }`. Systems query capabilities; nothing is special-cased per object |
| Unity events / UnityEvent | `EventBus` (`src/core/EventBus.js`) |
| PlayerPrefs / save | `localStorage` for the prototype, then Capacitor Preferences or the filesystem; versioned (see §6) |

## 3. Source layout

```
index.html              loads src/main.js as a module
css/styles.css          HUD only
vendor/                 three.js r186, cannon-es 0.20 (ES modules; see vendor/README.md)
assets/fonts/           Nunito (OFL)
src/
  main.js               bootstrap and the frame order (no GameManager)
  core/EventBus.js      world events (§40), with a recent-event log
  engine/lib.js         the only importer of vendor/: re-exports THREE and CANNON
  engine/Kit.js         the model accumulator (from HBD's CityKit)
  engine/Physics.js     cannon world, tiers, debris budget, out-of-world recovery
  engine/Renderer.js    scene, sky, sun and shadows, quality tier
  art/Palette.js        element and world colours
  art/HeroModel.js      the protagonist: jointed model and procedural animator
  art/PropModels.js     rock, floor, ruin wall, pillar, arch, planks, posts
  input/Gestures.js     move stick, press / drag / release velocity, orbit, pinch; WASD at a desk
  input/Intent.js       what a touch means: material + gesture → element and verb (CONTEXT_CONTROLS.md)
  data/materials.js     which elements act on which material, and the hold times
  player/PlayerController.js   the hero's body, movement and facing
  player/CameraRig.js   third-person orbit, clip avoidance, target framing
  elements/Channel.js   the hero's hands: hold, move, throw, drop, aim; tether in the element's colour
  elements/EarthSystem.js      Earth's sensing (rock highlight) and limits
  elements/FireSystem.js       ignite, heat, spread, burn out, fireballs, hot stone; douse, soak, quench
  elements/WaterSystem.js      stream (tube + spray) while connected to a basin, orbs once broken off
  art/FireFx.js         pooled flame and smoke particles, two draw calls
  world/Interactables.js       everything a touch can land on, with its material
  world/Destructible.js modular structures: pieces, support, states, cause
  world/TestRoom.js     the Phase 1 room
  ui/Hud.js             stick, element badge, hint, event log, debug readout
qa/
  parsecheck.sh         module parse + dead private-helper check (from HBD)
  smoke.js              the Phase 1 gate (CI)
  modelsheet.js         model review screenshots
scripts/build-web.js    copies the shipped files to www/ for Capacitor
docs/                   brief, architecture, art, checklist
```

## 4. The frame

`src/main.js` owns the order and nothing else:

```
intent (what the finger means) → channel (forces on what is held) → earth (sensing)
      → player (velocity) → physics step
      → fire (contacts recorded in the step, burning, spread)
      → structures (apply hits and burns) → particles → camera → render → HUD
```

Hits and contacts are **recorded** during the physics step and **applied** after it, because changing a body from static to dynamic inside cannon's collision callback corrupts the solver. `FireSystem.update()` and `Destructible.update()` do the applying.

`dt` is capped at 0.1 s. Physics runs a fixed 1/60 step with up to 6 sub-steps, so a slow frame doesn't put the simulation into slow motion (a lesson from HBD's dice).

## 5. Physics tiers and the budget (§37, §54, §55)

| Tier | What | Simulated? |
|---|---|---|
| `static` | ground, walls, pillars, posts | Never moves |
| `interactive` | rocks | Dynamic; sleeps when still; comes back to its spawn if it leaves the world |
| `destructible` | barricade panels | Static until broken |
| `debris` | broken panels | Dynamic, **budgeted**: past `BUDGET.debris` (40) the oldest are frozen where they lie (active → cached) |
| `player` | the hero's sphere | Dynamic, rotation locked, never sleeps |
| `elemental` | fireballs | Dynamic small sphere, mostly gravity-free; removed when spent |

Fire itself (heat, spread, burning) is FireSystem's own cheap simulation, not cannon's; only the fireball is a body. Flames and smoke are pooled particles: two draw calls whatever is burning, and emission is skipped when a pool is full (480 flame / 160 smoke on desktop, 320 / 120 on phones).

The budget numbers are the brief's starting guesses. They must be profiled on real phones before anyone tunes them.

## 6. Systems: built, and planned

The brief's required systems, and where each stands. "Planned" means an unchecked item in `CHECKLIST.md`; nothing is built ahead of its turn.

| System | Status | Where |
|---|---|---|
| GameBootstrap | **Phase 1** | `src/main.js` |
| EventSystem | **Phase 1** (bus + log) | `src/core/EventBus.js` |
| InputSystem | **Phase 1** (stick, press/drag/flick, orbit, pinch, WASD; context intent) | `src/input/Gestures.js`, `src/input/Intent.js` |
| PlayerSystem | **Phase 1** (movement, facing, animation) | `src/player/` |
| ElementSystem | **Phase 1: Earth, Fire and Water** | `src/elements/` (`Channel`, `EarthSystem`, `FireSystem`), `src/data/materials.js` |
| PhysicsInteractionSystem | **Phase 1** (tiers, budget) | `src/engine/Physics.js` |
| DestructionSystem | **Phase 1** (pieces, support, states, cause) | `src/world/Destructible.js` |
| UISystem | **Phase 1** (minimal HUD) | `src/ui/Hud.js` |
| SaveSystem | Planned: versioned JSON `{ version, player, world, npcs, story, reputation }` with a migration per version bump | |
| WorldStateSystem | Planned: listens to the EventBus, keeps `{ id → state, cause, time, witnesses }` per persistent object | |
| SceneSystem | Planned: region modules, streamed | |
| NPCMemorySystem, ReputationSystem, DialogueSystem, QuestSystem | Planned (Phase 5 onward): all listen to the EventBus | |
| CombatSystem, EnemyAISystem, WielderAISystem, CaelSystem | Planned (Phase 6 onward) | |
| AudioSystem | Planned: HBD's `AudioManager.js` is the starting point | |

## 7. Cause and consequence, already wired

The brief's consequence system (§12) needs to know **who** broke something. Phase 1 already records it:

1. `EarthSystem.throwEntry()` tags the rock `thrownBy: 'player'` with a timestamp.
2. A panel hit within 6 seconds of the throw is the player's doing; debris the player knocked loose carries the blame onward.
3. `Destructible` emits `StructureDamaged`, `PieceBroken` and `StructureStateChanged` events with `cause`.
4. The HUD shows `Barricade · Critical by you`. Later, WorldState, NPC memory and reputation subscribe to the same events.

Every destructible already has a persistent ID (`TestRoom_Barricade_01`, pieces `…_P<row><col>`), so saving and restoring its state is data work, not a rename.

## 8. Risks

1. **Web performance at scale** (§1). Measure on a real mid-range Android phone during Phase 2, not after.
2. ~~three.js r128 / cannon.js 0.6.2~~ **Done** (§9).
3. **cannon-es is quiet** (0.20.0, 2022). It works and is small enough to fix ourselves. If physics becomes the bottleneck the alternative is Rapier (WASM), a bigger change.
4. **Character art** beyond stylized humanoids needs a glTF pipeline (`ART_AND_MODELS.md` §6).

## 9. Engine upgrade: r128 → r186 (2026-09-29)

Done in Phase 1, while the codebase was twelve files, because every month of new code made it dearer.

| Change | Why it mattered |
|---|---|
| Globals → ES modules through `src/engine/lib.js` | r160+ ships no global build. One re-export file means the next upgrade touches `lib.js` and `vendor/` only. No import map, so nothing depends on WebView import-map support |
| cannon.js 0.6.2 → cannon-es 0.20 | Maintained fork, same API. Only `world.remove` → `world.removeBody` changed |
| Colour management on by default (r152) | `new Color(hex)` now converts sRGB → linear itself, so `Kit`'s manual conversion was removed (it would have converted twice). `outputEncoding` → default `outputColorSpace`; the sky texture is tagged `SRGBColorSpace` |
| Physically based light units (r155) | Hemisphere and sun intensities × π to keep the same look. Checked against r128 screenshots: the model sheet matches |
| `PCFSoftShadowMap` removed (r180) | Now `PCFShadowMap`, which is soft in r186 |
| `renderer.info` now counts the shadow pass | The HUD's draw calls went 77 → 116 with no change in cost: the camera view is still 77, and 39 are shadow-map draws r128 didn't report |

**A bug the upgrade found.** The north wall runs were built with an undefined rotation. r128 quietly drew nothing for them and gave them colliders turned 90°: invisible walls inside the courtyard, and a gap either side of the arch (visible in the first phone screenshot). r186's raycaster returned NaN distances for them, which put the camera at NaN. Fixed (`rotY = 0` default in `TestRoom.js`).
