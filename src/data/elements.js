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
