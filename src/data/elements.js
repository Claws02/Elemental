// ============================================================
// ELEMENTS — every element's tuning, as data
// ============================================================
//
// Forces, ranges, rates and timings for Earth, Fire, Water, Air and the
// hands that hold them (HOLD). The systems in src/elements/ read these and
// hold no numbers of their own, so tuning never touches code. Power and
// Control scale some of these at run time (data/growth.js).
// ============================================================

export const EARTH = {
    range: 14,           // how far the hero can sense and grab
    // How heavy a stone Earth lifts is Earth's Power (data/growth.js).
    // Raising stone from the ground (elements/Earthworks.js).
    raise: {
        hold: 0.8,             // seconds of stillness on open ground before it rises
        reach: 9,              // metres from the hero
        size: 1.4,             // the column's width
        minHeight: 0.7,        // how far it comes up at once
        maxHeight: [1.6, 3.2], // how far it can be raised, at Earth Power 0 … 1
        speed: 1.8,            // m/s rising: slow enough to ride
        sinkSpeed: 0.8,
        last: 25,              // seconds before it sinks back
        most: 3,               // columns standing at once
    },
};

// Ice: Water + Air (elements/Ice.js).
export const ICE = {
    radius: 1.8,        // around where the stream was landing: creatures freeze, fires go out
    frozen: 5,          // seconds a creature stays locked in ice
    shatter: 2.5,       // a hard hit on a frozen creature does this much more
    last: 20,           // seconds an ice arch stands
    fireMelt: 1.6,      // a fire this close melts it…
    fireRate: 6,        // …this many times faster
    breakSpeed: 6,      // a thing hitting it this fast…
    breakMass: 8,       // …and this heavy breaks a segment (a thrown rock, a charging boar)
    most: 3,            // arches standing at once
    floe: 1.7,          // radius of the floe a stream frozen on open water leaves
};

// Lava: Earth + Fire (elements/Lava.js).
export const LAVA = {
    molten: 1.8,        // a held stone's heat goes past 1 up to this with lava learned; past 1 it is molten
    splashSpeed: 5,     // a molten stone hitting something this fast bursts
    radius: 2.2,        // the pool
    last: 10,           // seconds before it crusts over
    burn: 30,           // fire damage per second to a creature in it
    playerBurn: 25,     // per second to the hero standing in it
    wear: 0.8,          // timber worn per second
    quench: 5,          // a stream on it cools it this many times faster
    scorches: 12,       // crusted pools kept on the ground
};

// Firestorm: Fire + Air (elements/Firestorm.js).
export const FIRESTORM = {
    reach: 10,          // metres the cone of flame carries
    angle: 0.42,        // half-angle of the cone, radians (~24°)
    burn: 35,           // fire damage to a creature at the root of the cone
    push: 9,            // m/s given to loose things (less for heavy ones)
    excessAt: 4,        // lighting this many things at once is excess
};

// Mud: Earth + Water (elements/Mud.js).
export const MUD = {
    radius: 2.4,
    slow: 0.35,         // speed in the mud, as a share of normal
    last: 25,           // seconds before it dries
    most: 4,            // patches at once
};

// Glide: Air under the hero; thermals over fire (elements/Glide.js).
export const GLIDE = {
    trigger: 1.5,       // falling faster than this (m/s) off anything high starts a glide
    minHeight: 0.6,     // …if the hero's feet are this far off the ground
    fall: 1.6,          // the most a glide sinks, m/s
    speed: 1.35,        // how much faster than walking/running a glide moves
    thermalRadius: 2.2, // a fire this close across…
    thermalHeight: 9,   // …and this far below lifts the glide
    lift: 9,            // m/s² of rising heat
    rise: 3.5,          // the fastest a thermal carries you up
};

// The flame jet: Fire from the hands to what is touched (elements/FlameJet.js).
export const FLAME = {
    range: 12,          // metres from the hands
    dps: 40,            // fire damage per second to a creature in the jet
    spray: 1.8,         // wild: things this close to where it lands can catch…
    sprayEvery: 0.6,    // …checked this often
    particles: 90,      // per second
    speed: 16,          // m/s the flame travels
    pickPx: 70,         // how close on screen a touch must be to a creature to aim at it
};

export const FIRE = {
    spreadRadius: 1.5,      // metres, centre to centre
    startIntensity: 0.25,   // a new fire spreads at a quarter strength…
    buildUp: 5,             // …and reaches full strength over this many seconds
    spreadRate: 0.6,        // heat/s given to a neighbour at distance 0 (≈5 s to catch the next panel along, ≈3 s above)
    climb: 1.6,             // multiplier for neighbours above the fire
    cool: 0.15,             // heat/s lost by an unheated flammable
    rockHeat: 0.45,         // heat/s a rock gains while held still in Fire
    rockCool: 0.04,         // heat/s a hot rock loses
    hotIgnites: 0.5,        // a rock this hot sets wood alight on contact
    fireballLife: 4,        // seconds after it leaves the hand
    droppedLife: 1.5,       // seconds after a slow release
    fireballRadius: 0.34,
    douseTime: 0.8,         // seconds of steady water a burning plank takes to go out
    youngAge: 2.5,          // a fire younger than this can be blown out by wind…
    blowTime: 0.35,         // …after this much of it; an older one is fanned instead
    fanFor: 3,              // seconds a gust of wind keeps a fire flaring
    originGrace: 1.5,       // seconds a new fireball ignores the thing it was pulled from
};

export const WATER = {
    reach: 8,             // metres from the source the stream can stretch
    range: 16,            // hero this far from the source: the stream lets go
    spray: 1.1,           // radius of the stream's spray, metres
    push: 30,             // m/s² given to light things in the spray (heavier move less)
    wear: 12,             // damage/s to timber held in the spray (~8 s to break a plank)
    splash: 2.0,          // radius of an orb's burst
    splashPush: 6,        // m/s given to things in a burst
    splashWear: 35,       // damage to timber at the centre of a burst
    orbRadius: 0.32,
    orbLife: 4,           // seconds a thrown orb flies before it falls apart
};

export const AIR = {
    touchPx: 60,          // minimum radius of the hero as a touch target
    windLen: 7,           // metres the steady wind reaches
    windAngle: 0.45,      // half-angle of the cone, radians (~26°)
    windPush: 8,          // m/s² on light things in the wind (heavier move less)
    gustLen: 9,
    gustAngle: 0.6,
    gustPush: 6,          // m/s given at once by a gust
    gustWear: 12,         // damage to timber at the gust's heart: only finishes off nearly-broken planks
};

export const HOLD = {
    range: 14,           // how far from the hero a held thing may drift before it is let go
    reach: 8,            // how far from the hands the hold target may be
    holdSpeed: 18,       // m/s cap while following the finger
    throwMin: 15, throwMax: 36,
    gravity: 22,         // Physics' gravity, cancelled while held
};
