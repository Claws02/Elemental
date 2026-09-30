# Abilities and combinations (phase 4)

The elements beyond their basics. The rule from `CONTEXT_CONTROLS.md` holds: no buttons and no cooldowns. What the finger is on and what the finger does decide what happens.

**Learning.** Each ability needs its elements usable: known, and not stilled by Cael's charm. In the story it also has to be learned, which the script does with `setFlag learned.<ability> = true` (for example from a lesson). The sandbox knows every ability. The list is `ABILITIES` in `src/data/growth.js`, and `Progression.can(ability)` is the check.

| Ability | Elements | Gesture | Does |
|---|---|---|---|
| Raise stone | Earth | Touch **open ground** within 9 m and hold still for 0.8 s | A column of stone rises there and keeps rising while you hold, up to 1.6 m (Earth Power 0) or 3.2 m (Power 1). Standing on the spot lifts you. At most three stand at once; each sinks back after 25 s. |

| Ice | Water + Air | While a stream runs (one finger on it), **touch the hero with a second finger** | The whole arc freezes into a solid ice arch, which is a barrier. Where it was landing, creatures are locked in ice for 5 s (a flyer drops, and a hard hit does 2.5× damage) and fires go out. It melts after 20 s, six times faster beside fire, and a hard-thrown rock breaks a segment. |
| Lava | Earth + Fire | Hold a stone still in the grip: Fire heats it, then past glowing it goes **molten**. Throw it | It bursts where it hits into a 2.2 m pool. For 10 s everything that burns there catches, creatures and you burn, and timber wears through. Then it crusts over and the scorch stays. A stream quenches it five times faster. Every pool is **excess** in the ledger. |

Tuning lives in `src/data/elements.js` (`EARTH.raise`, `ICE`, `LAVA`). The code is in `src/elements/` (`Earthworks.js`, `Ice.js`, `Lava.js`), and the gestures are Intent's states.

## Raise stone

- **Cover and barriers:** a charge or a bite stops against a column, and several make a wall across a lane.
- **Climbing:** there is no jump, so stone is how the Conduit climbs. Stand where it will rise.
- **Not through things:** stone won't rise through a wall, a house or another column. Loose things on the spot (rocks, crates, creatures, you) ride up with it.
- **Gesture conflicts:** a drag across the ground is still the camera. Ground right at the hero's feet belongs to Air, whose touch area is the hero.

*Test: `qa/abilities.js`.*

## Ice

- **Why a second finger:** holding still while streaming is already how you douse a fire, because a burning plank needs 0.8 s of steady water. If holding still also froze, every fire fight would end in ice. Instead the Conduit uses two elements at once: Water from the basin with one hand, Air from themselves with the other.
- **Bridges:** ice bridges need gaps and rivers to cross. They come with terrain in phase 5, freezing where a stream lands on open water. Today's arch stands from the basin, too high to step onto.

*Test: `qa/abilities.js`.*

## Lava

- **It builds on heat:** heating a stone is the trained-Fire verb from Phase 1 (hold a held stone still). Learning lava lets the heat run past 1 up to 1.8; past 1 the stone is molten, glowing orange and shedding flame.
- **Why excess:** the brief says lava should be "one of the first abilities that makes the player realize: maybe I shouldn't be doing this everywhere." The world counts it before it counts what burns.
- **The stone is spent:** it cools to a black lump where it burst.

*Test: `qa/abilities.js`.*
