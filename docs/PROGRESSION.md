# Progression: learning the elements

Agreed 2026-09-29. The player does not start with every element. They gather them as the story goes, and each one grows along two separate tracks. Numbers live in `src/data/growth.js`; state lives in `src/core/Progression.js`.

## Element states

| State | Meaning |
|---|---|
| **Locked** | Not yet known. Touches that would use it do nothing else (a basin is just stone; touching the hero isn't wind). |
| **Wild** | It answers, but untrained. Dangerous (see Wild Fire). |
| **Trained** | Learned from Cael. Grows in Power and Control. |

**The prologue (Veyra):** every element locked until the stone cracks; then all four answer at once, all wild, and the first thing the power does is set the player's own roof alight (cause `awakening`: the ledger doesn't count it). When it ends, Earth becomes Cael's to teach, Fire stays wild, and Water and Air go dormant (locked) until their lessons wake them: Water at the Sunken Cistern (Lesson II), Air at Skyreach (Lesson IV).

**Cael's charm.** After the fire Cael offers a charm. Worn, it stills every WILD element (`Progression.live()` reads it as locked); a trained element still answers, so each comes back as Cael trains it. Refused, it stays in the player's pocket (a small silver button on the HUD) and can be put on any time; once on, it stays on. Flag `charm`: `none` (the stone has cracked, not yet offered), `worn`, `refused`.

**Surges** (`src/elements/Surges.js`, tuning `SURGE` in `data/growth.js`). Without the charm, a wild element goes off on its own every 40–90 s, faster under stress (creatures on you, fire close, health low): fire lights what's near and singes you, earth jolts things and cracks timber, water lashes and shoves, air blasts. People close by are hurt and flinch away. It all goes in the ledger as the player's (cause `surge`).

**Lesson I, played on its own (`?scene=lesson`):** Earth trained (Power 1, Control 1), Fire **wild**, Water and Air locked. Fire woke in Veyra, in the prologue; Cael judges it too uncontrollable to start with, so he teaches Earth first. The player can still reach for Fire, and Cael notices every time.

**Sandbox:** everything trained, at full Power and Control.

## Power and Control

Two tracks per element, 0 to 1, shown as levels 1 to 11.

| | Power | Control |
|---|---|---|
| How it grows | With use: cheaply, and most with destruction and fighting | Only through training and restraint (Cael's lessons) |
| Earth | How heavy a stone you can lift (4 → 25), how hard you throw (24 → 36 m/s) | How steady a held stone is (sway 0.12 m → 0), how softly a set-down lands |
| Fire | Fireball size (0.34 → 0.54 m) and hit (22 → 55); the jet's reach (12 → 20 m) and heat (40 → 90 /s) | How long a thrown fireball holds together (4 → 7 s), how fast a stone heats in your grip (×1 → ×2) |
| Water | The stream's reach (8 → 16 m) and draw (12 → 18 m), its shove (×1 → ×2), what it does to a creature (×1 → ×2.5), an orb's burst | How far it drifts off your aim (0.45 m → 0), how fast a fire goes out under it (0.8 → 0.4 s) |
| Air | Wind and gust reach (7 → 12 m, 9 → 15 m), their push (gust ×1 → ×2) | How tight the wind's cone is (a gust's half-angle 0.6 → 0.36 rad: it hits what you aim at, spares what's beside it), how slowly a glide sinks (1.6 → 0.96 m/s) |
| Gains | A throw +0.01 (fireball, orb, stone); a fire doused +0.01; a gust +0.006; a piece broken +0.02 (Earth); wild Fire, a fire lit +0.03; **in a fight**, +0.002 per 10 damage and +0.015 a kill, to the element that did it (about 4–5 kills a level) | The lessons' grants (Lesson I: +0.05, +0.05, +0.1 the quiet way); the yard's drill (+0.03 a soft set-down, to level 6); a clean fight (the Stonebound made to yield: +0.05) |

**Techniques wait on Control** (`ABILITIES` in `growth.js`): taught in the story *and* sure enough. Earth: pull a stone from the ground at Control 3, raise a column at 4, catch a thrown stone at 5. Water: tear the stream free into an orb at 3. Power never unlocks one.

Level 1 of every track is the tuning before levels meant anything, so a level only ever adds. Control is precision, never less effect: a master can still break a plank on purpose. The curves are `GROWTH` in `src/data/growth.js` (each names its track); `Progression.stat(el, key)` reads one; the systems read them where they used to read a constant.

**You can see it** (`ui/Hud.js`): under the health bar, a ring per element you have (none while it's locked; a wild one pulses), the outer arc Power and the inner arc Control, each filling toward its next level, the Power level in the middle. A level gained: the world slows for a beat, the screen flashes the element's colour, and a banner names the level and says what it does (`WHAT` in `growth.js`). *Test: `qa/growth.js`.*

High Power with low Control is how accidents happen. It is the brief's line: the player becomes more powerful than Cael, but never automatically wiser.

## Wild Fire

What untrained Fire does (all five agreed):

1. **Catches too easily:** hold times halved (timber 0.3 s, not 0.6).
2. **Throws sparks:** whatever you light, one or two other flammable things within 3 m catch too.
3. **Can't be taken back:** pulling the flame out of something burning needs training. Nor can it heat a stone in the grip: holding a stone still is just holding it.
4. **Unstable fireballs:** a wild fireball bursts in the hand after 3–5 s, lighting what's within 1.8 m; thrown, it bursts wide on impact.
5. **Power, never Control:** each fire the player lights raises Fire Power (+0.03). Control only comes from training (Act II).

Cael reacts: "Put it out." Then, when the player can't: "You can't, can you. That's why we don't start there." Each fire lowers his trust (`flags.caelTrust`).

## Lesson I: The Quiet Element

The first training scene (`scenes/lesson1.json`, run by `src/story/Story.js`), in the ruined courtyard. Title screen → **Begin**.

The story opens facing Cael, with only three stones out: the small one he points to and two too heavy to lift at Power 1. Touch a heavy one and Cael says so ("Too heavy. You're not ready for that one."); the fat-finger assist never swaps it for the small one.

1. **Lift** the stone Cael points to (an Earth ring marks it).
2. **Hold it steady** for 3 s while low Control makes it sway. Control +.
3. **Set it down** on the pressure plate, which stands on a pedestal at eye level (1.5 m), so it takes aim: let go within 0.6 m of the surface. A drop or a throw doesn't count ("That was a drop. Pick it up. Again."). Control +.
4. **The sealed passage.** Both ways pass; the world and Cael remember which:
   Only now do the courtyard's other seven stones rise out of the ground.
   - **Quiet:** stones on both counterweight plates (raised to eye level like the first; chains run up to the barricade's posts) lift the barricade whole. Control ++, Cael's trust +.
   - **Loud:** break it or burn it open. Power from the breaking, Cael's trust −.
5. **Close:** Cael's words depend on how; then the lesson card (outcome, levels, how often you reached for fire). The outcome is saved.

## Still to decide

- How Water and Air are first learned (story beats in Acts II–III).
- What Fire training looks like when it finally comes, and what trained Fire's Control buys.
- ~~Whether Power and Control ever show as numbers outside the lesson card.~~ Decided 2026-10-30: rings and a level-up banner (`GROWTH_AND_COMBAT.md`).
