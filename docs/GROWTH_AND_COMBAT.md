# Growth and combat: a proposal (2026-10-30)

Your note: the game moves too fast; players should have to learn to control their powers, fight more, and feel themselves level up. This is what the build does today, why it feels fast, and a plan. Nothing here is built yet. The open decisions were settled on 2026-10-30 (§4).

## 1. What the build does today

| | Today |
|---|---|
| Story so far | 6 chapters (prologue → Cold Forge), **36 objectives**, about 130 lines. Lesson II is 4 objectives, Lesson III is 3. |
| Fights in the story | **2**: the Emberwing flock (prologue) and the Stonebound at the Watchstone. Wild creatures live in the regions, but the story never sends you into them. |
| Learning an element | One short scene flips it to *trained* and grants a lump of Control (+0.15 to +0.3). Nothing you do afterwards has to be practised. |
| Power and Control | Tracked for all four elements, levels 1–11, saved. **Only Earth's do anything in play** (stone weight, throw speed, sway). Fire, Water and Air levels change nothing: a level-9 fireball is a level-1 fireball. |
| Abilities | 7 exist (raise, pull, ice, lava, firestorm, mud, glide). The story teaches **2** (pull and raise, at the yard). The other five are sandbox-only. |
| Levelling up | A line in the log ("Earth · Power 3"). Nothing on screen says what changed. |
| Fights growing with you | Creature tiers scale to your "might" (young animals for a new hero, full packs later). Invisible to the player. |

So it moves fast because each lesson is a short scene that hands over the finished power, there's almost nothing to fight between lessons, and getting stronger has no visible effect.

## 2. The plan

### 2.1 Every level does something (the foundation)

> ✅ **Built** (2026-10-30): curves for all four in `src/data/growth.js`, read by the systems; Power grows from use and fighting; element rings and a level-up banner with a slowed beat. `docs/PROGRESSION.md` has the numbers. Not built yet: Control-gated techniques (§2.2) and everything after.

Give Fire, Water and Air their own Power and Control curves in `src/data/growth.js`, the way Earth has. A level should be something you can *see*:

| | Power (grows with use, cheaply, most with destruction) | Control (grows with precision and restraint) |
|---|---|---|
| **Earth** | Heavier stones (built), harder throws (built), bigger raised columns, stone that breaks walls | Steadier hold (built), soft set-down (built), raising exactly where you point, catching a thrown stone |
| **Fire** | Fireball size, damage, blast radius; jet range and heat | Fewer stray sparks, a longer hold before a fireball bursts, pulling a flame back out, lighting one plank and not its neighbour |
| **Water** | Stream range (8 m → 16 m), push force, orb size | Stream wander shrinks, drawing from smaller sources (a barrel, a puddle, wet ground), freezing exactly where it lands |
| **Air** | Gust force and reach, glide distance | Deflecting projectiles reliably, fanning a fire without blowing it out, not throwing your own allies about |

### 2.2 Techniques you earn, not just get

> ✅ **Water built** (2026-11-01): the orb (tearing the stream free) at Water Control 3; below it a yank or a flick just lets the stream go. An unsure stream drifts off its mark (0.45 m at Control 1, none at 11). Lesson II grants +0.05 for the camp saved and +0.05 for the sluice, not +0.3.
>
> ✅ **Earth built** (2026-10-30): pull at Earth Control 3, raise at 4, catch at 5 (`ABILITIES` in `data/growth.js`; taught *and* sure enough). Lesson I now grants +0.2 Control the quiet way (level 3), +0.1 the loud way (level 2), not +0.6. Fire, Water and Air ladders: not yet.

Each element gets a ladder of techniques at Control levels (Power alone never unlocks one: the brief's "more powerful, never automatically wiser").

| Control level | Earth | Fire | Water | Air |
|---|---|---|---|---|
| 1 | Lift, throw | (wild) | Stream | Gust |
| 3 | Pull stone from the ground | Pull a flame out | Orb | Wind |
| 5 | Raise cover | Held fireball (no burst) | Douse at range | Deflect |
| 7 | Catch and return | Flame jet, aimed | Ice (with Air) | Glide |
| 9 | Stone armour / slam | Firestorm (with Air) | Mud (with Earth) | Thermal (with Fire) |
| 11 | Wall | Lava (with Earth): the line you learn not to cross | Whip | Shield |

Cael (and later Kestrel and the Tidekeepers) teach each one in a short lesson when you reach its level, so the techniques that exist today get a place in the story.

### 2.3 Learning control is play

> ✅ **Water built:** the Cistern's drill: Cael lights three bound hay bundles east of the pool one at a time; each one you put out is +0.03 Water Control (to level 6); one that burns away first is ash, the turn passes, and he renews it. Water Control 3 teaches the orb; **soft gate** at 4 before Saltmere (`lesson2.unready`; Cael remembers it at the sea wall).
>
> ✅ **Earth built:** the Thornwick yard's drill: three plates at eye level; a stone set down softly is +0.03 Earth Control (a drop teaches nothing; once per let-go), up to level 6. Cael won't teach the pull until level 3; raising waits on 4. **The soft gate:** level 5 is ready for the Watchstone; walk out of the yard before then and you go anyway (`act1.unready`), and Cael tells you to stay behind him at the ruin.

- **Drills.** Each lesson leaves behind a drill you can repeat at any camp or training ground. A Thornwick-yard style course per element: hold a stone through a swaying gate, light only the marked lantern, put out five fires without soaking the hay, deflect three stones. Graded by how cleanly you do it; only clean runs grow Control.
- **Mastery trials gate the road.** Cael won't move on until you're ready: Lesson II ends when Water Control reaches 3, not when the cutscene ends ("Not yet. Again."). Decided: soft. Cael says it; you can go anyway, and the road is harder for it.
- **Elements wake slowly.** Water wakes at the cistern as a trickle (short range, wanders), and the drills turn it into a stream.

### 2.4 More fighting, and fighting that teaches

> ✅ **Water built:** the smoke from the burning camp draws a flock of Emberwings (required): a stream grounds them.
>
> ✅ **Earth built:** the Oruun Gate's road fight (three Thornhounds off the pass, scree to throw: required). The Thornwick hunt (Brask asks about the boar in the north fields: optional; killed, it's `hunt.boar`, care in the Reach, Brask's lines change). Making the Stonebound yield is +0.05 Earth Control: a clean fight.

- **A fight on every road.** Each road chapter gets an encounter built for its lesson. At the Oruun Gate, Thornhounds test your stone throwing. On the cistern road, Mudlings test the new Water. At the Cold Forge, Cindermites test held Fire.
- **Work in every town.** A guard or the ruler posts a hunt: clear the boar out of the fields, the hounds out of the forest. These are optional, but they're where most Power comes from.
- **Clean fighting grows Control; messy fighting grows Power.** This is the game's theme in its combat. A weak-point hit, a kill with no collateral, and sparing a yielding Wielder all grow Control. Smashing through scenery grows Power, and the ledger remembers.
- **Combos as answers.** Elites and armoured creatures need a combination: a Shellback has to be flipped with Earth then hit; a Frostmaw's ice has to be melted. The bestiary already has a weakness per creature; the fights should demand them.
- **A boss per act** (ROADMAP phase 7). Act I's is the Stonebound captain at the Watchstone, made a proper three-phase fight.

### 2.5 Feeling yourself level up

- **The level-up moment:** time slows for a beat, the element's colour bursts from the hero, Cael (or whoever's near) says one line, and a small card says what changed in plain words: *"Earth · Power 4. The cart-sized stones are yours now."*
- **The element rings:** four small rings by the health bar, one per element, filling toward the next level. Decided: yes. "Never a meter" stays for consequences; powers get rings.
- **Proof in the world:** the stone you couldn't lift at the Gate, you can lift on the way back. Old places should have things in them you can only do later.

### 2.6 Pacing target

Today the 6 chapters hold about 2 fights and 36 objectives. A target: each chapter has **one lesson, one drill, one required fight, one optional hunt**, and the next lesson waits on a Control level. That roughly doubles the play time of what's built without adding new places.

## 3. Suggested order

1. **The foundation:** Fire, Water and Air curves in `growth.js`; the level-up moment and its card. Everything else rests on levels meaning something.
2. **One element end to end (Earth)**, because it's the most built: the technique ladder, a drill at the yard, the Gate's Thornhound fight, a Thornwick hunt, a Control gate before the Watchstone. Play it and tune.
3. Then the same for Water (cistern), then Fire (forge).
4. Combo creatures and the Watchstone boss.

## 4. Decided (2026-10-30)

- **Visible growth:** element rings by the health bar, filling toward the next level, and a level-up moment with a card saying what changed.
- **Soft gates:** Cael says when you aren't ready; you can go on anyway, and it's harder.
- **Fights:** one required fight per road chapter, built around its lesson; optional hunts posted in towns.
- **Order:** the foundation first (every level does something; rings and cards), then Earth end to end.
