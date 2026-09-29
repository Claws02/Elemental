# Progression: learning the elements

Agreed 2026-09-29. The player does not start with every element. They gather them as the story goes, and each one grows along two separate tracks. Numbers live in `src/data/growth.js`; state lives in `src/core/Progression.js`.

## Element states

| State | Meaning |
|---|---|
| **Locked** | Not yet known. Touches that would use it do nothing else (a basin is just stone; touching the hero isn't wind). |
| **Wild** | It answers, but untrained. Dangerous (see Wild Fire). |
| **Trained** | Learned from Cael. Grows in Power and Control. |

**Story start (Lesson I):** Earth trained (Power 1, Control 1), Fire **wild**, Water and Air locked. Fire woke in Veyra, in the prologue; Cael judges it too uncontrollable to start with, so he teaches Earth first. The player can still reach for Fire, and Cael notices every time.

**Sandbox:** everything trained, at full Power and Control.

## Power and Control

Two tracks per element, 0 to 1, shown as levels 1 to 11.

| | Power | Control |
|---|---|---|
| How it grows | With use: cheaply, and most with destruction | Only through training and restraint (Cael's lessons) |
| Earth now | How heavy a stone you can lift (4 → 25), how hard you throw (24 → 36 m/s) | How steady a held stone is (a slow sway of 0.12 m → 0; was 0.4 m, which was annoying rather than tense), how softly a set-down lands |
| Gains | +0.01 a throw, +0.02 a piece broken | Lesson I: +0.15 hold steady, +0.15 set down gently, +0.3 open the passage without breaking it |

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

The first training scene (`src/story/Lesson1.js`), in the ruined courtyard. Title screen → **Begin**.

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
- Whether Power and Control ever show as numbers outside the lesson card.
