# ELEMENTAL: design brief

> **Source of truth.** This is the original design document, kept as written except for spacing and markdown. Two decisions made since then override it:
>
> 1. **Engine.** The brief says Unity/C#. Elemental is built on Hundred Block Dash's stack instead: three.js r128 + cannon.js, shipped to iOS/Android with Capacitor, with every model built in code. Wherever the brief says *Unity*, *ScriptableObject*, *prefab* or *scene*, read the web equivalent in [`TECH_ARCHITECTURE.md`](TECH_ARCHITECTURE.md).
> 2. **Art.** Stylized high fantasy, built with HBD's procedural technique. See [`ART_AND_MODELS.md`](ART_AND_MODELS.md).
>
> The working checklist is [`CHECKLIST.md`](CHECKLIST.md).

**Working title:** ELEMENTAL · High-fantasy mobile action-adventure

| | |
|---|---|
| Genre | Physics-driven action-adventure RPG |
| Platform | iOS / Android |
| Target campaign | 8–12 hours minimum |
| Perspective | Third-person |
| Engine | ~~Unity~~ three.js + cannon.js + Capacitor (see above) |
| Primary mechanic | Gesture-based elemental manipulation |
| Core fantasy | "The world is physically yours to manipulate." |
| Core narrative | "You thought you were saving the world. You were destroying it." |

---

## 1. The game in one sentence

ELEMENTAL is a high-fantasy mobile action-adventure in which the player gains the ability to physically manipulate the elements, believing they are becoming the world's hero, while their increasingly powerful actions destroy towns, damage ecosystems, hurt innocent people, and eventually lead to the accidental death of the person who was actually trying to save the world.

## 2. The design philosophy

The game is built around one fundamental principle: **SHOW THE PLAYER, DON'T TELL THE PLAYER.**

The game should almost never say "You are evil." Instead:

- A player burns down a building. Later, an NPC remembers it.
- A player destroys a bridge. Later, refugees cannot cross the river.
- A player launches a boulder through a monster. The boulder continues flying and kills a civilian.
- A player destroys a town gate to get somewhere faster. Later, enemies enter through the destroyed gate.
- A player saves a village from monsters by flooding part of it. Later, villagers rebuild their homes.

Meanwhile, Cael arrives at those same places and helps repair what the player damaged. The player hears "Cael saved us." And: "That elemental who came through before him nearly destroyed us." Eventually the player realizes: they were the elemental.

## 3. The world: Aerath

Aerath is a high-fantasy continent built around four fundamental elemental forces: **Earth, Water, Fire, Air.** These aren't simply magical categories. They are physical forces that govern the world. Earth creates stability. Water creates life. Fire creates transformation. Air creates movement.

The world remains stable because these forces exist in equilibrium. Ancient civilizations discovered ways to manipulate them. Those civilizations eventually disappeared. The ruins remain, and so does their knowledge.

## 4. Elemental Wielders

Most people cannot directly manipulate the elements. A small number are born with elemental affinity. These people are called **Wielders**. A Wielder might manipulate Earth, Water, Fire or Air. Most specialize in one. Extremely rare individuals can manipulate two. Almost nobody can manipulate all four.

The protagonist is different. They are a **CONDUIT**: a Conduit can channel multiple elements simultaneously. This is why the protagonist's abilities appear miraculous. It is also why the protagonist is extremely dangerous.

## 5. The protagonist

The player creates: name, gender, face, hair, skin, body type, clothing, voice style, starting elemental affinity.

The protagonist begins with limited knowledge. They aren't evil. They aren't deliberately cruel. They genuinely want to help. This distinction is essential. The player should be able to think "I'm doing the right thing" even while the game is showing consequences.

## 6. Cael

Working name: **CAEL**, the game's emotional centerpiece. He is an experienced Wielder: highly skilled, mysterious, sarcastic, compassionate, extremely observant, protective, knowledgeable about elemental history.

When the player first meets him, he appears to be an antagonist. He defeats the protagonist. But instead of killing them, he says: *"You don't understand what you've awakened."* Then leaves. The player assumes Cael is the villain. He isn't.

## 7. Cael's real purpose

Cael has discovered that something is destabilizing the elemental balance. He believes someone is deliberately manipulating elemental Wielders. He encounters the protagonist and immediately recognizes something terrifying: the protagonist is a Conduit. Cael initially intends to stop them. But after watching them, he realizes: they're not evil, they're ignorant. He decides to train them. This begins the central friendship.

## 8. The friendship

This section needs to be one of the longest sections of the game. The player and Cael should spend enough time together that the player genuinely likes him. They should explore ruins, fight monsters, solve environmental puzzles, discover villages, camp, joke, argue, learn elemental techniques, rescue people, get into trouble, discuss their pasts, and discuss what makes someone a hero.

Cael should occasionally criticize the player's methods, but not constantly. He should genuinely admire the player's potential. At one point:

> **CAEL:** "You could become something incredible."
> **PLAYER:** "A hero?"
> **CAEL:** "Something more important than that."
> **PLAYER:** "What's more important than being a hero?"
> **CAEL:** "Knowing when not to be one."

The meaning is invisible at the time. It becomes devastating later.

## 9. Elemental gameplay

The elemental system should NOT behave like a traditional spell wheel. The player interacts with the actual environment.

- **Earth:** pick up rocks, throw rocks, pull stones from walls, create barriers, break walls, move debris, raise platforms, collapse structures, manipulate soil, create ramps, create temporary cover.
- **Water:** pull water from rivers, redirect water, extinguish fires, create streams, push objects, flood areas, freeze water later, create ice bridges, create ice platforms.
- **Fire:** ignite wood, burn vegetation, melt ice, heat metal, ignite oil, cause explosions, create smoke, destroy structures.
- **Air:** push objects, pull objects, redirect projectiles, create gusts, extinguish flames, accelerate fire, move lightweight objects, eventually glide.

## 10. Element combinations

The player's power develops progressively.

- **Earth + Water → Mud:** slow enemies, create unstable terrain, trap enemies, repair structures, create clay.
- **Water + Air → Ice:** bridges, slides, barriers, traps, freezing enemies.
- **Fire + Air → Firestorm:** spread flames, launch fire, create powerful area attacks.
- **Earth + Fire → Lava:** extremely powerful, and extremely destructive. This should be one of the first abilities that makes the player realize: "Maybe I shouldn't be doing this everywhere."

## 11. The destruction system

One of the game's defining features. The world should not simply reset after combat. Damage persists. If the player destroys a house, bridge, market stall, wall, tree, crop, road, tower or gate, the game records it. Some damage can eventually be repaired. Some cannot.

## 12. The consequence system

Every significant world object receives a persistent state. Example:

```
Object:                  Townhouse_07
State:                   Intact | Damaged | Destroyed | Burned | Repaired
Cause:                   Player | Monster | NPC | Environmental event
Time:                    Day 4
Witnesses:               23
Known responsible party: Player
Reputation impact:       -12
Quest impact:            Quest_17 delayed
```

This is how the world remembers the player.

## 13. Player reputation

Do NOT create a simple Good/Evil meter; that would make the story too obvious. Create multiple reputation dimensions:

- **Fear:** how frightened people are of you.
- **Trust:** how much people believe you.
- **Gratitude:** how much people appreciate specific things you have done.
- **Blame:** how strongly people associate disasters with you.
- **Fame:** how widely known you are.

This creates complicated situations. The player could have high Fame, high Gratitude, high Fear and extremely high Blame. People know who you are. Some admire you. Some are terrified of you. Everyone remembers the destruction.

## 14. The NPC memory system

NPCs should have persistent memories. Example:

```
NPC: Mara
Memory: Player saved daughter from monster.
Memory: Player accidentally destroyed bakery.
Memory: Player burned town wall.
Emotion: +20 gratitude, -40 fear, -15 trust
Current opinion: "I don't think they're evil. I think they're dangerous."
```

This allows NPC dialogue to change naturally.

## 15. The critical narrative trick

Even if the player does something good, people may still blame them. A monster attacks a town. The player saves everyone. But during the battle buildings are destroyed, roads collapse, fires spread, civilians are injured. The player saved the town. But the town remembers the destruction.

One NPC might say "You saved my daughter." Another: "And destroyed my home." Another: "Maybe both are true." This is much more interesting than a morality meter.

## 16. Town design

Every major town should contain four layers:

1. **Before the player arrives:** the town has its own problems.
2. **Player interaction:** the player can help, fight, explore, manipulate elements, destroy things.
3. **Consequences:** the town changes.
4. **Return visit:** the player sees what their actions caused. This is critical.

## 17. The story structure

| Part | Length |
|---|---|
| Prologue | 30–45 minutes |
| Act I | 1–1.5 hours |
| Act II | 2 hours |
| Act III | 2 hours |
| Act IV | 2 hours |
| Act V | 1–2 hours |
| Finale | 45–60 minutes |
| **Total** | **8–12+ hours** (exploration and optional content extend this substantially) |

## 18. Prologue: The Awakening

The player begins in **Veyra**, a beautiful mountain village. The player is an ordinary young person. A monster attack begins. The protagonist attempts to help. Their powers awaken. They accidentally destroy a building, injure the environment, and create an enormous elemental reaction. But they save several people. Everyone is amazed. The player thinks: "I can protect people."

Then Cael appears. He watches silently. The protagonist attacks him. Cael effortlessly defeats them. He says: *"You don't know what you are."* Cut to title: **ELEMENTAL**.

## 19. Act I: The Stranger

The player searches for Cael and eventually finds him. Cael reluctantly agrees to train them. The player learns Earth, basic physics manipulation, elemental targeting and environmental interaction. The first major dungeon is an ancient elemental ruin. Cael and the player explore it together. They encounter their first elemental Wielder enemy. Cael defeats them.

> **PLAYER:** "Why are these people attacking us?"
> **CAEL:** "Because they think we're the problem."
> **PLAYER:** "Are we?"
> **CAEL:** "Not yet."

## 20. Act II: The Apprentice

The player learns Water and Fire. The pair travel through forests, mountains, ruins, villages and underground caverns. The player starts becoming extremely powerful. Cael repeatedly teaches restraint. The player occasionally ignores him. This creates small consequences. Nothing catastrophic yet. The player and Cael become friends.

## 21. The first separation

Cael discovers evidence of a larger conspiracy. He believes someone is deliberately causing elemental disturbances. The player wants to continue helping people. Cael wants to investigate the source. They argue.

> **CAEL:** "You want to save everyone."
> **PLAYER:** "What's wrong with that?"
> **CAEL:** "Nothing. That's what makes you dangerous."

They separate.

## 22. Act III: The Hero

The player travels alone. They enter **AURELIA**, a massive fantasy city. This is where the narrative trick becomes obvious without being explained. NPCs talk about Cael: "Cael stopped the flood." "Cael rescued the miners." "Cael defeated the Ash Wyrm." "Cael repaired the western aqueduct." The player is confused. Then: "Some other elemental came through. They destroyed half the eastern district." The player realizes they are talking about the player. But the player doesn't accept it. They rationalize it: "They don't understand what happened."

## 23. The player becomes a wanted person

Rumors spread. The protagonist becomes associated with destroyed villages, elemental disasters, attacks on Wielders and monster outbreaks. The player believes the rumors are propaganda. And sometimes they are. This is important: the player isn't wrong about everything. Someone really is manipulating events.

## 24. Act IV: The Conflict

The player begins encountering other Wielders. Each town has different elemental factions:

- **The Ember Guard:** Fire Wielders who protect industrial settlements.
- **The Tidekeepers:** Water Wielders who control canals and agriculture.
- **The Stonebound:** Earth Wielders protecting ancient ruins.
- **The Skyborne:** Air Wielders living in mountain cities.

The player can fight, negotiate, evade, or accidentally provoke them. Every battle can damage the environment.

## 25. The second Cael encounter

The player finds Cael. He has become famous. People cheer when he enters town. The player is angry; they believe Cael has turned everyone against them. Cael tries to explain. The player refuses to listen. They fight.

> **CAEL:** "STOP!"
> **PLAYER:** "You betrayed me!"
> **CAEL:** "No. I was trying to save you."

## 26. The terrible accident

The game's emotional turning point. The player uses an extremely powerful elemental combination, perhaps Earth + Fire + Air. The attack destabilizes the environment. Cael attempts to stop it. The player doesn't realize he is standing inside the reaction zone. The attack hits him. Silence. Cael falls. The player runs to him.

> **PLAYER:** "Cael?" No response. "Cael?"
> He looks at the player. **CAEL:** "You finally did it."

The player thinks he means "You finally mastered the elements." But Cael means "You finally destroyed what you couldn't control." He dies.

## 27. The revelation

After Cael's death, the player discovers his belongings: maps, notes, sketches, elemental research, observations about the player. The player expects to find evidence that Cael betrayed them. Instead they discover Cael had been protecting them. He had been documenting every major elemental disturbance. He had been investigating the Architect. He had been trying to find a way to prevent the player from being manipulated. He genuinely considered the protagonist his friend.

## 28. Act V: The Truth

The player discovers **THE ARCHITECT**, the true antagonist. Their objective: create a world where elemental power can be centrally controlled. The protagonist is the perfect weapon. The Architect has been manipulating monsters, provoking Wielders, creating elemental disturbances, spreading rumors, manipulating evidence, and using the protagonist's destruction to destabilize political relationships.

But there is an important complication: **the Architect did not cause everything.** Some destruction was genuinely the player's fault. Some deaths were genuinely caused by the player. Some towns genuinely hate them for good reason. The Architect cannot simply be blamed for everything. This preserves the emotional weight.

## 29. The player's realization

The protagonist finally confronts the truth. Not "I'm secretly evil." Instead: "I kept trying to be the hero without understanding what being a hero required." The player remembers Cael's warnings, destroyed villages, injured civilians, burned buildings, broken bridges, frightened NPCs, Wielders they attacked, and people they genuinely helped. The player realizes: **intent doesn't erase consequence.**

## 30. The final act

The player enters the Architect's fortress, constructed around the elemental system itself. Every area represents one element. The player must use everything they've learned. But now the environmental puzzles are morally meaningful. Earlier: "Destroy the bridge to progress." Now: "Destroying this bridge will strand hundreds of civilians." The game gives the player alternatives. The player has learned restraint.

## 31. Final battle

The Architect attempts to seize control of the protagonist. The player must fight using Earth, Water, Fire, Air, combinations and environmental manipulation. The final battle changes based on the player's accumulated destruction: a heavily destructive player sees a devastated world; a restrained player sees more intact environments. But there is no "perfect hero" ending. The protagonist has consequences.

## 32. Endings

- **Ending A: The Conduit.** The player takes complete control of the elemental system. The world becomes stable. But the protagonist becomes the world's absolute elemental authority. Final line: "The world was finally safe." Then: "Because nothing could disobey me."
- **Ending B: The Release.** The protagonist destroys the system. Elemental Wielders lose much of their power. The world becomes independent of Conduits. The protagonist walks away. Nobody knows what to call them. Hero? Villain? Survivor? The game doesn't answer.
- **Ending C: The Sacrifice.** The protagonist gives themselves to the elemental system and becomes its guardian. Final scene: a traveler walks through a forest. The wind moves. A rock shifts. A flame extinguishes itself. The traveler whispers: "Thank you."
- **Ending D: The Fall.** If the player repeatedly embraces destructive solutions, the Architect can convince them that control is the only answer. The protagonist becomes the new Architect. The final scene shows the world under their control. Then: "At least nobody can hurt anyone anymore." Cut to black.

## 33. Optional postgame: World State Mode

After completing the story the player can continue exploring the world. Towns remember the final state. Destroyed areas remain damaged. Characters continue living. Some towns may rebuild; some may never recover. Cael's memorials appear throughout the world, and the player can revisit them.

## 34. Core gameplay loop

Explore → observe environment → manipulate environment → solve physical problem → fight enemies → cause environmental consequences → discover story → enter settlement → NPC reactions → quest → explore → return to altered world → progress abilities.

The important part: **combat and environmental manipulation are not separate systems. They are the same system.**

## 35. Mobile control system

The controls should feel like the player is actually manipulating the world.

| Gesture | Meaning |
|---|---|
| Tap | Select object |
| Hold | Grab / maintain elemental influence |
| Drag | Move object |
| Swipe | Apply force |
| Two-finger drag | Large-scale manipulation |
| Circular gesture | Elemental rotation / manipulation |
| Pinch | Increase/decrease force radius |
| Flick | Throw |
| Long press | Charge elemental power |

## 36. Element selection

Avoid a giant HUD. Use an elemental wheel: the player touches and holds the elemental control, their thumb moves toward Earth / Water / Fire / Air, and releasing selects the element. The environment responds visually: with Earth, nearby rocks highlight subtly; with Water, nearby water begins reacting; with Fire, combustible objects glow; with Air, lightweight objects show airflow indicators.

## 37. Physics architecture

~~Use Unity physics.~~ (cannon.js; see note at top.) NEVER simulate every object at full physical fidelity. Divide objects into:

- **Static:** buildings, terrain, large structures.
- **Interactive:** rocks, barrels, furniture, debris.
- **Destructible:** walls, doors, bridges, roofs.
- **Elemental:** water, fire, ice, lava.
- **Cosmetic:** grass, leaves, particles.

This is essential for mobile performance.

## 38. Destruction architecture

Use modular destruction. A building isn't one giant physics object. It consists of foundation, walls, roof, doors, windows, furniture and decorative elements. The player can destroy individual pieces. At predefined structural thresholds: **Intact → Damaged → Critical → Collapsed.** This gives the appearance of highly dynamic destruction without requiring a fully simulated building.

## 39. World state architecture

Every persistent location gets a state.

```
World
 ├── Region
 │    ├── Town
 │    │    ├── Buildings
 │    │    ├── NPCs
 │    │    ├── Quests
 │    │    └── Reputation
 │    └── Wilderness
 └── Global Story State

TownState {
    population, reputation, destructionLevel, fireDamage, waterDamage,
    structuralDamage, repairedStructures, completedQuests, activeQuests,
    playerKnown, playerFear, playerTrust
}
```

## 40. Event system

Every meaningful action should generate an event: `BuildingDestroyed`, `NPCSaved`, `NPCInjured`, `NPCKilled`, `MonsterDefeated`, `FireStarted`, `FireExtinguished`, `BridgeDestroyed`, `BridgeRepaired`, `TownAttacked`, `PlayerEnteredTown`, `CaelVisitedTown`. Events feed NPC memories, quests, reputation, dialogue, world state and story progression.

## 41. Quest architecture

Quests should not simply be "go here → kill enemy → collect item → return." Instead: problem → player chooses approach → environmental interaction → consequence → NPC reaction → quest state changes.

Example, **"The Broken Aqueduct":** a town needs water. Possible solutions: repair the aqueduct; redirect a river; freeze water into a temporary channel; destroy a dam; ignore the problem. Every solution produces different consequences.

## 42. NPC dialogue system

Dialogue should be data-driven:

```
if playerDestroyedHouse == true       dialogue = "You burned my home."
else if playerSavedChild == true      dialogue = "I remember what you did for my daughter."
else                                  dialogue = defaultDialogue
```

Multiple memories can combine. An NPC could say: "You saved my daughter." Pause. "Then you burned my house." Pause. "I don't know what you're supposed to be."

## 43. Enemy system

Monsters (naturally occurring creatures), corrupted creatures (affected by elemental instability), elemental Wielders (human opponents), elite Wielders (major combat encounters), bosses (story-critical encounters).

## 44. Wielder combat

Every Wielder should physically manipulate the environment. A Fire Wielder can ignite trees, throw flaming debris, melt ice. An Earth Wielder can raise walls, throw rocks, collapse terrain. A Water Wielder can flood areas, create projectiles, freeze surfaces. An Air Wielder can launch debris, redirect attacks, create wind barriers. The player isn't fighting spellcasters. They're fighting people who manipulate the same physical world.

## 45. Boss design

Bosses should teach elemental mechanics.

- **Earth boss** uses terrain. Teaches positioning, breaking cover, moving objects.
- **Fire boss** uses environmental ignition. Teaches fire propagation, water counterplay.
- **Water boss** uses flooding. Teaches elevation, freezing.
- **Air boss** uses projectile manipulation. Teaches momentum, object physics.

## 46. Cael's combat AI

Cael should feel substantially stronger than the player early in the game. He uses predictive movement, efficient elemental combinations, environmental awareness and minimal destruction. The contrast is important. The player fights like "MORE POWER!" Cael fights like "Exactly as much power as necessary." The player eventually becomes more powerful than Cael, but should never become wiser than him automatically.

## 47. Visual identity

High fantasy. The world should feel ancient, enormous, magical, physically believable, colorful and mysterious. Avoid generic medieval fantasy. The elemental system should visually dominate the identity: massive floating rocks, rivers flowing through enormous cities, ancient elemental machines, fire-lit mountain settlements, floating ruins, airborne structures, water temples, underground civilizations.

## 48. World regions

1. **Veyra:** mountain village. Tutorial.
2. **Verdant Reach:** dense forest. Water/Earth.
3. **Ashen Vale:** volcanic region. Fire.
4. **Aurelian Basin:** massive fantasy civilization. All elements.
5. **Skyreach:** mountain/air region. Air.
6. **The Hollow:** underground ancient civilization. Ancient elemental technology.
7. **The Convergence:** final region. All elements collide.

## 49. Model / asset pipeline

Every game asset should be designed around modularity.

```
Characters:   Player, Cael, NPC, Wielders, Monsters
Environment:  Terrain, Buildings, Props, Ruins, Vegetation
Elemental:    Fire, Water, Earth, Air, Ice, Lava
Destruction:  Walls, Doors, Bridges, Roofs, Debris
FX:           Elemental, Destruction, Combat, Environment
```

## 50. Technical architecture (Unity folder layout)

The brief's Unity `Assets/` layout (Art, Audio, Materials, Prefabs, Scenes per region, Scripts per system, ScriptableObjects, Tests) is mapped to the web project in [`TECH_ARCHITECTURE.md`](TECH_ARCHITECTURE.md).

## 51. Core software architecture

Modular systems.

```
GameManager ── SaveManager, WorldStateManager, QuestManager, DialogueManager,
               ReputationManager, EventManager, AudioManager, SceneManager
PlayerController ── InputController, ElementController, GrabController, ThrowController,
                    MovementController, CombatController, HealthController, InteractionController
ElementController ── EarthSystem, WaterSystem, FireSystem, AirSystem, CombinationSystem
```

## 52. Data-driven design

Do not hard-code quests, NPC dialogue, elemental abilities, or enemy statistics. ~~Use ScriptableObjects~~ (data modules; see TECH_ARCHITECTURE).

```
ElementDefinition: ElementType, Force, Range, MassLimit, EnergyCost, InteractionTags, VisualEffect, AudioEffect
QuestDefinition:   QuestID, Title, Description, Objectives, Conditions, Rewards, FailureStates, Consequences, DialogueReferences
NPCDefinition:     NPCID, Name, Faction, HomeTown, Personality, Memories, Relationships, DialogueTree
```

## 53. Save system

- **Player:** appearance, abilities, upgrades, inventory, location.
- **World:** destroyed objects, repaired objects, fires, destroyed bridges, completed quests, town states.
- **NPC:** memories, relationships, alive/dead, location.
- **Story:** chapters, Cael relationship, discovered clues, Architect knowledge, major decisions.
- **Reputation:** fear, trust, blame, gratitude, fame.

## 54. Performance architecture

Mobile performance is a first-class requirement. Use object pooling, GPU instancing, LODs, baked lighting where appropriate, simplified collision meshes, capped physics simulation, regional loading, additive scene loading, occlusion culling, pooled particles, limited simultaneous rigidbodies. Do NOT allow hundreds of full-detail rigidbodies to simulate indefinitely. When objects leave meaningful interaction range: **Active Physics → Simplified Physics → Cached World State.**

## 55. The physics budget

Starting target: player 1; active enemies 10–30; interactive rigidbodies 50–100; major destruction objects 20–40; particles budgeted by device tier. The exact values should be profiled on real target devices rather than assumed.

## 56. World streaming

Do not build the entire world as one scene. World → persistent systems, regions (terrain, town, NPCs, encounters), streaming boundary. Load nearby areas asynchronously.

## 57–68. Development roadmap

Do NOT build the entire game immediately. Build the smallest possible version of the central fantasy first.

| Phase | Goal / contents |
|---|---|
| **1. Technical prototype** | "Can manipulating the world actually feel fun?" Third-person player, touch movement, camera, one room, 10 rocks, one wooden wall, water container, fire, Earth/Water/Fire manipulation, basic physics, throwing, destruction. No story, inventory, NPCs or quests. |
| **2. Elemental sandbox** | Air, freezing, fire spreading, water-flow approximation, object combinations, elemental interactions, destructible structures. Test: can a player spend 20 minutes just experimenting? If not, do not continue. |
| **3. Mobile controls** | Touch movement, gesture grabbing, swipe throwing, elemental wheel, contextual interaction, camera controls, accessibility options. Test on actual phones. |
| **4. Destruction system** | Destructible walls, buildings, bridges, doors, props; fire, water and structural damage; persistent damage. Create a small town, let the player destroy it, reload: the damage must persist. |
| **5. NPC memory** | 10 NPCs, 5 buildings, memory, reputation, dynamic dialogue. Test: player burns house, leaves, returns, NPC remembers. |
| **6. First vertical slice** | 30–45 minutes: Veyra, protagonist creation, awakening, first monster attack, first powers, Cael introduction, Cael fight, beginning of training. Should feel like a real game. |
| **7. Cael system** | Character, AI, combat, dialogue, friendship system, training missions, companion behavior. Cael must feel like a real character, not a tutorial NPC. |
| **8. First major region** | Verdant Reach: 2 towns, 1 dungeon, 5–10 enemy types, 2 Wielder types, 3 bosses, environmental puzzles, optional quests. |
| **9. Story system** | Cinematic triggers, dialogue trees, story flags, chapter system, relationship states, world events, Cael separation. |
| **10. Full world** | Remaining regions, each introducing a new elemental mechanic, enemy, Wielder faction, puzzle type, consequence type and story information. |
| **11. Cael's death** | One of the most carefully produced sequences. No cheap twist, no sudden melodrama. The player must understand exactly what happened. Afterward gameplay changes: his combat style, advice and campfire conversations are gone. The player is alone. |
| **12. Endgame** | Architect, final region, final dungeon, final boss, ending calculations, ending cinematics, postgame world state. |

## 69. QA testing

- **Physics:** Can objects become trapped? Can players launch themselves outside the world? Can buildings collapse incorrectly?
- **Narrative:** Can the player reach areas out of order? Destroy quest objects? Kill important NPCs?
- **Save:** Does destruction persist? NPC memory? Quest state?
- **Mobile:** Thermal throttling, battery drain, memory pressure, frame rate, touch accuracy, device compatibility.

## 70. The Chaos Test

Give a tester no instructions. Tell them "You can manipulate the world." Observe. If the tester immediately tries to burn a house, destroy a bridge, throw rocks, flood something, launch an NPC or break into an area, that's good. The game should support curiosity.

## 71. The Cael Test

Give someone who knows nothing about the story the first 3 hours. Ask "Who do you think the villain is?" Expected: Cael. "Do you like Cael?" Expected: yes. Later: "Who do you think the real hero is?" Expected: the player. Only after the reveal should those assumptions collapse.

## 72. The Villain Test

After completing the game, ask "Was the protagonist evil?" There should not be an obvious yes/no answer. The better response: "They caused terrible things, but they weren't trying to." That ambiguity is the point.

## 73. Master AI development prompt (summary)

The full master prompt restates §1–72 for an AI agent. Its binding rules:

- **Theme:** intent does not erase consequence. The Architect is not responsible for everything; do not retroactively excuse the protagonist.
- **Build incrementally.** Every feature goes Architecture → Data model → Core implementation → Integration → Testing → Optimization → Documentation → Cleanup. Maintain a master Markdown checklist; one unchecked task at a time; mark it done; never implement future systems prematurely.
- **Code:** clean modular architecture; interfaces only where they decouple meaningfully; data-driven content; no unnecessary third-party dependencies; no narrative content in gameplay classes; event-driven world consequences; independently testable systems; no monolithic GameManager.
- **Required systems:** GameBootstrap, SaveSystem, SceneSystem, WorldStateSystem, EventSystem, QuestSystem, DialogueSystem, NPCMemorySystem, ReputationSystem, PlayerSystem, InputSystem, ElementSystem, PhysicsInteractionSystem, DestructionSystem, CombatSystem, EnemyAISystem, WielderAISystem, CaelSystem, AudioSystem, UISystem.
- **Element system:** generic framework for Earth, Water, Fire, Air plus derived Ice, Lava, Mud, Steam, Smoke. Each defines Force, Range, MassLimit, EnergyCost, InteractionTags, Damage, EnvironmentalEffects, VFX, SFX. Objects expose composable capabilities (`IElementReactive`, `IGrabbable`, `IThrowable`, `IDestructible`, `IFlammable`, `IFreezable`, `IFloodable`, `IBreakable`), never a hard-coded system per object.
- **Physics rule:** identify target → determine allowable interaction → calculate force → apply force → trigger elemental reaction → record world event → update nearby environmental systems. Activate/deactivate physics by distance and relevance.
- **Destruction:** persistent, every important destructible has an ID (e.g. `Town_Veyra_Building_003`); states Intact, Damaged, Critical, Destroyed, Burned, Flooded, Collapsed, Repaired; reconstruct on reload.
- **NPC memory entries:** EventID, EventType, Location, Timestamp, EmotionalWeight, PositiveOrNegative, WitnessedByNPC. Contextual dialogue conditions, not hand-built infinite trees.
- **Reputation** (Fear, Trust, Gratitude, Blame, Fame) influences dialogue, prices, quest availability, combat, NPC proximity, guards, rumors, town reactions, story events.
- **Quests** support multiple solutions and branch rather than break when a quest-critical object is destroyed.
- **Save** is versioned with migration of older saves.
- **Input:** Tap, Hold, Drag, Swipe, Flick, Pinch, two-finger, element wheel; configurable; not excessively precise on small screens; accessibility settings.
- **Camera:** third-person; avoid clipping; frame interaction targets; support combat and puzzles; smooth follow; automatic adjustment.
- **Performance:** mobile first; profile before optimizing; no assumptions without measurements.
- **Agent workflow per feature:** name the subsystem; identify dependencies; update the checklist; implement the smallest functional version; test; report exact files changed; explain how to verify; only then move on. Never silently implement multiple unrelated features.

## 74. First development checklist

Carried into [`CHECKLIST.md`](CHECKLIST.md), adapted to the web stack.

## 75. The most important prototype

Before building the massive world, create this exact scenario: a tiny village with 5 buildings, 10 NPCs, 20 interactive objects, a river, a bridge, a forest and 5 enemies. The player can pick up and throw rocks, break walls, move and freeze water, ignite buildings, extinguish fires, destroy the bridge, fight enemies, and accidentally hurt NPCs. Then: leave the village, save, return. The village should remember. NPCs should remember. Destroyed objects should remain destroyed. Dialogue should change.

This tiny village is effectively the proof-of-concept for the entire game. If this works, the rest of ELEMENTAL becomes a content problem rather than a fundamental technology problem.

## 76. The ultimate design principle

The player should eventually look back at the beginning of the game and realize the game was telling them the truth the entire time. Cael warned them. NPCs warned them. The environment warned them. Their own actions warned them. They simply interpreted every warning as an obstacle standing between them and becoming the hero.

The final realization shouldn't be "The game tricked me." It should be: **"The game never lied to me. I lied to myself."** And Cael's death should be the moment that makes the entire first half of the game suddenly mean something different.

## 77. The core experience

The finished game should leave the player with three memories:

1. "Holy shit, I can actually manipulate this world."
2. "Cael was my friend."
3. "Oh God. What have I done?"

Everything else exists to support those three moments.
