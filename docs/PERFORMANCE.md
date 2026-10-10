# Performance: holding 60 fps on a phone

The target is a steady 60 fps on an iPhone 15/16 Pro, through the heaviest moments: a town on fire, a crowded plaza, a region seen to the fog. This is what the game does to get there, and how to measure it.

## Measure first

- **`index.html?bench`** runs a fixed path through Thornwick: the plaza, two cottages set alight and burning, then the river. At the end a card shows average fps, the 1% low (the slowest 1% of frames), a frame's time split (logic, physics, the CPU's side of drawing), peak draw calls and triangles, and the resolution and quality level it settled at. **Copy** puts it on the clipboard. Run it on the phone with Low Power Mode off and the phone not hot.
- **`npm run bench`** runs the same thing headless. Headless Chromium draws in software, so its fps means little; the CPU split, draw calls and triangles compare run to run.
- **The debug readout** (top right) shows fps, the frame split, the resolution and quality level, draw calls, bodies and fire.

## What the game does

**Drawing (the GPU)**

| Trick | Where | What it buys |
|---|---|---|
| Cheap lighting: Lambert for the world, Phong where something shines (metal, glass, water, ice) | `engine/Kit.js`, effects | The art is flat colour; physically based shading cost several times as much per pixel for the same look |
| Phones start at 1.5× resolution (not 2×), and adapt | `engine/Renderer.js` `adapt()` | A third fewer pixels; sharpness climbs back to 2× when there's room |
| A quality ladder under the resolution: shadows every 2nd, 3rd, 4th frame, a smaller shadow map, fewer flames | `Renderer.LEVELS` | Holds 60 in the heaviest moments; climbs back first when calm |
| Shadows: a tight box round the hero; terrain and debris cast none | `Renderer`, `Physics.toDebris` | The shadow pass draws what matters |
| Every building one mesh, burning or not (`world/Skin.js`) | `Structure`, `Building` | A burning village costs what a quiet one does in draw calls |
| Scenery batched into 40 m cells, culled by distance | `world/Batcher.js`, `Game.js` | Hundreds of trees in a handful of draw calls |
| People far off are a baked still (one or two draws), not a 15-part rig | `story/Npc.js` `NPC_LOD` | A crowd stays cheap |
| Every particle in the game (flame, embers, smoke, steam, water drops, mist, wind streaks, rock chips, dust, sparks) on the GPU: two instanced meshes, written once at birth, aged in the vertex shader; only the slots born this frame are uploaded; not drawn while empty | `art/Particles.js` | The CPU no longer moves a single particle; four always-on point systems became two meshes that idle at zero |
| Each pool still a budget (full: new emission skipped), and debris counts thin on the quality ladder; size capped near the lens | `art/Particles.js` `Pool`, `Juice._n` | Overdraw (the phone's real limit with particles) stays bounded |
| Phones see a little less far (85%), the fog closing in to match | `quality.viewK` | Fewer things drawn and culled later |
| Every shader compiled while loading | `Renderer.warm()` | No stall the first time fire, ice or lava appears |
| Juice (flares, shockwaves, ground marks) as three instanced quad pools, aged on the GPU, drawn only while something in them is alive | `art/Juice.js` | Impact feel for at most three draw calls, none when idle; the CPU writes one slot per event |
| The ladder sheds juice before frames: decals go at `fx` < 0.75, shockwaves at < 0.5, flares shrink | `Juice.decal/ring/flare` | The heaviest fights keep 60 |

**Thinking (the CPU)**

| Trick | Where | What it buys |
|---|---|---|
| A building is ONE physics body (a shape per piece); a piece gets its own body only when it breaks off | `world/Structure.js` | Thornwick: 654 bodies → 191; a physics step 2.6 → 0.4 ms |
| Static bodies more than 50 m from the hero leave the physics world until the hero nears | `Physics.park()` | The broadphase only pays for what's near |
| Fixed 1/60 s physics steps (up to 6 for a 100 ms frame) | `Physics.step()` | With a step now a fraction of a millisecond, catching up costs little; longer or fewer steps changed how things meet (tried, reverted) |
| Fire looks only at what is burning, heating or wet; spread on a grid, 10 times a second | `FireSystem` (`live`, `_grid`) | An idle village costs nothing; a burning one a fraction of a millisecond |
| Buildings asleep until fire, water or a blow reaches them | `Structure.update`, `Building` | Hundreds of pieces cost nothing while nothing happens |
| No garbage in the hot loops (skins, fire) | `Skin.update` | No collector pauses (stutter on iOS) |

## The phone itself

- **Low Power Mode** holds every web page and web app at 30 fps. The game notices a steady 30 with little work to do and says so, once.
- **ProMotion (120 Hz):** the game runs at 60, which is what it is tuned for; running at 120 would double the work per second for little gain in this kind of game.
- **Heat:** a phone that has been working hard slows itself down. Benchmark from cool.

## Later, if needed

- **WebGPU** (three.js's WebGPURenderer; iOS Safari supports WebGPU): much less CPU per draw call.
- **Physics on a worker thread.**
- Character animation on the GPU (one skinned mesh per character instead of a rig of parts).
