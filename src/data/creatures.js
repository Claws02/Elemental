// ============================================================
// CREATURES — Aerath's wildlife, as data (the world bible's archetypes)
// ============================================================
//
// Every creature reacts to the elements through the same five channels
// (src/creatures/Creatures.js), and each species' numbers say how much:
//
//   impact   something heavy hit it (a thrown rock, falling debris), by speed × mass
//   fire     a fireball, standing in flames, a blast
//   water    the stream or an orb: soaks it, pushes it
//   wind     wind and gusts: push it, and flyers get tumbled
//   (a charge that ends against a wall is an impact of its own making)
//
// `weak` multiplies damage from a channel; `fears` makes it flee from that
// element; `soakedFalls` grounds a flyer that gets wet. Weaknesses follow
// from what the creature is, so a player can work them out: a bird of embers
// hates water, a charging boar is stopped by a wall, a pack animal fears fire.
//
// `behaviour` picks the AI: charge · pack · flyer.
//
// `tier` (1–4) is how strong the hero must be before the species appears
// (TIERS, by Progression.might()). One tier short, an animal (`young`) comes
// as its young instead: fewer, smaller, weaker (YOUNG). Further short, or not
// an animal, it isn't there yet. The world fills in as the hero grows.
// ============================================================

export const SPECIES = {
    emberwing: {
        tier: 1, young: true,
        name: 'Emberwing', behaviour: 'flyer',
        hp: 20, radius: 0.32, mass: 2, speed: 7, sense: 26, reach: 1.4,
        cruise: [5, 7.5],                     // flight height, metres
        attack: { damage: 8, every: 3.5, ember: true },   // dives, drops a burning ember on what's below
        weak: { impact: 3, fire: 0, water: 2, wind: 1 },
        fears: ['water'], soakedFalls: true, fleeAt: 0.5,
        look: { body: 0x7a2a1a, wing: 0x9a3a1e, glow: 0xff7a2a },
    },
    bristleback: {
        tier: 2, young: true,
        name: 'Bristleback', behaviour: 'charge',
        hp: 90, radius: 0.75, mass: 160, speed: 3, sense: 16, reach: 1.7,
        charge: { windup: 0.9, speed: 12, time: 1.6, stun: 2.5 },
        attack: { damage: 28, knock: 11 },
        weak: { impact: 1, fire: 1, water: 0.3, wind: 0.2, stunned: 2.5 },
        fears: [], fleeAt: 0.25,
        look: { body: 0x5a4030, bristle: 0x3a2a1e, tusk: 0xe8dcc0 },
    },
    thornhound: {
        tier: 2, young: true,
        name: 'Thornhound', behaviour: 'pack',
        hp: 35, radius: 0.45, mass: 45, speed: 6.5, sense: 20, reach: 1.3,
        circle: 4.5,                          // metres they hold off at before darting in
        attack: { damage: 12, every: 2.2, lunge: 9 },
        weak: { impact: 1.5, fire: 2, water: 0.5, wind: 0.6 },
        fears: ['fire'], fleeAlone: true, fleeAt: 0.35,
        look: { body: 0x4a5040, thorn: 0x2e3326, eye: 0xd8e05a },
    },

    // ---- the rest of the bestiary (phase 5): each answers to what it physically is ----------------------
    shellback: {
        tier: 2, young: true,
        name: 'Shellback', behaviour: 'tank',
        hp: 70, radius: 0.85, mass: 220, speed: 1.6, sense: 14, reach: 1.9,
        attack: { damage: 18, every: 2.5, knock: 6 },
        weak: { impact: 0.1, fire: 0.25, water: 0.1, wind: 0, flipped: 5 },     // the shell takes it all, until it is on its back
        flipTime: 7, fears: [], fleeAt: 0.2,
        look: { shell: 0x5a6a4a, plate: 0x4a5a3c, skin: 0x8a8a6a, eye: 0xd8e05a },
    },
    cindermite: {
        tier: 2, young: true,
        name: 'Cindermite', behaviour: 'swarm',
        hp: 5, radius: 0.22, mass: 1.5, speed: 5.5, sense: 18, reach: 0.7,
        attack: { damage: 4, every: 0.8 },
        weak: { impact: 2, fire: 0, water: 4, wind: 1.5 },                     // heat is what it eats; water kills it
        seeks: 'heat', fears: [], fleeAt: 0,
        look: { body: 0x2a2220, glow: 0xff7a2a },
    },
    mudling: {
        tier: 1, young: true,
        name: 'Mudling', behaviour: 'lumber',
        hp: 40, radius: 0.6, mass: 90, speed: 2.2, sense: 15, reach: 1.5,
        attack: { damage: 14, every: 2.2, knock: 4 },
        weak: { impact: 0, fire: 0.6, water: 0, wind: 0.2, baked: 4 },           // stones sink into it; baked, a stone shatters it
        bakeAt: 10, bakeTime: 8, splits: true, fears: [], fleeAt: 0,
        look: { body: 0x5a4632, dark: 0x3e3022, baked: 0xa88a62, eye: 0xd8c07a },
    },
    brinecoil: {
        tier: 3, young: true,
        name: 'Brinecoil', behaviour: 'swim',
        hp: 45, radius: 0.5, mass: 40, speed: 4, sense: 16, reach: 1.6,
        attack: { damage: 16, every: 2.5, shock: 6 },                           // shocks the water: metres around it
        weak: { impact: 1, fire: 0.6, water: 0, wind: 0.3 },
        fears: [], fleeAt: 0.3, frozenFor: 9,                                   // ice pins it far longer than most
        look: { body: 0x2a5a6a, belly: 0x8ab8b8, glow: 0x9ae8ff },
    },
    galekite: {
        tier: 2, young: true,
        name: 'Gale-kite', behaviour: 'kite', flies: true,
        hp: 26, radius: 0.55, mass: 6, speed: 7.5, sense: 26, reach: 1.6,
        cruise: [8, 12], attack: { damage: 12, every: 4 },
        weak: { impact: 3, fire: 1, water: 1, wind: 1, grounded: 2 },            // weight or wind brings it down
        groundTime: 5, fears: [], fleeAt: 0.35,
        look: { body: 0x6a8aa8, wing: 0x8aa8c4, under: 0xd8e4ec, eye: 0xffffff },
    },
    frostmaw: {
        tier: 3, young: true,
        name: 'Frostmaw', behaviour: 'freezer',
        hp: 60, radius: 0.65, mass: 110, speed: 3.4, sense: 18, reach: 1.7,
        attack: { damage: 14, every: 2.4, chill: 3 },
        weak: { impact: 1, fire: 1.4, water: 0, wind: 0.4, thawed: 2 },          // fire thaws it: slow and clumsy
        wallEvery: 7, thawTime: 6, fears: [], fleeAt: 0.25,
        look: { body: 0xa8c8d8, scale: 0x7aa0b8, frost: 0xe8f6ff, eye: 0x6ad8ff },
    },
    glasswight: {
        tier: 3, young: false,
        name: 'Glass-wight', behaviour: 'guard',
        hp: 50, radius: 0.55, mass: 140, speed: 2.8, sense: 10, reach: 1.8,
        attack: { damage: 16, every: 2 },
        weak: { impact: 2.5, fire: 0, water: 0, wind: 0 },                       // only a heavy blow; fire bounces back at you
        shatterAt: 12, reflects: 0.6, guardRange: 9, fears: [], fleeAt: 0,
        look: { body: 0xa8d8d0, edge: 0x7fc8c0, glow: 0x7ff0e0 },
    },
    sentinel: {
        tier: 3, young: false,
        name: 'Lantern Sentinel', behaviour: 'sentinel',
        hp: 999, radius: 0.75, mass: 400, speed: 1.2, sense: 16, reach: 2,
        attack: { damage: 5, bind: 14 },                                        // binding light: holds you, wears you down
        weak: { impact: 0, fire: 0, water: 0, wind: 0 },
        lamps: 3, lampWater: 1.2, alarmAt: 15, fears: [], fleeAt: 0,
        look: { body: 0x5a5e66, trim: 0xc8a85a, lamp: 0xffd68a, dark: 0x2a2c30 },
    },
    // A Wielder of the Stonebound (Earth): a person, not a beast. Keeps its distance, lifts a stone where you can
    // see it and throws it; raises a slab when you lift one. Never killed: hurt enough, it yields (spared).
    stonebound: {
        tier: 2, young: false, person: 'stonebound',
        name: 'Stonebound', behaviour: 'wielder',
        hp: 40, radius: 0.42, mass: 70, speed: 3.2, sense: 18, reach: 1.2,
        attack: { damage: 7, every: 3.4, windup: 0.9, speed: 15, range: 8 },
        shield: { every: 7, secs: 2.5 },
        weak: { impact: 1.3, fire: 0.7, water: 0.4, wind: 0.6 },
        yieldAt: 0.3, fears: [], fleeAt: 0,
        look: {},
    },
    wellspawn: {
        tier: 4, young: false,
        name: 'Wellspawn', behaviour: 'shifter',
        hp: 55, radius: 0.6, mass: 60, speed: 3.6, sense: 18, reach: 1.6,
        attack: { damage: 12, every: 2.2 },
        weak: { impact: 0, fire: 0, water: 0, wind: 0 },                         // only the opposite of what it is now
        shiftEvery: 4, fears: [], fleeAt: 0,
        look: { core: 0xffffff },
    },
};

// The element a wellspawn is now, and what answers it.
export const OPPOSITE = { fire: 'water', water: 'impact', earth: 'wind', air: 'fire' };

// The elite: a bigger, angrier version of a species (the scene sets `elite`).
/** The might (Progression.might(): 0 … ~5) each tier needs. */
export const TIERS = { 1: 0, 2: 0.6, 3: 1.4, 4: 2.4 };
/** The highest tier a hero of this might faces. */
export const tierFor = might => Object.keys(TIERS).map(Number).filter(t => might >= TIERS[t]).reduce((a, b) => Math.max(a, b), 1);
/** A species met a tier early: its young. */
export const YOUNG = { hp: 0.5, damage: 0.4, scale: 0.7, speed: 0.85, count: 0.5 };

export const ELITE = { hp: 2.2, damage: 1.5, scale: 1.3, speed: 1.1 };
