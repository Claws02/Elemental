# ELEMENTAL master checklist

The brief's first development checklist (§74), adapted to the web stack. **One unchecked task at a time**, in order. A task is checked only when it has been tested; the note says how.

Per task (brief §73): name the subsystem → dependencies → update this list → smallest working version → test → list the files changed → say how to verify → only then the next task.

## Phase 1: technical prototype — "Can manipulating the world actually feel fun?"

- [x] **Create the project.** Web stack, not Unity (see `TECH_ARCHITECTURE.md` §1). *Repo boots in Chromium with no page errors (`qa/smoke.js`).*
- [ ] **Configure iOS/Android build targets.** `capacitor.config.json` and `scripts/build-web.js` exist and the web build runs; the native projects (`npx cap add ios|android`) are not generated yet, and the app ID `com.claws.elemental` is a placeholder to confirm.
- [x] **Configure the input system.** Pointer Events: touch, mouse and pen through one path; WASD at a desk. *Smoke: W moves the hero.*
- [x] **Create the folder architecture.** `TECH_ARCHITECTURE.md` §3.
- [x] **Create the Git repository.** `Claws02/Elemental`.
- [x] **Engine upgrade: three.js r128 → r186, cannon.js → cannon-es.** Pulled forward from Phase 2 while the codebase is small (`TECH_ARCHITECTURE.md` §9). *Smoke passes; model sheet matches the r128 screenshots.*
- [x] **Create the bootstrap.** `index.html` + `src/main.js`, fixed frame order, no GameManager.
- [x] **Basic third-person controller.** Camera-relative movement, acceleration, facing. *Smoke.*
- [x] **Camera.** Orbit, pinch/wheel zoom, clip avoidance against walls, frames the held rock. *Screenshots; clip avoidance checked by eye only.*
- [x] **Mobile movement controls.** Floating stick in the bottom-left quarter of the screen, so the top left stays grabbable (changed after the first phone test). *Played on a phone: 30–60 fps; grab and flick feel good.*
- [x] **One test environment.** The ruined courtyard (`src/world/TestRoom.js`).
- [x] **Grabbable rock.** Ten of them, 0.35–0.85 m. *Smoke.*
- [x] **Physics grab.** Spring-held, follows the finger across a camera-facing plane, limited to reach. Fat-finger assist. *Smoke: press grabs, rock lifts.*
- [x] **Physics throw.** Flick direction on screen → world direction; flick speed → 15–36 m/s. Slow release drops. *Smoke: flick throws at 26.6 m/s; slow release does not throw.*
- [x] **Earth interaction.** Sense (amber highlight in range), grab, hold, throw, tether motes, hero reaches and throws. *Smoke + screenshots.*
- [x] **Destructible wall.** 18-panel timber barricade: damage, splash, support flood-fill, Intact → Damaged → Critical → Collapsed, cause attribution, debris budget. *Smoke: thrown rocks break it and the events blame the player; debris stays ≤ 40.*
- [ ] **Fire interaction.** ← **next.** A brazier in the room; Fire ignites the barricade's panels (`flammable`), fire spreads panel to panel, burned is a destruction state.
- [ ] **Water interaction.** A water trough or basin; pull a stream from it, push objects, extinguish fire.
- [ ] **Elemental interaction framework.** Capabilities on physics entries (`grabbable`, `throwable`, `flammable`, `breakable`, …) and element definitions as data (`src/data/elements.js`), replacing the Earth-only constants. Do this when the second element lands, so it is shaped by two real cases.
- [x] **Destruction state (in memory).** States, piece IDs, events. Persistence is the next item.
- [ ] **Save/load prototype.** Versioned JSON; the barricade reloads broken.
- [ ] **Phase 1 review on a real phone.** *First pass 2026-09-29 (r128 build): 30–60 fps, grab and flick feel good for Earth; the move zone was too big (fixed).* Still to check: the r186 build's frame rate against those numbers, what drops it to 30, and thermal after 10 minutes.

## Phase 2: elemental sandbox

- [ ] Air: push, pull, gust, redirect a thrown rock
- [ ] Freezing (Water + Air → ice)
- [ ] Fire spreading
- [ ] Water-flow approximation
- [ ] Element combinations
- [ ] Destructible structures beyond the barricade
- [ ] **Gate:** a tester spends 20 minutes experimenting unprompted. If not, stop and rethink.


## Phase 3 onward

Unchanged from the brief (`DESIGN_BRIEF.md` §57–68): mobile controls and the element wheel; the destruction system and persistent town damage; NPC memory; the first vertical slice (Veyra, awakening, Cael's introduction); the Cael system; the first region (Verdant Reach); the story system; the full world; Cael's death; the endgame.

Remaining items from the brief's §74 list, in order: small test village · NPC · NPC memory · persistent building damage · first combat encounter · first Cael prototype · first 30-minute vertical slice.
