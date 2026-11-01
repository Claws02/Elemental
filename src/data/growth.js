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

// Each entry: [the track it follows, a curve from that track (0 … 1) to the number]. At 0 every number is the
// tuning in data/elements.js as it was before levels meant anything, so a level only ever makes you stronger
// (Power) or surer (Control). The level-up card (ui/Hud.js) says what each track's next level does: WHAT.
const P = 'power', C = 'control';
export const GROWTH = {
    earth: {
        maxMass:  [P, p => 4 + 21 * p],          // kg-ish: 4 lifts only the smallest stones; 25 lifts every rock in the room
        throwMax: [P, p => 24 + 12 * p],         // m/s at the fastest flick
        wobble:   [C, c => 0.12 * (1 - c)],      // metres a held stone sways about the finger (was 0.4: annoying, not tense)
        slam:     [C, c => 7 * (1 - c)],         // m/s a slow release is driven into the ground
    },
    fire: {
        ballRadius: [P, p => 0.34 * (1 + 0.6 * p)],    // a fireball's size, and the heat it carries
        ballHit:    [P, p => 22 * (1 + 1.5 * p)],      // damage when it strikes a creature (FireSystem)
        jetRange:   [P, p => 12 + 8 * p],              // metres the flame jet reaches (FLAME.range)
        jetDps:     [P, p => 40 * (1 + 1.25 * p)],     // its fire damage per second (FLAME.dps)
        ballLife:   [C, c => 4 + 3 * c],               // seconds a thrown fireball holds together: how far it carries (FIRE.fireballLife)
        rockHeat:   [C, c => 0.45 * (1 + c)],          // heat/s a stone gains held still in Fire (FIRE.rockHeat)
    },
    water: {
        reach:      [P, p => 8 + 8 * p],               // metres the stream stretches from its source (WATER.reach)
        draw:       [P, p => 12 + 6 * p],              // how far from you a stream can rise (WATER.draw)
        push:       [P, p => 30 * (1 + p)],            // shove on things in the spray (WATER.push)
        hit:        [P, p => 4 * (1 + 1.5 * p)],       // what the spray does to a creature
        splash:     [P, p => 2 * (1 + 0.5 * p)],       // an orb's burst (WATER.splash)
        douseTime:  [C, c => 0.8 * (1 - 0.5 * c)],     // seconds of steady water a burning plank takes (FIRE.douseTime)
    },
    air: {
        windLen:    [P, p => 7 + 5 * p],               // metres the steady wind reaches (AIR.windLen)
        gustLen:    [P, p => 9 + 6 * p],               // (AIR.gustLen)
        windPush:   [P, p => 8 * (1 + 0.75 * p)],      // (AIR.windPush)
        gustPush:   [P, p => 6 * (1 + p)],             // (AIR.gustPush)
        gustAngle:  [C, c => 0.6 * (1 - 0.4 * c)],     // half-angle of a gust's cone: a surer gust hits what you aim at, and spares what's beside it
        windAngle:  [C, c => 0.45 * (1 - 0.4 * c)],    // the steady wind's (AIR.windAngle)
        glideFall:  [C, c => 1.6 * (1 - 0.4 * c)],     // m/s a glide sinks: Control carries you further (GLIDE.fall)
    },
};

// What each track's next level does, in plain words, for the level-up card.
export const WHAT = {
    earth: { power: 'Heavier stones answer you, and you throw harder.', control: 'A held stone sways less and sets down softer.' },
    fire:  { power: 'Bigger fireballs that hit harder; the jet burns hotter and reaches further.', control: 'Your fireballs hold together further, and a stone heats faster in your grip.' },
    water: { power: 'The stream reaches further, shoves harder and hits harder.', control: 'Fires go out sooner under your stream.' },
    air:   { power: 'Wind and gusts reach further and push harder.', control: 'Your wind hits what you aim at and spares what\'s beside it, and a glide carries you further.' },
};

// What a gain is worth. Use is cheap; restraint is what Cael teaches.
export const GAINS = {
    earthThrow:      { el: 'earth', track: 'power', amount: 0.01 },
    earthBreak:      { el: 'earth', track: 'power', amount: 0.02 },   // per piece the player breaks
    fireWildIgnite:  { el: 'fire',  track: 'power', amount: 0.03 },   // wild Fire grows Power, never Control
    // Use grows Power for every element; a fight grows it most (Progression._listen).
    fireThrow:       { el: 'fire',  track: 'power', amount: 0.01 },   // a fireball thrown
    waterDouse:      { el: 'water', track: 'power', amount: 0.01 },   // a fire put out with water
    waterThrow:      { el: 'water', track: 'power', amount: 0.01 },   // an orb thrown
    airGust:         { el: 'air',   track: 'power', amount: 0.006 },  // a gust
    hit:             { track: 'power', amount: 0.002 },               // per 10 damage dealt to a creature, to that element
    kill:            { track: 'power', amount: 0.015 },               // a creature killed, to the element that did it: a level is ~4–5 kills
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

// Abilities beyond an element's basics, and combinations of two. Each needs its
// elements usable (not locked, not stilled by the charm) and, in the story, to
// have been learned: the story sets flag `learned.<ability>` (the sandbox knows
// them all). docs/ABILITIES.md.
// `control`: the Control level of the first element it needs before it answers at all, learned or not
// (docs/GROWTH_AND_COMBAT.md §2.2): Power alone never unlocks a technique.
export const ABILITIES = {
    pull:      { name: 'Pull stone',  needs: ['earth'], control: 3 },
    raise:     { name: 'Raise stone', needs: ['earth'], control: 4 },
    catch:     { name: 'Catch stone', needs: ['earth'], control: 5 },
    freeze:    { name: 'Ice',         needs: ['water', 'air'] },
    lava:      { name: 'Lava',        needs: ['earth', 'fire'] },
    firestorm: { name: 'Firestorm',   needs: ['fire', 'air'] },
    mud:       { name: 'Mud',         needs: ['earth', 'water'] },
    glide:     { name: 'Glide',       needs: ['air'] },
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
