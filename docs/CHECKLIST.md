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
- [x] **Context controls.** No element selector: the material and the gesture choose the element; hold times per material (`CONTEXT_CONTROLS.md`). *Smoke: drag on timber doesn't ignite, hold does; a rock still grabs instantly.*
- [x] **Fire interaction.** Two braziers; pull a fireball from coals or anything burning (it goes out); ignite timber on the spot; heat a held rock (a hot rock ignites wood); fire spreads and climbs, burns through, and the barricade ends **Burned**, blamed on the player. Pooled flame and smoke particles. *Smoke: 15 fire checks; screenshots. Phone: hold times feel right; spread slowed at the start (builds over 5 s) so it can be stopped early but runs away if ignored.*
- [x] **Barricade rebuilds 60 s after the last damage** (testing aid, `regenAfter` in `TestRoom.js`). *Smoke: rebuilds whole, in place, static.*
- [x] **Water interaction.** Two basins. Touch the water and a stream comes (unlimited; lands up to 8 m from the basin, falls short beyond). Yank the finger away fast, or flick, and it tears free into an orb (one splash, throwable). Puts fire out, soaks timber (won't catch for 20 s), cools hot stone in steam, pushes rocks and debris, wears planks through, all blamed on the player. *Smoke: 11 water checks; screenshots. Phone: the stream feels distinct from dragging a rock; break-off changed from 8 m to a fast yank at the player's request.*
- [x] **Air interaction.** From the hero: drag for wind, flick for a gust. Pushes things, deflects projectiles, blows out young flames, fans established ones downwind. *Phone: dousing young flames works well; it was far too strong (the barricade fell to 3 gusts) and carrying loose planks stole Fire's touch.* Now: gusts do at most 12 damage (finish off nearly-broken planks only), pushes halved, Air carries nothing, and a touch squarely on a thing beats the hero's touch area.
- [x] **Test obstacles** (testing aid). A dry hay field (catches in 0.25 s, burns fast), a crate stack, three training dummies, and two oil barrels by the barricade that burst 2.5 s after catching, lighting and damaging what's near. All reset 60 s after the last disturbance, like the barricade.
- [ ] **Elemental interaction framework.** ← **next.** Materials as data, one interactable registry, shared holding (`Channel`) and the Intent state machine exist. With all four elements in, move each element's tuning (`EARTH`, `FIRE`, `WATER`, `AIR`: force, range, reach, rates) into `src/data/elements.js` so they're data, not code, and check the three systems share what they should.
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
