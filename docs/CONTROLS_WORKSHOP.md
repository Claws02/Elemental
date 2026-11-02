# Controls workshop: holding, moving and throwing (2026-11-02)

Your notes: it's hard to control the elements and use them the way you mean to; a held rock should move with you when you walk; players should learn to throw before anything attacks them; maybe an aim lock that can be switched on and off.

This is what the build did, why it felt hard, what other games do, and the options; the decisions are in §4. **Built 2026-11-02:** carrying (3.1), the three aim settings (3.2, without the throw preview arc), and the Thornhounds moved to the road north of the yard (`qa/controls.js`). Then (2026-11-02, your notes): no preview arc; the yard gets **moving targets** after the standing ones (two straw men on runners, one slow, one quick; `dummy` `slide`); aim assist moves into a **pause menu** (the gear, top right, or Esc): Resume, Save here and now, Aim assist, Save and quit. Assist stays with thrown things (decided 2026-11-02): streams and wind are aimed by hand.

## 1. Why it feels hard (`src/elements/Channel.js`, `src/input/Intent.js`)

| What you feel | Why |
|---|---|
| **The rock doesn't come with you.** | A held thing is pulled toward a fixed point *in the world*, set where your finger last was. Walk away and it stays behind until it's dragged along at the edge of your reach (8 m), and it's dropped if it gets 16 m away. |
| **You crawl while holding.** | Any channel (holding, streaming, wind) slows the hero to 45% speed. |
| **Throws go roughly, not where you look.** | A flick's direction on screen becomes a flat compass direction with a fixed small lift. It ignores what's under your finger or in front of you, and the flick has to be fast (over 900 px/s) to count as a throw. Hitting a moving hound at 10 m depends on a precise swipe. |
| **No help finding the target.** | Grabbing has a fat-finger assist, and the flame jet picks the creature nearest your touch, but nothing helps a throw land. |
| **Fighting before learning.** | The Thornhounds at the Oruun Gate (added last week) come before the Thornwick yard, where throwing is taught. The prologue's flock comes before anything, though the flame jet locks onto birds and they die to any hit. |

## 2. What other games do

| Game | What it does | What it teaches |
|---|---|---|
| **Half-Life 2** (gravity gun) | The held object sits at a fixed distance in front of you, and follows your view and your walking. | Held things live in **your** frame, not the world's. |
| **Control** (Remedy) | Hold the button and Jesse grabs the nearest object automatically; launches are aim-assisted, with stronger snapping in Assist Mode. | Grabbing should be effortless; aim help can be a setting. |
| **The Force Unleashed** | Grip plus a lock-on button. Reviewers hated it: the lock picked the wrong target, and gripping meant standing still. The sequel locks onto "the most sensible thing" but lets you steer. | **A lock that picks wrong is worse than none.** Never root the player while they channel. |
| **Brawl Stars / Wild Rift** (mobile) | Tap an attack and it auto-aims at the nearest enemy; drag it and you aim manually, with a preview line. Auto-aim is on by default, a crutch for learning, and skilled players drag. | **Tap = assisted, drag = precise**, both always available. |
| **Aim-assist practice** (Halo; developer write-ups and a GDC talk) | *Magnetism* bends the shot toward a target near your aim; *friction* slows your aim near targets. Too much feels like the game plays itself; too little does nothing. Scale by distance and size; **the player's input always wins.** | Assist bends what you meant; it never overrides you. |

Sources: [Game Informer: Control review](https://www.gameinformer.com/review/control/control-review-a-heady-power-trip) · [Control AWE Assist Mode](https://caniplaythat.com/2020/09/01/control-awe-expansion-introduces-assist-mode/) · [Kotaku: The Force Unleashed II](https://kotaku.com/playing-with-the-force-unleashed-iis-jedi-mind-tricks-a-5619041) · [Game Revolution: The Force Unleashed review](https://www.gamerevolution.com/?p=41808) · [Den of Geek: The Force Unleashed II](https://www.denofgeek.com/games/star-wars-the-force-unleashed-ii-xbox-360-review) · [Wild Rift hands-on](https://www.oneesports.gg/lol/hands-on-wild-rift-is-the-perfect-league-of-legends-experience-on-mobile/) · [Brawl Stars aim settings](https://jeu.video/en/guide/brawl-stars-aim-settings) · [Halopedia: Aim assist](https://www.halopedia.org/Aim_assist) · [Bugnet: fixing aim assist](https://bugnet.io/blog/how-to-fix-aim-assist-over-or-under-correcting) · [GDC: Techniques for Building Aim Assist](https://www.gdcvault.com/play/1017942/Techniques-for-Building-Aim-Assist) · [Valve: weapon_physcannon](https://developer.valvesoftware.com/wiki/Weapon_physcannon)

## 3. Proposal

### 3.1 Held things travel with you
- A held stone keeps its place **relative to you** (beside you, in front, overhead) while you walk, turn and jump. Dragging moves that place; walking carries it.
- Walk at near full speed while holding: 85% for a light stone, slower for heavy ones (by weight against your Earth Power). A stream or wind still slows you more, since it ties you to its source.
- A held thing only drops when something forces it: hit hard, swimming, or a stream's source too far away.

### 3.2 Throwing that lands
- **Flick toward where you want it, and it goes there:** the throw follows the line from the hero to whatever is under the flick's direction on screen, with the arc worked out to reach it rather than a fixed lift.
- **Aim assist, three settings** (a toggle on the HUD and in settings):

  | Setting | What it does |
  |---|---|
  | **Lock** | The nearest thing worth hitting in front of you (a creature in the fight, a straw man, the objective's mark) gets a ring. Flick anywhere roughly toward it (within ~40°) and the throw goes to it, leading a moving target. Tap a different creature to move the lock. |
  | **Assist** (the default) | No lock ring; a throw within 10° of a target bends onto it (magnetism). |
  | **Off** | Exactly where you flicked. |

- ~~**Tap to throw**~~ (decided against: a flick is the throw).
- **A throw preview:** while holding, a faint arc shows where a flick would land.

### 3.3 Learn before you fight
- **Lesson I gains throwing.** At the Oruun Gate, before the passage trial, Cael sets two straw men in the court: knock them both down. He introduces the lock: "Your eyes find them. Let your hand follow."
- The **Thornhounds** come after that, on the road out, as now.
- The **Thornwick yard** stays the place for the harder things (the drill, the pull, the column), and gets moving targets (straw men on a sledge Brask drags) to practise leading a throw.

### 3.4 Everything else that channels
- The **stream** aims where your finger is, as now, but snaps to a locked creature when you drag near it.
- **Wind and gusts** go toward the lock if there is one.
- The **flame jet** already picks the creature nearest your touch: unchanged.

## 4. Decided (2026-11-02)

1. **Held things travel with you** (3.1), at about 85% speed (heavier stones slower).
2. **Aim assist: Lock / Assist / Off, Assist by default.** A toggle on the HUD and in settings.
3. **No tap-to-throw.** A flick is the throw.
4. **Lesson I stays as it is; the Thornhounds move** from the Oruun Gate's road to after the Thornwick yard, on the way north to the Watchstone, so throwing is taught before the first fight.
5. **Tuned after the pause menu (2026-11-02):** Assist bends within **10°** (was 15°: subtler, your aim matters); Lock stays as built (nearest in view, sticky); assist is for **thrown things only** (stones, fireballs, orbs), not streams or wind; new players start on **Assist**.
