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

**Isolde Marr.** A Lantern Office officer (badge, braid). Assigned to watch you in Act III; becomes the only person in Halcyra who listens. **Decided: a true friend.** Recruited to watch you, she chooses you; the betrayal is elsewhere.

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

**High Lantern Corvane.** Runs the Lantern Office, which registers and polices Wielders. Hard, honest by his own lights, the obvious suspect. **Decided: a red herring.** Not the Architect: he is what the Architect hides behind, and may stand with you at the end.

**The Architect.** Wants the elements under one hand: a world where no Wielder acts unregistered and no Conduit acts at all. Has been nudging monsters, provoking Wielder orders, and spreading the story of the player's destruction (some of it true). **Decided: Master Thessaly**, the Oruun scholar Cael studied under, who taught him to read the stones and taught him the verse. Thessaly wants the Conduit as a lever. Grey-cloaked, grey-eyed, paying in silver with no face on it (Doran's "man in grey" in Thornwick, Act I). Cael's death and the Architect are personally tied; the Empire's institutions stay morally grey rather than evil.

**The Oruun.** The vanished civilisation that learned to hold the elements in balance. Their stones stand all over Aerath; their ruins can't be destroyed. The standing stones are the balance's nails; one cracked in Veyra the night you woke.

## Prologue: The Awakening (Veyra) — built

1. Festival morning. Find Bram at the forge (a choice: earnest or teasing).
2. The square; Mira's bread.
3. **The standing stone.** Wynn sends you to put a hand on it for luck. It answers: runes swell, the four elements' lights rise round it, for you alone. Wynn has kept it sixty years and never seen it answer a hand; she half-remembers the verse. You answer her (*what does it mean* / *it was nothing* / *can I touch it again*); she keeps it from the others.
4. Dusk, home. Emberwings come for you, not the thatch; you can't fight back.
5. The stone cracks; all four elements wake wild in you. Fire from your hands drives off the birds and spills onto your own roof.
6. Cael arrives, puts out every fire, and stills you. Wynn tells him the stone answered your hand; he answers what you told her.
7. The night is counted: what burned, Bram's barn, who Veyra blames. The charm (wear it or not). Help clear the ashes, hunt the birds, or say nothing. The verse.
8. **Dawn: the road out.** Cael leads you out of Veyra up the east road (he waits if you fall behind). No teleport.

## Act I: The Road and the Reach

**The Oruun Gate** (the pass between Veyra and the Verdant Reach; Lesson I, *The Quiet Element*). An Oruun ruin across the road with a sealed passage. Cael teaches Earth: lift, hold still, set down on the plate. Then the trial: the passage is the way through. Break it (loud), burn it (if you didn't wear the charm), or find the counterweight and open it standing (quiet). Cael remembers how you did it, and leads you on into the Reach. *(Built: `scenes/gate.json`.)*

**Thornwick: The Dry Mill** *(built: `scripts/scenes/verdant.mjs`, `qa/thornwick.js`)*. Cael leads you over the bridge into town.
- *Before you arrive:* since the night the stone cracked, a rockslide has dammed the river in the hills above town. The river is low enough to ford; the mill has stopped; the lower fields are drying. Maren's men can't move the stones. Folk mention it when you talk to them.
- *The problem:* reach the slide and open the river.
- *Approaches:*
  - Lift the six rocks off the timber jam with Earth: the river carries the jam away (quiet; care; Cael approves; Earth control grows).
  - Break the jam: the river comes all at once; the dock and the mill's wheel go with it (loud; harm and excess, on your account).
  - Burn the jam (if fire is free): it opens, and the hillside smokes (burned; excess).
  - Leave it: the river stays low, the mill still; Thornwick talks about it.
- *At the slide:* the first Wielder you meet, Doran of the Stonebound, who says the stones *moved on their own* the night of the crack and that a stranger in grey paid him to keep people away. First hint of the Architect.
- *Consequences:* the river and mill state persist, and so do the dock and the field. Maren's standing moves. Folk lines change.
- *Return visit:* the mill turning (or wrecked), Pell the dockhand who lost the dock, Hobb the miller, Maren's accounts. Cael has gone on north to the ruin; the next build is there.

**The training yard** *(built: `qa/yard.js`)*. Before the ruin, Cael takes you to the Lord-Warden's yard east of the hall: Sergeant Brask, four straw men that stand back up, and a pile of stones that never runs out (a thrown stone crumbles and a fresh one rises). Knock three down; Cael counts with you, then goes ahead north. The yard stays for practice.

**The Watchstone** (end of Act I) *(built: `qa/ruin.js`)*. An Oruun ruin north of Thornwick's fields. Cael has gone ahead; he asks you to put your hand on its stone, cracked like Veyra's. Inside the crack: chisel marks, square and patient, and a scrap of grey cloth at its foot. Cael goes quiet: *"I know this hand."* (He won't say whose yet.) Then the Stonebound come, led by Varn, thinking you're the ones cracking their stones. The first Wielder fight: Cael holds one off; you make the other two yield. They keep their distance, lift a stone where you can see it and throw it; lift one yourself and they raise a slab. Wielders never die: beaten, they kneel and yield (spared). Cael ends it without breaking a stone. Let them go, send them to Maren, or ask who told them you'd come (a grey man at the Loom, "very sure" the Conduit would crack the next stone).

> **PLAYER:** "Why are these people attacking us?" **CAEL:** "Because they think we're the problem." **PLAYER:** "Are we?" **CAEL:** "Not yet."

## Act II: The Apprentice

**The Sunken Cistern** *(built: `scenes/cistern.json`, `qa/cistern.js`)*. The road south from the Reach. Bram has caught up at the border (Hollis said don't, so he came, with Mira's bread); he brings Veyra's news, and travels with you from here. Cael leads to an Oruun cistern, a sunken pool by the road, where a travellers' cart is burning. Lesson II: Water answers now (trained, charm or no); draw a stream from the pool and put the fire out before it reaches the tents (care). Then the sluice: the Oruun opened it with water, not hands; hold a stream on its wheel and the gate rises. *"Water doesn't push. It persuades."* On south to Saltmere.

**Saltmere: The Sea Wall** *(built: `scenes/saltmere.json`, `qa/saltmere.js`)*. Cael leads you down to Lowtown, a quarter that has lived below the sea for eight hundred years behind an Oruun wall. Three nights ago the stone in the wall split and the wall opened; the Tidekeepers (Saltmere's water Wielders, captain Nerys) have held the water since, and the spring tide comes tonight. Tide-Regent Oriel Sand meets you at the wall (the Stonebound's letter about you came the day before Cael's). Answer her (*I'll close it* / *they think I did this* / let Bram answer).
- *The tide:* the sea rises on the whole coast; Lowtown fills through the gap. The Oruun built the wall to close itself: lift the fallen wall stones (Earth) and set one on each of the three sockets in the gap, and the wall rises whole.
- *Outcomes:* closed before the water tops the sill, Lowtown stays dry (*held*: care); late, it's wet to the knee (*wet*: less care). Folk and Oriel remember which.
- *The Tidestone:* Cael asks you to touch the stone that split. Chisel marks again, the same hand as the Watchstone: *"Once is a grudge. Twice is a pattern."* Nerys: every stone that breaks, the Conduit's just been. Show her the marks, tell her it bothers you, or ask who told her (a grey coat at the fish market, silver with no face on it).
- *After:* the tide turns; the Regent goes home to the council house; the wall stays closed on every later visit.

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
3. ✅ **Thornwick: The Dry Mill**, with the river and mill states, Doran of the Stonebound, the return visit. Cael leads the way throughout (character role `lead`).
4. ✅ **The Watchstone:** the stone cracked on purpose (Thessaly's hand, which Cael knows), the first Wielder fight (the Stonebound: a new enemy that yields, never dies), Act I told.
5. ✅ **The road south:** the Sunken Cistern, Bram joins, Lesson II (Water: draw, aim, douse; drive a wheel).
6. ✅ **Saltmere: the sea wall** at spring tide: Oriel, Nerys and the Tidekeepers; the wall's sockets; the second stone cut on purpose.
7. **Next:** the road to Emberwall (Lesson III, *Fire, held*: a cold Oruun forge) and Cindrel's furnace fire.
