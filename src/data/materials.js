// ============================================================
// MATERIALS — what each element can do to what (docs/CONTEXT_CONTROLS.md)
// ============================================================
//
// The context rule: the MATERIAL says which elements can touch an object, and
// the GESTURE says what the player is doing to it.
//
//   move     press and drag. The element that moves this material acts,
//            instantly, with no delay (Earth on stone).
//   change   press and HOLD STILL for `hold` seconds. The element that
//            transforms this material acts:
//              pull    draw the fire out as a fireball you then hold
//              ignite  set it alight where it stands
//              heat    raise its heat while you keep holding still (stone
//                      never burns; hot stone ignites what it hits)
//
// A `source` material gives, rather than moves: touching a basin starts a
// stream of its water (WaterSystem), and the stream becomes an orb in the
// hand if it is stretched past its reach.
//
// Hold times are per material, on purpose: coals answer Fire almost at once,
// timber takes a moment, stone resists. Tune them here, nowhere else.
//
// `whenBurning` replaces `change` while the object is on fire: anything
// burning is a fire source you can pull from.
//
// Air has no material and moves nothing by hand: it comes from the hero as
// wind and gusts (touch the hero and drag, or flick; AirSystem). Carrying
// loose planks with Air was tried and removed after the phone test: it stole
// the touch from Fire (a broken plank could no longer be set alight).
// ============================================================

export const MATERIALS = {
    stone: {
        name: 'stone',
        move: 'earth',
        change: { element: 'fire', verb: 'heat', hold: 1.5 },
    },
    wood: {
        name: 'wood',
        change: { element: 'fire', verb: 'ignite', hold: 0.6 },
        whenBurning: { element: 'fire', verb: 'pull', hold: 0.25 },
        flammable: { fuel: 8, ignitesAt: 1 },   // seconds of burning; heat 0..1 to catch
        soaks: 20,                               // seconds wet timber resists fire
    },
    hay: {
        name: 'hay',                    // dry: answers Fire almost as fast as coals
        change: { element: 'fire', verb: 'ignite', hold: 0.25 },
        whenBurning: { element: 'fire', verb: 'pull', hold: 0.25 },
        flammable: { fuel: 3.5, ignitesAt: 0.55, flash: 2 },   // flash: goes up at full strength at once, spreads this much faster
        soaks: 20,
    },
    thatch: {
        name: 'thatch',                 // a roof of straw: quicker than timber, slower than loose hay
        change: { element: 'fire', verb: 'ignite', hold: 0.4 },
        whenBurning: { element: 'fire', verb: 'pull', hold: 0.25 },
        flammable: { fuel: 6, ignitesAt: 0.8, reach: 2.6 },   // burning straw carries: down the walls, over the ridge, to the next roof
        soaks: 20,
    },
    door: {
        name: 'door',                   // no element: anyone can open a door, powers or not
        use: 'door',                    // a tap opens or closes it
    },
    barrel: {
        name: 'oil',                    // an oil barrel: burns briefly, then bursts
        change: { element: 'fire', verb: 'ignite', hold: 0.6 },
        whenBurning: { element: 'fire', verb: 'pull', hold: 0.25 },
        flammable: { fuel: 2.5, ignitesAt: 1 },
        explodes: { radius: 3.5, push: 9, wear: 60 },
        soaks: 20,
    },
    coals: {
        name: 'coals',
        change: { element: 'fire', verb: 'pull', hold: 0.25 },
    },
    water: {
        name: 'water',                  // standing water: a basin, later rivers
        move: 'water',                  // touch and it comes: a stream while it stays
        source: 'water',                // connected to this source, an orb once it snaps off
    },
    waterOrb: {
        name: 'water',                  // water carried away from its source
        move: 'water',
    },
    flame: {
        name: 'flame',                  // a fireball in the hand
        move: 'fire',
    },
};

/** The change verb an object answers to right now, or null. */
export function changeVerb(mat, burning) {
    return (burning && mat.whenBurning) || mat.change || null;
}
