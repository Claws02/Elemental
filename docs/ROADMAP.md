# Roadmap: from prototype to the full game

Written against the full-game brief (2026-09-30), after inspecting both repositories and running every test. It answers the brief's steps 1–4: what exists, what is missing, and the order to build it.

## Where it stands (all tests passing)

| Area | Exists | Missing for the full game |
|---|---|---|
| Earth | Grab, drag, flick-throw, slow drop; mass limit from Power; sway from Control | Spike, Slam, Wall, Armor; terrain raising |
| Fire | Ignite, pull a fireball, heat stone, spread and burn, wild Fire | Jab, Charge, Stream, Wall, Thermal Lift, Dash |
| Water | Stream from a basin, orb, douse, soak, push | Whip, Pull, Heal, Freeze; water from other sources |
| Air | Wind and gust from the hero, pushes, fans or blows out fire | Blast, Shield, Glide, Tornado, Dash |
| Combinations | Steam (water on hot stone), hot stone lights wood, wind fans fire | Molten rock, mud, mist and ice, intensified flame, the all-four interaction |
| Progression | Power and Control per element; locked, wild and trained states; saved flags | Unlocks tied to story beats; Control-gated techniques |
| Player | Moves, faces, holds, throws | **Health, damage, death, checkpoints, customisation** |
| Enemies | None | **All of it**: creatures, AI, elemental weaknesses, bosses |
| World | Scenes as data, building kit, destructible barricade, plates, gates, triggers | Terrain heights, larger scenes, travel between scenes, destructible buildings, state variants (burned, transformed) |
| Story | Steps, conditions, actions, reactions, end card; Lesson I | Dialogue choices, companion lines, cutscene camera, cross-scene flags |
| Consequences | Cause attribution on every break and fire; Cael's trust flag | Consequence ledger, regional reputation, persistent world-state IDs, NPC memory |
| Save | Progression plus flags in localStorage | Save slots, world state, checkpoints, versioned migration, corruption recovery |
| Audio | None | All of it |
| Menus | Title screen | Pause, settings, save slots, customisation, chapter select for QA |
| Mobile | Web; Capacitor configured | Native iOS and Android projects; device testing |
| Editor | Place, properties, wires, story, play, save for Claude | Multi-select, terrain, NPC routes, enemies, world-state variants |

## The honest scale

The brief describes 8–12 hours of authored content: 5 regions, a capital, 5 rulers, 3 companions, 10–14 enemy types, 5–6 bosses and 4 endings. A small professional team takes that much content a year or more. Systems are not what limits it. Authored places, encounters and tuning are, and the tuning has depended on phone playtests every time (Air too strong, the wobble, fire spread, hold times).

In this environment I can build every system, and author every region, encounter and line of dialogue, in the current code-built art style with synthesised audio. I can't play it on a device, judge feel, or make final-quality art or music. So each phase ends with a build for you to play, and the next phase starts from your notes.

## Order of work

Every phase keeps the game playable from the title screen and ends with the tests green.

1. **Core systems.** Player health and damage, death and checkpoints, save slots with world state and migration, the consequence ledger (hidden: causes, not a meter), regional reputation, element tuning moved into `src/data/elements.js`, and scene-to-scene travel.
2. **Creatures and combat.** A creature framework (data-driven archetypes, simple state-machine AI, physics bodies that elements act on), elemental weaknesses that follow from physics, the first 3 archetypes, and an elite.
3. **The prologue: the village fire.** A playable disaster where fire spreads through real village buildings, with measured damage, Cael's arrival and the aftermath. Lesson I follows it.
4. **Elemental expansion.** The abilities in the brief's list, each as a material + gesture verb (no cooldown buttons), the combinations, and traversal (platforms, thermal lift, glide, freeze).
5. **Terrain and bigger places.** Height-field terrain, larger scenes with culling, and editor support for terrain, multi-select and NPC routes. *Built: every region blocked out as a 240 m terrain scene, linked by exits, with region architecture, nature, twelve creatures and the rulers (CHECKLIST.md).*
6. **World and story, act by act.** Acts I–VI: regions, rulers, companions, the ancient mystery, the transformation (world-state variants), Cael's discovery, the fracture, the confrontation and his death, the final act and the endings.
7. **Bosses.** Five or six, each a mechanic to understand, one per act or region.
8. **Polish.** Synthesised audio and music hooks, VFX, lighting, UI, and performance on device.
9. **QA.** Automated tests per system, every ending path, save corruption and recovery, and death and checkpoints.

## Decisions waiting on you

See the questions asked on 2026-09-30: build order, world structure, audio, and who writes the world bible.
