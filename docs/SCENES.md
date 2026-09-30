# Scenes

Every place in Elemental is a **scene file**: plain JSON in `scenes/`, made in [Elemental-Editor](https://github.com/Claws02/Elemental-Editor) or by hand. The game has no scene code of its own. `src/scene/` turns a file into a world, and `src/story/Story.js` runs its script.

| Scene | What it is | Open it |
|---|---|---|
| `lesson1.json` | Lesson I · The Quiet Element (Cael's first lesson) | `?scene=lesson` (or `lesson1`) |
| `courtyard.json` | The ruined courtyard: every element, the test obstacles | `?scene=sandbox` (or `courtyard`) |
| `village.json` | A sample village made from the building kit, with a small gate puzzle | `?scene=village` |

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
- **settings.mood**: the light the scene opens in (`day`, `dusk`, `night`); the story can change it.
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
| Village | **timber house** (`kind` house or barn; `cols` × `depth` panels, `rows` high, thatch roof): every wall panel breaks and burns, the roof burns from the thatch; *burned* when half of it has. **standing stone** (`cracked`; action `crack`) |
| Buildings | wall (stone, timber or plaster; door, window, two windows or arch), floor, roof, stairs, fence, post, and **prefab buildings** (cottage, town house, smithy, watchtower, shed) |
| Creatures | creature groups: Emberwing (flying fire bird), Bristleback (charging boar), Thornhound (pack hunter); a count, a spread, attacks on sight, one elite; `embers` off makes Emberwings go only for the player |
| Travel | exit to another scene |
| Ground | ground patch (grass, dirt, cobble, sand, flagstone; square or round) |

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
| timber house | intact, damaged, burning, burned | |
| standing stone | cracked | crack |
| anything that can start hidden | visible | reveal, hide |

## The script: story steps

A scene with a `script` is a story scene. Its lines are spoken by the character named as `speaker`, and the scene opens looking at `face`.

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

**Actions** (one key each): `say` · `do` `{obj, action}` · `reveal` / `hide` (ids) · `grant` `{el, track, amount}` (Power or Control) · `flag` `{name, add}` (saved flags, e.g. Cael's trust) · `count` `{name, add}` · `saveFlag` (save the outcome and counters under a name, and checkpoint) · `card` (show the end card) · `checkpoint` · `travel` `{scene, at}` · `setFlag` `{name, value}` · `setState` `{id, value}` · `ledger` `{tally, add}` · `setElement` `{el, state, power?}` (locked / wild / trained) · `mood` `{name, secs}` (day, dusk, night: the light changes over `secs`) · `douseAll` `{by}` (every fire out) · `hint` (a one-line tip) · `npc` `{id, role, target?}` (target `{x, z}` for walk) · `surge` `{el, target?, cause?}` (the player's wild power goes off: fire lights the nearest things, or `target`'s pieces; earth jolts; water lashes; air blasts. `cause` `awakening`, the default, isn't held against the player; `surge` is).

**Reactions** answer the player at any point: `playerFire`, `tooHeavy`, `playerBreak`, `playerThrow`, `playerSurge` (their wild power went off on its own). Each can count (`count`), change a flag, say the nth of its `lines` (or cycle through them), wait `throttle` seconds before speaking again, and follow up later (`followUp`: after N seconds, if a condition holds).

**The card** text can read the outcome, counters, levels and flags: `{outcome|quiet=…|loud=…}`, `{fireSeen|0=…|1=…|*=You did it # times}`, `{earth.power}`.

## Checking a scene

```bash
npm run scenes     # every scenes/*.json through src/scene/validate.js
```

The editor runs the same checks as you work and lists them under **Check**. CI runs them on every push.

## From the editor to the game

1. In Elemental-Editor, **Save for Claude** with a note on what changed.
2. Ask Claude to pull the scene. Claude reads it from the editor's store, writes `scenes/<id>.json` here, runs `npm run scenes` and the tests, and commits.
