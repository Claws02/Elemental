// ============================================================
// WORLD — how the scenes join: each scene's exits (side, place along it, where to)
// ============================================================
//
// Read by the scene builder (scripts/scenes/lib/region.mjs: the exits and
// their roads) and by the game (the journey marker: Game.js finds the next
// exit toward wherever the story says you're bound).
// ============================================================

export const LINKS = {
    veyra:     [['E', 0, 'gate']],
    gate:      [['W', 0, 'veyra'], ['E', 0, 'verdant']],      // the Oruun Gate: Lesson I on the road
    lesson1:   [],
    verdant:   [['W', 0, 'gate'], ['E', 0, 'halcyra'], ['N', -0.3, 'forge'], ['S', -0.3, 'cistern']],
    cistern:   [['N', 0, 'verdant'], ['S', 0, 'saltmere']],     // the Sunken Cistern: Lesson II on the road south
    forge:     [['S', 0, 'verdant'], ['N', 0, 'emberwall']],    // the Cold Forge: Lesson III on the road north
    emberwall: [['S', -0.4, 'forge'], ['S', 0.4, 'halcyra'], ['E', 0, 'skyreach']],
    skyreach:  [['W', 0, 'emberwall'], ['S', -0.4, 'halcyra'], ['S', 0.4, 'glass']],
    glass:     [['N', 0, 'skyreach'], ['W', -0.4, 'halcyra'], ['W', 0.4, 'saltmere']],
    saltmere:  [['N', -0.3, 'cistern'], ['E', -0.4, 'halcyra'], ['E', 0.4, 'glass']],
    halcyra:   [['W', 0, 'verdant'], ['N', -0.4, 'emberwall'], ['N', 0.4, 'skyreach'], ['E', 0, 'glass'], ['S', 0, 'saltmere']],
};

export const NAMES = { veyra: 'Veyra', gate: 'The Oruun Gate', cistern: 'The Sunken Cistern', forge: 'The Cold Forge', verdant: 'Verdant Reach', emberwall: 'Emberwall Marches', saltmere: 'Saltmere Coast', skyreach: 'Skyreach Heights', glass: 'The Glass Expanse', halcyra: 'Halcyra' };

/** The next scene on the shortest way from `from` to `to` (or null). */
export function nextHop(from, to) {
    if (!LINKS[from] || from === to) return null;
    const prev = { [from]: null }, q = [from];
    while (q.length) {
        const a = q.shift();
        for (const [, , b] of LINKS[a] || []) {
            if (b in prev) continue;
            prev[b] = a;
            if (b === to) { let c = b; while (prev[c] !== from) c = prev[c]; return c; }
            q.push(b);
        }
    }
    return null;
}
