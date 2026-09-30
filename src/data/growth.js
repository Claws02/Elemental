// ============================================================
// GROWTH — what Power and Control mean for each element, as numbers
// ============================================================
//
// Two tracks per element, both 0 … 1 (agreed design, docs/PROGRESSION.md):
//
//   POWER     grows with use, cheaply, and most with destruction:
//             how heavy, how far, how hard
//   CONTROL   grows only through training and restraint:
//             how steady, how gentle, how precise
//
// High Power with low Control is how accidents happen. Every number that
// Power or Control changes lives here, so tuning never touches the systems.
// ============================================================

export const GROWTH = {
    earth: {
        maxMass:  p => 4 + 21 * p,          // kg-ish: 4 lifts only the smallest stones; 25 lifts every rock in the room
        throwMax: p => 24 + 12 * p,         // m/s at the fastest flick
        wobble:   c => 0.12 * (1 - c),      // metres a held stone sways about the finger (was 0.4: annoying, not tense)
        slam:     c => 7 * (1 - c),         // m/s a slow release is driven into the ground
    },
};

// What a gain is worth. Use is cheap; restraint is what Cael teaches.
export const GAINS = {
    earthThrow:      { el: 'earth', track: 'power', amount: 0.01 },
    earthBreak:      { el: 'earth', track: 'power', amount: 0.02 },   // per piece the player breaks
    fireWildIgnite:  { el: 'fire',  track: 'power', amount: 0.03 },   // wild Fire grows Power, never Control
};

// Wild (untrained) elements. Only Fire can be wild for now.
export const WILD = {
    fire: {
        holdFactor: 0.5,       // catches in half the time: a pause becomes a fire
        sparks: [1, 2],        // extra flammables within `sparkRadius` that catch with whatever you light
        sparkRadius: 3,
        burstAfter: [3, 5],    // seconds a wild fireball lasts in the hand before it bursts
        burstRadius: 1.8,      // what a burst (in the hand or on impact) sets alight
    },
};

// Wild surges: without the charm, an untrained element goes off on its own
// around you (src/elements/Surges.js). Stress makes it come sooner.
export const SURGE = {
    every: [40, 90],        // seconds between surges, calm
    stress: { creatures: 1.0, fire: 0.5, hurt: 0.5 },   // added to the clock's speed: 1 + these
    creatureRange: 14,      // an engaged creature this close is stress
    fireRange: 6,           // a fire this close is stress
    radius: 4.5,            // what a surge reaches
    people: 3,              // people this close are hurt by it
    ignites: 3,             // a fire surge lights at most this many things
    playerHurt: 6,          // a fire surge singes you too
};

// Where a new story starts, and the sandbox.
export const PROFILES = {
    story: {
        earth: { state: 'trained', power: 0, control: 0 },
        fire:  { state: 'wild',    power: 0.15, control: 0 },
        water: { state: 'locked',  power: 0, control: 0 },
        air:   { state: 'locked',  power: 0, control: 0 },
    },
    sandbox: {
        earth: { state: 'trained', power: 1, control: 1 },
        fire:  { state: 'trained', power: 1, control: 1 },
        water: { state: 'trained', power: 1, control: 1 },
        air:   { state: 'trained', power: 1, control: 1 },
    },
};
