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
// ============================================================

export const SPECIES = {
    emberwing: {
        name: 'Emberwing', behaviour: 'flyer',
        hp: 20, radius: 0.32, mass: 2, speed: 7, sense: 26, reach: 1.4,
        cruise: [5, 7.5],                     // flight height, metres
        attack: { damage: 8, every: 3.5, ember: true },   // dives, drops a burning ember on what's below
        weak: { impact: 3, fire: 0, water: 2, wind: 1 },
        fears: ['water'], soakedFalls: true, fleeAt: 0.5,
        look: { body: 0x7a2a1a, wing: 0x9a3a1e, glow: 0xff7a2a },
    },
    bristleback: {
        name: 'Bristleback', behaviour: 'charge',
        hp: 90, radius: 0.75, mass: 160, speed: 3, sense: 16, reach: 1.7,
        charge: { windup: 0.9, speed: 12, time: 1.6, stun: 2.5 },
        attack: { damage: 28, knock: 11 },
        weak: { impact: 1, fire: 1, water: 0.3, wind: 0.2, stunned: 2.5 },
        fears: [], fleeAt: 0.25,
        look: { body: 0x5a4030, bristle: 0x3a2a1e, tusk: 0xe8dcc0 },
    },
    thornhound: {
        name: 'Thornhound', behaviour: 'pack',
        hp: 35, radius: 0.45, mass: 45, speed: 6.5, sense: 20, reach: 1.3,
        circle: 4.5,                          // metres they hold off at before darting in
        attack: { damage: 12, every: 2.2, lunge: 9 },
        weak: { impact: 1.5, fire: 2, water: 0.5, wind: 0.6 },
        fears: ['fire'], fleeAlone: true, fleeAt: 0.35,
        look: { body: 0x4a5040, thorn: 0x2e3326, eye: 0xd8e05a },
    },
};

// The elite: a bigger, angrier version of a species (the scene sets `elite`).
export const ELITE = { hp: 2.2, damage: 1.5, scale: 1.3, speed: 1.1 };
