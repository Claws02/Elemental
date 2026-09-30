# Context controls: the material and the gesture choose the element

Agreed 2026-09-29. There is no element selector in normal play. What the finger lands on, and what the finger does, decide which element acts. Code: `src/data/materials.js` (the rules as data) and `src/input/Intent.js` (the state machine).

## The three rules

**1. The material says which elements can touch an object.** This is fixed and learnable, and it's what makes the world physically believable. Stone answers Earth; timber answers Fire; later, water answers Water and light things answer Air.

**2. The gesture says what you're doing.**

| Gesture | Verb | Example |
|---|---|---|
| Press and drag | **MOVE**: the element that moves this material | Earth lifts a rock |
| Press and hold still | **CHANGE**: the element that transforms this material | Fire ignites timber, pulls a flame from coals, heats stone |
| Flick | throw what you're holding | any element |
| Slow release | drop it | any element |

**3. The hold time belongs to the material.** Things that answer an element readily do so fast; things that resist take longer. The player's own rule: "holding a flammable object like coals would ignite really quickly … a rock should take about 1 second, maybe longer since it's not supposed to ignite."

| Material | MOVE | CHANGE (hold still) | Hold time |
|---|---|---|---|
| Stone (rocks) | Earth, instantly | Fire **heats** it | 1.5 s of stillness while held |
| Timber (barricade) | — | Fire **ignites** it | 0.6 s |
| Timber, burning | — | Fire **pulls** the flame out (it goes out) | 0.25 s |
| Coals (brazier) | — | Fire **pulls** a fireball | 0.25 s |
| Flame (fireball) | Fire | — | — |
| Water (basin) | Water, instantly: a **stream** | reserved for freezing (Water + Air, Phase 2) | — |
| Water (orb) | Water | — | — |

Tune these in `src/data/materials.js`, nowhere else.

## What the player sees

- **Before it acts:** a ring fills around the finger in the element's colour for the hold time, so the player knows that holding still will do something, and what.
- **While it acts:** the tether from the hero's hand to the target and the hero's belt stone take the element's colour. The badge in the top left reports the element acting (it is not a button).

## How the edge cases resolve

| Situation | Outcome |
|---|---|
| Touch a rock | Earth grabs it instantly. No delay was added to the grab that tested well. |
| Keep holding the rock still | After 1.5 s the Fire ring fills and the rock heats in the grip. The Conduit is using two elements at once. A hot rock glows and sets alight the wood it hits. |
| Touch timber and drag | It's a camera drag. Nothing catches. |
| Touch timber and hold still | It catches after 0.6 s, and the fire is recorded as the player's. |
| Touch a burning plank and hold | A fireball comes away in the hand toward the hero, and the plank goes out. |
| Hold a fireball against timber | It catches, and the fireball is spent. |
| Touch a brazier and hold | A fireball in the hand. The brazier stays lit. |
| Touch empty world | Camera drag, as before. |
| Touch in the bottom-left quarter | Always the move stick. A rock lying there has to be approached from another angle. |

## Combinations and abilities

See `ABILITIES.md`. They follow the same rule. Two elements at once use two fingers: while streaming, a second finger on the hero freezes the water.

## Water: a stream while connected, an orb once it breaks off

Agreed 2026-09-29. Water acts from the player's hand, never by holding still on fire (that stays Fire's pull), so no gesture means two things.

| | Stream (still connected to the basin) | Orb (broken off) |
|---|---|---|
| How | Touch the basin: the water comes at once, arcing from the basin to whatever the finger points at | **Yank** the finger away from the basin, fast (over 2200 px/s), and it tears free into an orb in the hand; still moving fast when the finger lifts, it's thrown in the same motion. A flick on release does the same |
| Water | Unlimited: the basin feeds it | One splash |
| Reach | 8 m from the source. Pointed further it **does not break**: it thins, gives out and falls short where its reach ends, so you can see you need to get closer | Carried and thrown anywhere |
| Does | Sprays where it lands: puts fire out, soaks timber, cools hot stone (steam), pushes rocks and debris, wears timber down (~8 s to break a plank) | Bursts on whatever it hits: the same, in a 2 m radius |
| Slow release | Collapses: a small splash where it ended | Dropped: bursts where it lands |

- **Fire fights back** (added after the phone test, to cause some panic): a burning plank only goes out after about 0.8 s of steady water (`FIRE.douseTime`), steaming and still burning the whole time, and it recovers if the water slips off. An orb's burst puts out what it hits squarely (within about 1 m) but only knocks back fires at the edge of the splash.
- **Soaked timber** won't catch or take heat from nearby fire for 20 s, and looks darker. Soaking ahead of a fire makes a firebreak.
- **Water can do damage** (the player's choice): pushing rocks into the wall and wearing planks through are recorded as the player's doing.
- **Aiming:** the stream's end goes to what the finger points at in the world (walls, planks, rocks, ground), never its own basin, so it can reach past the basin to what's behind it.
- **Why a yank, not distance** (changed after the phone test): breaking off at 8 m meant a stream could never be tried on anything further, and every far target needed an orb or a way to move the water source. Now distance only limits how far the stream lands, and breaking off is a deliberate gesture.
- **Watch on the phone:** 2200 px/s is set so a quick aim toward a far target stays a stream. If yanks don't register, or aims tear free, tune `YANK_PX` in `Intent.js`.

## Air: the Conduit's own breath

Agreed 2026-09-29. Air is the one element with no source in the world, so it comes from the hero.

| Gesture | What happens |
|---|---|
| Touch **the hero** and drag | Steady **wind** from the hero toward what the finger points at: a ~7 m cone, pale-jade streaks. Keeps blowing while the finger stays down |
| Touch the hero and **flick** | A **gust** toward what's under the finger where it lifts (screen direction alone aims badly: depth is squashed on a phone) |
**Air carries nothing.** It only blows. (Carrying loose planks with Air was tried and removed after the phone test: it stole the touch from Fire, so a broken plank could no longer be set alight.)

What moving air does:
- **Pushes:** light things drift, crates shift, rocks barely roll, a fireball or orb in flight is deflected. (Halved after the phone test.)
- **Fans fire, both ways:** a young flame (under 2.5 s old) blows out after about 0.35 s of wind; an established fire flares for 3 s, burns faster, and spreads further and faster **downwind**. Blowing on a fire too late drives it across the wall.
- **Hurts, a little:** a gust does at most 12 damage at its heart (was 70; three gusts used to bring the barricade down). It finishes off a plank that's nearly broken and barely marks sound timber. Steady wind breaks nothing.
- **Touch priority:** a touch squarely on a thing (a rock at the hero's feet) goes to that thing; otherwise a touch on the hero is Air; otherwise the fat-finger assist picks the nearest thing.
- **Touching the hero wins over the move stick:** in portrait the hero stands at the move zone's edge, so a touch on the hero is Air even inside the bottom-left quarter. The hero's touch area is at least 60 px.

## Where the Phase 3 element wheel fits

It stops being how you choose an element. It becomes an **override** for the rare case context gets wrong, for example using Air on a stone to shove it rather than let Earth lift it.

## Risks to watch on the phone

1. **Accidental heating.** Holding a rock still while deciding where to throw it heats it after 1.5 s. That's on-theme (accidental fire is the story), and the ring gives warning, but if it annoys, raise the stone hold time.
2. **Holding a fireball near the barricade** can set it alight before you throw. Also on-theme; watch whether it feels unfair.
3. **Fire gets away from you, on purpose.** A new fire starts at a quarter strength and builds over 5 s (`FIRE.startIntensity`, `FIRE.buildUp`). The first neighbour catches after about 5 s: the window to pull it back out. Left alone, burning planks heat their neighbours from all sides and it runs away; one plank takes the whole barricade in about 19 s. Tuned after the first phone test (was 3 s and 12 s): the player wanted more chance to stop it, but also wanted the power to be hard to control.
