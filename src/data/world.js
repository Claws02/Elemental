// ============================================================
// WORLD — how the scenes join: each scene's exits (side, place along it, where to)
// ============================================================
//
// Read by the scene builder (scripts/scenes/lib/region.mjs: the exits and
// their roads) and by the game (the journey marker: Game.js finds the next
// exit toward wherever the story says you're bound).
// ============================================================

import { whenHolds } from '../scene/when.js';

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

// Roads closed until the story reaches them, each with a reason the player can see: who stands in the road
// and what they say. `open` is a showWhen expression (scene/when.js) on story flags. Only the way out is
// closed; the way back is always open. The scene builder puts the speaker in the road (`look`, none for a
// thing like a door); the exit turns the hero back while it's shut.
export const ROADS = {
    'verdant>cistern':  { open: 'act1.ruin', who: 'Warden\'s man', look: 'verdant_guard',
                          say: ['Lord-Warden\'s orders: nobody south till the trouble at the Watchstone is settled.'] },
    'verdant>forge':    { open: 'act2.saltmere', who: 'Warden\'s man', look: 'verdant_guard',
                          say: ['Nothing up the north pass but an Oruun door, shut since before the Empire. Nobody\'s opened it in my lifetime.'] },
    'verdant>halcyra':  { open: 'act3', who: 'Lantern warden', look: 'lantern',
                          say: ['Road to Halcyra is closed to Wielders without registry papers. Lantern Office orders.'] },
    'forge>emberwall':  { open: 'lesson3', who: 'The Oruun door',
                          say: ['Shut fast. It answers the forge, not your hands.'] },
    'emberwall>halcyra': { open: 'act3', who: 'Lantern warden', look: 'lantern',
                          say: ['Papers, Wielder. No? Then the capital can wait.'] },
    'emberwall>skyreach': { open: 'act2.cindrel', who: 'Ember Guard', look: 'ember_guard',
                          say: ['Switchback\'s down. Rockfall. The Guard holds it until the Forge-Queen says otherwise.'] },
    'saltmere>halcyra': { open: 'act3', who: 'Lantern warden', look: 'lantern',
                          say: ['Registry papers. Every Wielder on the capital road carries them now.'] },
    'saltmere>glass':   { open: 'act3', who: 'Caravan master', look: 'glass_folk',
                          say: ['No riders out till the wells settle. Ask again when the Matriarch sends word.'] },
    'skyreach>halcyra': { open: 'act3', who: 'Lantern warden', look: 'lantern',
                          say: ['The Lantern Office keeps this road. Papers, or turn round.'] },
    'skyreach>glass':   { open: 'act3', who: 'Caravan master', look: 'glass_folk',
                          say: ['The desert road\'s closed. The wells are failing, and Sarn turns strangers back.'] },
};

/** Whether the road from `from` to `to` is open, given `flag(name)` (a story flag's value). */
export function roadOpen(from, to, flag = () => undefined) {
    const r = ROADS[`${from}>${to}`];
    return !r || whenHolds(r.open, { flag });
}

/** The next scene on the shortest way from `from` to `to` (or null), by roads open under `flag` (all, without it). */
export function nextHop(from, to, flag = null) {
    if (!LINKS[from] || from === to) return null;
    const prev = { [from]: null }, q = [from];
    while (q.length) {
        const a = q.shift();
        for (const [, , b] of LINKS[a] || []) {
            if (b in prev || (flag && !roadOpen(a, b, flag))) continue;
            prev[b] = a;
            if (b === to) { let c = b; while (prev[c] !== from) c = prev[c]; return c; }
            q.push(b);
        }
    }
    return null;
}
