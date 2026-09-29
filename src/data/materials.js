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
// Hold times are per material, on purpose: coals answer Fire almost at once,
// timber takes a moment, stone resists. Tune them here, nowhere else.
//
// `whenBurning` replaces `change` while the object is on fire: anything
// burning is a fire source you can pull from.
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
    },
    coals: {
        name: 'coals',
        change: { element: 'fire', verb: 'pull', hold: 0.25 },
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
