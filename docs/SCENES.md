# Scenes

Every place in Elemental is a **scene file**: plain JSON in `scenes/`, made in [Elemental-Editor](https://github.com/Claws02/Elemental-Editor) or by hand. The game has no scene code of its own. `src/scene/` turns a file into a world, and `src/story/Story.js` runs its script.

| Scene | What it is | Open it |
|---|---|---|
| `lesson1.json` | Lesson I · The Quiet Element (Cael's first lesson) | `?scene=lesson` (or `lesson1`) |
| `courtyard.json` | The ruined courtyard: every element, the test obstacles | `?scene=sandbox` (or `courtyard`) |
| `village.json` | A sample village made from the building kit, with a small gate puzzle | `?scene=village` |
| `veyra.json` | The prologue: the night of the fire, in a valley that opens east to the Reach | New game, or `?scene=veyra` |
| `verdant.json` | The Verdant Reach · Thornwick on the river, farmland, the Sunken Loom | `?scene=verdant` |
| `emberwall.json` | The Emberwall Marches · Cindrel in its caldera, lava channels, the Anvil Vaults | `?scene=emberwall` |
| `saltmere.json` | The Saltmere Coast · Lanthe on stilts and rope bridges, the Drowned Choir | `?scene=saltmere` |
| `skyreach.json` | Skyreach Heights · Vaelmont on the peak, the wind-bridge, the Windless Stair | `?scene=skyreach` |
| `glass.json` | The Glass Expanse · Sarn at the oasis, the scar and the Sealed Heart | `?scene=glass` |
| `halcyra.json` | Halcyra · the palace on the Mirror Lake, the Lantern Office | `?scene=halcyra` |
| `testlands.json`, `gallery.json`, `bestiary.json` | Test scenes: terrain and water, every model, every creature | `?scene=<id>` |

Any other file in `scenes/` plays at `?scene=<its id>`.

## The file

```json
{ "format": 1, "id": "lesson1", "name": "Lesson I · The Quiet Element",
  "settings": { "ground": { "half": 28, "style": "flagstone" }, "profile": "story", "resetProgress": true, "resetAfter": 0 },
  "objects": [ { "id": "Cael", "type": "npc", "x": -0.4, "y": 0, "z": 2.6, "rotY": 3.14, "name": "Cael", "look": "cael" } ],
  "wires": [],
  "script": null }
```

- **settings.ground**: the base floor, `half` metres each way from the centre; `style` is flagstone, grass, dirt, cobble or sand.
- **settings.region**: the kingdom the scene is in (verdant, emberwall, saltmere, skyreach, glass, capital); the ledger counts what you do there against it.
- **settings.mood**: the light the scene opens in (`day`, `dusk`, `night`, and the regions' `ember`, `sea`, `peaks`, `glare`); the story can change it.
- **settings.terrain**: a height field instead of the flat floor: `{ size, cell, heights, paint }` (`size` metres square, a corner every `cell` metres; `heights` are base64 Int16 centimetres, `paint` base64 bytes, one surface per corner: grass, dirt, rock, sand, snow, ash, glass, cobble, salt, moss, basalt, mud). Objects sit on the ground where they're placed (`y` is above it); the edge is a wall, and past it the land rolls on into the fog. Region scenes are 240 m.
- **settings.view**: `{ far }` how far you see, in metres (default 170 on terrain); things past it are culled.
- **settings.persistent**: the scene remembers what happens to its objects in the save (a barricade burned, a stone revealed, a gate opened, a hay bale burned) and puts it back when you return.
- **settings.profile**: `story` (the story's element states, saved on the device) or `sandbox` (everything trained, never saved). `resetProgress` starts the story over; `resetAfter` is the testing aid that puts disturbed props back after that many quiet seconds (0 = off).
- **objects**: every object has an `id` (unique), a `type`, a position (`x`, `z`; `y` is the height of its base) and a turn (`rotY`, radians; the object's front faces +Z before turning). The rest are the type's properties. `src/scene/schema.js` lists them all, with defaults and ranges.

### Object types

| Group | Types |
|---|---|
| Ruins | ruined wall, pillar, fallen drum, archway, sealed door |
| Nature | rock (Earth lifts it if 40 × radius³ ≤ Earth Power's limit), tree (oak, pine, dead), hay |
| Elements | brazier (a fire source), basin (a water source) |
| Props | crate, oil barrel, training dummy, market stall |
| Puzzle | timber barricade, portcullis gate, pressure plate, trigger zone |
| Characters | player start (one per scene), character (looks: Cael, villager, elder, guard, smith, baker, youth; `role`: idle, walk, brigade — carries water from the nearest basin to the nearest fire — or cower — keeps away from creatures) |
| Village | **timber house** (`kind` house or barn; `cols` × `depth` panels, `rows` high, thatch roof): every wall panel breaks and burns, the roof burns from the thatch; *burned* when half of it has. A door in the front wall opens with a tap onto an empty, boarded room. **standing stone** (`cracked`; action `crack`) |
| Buildings | wall (stone, timber or plaster; door, window, two windows or arch), floor, roof, stairs, fence, post, and **prefab buildings** (cottage, town house, smithy, watchtower, shed) |
| Creatures | creature groups: Emberwing (flying fire bird), Bristleback (charging boar), Thornhound (pack hunter); a count, a spread, attacks on sight, one elite; `embers` off makes Emberwings go only for the player; `fragile` (a first fight: any hit kills) and `damage` (× what they do) |
| Travel | exit to another scene |
| Land (phase 5) | **water** (a lake, river stretch or sea at an absolute `level`; rect or `round`; `kind` water — wade, then swim past 1.25 m (out up a bank, or by climbing a quay or dock within about 1.5 m of the surface; fire won’t come in deep water) — or lava, which burns), tree kinds per climate, plant, boulder, tower, bridge (stone, whitestone, marble, plank, rope; `drop` when one bank stands higher), dock, town wall, gatehouse, tent, forge chimney, lamp, banner, statue, fountain; prefab halls for every kingdom |
| Creatures (phase 5) | Shellback, Cindermite (swarm; `vent` keeps them coming), Mudling, Brinecoil, Gale-kite, Frostmaw, Glass-wight, Lantern Sentinel, Wellspawn ; every group has `tier` (`kind`: its species' tier 1–4, `always` for a group the story needs): a hero one tier short meets the young, further short meets nothing yet |
| Characters (phase 5) | the rulers (Maren, Vorn, Oriel, Senn, Yessa, Ilvane, Corvane), Kestrel, each kingdom's folk and guards; `role` patrol walks `route` (`"x,z; x,z; …"`) |
| Ground | ground patch (grass, dirt, cobble, sand, flagstone; square or round) |

**Buildings burn and break true to material** (phase 5). A prefab building, a wooden bridge (plank or rope), a dock, a tent, a stall and a fence are structures: their walls come in cells, roofs and upper floors in strips, each piece burning (timber, plaster, thatch, shingle, canvas) or not (stone, brick, basalt, whitestone, marble, adobe, slate, tile, copper). Pieces hold each other up, so what stood on burned timber falls. A structure signals `burned`, `collapsed`, `damaged`, `intact`, `burning`; persistent scenes remember burned and collapsed. Prefabs belong to `civilian` unless set; a prefab can be a `landmark` (rulers' halls and the palace are by default): bringing one down weighs heavily on the kingdom and sets the flag `destroyed.<id>`.

**Every object** also takes `showWhen`: it exists only when those conditions hold as the scene loads. Conditions are separated by commas: `flagName`, `!flagName`, `flag=value`, `state:ObjectId=value`. It's how one scene file holds Veyra burned and rebuilt, or a region before and after its seal opens. Things someone owns take `owner` (civilian or empire): harm to them goes in the ledger.

**Player starts** have a `name`. `start` is where a scene begins; other names are arrival points. An **exit** (group Travel) is a zone that takes you to another scene (`to`) and arrives at a named start (`at`). Arriving saves a checkpoint.

A **prefab** is one object (`{ "type": "prefab", "prefab": "cottage" }`) that the loader expands into building-kit pieces (`src/data/prefabs.js`). Its `style` restyles every wall. Pieces get ids `<prefab id>.<n>`. In the editor, **Break apart** turns it into those pieces so you can change them one by one.

Any object with **Starts hidden** is out of the world until something reveals it; then it rises out of the ground where it was placed. Lesson I uses this to hold back seven stones until the first test is done.

## Wires: puzzle logic

A wire watches **signals** and runs **actions** on objects:

```json
{ "id": "Counterweights", "mode": "all", "once": true,
  "inputs": [ { "obj": "Lesson1_WeightL", "signal": "weighted" }, { "obj": "Lesson1_WeightR", "signal": "weighted" } ],
  "do":     [ { "obj": "TestRoom_Barricade_01", "action": "raise" } ] }
```

`mode` is `all` or `any`. `undo` runs when the inputs stop holding (a gate that closes when the stone is taken off); `once` fires only the first time.

| Type | Signals | Actions |
|---|---|---|
| plate | weighted, gentle (set down, not dropped), empty | hintOn, hintOff |
| barricade | intact, damaged, broken, collapsed, burned, raised | raise, rebuild |
| gate | open, closed | open, close, toggle |
| trigger | entered (ever), inside (now) | |
| crate, barrel, dummy | burning, burned, moved | |
| hay | burning, burned | |
| creature | gone (every one dead or driven off), engaged (they've seen you) | release |
| timber house | intact, damaged, burning, burned, open | open, close (its door) |
| standing stone | cracked | crack |
| anything that can start hidden | visible | reveal, hide |

## The script: story steps

A scene with a `script` is a story scene. Its lines are spoken by the character named as `speaker`, and the scene opens looking at `face`. A script with `when` (a `showWhen` expression, e.g. `"lesson1"`) runs only when that holds: the Reach's story waits until you've come through the Gate.

```json
{ "id": "place", "objective": "Set it down on the plate", "mark": "Lesson1_Plate",
  "do": [ { "do": { "obj": "Lesson1_Plate", "action": "hintOn" } } ],
  "waiting": [ { "when": { "all": [ { "signal": { "obj": "Lesson1_Plate", "name": "weighted" } }, { "not": { "signal": { "obj": "Lesson1_Plate", "name": "gentle" } } } ] },
                 "say": [ "That was a drop. Pick it up. Again." ] } ],
  "ends": [ { "when": { "signal": { "obj": "Lesson1_Plate", "name": "gentle" } },
              "say": [ "There." ], "do": [ { "reveal": [ "TestRoom_Rock_01" ] } ], "next": "trialIntro" } ] }
```

- On entering a step: its lines (`say`), then its actions (`do`). `mark` puts the Earth ring over an object, and the speaker points at it.
- `waiting`: while in the step, each time a condition *becomes* true, say and do something.
- `ends`: the first ending whose condition holds finishes the step: its lines, its actions, then the `next` step (or the one after it; `done` ends the story). An ending can set the `outcome` the card and the save read. (`until` + `then` is shorthand for one ending.)
- `choices`: a list of `{ label, flag?, say?, do?, next? }`. When the step's lines are done, the replies show as buttons; the pick sets its `flag` `{name, value}`, runs its lines and actions, then goes to its `next`.
- A line starting `@Name ` is spoken by that character instead of the speaker (`"@Bram Watch the sparks!"`). `{name}` is the player's name from the character creator.
- An objective containing `{held}` shows the held-steady timer and a progress bar.

**Conditions** (one key each): `talking` · `time` (seconds in the step) · `held` (an object id, or `*`) · `heldFor` `{obj, secs, lost}` · `signal` `{obj, name}` · `wire` · `broken` / `burned` `{obj, min}` · `burning` · `count` `{name, min}` · `flag` `{name, is}` · `state` `{id, is}` (a remembered world state) · `ledger` `{tally, min, region?}` · `standing` `{region, atLeast}` (0 the cause of all this … 4 saviour) · `many` `{prefix, type?, signal, min?, max?}` (how many objects whose id starts with `prefix` show `signal`: "three houses burned") · `all` / `any` (lists) · `not`.

**Actions** (one key each): `say` · `do` `{obj, action}` · `reveal` / `hide` (ids) · `grant` `{el, track, amount}` (Power or Control) · `flag` `{name, add}` (saved flags, e.g. Cael's trust) · `count` `{name, add}` · `saveFlag` (save the outcome and counters under a name, and checkpoint) · `card` (show the end card) · `checkpoint` · `travel` `{scene, at}` · `setFlag` `{name, value}` · `setState` `{id, value}` · `ledger` `{tally, add}` · `setElement` `{el, state, power?}` (locked / wild / trained) · `mood` `{name, secs}` (day, dusk, night: the light changes over `secs`) · `douseAll` `{by}` (every fire out) · `hint` (a one-line tip) · `npc` `{id, role, target?, route?}` (target `{x, z}` for walk; `route` `"x,z; x,z"` for lead: the character walks it ahead of the player, waits when they fall behind, and hurries when they're ahead; `follow` walks beside them) · `water` `{prefix, level, secs?, settle?}` (every water whose id starts with one of `prefix`, comma-separated, eases to `level` over `secs`, then on to `settle` `{level, secs}`; remembered) · `protect` (a number: health can't drop below it; 0 ends it) · `flameSpill` `{target, radius, after?}` (the first flame jet near `target` spills onto it, cause `awakening`; after `after` seconds it happens anyway) · `surge` `{el, target?, cause?}` (the player's wild power goes off: fire lights the nearest things, or `target`'s pieces; earth jolts; water lashes; air blasts. `cause` `awakening`, the default, isn't held against the player; `surge` is).

**Reactions** answer the player at any point: `playerFire`, `tooHeavy`, `playerBreak`, `playerThrow`, `playerSurge` (their wild power went off on its own). Each can count (`count`), change a flag, say the nth of its `lines` (or cycle through them), wait `throttle` seconds before speaking again, and follow up later (`followUp`: after N seconds, if a condition holds).

**Water and fire**: a water body signals `drawn` while a stream comes from it; a `waterwheel` with `driven` turns only while a stream plays on it and signals `spun` once it has turned its mechanism; the action `ignite` `{prefix}` sets things alight (not on the player's account). The Reach's south road leads to the Sunken Cistern (Lesson II) and on to Saltmere. A stream rises from where the finger touches the water (no further than `WATER.draw`, 12 m, from the hero), not from the edge nearest the hero.

**Tides**: the `water` action eases every water whose id starts with a prefix to a level (`Sea` lifts `Sea`, `Sea_West`, `Sea_Wall`). Water bodies are flat sheets over a rectangle, so ground meant to stay dry below the sea (Saltmere's Lowtown) sits outside every sea sheet, ringed by a berm higher than the tide, with its own water (`Lowtown_Flood`) hidden under its floor until the story raises it.

**Practice**: a `rock_pile` keeps `count` loose stones on it (a thrown one crumbles a few seconds after it lands; a fresh one rises); a `dummy` with `practice` stands back up after it falls and signals `hit` once your throw has knocked it down (reaction `targetDown` each first time). The **compass** strip at the top shows the way you face and the current step's `mark`, with its distance: say north, south, east or west in objectives.

**Talk** (`script.talk`): what each character says when the player taps them, by id: `{ "Hobb": [ { "when": cond, "say": [[lines], [lines]] } ] }`, the first entry whose `when` holds; each tap says the next list. Said before the character's own lines (`src/data/talk.js`).

**The card** text can read the outcome, counters, levels and flags: `{outcome|quiet=…|loud=…}`, `{fireSeen|0=…|1=…|*=You did it # times}`, `{earth.power}`.

## Regions and the world map

The kingdoms are separate scenes joined by exits at their edges (not an open world). Each region is built by a script, `scripts/scenes/<id>.mjs`, from the helpers in `scripts/scenes/lib/` (land shaping, roads, towns, scattered growth, people), so a layout change is a code review. `npm run scenes:build` rebuilds them all; the same seed gives the same scene.

```
                         Emberwall ── Skyreach
                        /    |     \  /    |
  Veyra ── Oruun Gate ── Verdant ── Halcyra ── Glass
                        \    |     /        |
                         Saltmere ──────────┘
```

The roads are `LINKS` in `scripts/scenes/lib/region.mjs`. Every exit is `Exit_<to>` and arrives at `from_<this scene>` in the other one; each region also has a `start`. Veyra's road east opens at dawn, when the prologue is told (its exit is `hidden` and the last step reveals it; the reveal is remembered). It leads to the Oruun Gate (`scripts/scenes/gate.mjs`), where Lesson I is played on the road with Cael leading the way (character role `lead`), and on into the Reach, where Thornwick's story (Act I, The Dry Mill) begins. Played on its own (`?scene=lesson`), Lesson I's end card has an **Into the Verdant Reach** button (a card button may carry `travel: { scene, at }`).

A story told to its end stays told: coming back to its scene doesn't start it over or reset progress.

Edit a region in the editor and it becomes a hand-edited scene; tell Claude, and the script is updated to match or retired for that region.

## Checking a scene

```bash
npm run scenes     # every scenes/*.json through src/scene/validate.js
npm run world      # every region loads, stands, draws within budget, and every road leads both ways
```

The editor runs the same checks as you work and lists them under **Check**. CI runs them on every push.

## From the editor to the game

1. In Elemental-Editor, **Save for Claude** with a note on what changed.
2. Ask Claude to pull the scene. Claude reads it from the editor's store, writes `scenes/<id>.json` here, runs `npm run scenes` and the tests, and commits.
