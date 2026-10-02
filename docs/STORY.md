# ELEMENTAL: the story

The story outline: who the people are, what happens in each act and each kingdom, and how the world answers the player. It follows `DESIGN_BRIEF.md` (§17–32) and what is already built; where the build changed the brief, the build wins and it says so here. **Open decisions** are marked ❓.

## The spine in one paragraph

A festival-night accident wakes a Conduit, the first person in living memory who can hold all four elements. Cael, a stone-reader who has followed the old Oruun stones across the Empire, takes them on the road and teaches them restraint while they travel the six kingdoms. The player helps everywhere they go, and every kingdom keeps its own account of what that help cost. Someone is feeding those accounts: the Architect wants the elements under one hand, and a Conduit everyone fears is the perfect reason to build that hand. Cael finds the thread first. By the time the player believes him, they have already done the one thing they can't take back.

## What the world remembers (built)

| What | Where | Who reads it |
|---|---|---|
| Five tallies per kingdom: harm, care, excess, spared, killed | `core/Ledger.js` | Standing (*the cause of all this* … *saviour*), rulers, folk, endings |
| Story flags: choices, outcomes, who saw what | `prog.flags` | Later scenes, Cael, named characters |
| Each building's state, and who burned it or saved it | session state `<id>`, `<id>@by`, `<id>@saved` | The people who live there (`story/Talk.js`) |
| Every burned house and broken bridge, kept | `scene/Loader.js` persistence | The return visit |

People answer from this when the player taps them: first the scene's own lines, then their house, then their own lines, then their kingdom's folk by standing (`data/talk.js`).

## The people

**The player.** A young smith's apprentice in Veyra (name and look from the creator). Not chosen, not trained, not cruel. Wants to help. The game never says they're wrong to; it shows what helping cost.

**Cael.** Stone-reader, Wielder of Earth (and quietly more), the emotional centre. Dry, observant, kind in ways he won't admit. *Built:* he arrives after the fire to put it out and offers the charm; he is not the brief's first-act antagonist. His arc: teacher → friend → the man everyone cheers while the player is blamed → dead by the player's hand. He believes the Oruun verse names two people, *one who saves the world and one who changes it*, and that he is the first.

**Bram Holloway.** Best friend, the smith's son. Stays in Veyra in the prologue; joins later (Act II) when Veyra sends him after you, or when you send for him. He remembers what you did to his barn.

**Wynn.** Veyra's elder and keeper of the stone. Half-remembers the verse. The first to see the stone answer you.

**Isolde Marr.** A Lantern Office officer (badge, braid). Assigned to watch you in Act III; becomes the only person in Halcyra who listens. ❓ *Is she the Architect's hand, a true friend, or both?* (Recommendation: a true friend who was recruited to watch you and chooses you; the betrayal is elsewhere.)

**Kestrel.** A Skyreach glider-girl who wants to fly more than anything. Teaches Air by example (Act II). Comic heart, high stakes: she is the person your Firestorm can hurt.

**The rulers** (one per kingdom, each with a hall: a landmark that can be destroyed, at heavy cost):

| Kingdom | Ruler | Town | What they care about | Faction |
|---|---|---|---|---|
| Verdant Reach | Lord-Warden Aldric Maren | Thornwick | Roads, bridges, harvest. Keeps accounts | Stonebound (ruins) |
| Emberwall Marches | Forge-Queen Talia Vorn | Cindrel | Furnaces; fire as a craft | Ember Guard |
| Saltmere Coast | Tide-Regent Oriel Sand | Lanthe | The sea wall; the tide's mood | Tidekeepers |
| Skyreach Heights | Abbess-Prince Senn | Vaelmont | The bells, the winds, the climb | Skyborne |
| The Glass Expanse | Matriarch Yessa Keth | Sarn | Water, wells, the shrinking oasis | (riders; no Wielder order) |
| Halcyra (capital) | Empress Ilvane IV | Halcyra | The Empire's shape | Lantern Office (High Lantern Corvane) |

**High Lantern Corvane.** Runs the Lantern Office, which registers and polices Wielders. Hard, honest by his own lights, the obvious suspect. ❓ Not the Architect (recommended): he is what the Architect hides behind.

**The Architect.** Wants the elements under one hand: a world where no Wielder acts unregistered and no Conduit acts at all. Has been nudging monsters, provoking Wielder orders, and spreading the story of the player's destruction (some of it true). ❓ *Who?* Options: (a) **Empress Ilvane**: the ruler who "hears very little" hears everything; (b) **an Oruun scholar Cael once studied under**, who taught him the verse and wants the Conduit as a lever; (c) **someone unseen until Act V**. (Recommendation: **b**, *Master Thessaly*, so Cael's death and the Architect are personally tied, and the Empire's institutions stay morally grey rather than evil.)

**The Oruun.** The vanished civilisation that learned to hold the elements in balance. Their stones stand all over Aerath; their ruins can't be destroyed. The standing stones are the balance's nails; one cracked in Veyra the night you woke.

## Prologue: The Awakening (Veyra) — built

1. Festival morning. Find Bram at the forge (a choice: earnest or teasing).
2. The square; Mira's bread.
3. **The standing stone.** Wynn sends you to put a hand on it for luck. It answers: runes swell, the four elements' lights rise round it, for you alone. Wynn has kept it sixty years and never seen it answer a hand; she half-remembers the verse. You answer her (*what does it mean* / *it was nothing* / *can I touch it again*); she keeps it from the others.
4. Dusk, home. Emberwings come for you, not the thatch; you can't fight back.
5. The stone cracks; all four elements wake wild in you. Fire from your hands drives off the birds and spills onto your own roof.
6. Cael arrives, puts out every fire, and stills you. Wynn tells him the stone answered your hand; he answers what you told her.
7. The night is counted: what burned, Bram's barn, who Veyra blames. The charm (wear it or not). Help clear the ashes, hunt the birds, or say nothing. The verse.
8. **Dawn: the road out.** You walk out of Veyra with Cael beside you, up the east road. No teleport.

## Act I: The Road and the Reach

**The Oruun Gate** (the pass between Veyra and the Verdant Reach; Lesson I, *The Quiet Element*). An Oruun ruin across the road with a sealed passage. Cael teaches Earth: lift, hold still, set down on the plate. Then the trial: the passage is the way through. Break it (loud), burn it (if you didn't wear the charm), or find the counterweight and open it standing (quiet). Cael remembers how you did it. You walk on into the Reach together.

**Thornwick: The Dry Mill** (the Reach's town story; next build).
- *Before you arrive:* since the night the stone cracked, a rockslide has dammed the river in the hills above town. The river is low enough to ford; the mill has stopped; the lower fields are drying. Maren's men can't move the stones. Folk mention it when you talk to them.
- *The problem:* reach the slide and open the river.
- *Approaches:*
  - Lift the dam apart stone by stone with Earth (slow, quiet; Cael approves).
  - Smash it (fast; the surge tears out the dock and floods the low field).
  - Burn or blast it (if fire is free: the slide's timber catches, the hillside forest with it).
  - Leave it (the mill stays stopped; Thornwick remembers that too).
- *At the slide:* the first Wielder you meet, a Stonebound warden who says the stones *moved on their own* the night of the crack and that a stranger in grey paid him to keep people away. First hint of the Architect.
- *Consequences:* the river and mill state persist, and so do the dock and the field. Maren's standing moves. Folk lines change.
- *Return visit:* the mill turning (or not), the dockhand who lost the dock, Maren's accounts.

**The first Wielder fight** (end of Act I): the Stonebound at an Oruun ruin north of Thornwick. Cael wins it without breaking a stone.

> **PLAYER:** "Why are these people attacking us?" **CAEL:** "Because they think we're the problem." **PLAYER:** "Are we?" **CAEL:** "Not yet."

## Act II: The Apprentice

The road east and south. One lesson on each road, one town problem in each kingdom:

| Road | Lesson | Kingdom | Town problem (sketch) |
|---|---|---|---|
| Reach → Saltmere | II, *Water*: a flooded Oruun cistern | Saltmere | The sea wall is cracking at spring tide |
| Reach → Emberwall | III, *Fire, held*: a cold Oruun forge | Emberwall | A furnace fire the Guard can't put out |
| Emberwall → Skyreach | IV, *Air*: the bell tower stair | Skyreach | Kestrel's glider and the storm |

Combinations come in the kingdoms where they matter (Ice on the coast, Firestorm in the Marches, Mud in the Reach, Lava as the line you learn not to cross). Cael criticises sometimes, admires often. Camps between towns: short scenes, the friendship (*"You could become something incredible." "A hero?" "Something more important than that." "What's more important than being a hero?" "Knowing when not to be one."*).

**The first separation** (end of Act II, Skyreach). Cael has found Oruun stones cracked on purpose: someone is causing the disturbances. He wants to follow it; you want to keep helping. *"You want to save everyone." "What's wrong with that?" "Nothing. That's what makes you dangerous."* You part.

## Act III: The Hero (Halcyra)

Alone in the capital. Everyone talks about Cael: he stopped the flood, saved the miners, killed the Ash Wyrm. And *some other Wielder* tore up the eastern district (you). The Lantern Office posts your likeness; Isolde is assigned to you. The Glass Expanse (the oasis dying from below) is where you go to prove them wrong, and where the Architect's work is clearest.

## Act IV: The Conflict

The four Wielder orders move against you, each for reasons that are half right. Fight, negotiate, evade or provoke; every fight can break a town. **The second Cael encounter**: he is cheered in the street; you think he turned them against you; you fight. **The terrible accident**: your strongest combination, Cael in the middle of it. *"You finally did it."*

## Act V: The Truth, and the Finale

Cael's belongings: maps, notes, his record of every disturbance, his notes on you, and the Architect's name. The Architect did a great deal, but not everything: some of the burned houses are yours, and the people who lived in them say so. The Architect's fortress is built round the elemental balance; its puzzles are moral (*destroying this bridge strands the people on it*). The final battle reflects the world you left. No perfect ending.

## How people answer you (the rules)

- **Never a meter.** The world speaks in people: folk lines by standing, rulers by standing, named characters by flags and by what you did to them.
- **Both can be true.** *"You put out the fire on my house once. Then you burned it. I don't know what you're supposed to be."*
- **Return visits matter.** Every town gets one; what's broken stays broken unless someone rebuilds it.
- **Cael notices.** Fire reached for, walls broken, people spared; he says so rarely, and it lands.

## Building it: what's next

1. ✅ The stone, and talk-to-anyone.
2. ✅ **The road out:** the Oruun Gate between Veyra and the Reach (`scenes/gate.json`); Lesson I in it; Cael walks with you; no teleport, no card.
3. **Thornwick: The Dry Mill**, with the river and mill states, the Stonebound warden, the return visit.
4. Then Act I's Wielder fight, and Act II's roads, one at a time.
