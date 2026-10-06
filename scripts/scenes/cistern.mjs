// ============================================================
// Builds scenes/cistern.json: the Sunken Cistern, the road south from the
// Verdant Reach to the Saltmere Coast, where Lesson II (Water) happens on the
// road (docs/STORY.md, Act II). Run from the repo root:
//   node scripts/scenes/cistern.mjs
//
// A valley runs north to south, widening round an Oruun cistern (a sunken
// pool with a ruined rim) and pinching into a throat the Oruun closed with a
// sluice gate, worked by a waterwheel. Bram has caught up with you at the
// border. A travellers' camp by the pool is burning: draw a stream from the
// cistern and put it out; then turn the wheel with a stream to raise the
// sluice, and the road to Saltmere is open. Cael leads.
// ============================================================
import fs from 'fs';
import { Land, Dresser, fbm, ridge, smooth, exits, grow, scene } from './lib/region.mjs';

const SEED = 31, FLOOR = 3;
const POOL = { x: 0, z: 2, w: 14, d: 14 }, LEVEL = FLOOR - 0.6;
const L = new Land(240, 2, SEED);
L.shape((x, z) => {
    const ax = Math.abs(x);
    // How wide the floor is: the valley (13), the cistern's court (21), the throat the sluice closes (3), the valley.
    const court = smooth(-34, -24, z) * (1 - smooth(14, 16, z));
    const throat = smooth(15.5, 17.5, z) * (1 - smooth(23, 27, z));
    const hw = 13 + 8 * court - 10 * throat;
    const cliff = smooth(hw, hw + 4, ax);
    const floor = FLOOR - z * 0.01 + fbm(x, z, 30, SEED) * 0.7 * (1 - court) * (1 - cliff);
    return floor + cliff * (20 + ridge(x, z, 40, SEED) * 12) + smooth(hw + 4, 70, ax) * 22;
});
L.flatten(POOL.x, POOL.z, 22, FLOOR, 0.85);
// The cistern: a square pool sunk into the court.
L.add((x, z, h) => (Math.abs(x - POOL.x) < POOL.w / 2 && Math.abs(z - POOL.z) < POOL.d / 2 ? -(h - (FLOOR - 3.2)) : 0));
const S = new Dresser(L, SEED);
const o = S.objects;

S.add('Cistern_Pool', 'water', POOL.x, POOL.z, 0, { kind: 'water', width: POOL.w, depth: POOL.d, level: LEVEL });
for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.add(`Cistern_Pillar_${sx < 0 ? 'W' : 'E'}${sz < 0 ? 'N' : 'S'}`, 'pillar', POOL.x + sx * (POOL.w / 2 + 1), POOL.z + sz * (POOL.d / 2 + 1), 0, { height: 3.4 + (sx + sz + 2) * 0.3, broken: sx * sz > 0, seed: 70 + sx * 3 + sz }, 2);
for (const sx of [-1, 1]) S.add(`Cistern_Rim_${sx < 0 ? 'W' : 'E'}`, 'ruin_wall', POOL.x + sx * (POOL.w / 2 + 1), POOL.z, Math.PI / 2, { length: POOL.d - 1, height: 0.7, runes: true, seed: 80 + sx }, 2);
L.paint((x, z) => Math.abs(x - POOL.x) < POOL.w / 2 + 3 && Math.abs(z - POOL.z) < POOL.d / 2 + 3 ? 'flagstone' : null);
// The sluice across the throat, and the wheel that works it.
S.add('Sluice_Gate', 'gate', 0, 20, 0, { width: 6.4, height: 4.6, open: false });
S.add('Sluice_Wheel', 'waterwheel', 6, 13, 0, { y: FLOOR + 1.9, radius: 1.8, width: 0.9, turning: false, driven: true, owner: 'none' });
// A travellers' camp by the pool: tents, a cart, hay. Someone left a fire.
S.add('Camp_Tent_1', 'tent', -12, -1, 0.4, { size: 3.2, colour: 'ochre', seed: 3, owner: 'civilian' }, 2);
S.add('Camp_Tent_2', 'tent', -12.5, 6.5, -0.3, { size: 3, colour: 'blue', seed: 4, owner: 'civilian' }, 2);
S.add('Camp_Cart', 'stall', -10, 2.8, 1.3, { width: 2, awning: 'green', seed: 5, owner: 'civilian' }, 1);
for (let i = 0; i < 3; i++) S.add(`Camp_Hay_${i + 1}`, 'hay', -10.5 + i * 1.1, -5.5 - (i % 2) * 0.8, 0, { seed: 90 + i, owner: 'civilian' }, 1);
// Cael and Bram: Bram caught up with you at the border.
S.add('Cael', 'npc', 2.5, -98, 0, { name: 'Cael', look: 'cael', role: 'idle', showWhen: 'act1.ruin, !lesson2' });
S.add('Bram', 'npc', -2.5, -99, 0, { name: 'Bram', look: 'bram', role: 'idle', showWhen: 'act1.ruin' });
S.add('Zone_Cistern', 'trigger', 0, -2, 0, { width: 34, depth: 30, height: 6 });
S.add('Zone_South', 'trigger', 0, 46, 0, { width: 20, depth: 6, height: 6 });
S.add('Spawn', 'spawn', 0, -100, 0, { name: 'start' });

const ends = exits('cistern', L, S, { banner: 'blue', surface: 'dirt' });
const north = ends.find(e => e.to === 'verdant'), south = ends.find(e => e.to === 'saltmere');
L.road([[north.x, north.z], [1, -60], [0, -26]], 4, 'dirt');
L.road([[0, 26], [-1, 70], [south.x, south.z]], 4, 'dirt');
grow(S, 'Vale', 'meadow', { x0: -60, z0: -115, x1: 60, z1: 115 }, { trees: 40, plants: 70, boulders: 25, ok: (x, z, h, sl) => (z < -32 || z > 30) && sl < 0.6 && !L.busy(x, z, 2) });
L.paint((x, z, h, sl, cur) => cur !== 0 ? null : sl > 0.6 ? 'rock' : null);

// ---- the story: Bram; the burning camp; the sluice; on to Saltmere ----
const fire = v => ({ flag: { name: 'veyra.fire', is: v } });
const script = {
    id: 'Cistern', speaker: 'Cael', face: 'Bram', when: 'act1.ruin', flags: {},
    reactions: [
        { on: 'playerFire', count: 'fires', throttle: 16, lines: [['@Cael Water, today. Not that.'], ['@Bram Hey! We’re putting fires OUT.']] },
    ],
    steps: [
        { id: 'bram',
          say: ['@Bram There you are! I’ve been running since Thornwick. Three days!', '@Bram Dad sent me. Well. Dad said “don’t”. So I came.'],
          choices: [
              { label: 'Go home, Bram.', flag: { name: 'bram.joined', value: 'sent' }, say: ['@Bram No.', '@Cael He’s not wrong to come. He’s wrong if he thinks it’ll be safe.', '@Bram I don’t think that. I just think it’ll be worse without me.'] },
              { label: 'Good. Come with us.', flag: { name: 'bram.joined', value: 'welcome' }, say: ['@Bram I brought bread. Mira’s. Don’t tell her I took the good loaf.'] },
              { label: '(Hug him.)', flag: { name: 'bram.joined', value: 'hug' }, say: ['@Bram …Yeah. Me too.'] },
          ] },
        { id: 'news', ends: [
            { when: fire('ruin'), say: ['@Bram They’re rebuilding. Mira says she doesn’t blame you. She says it every morning. Loudly. To everyone.'] },
            { when: fire('some'), say: ['@Bram Two roofs are new thatch. Dad says the forge never looked better.'] },
            { when: { time: 0 }, say: ['@Bram Not a roof lost. Wynn’s telling everyone the stone woke for you. They’re making a song of it. It’s bad.'] } ] },
        { id: 'road', do: [{ npc: { id: 'Cael', role: 'lead', route: '1,-70; 0,-40; -2,-24' } }, { npc: { id: 'Bram', role: 'follow' } }],
          say: ['@Cael South, then. There’s an Oruun cistern on this road. Old water, and a lesson in it.'],
          objective: 'Follow Cael south to the cistern', mark: 'Cael', until: { signal: { obj: 'Zone_Cistern', name: 'inside' } } },
        // Lesson II: Water. First a fire that needs putting out.
        { id: 'smoke', do: [{ checkpoint: true }, { ignite: { prefix: 'Camp_Cart' } }, { setElement: { el: 'water', state: 'trained' } }, { npc: { id: 'Cael', role: 'walk', target: { x: -6, z: -9 } } },
                            { hint: 'Touch the water to draw a stream; drag to aim it. It reaches about eight metres from the pool.' }],
          say: ['@Bram Smoke! The camp, by the pool!', '@Cael Someone left their fire. It’s in the tents now.', '@Cael Water, then. It’s quieter than fire, and it goes where it’s let.',
                '@Cael Touch the pool and draw it out. Aim at the flames, not the cloth that isn’t burning.'],
          objective: 'Put out the fires in the camp', mark: 'Camp_Cart',
          waiting: [{ when: { signal: { obj: 'Cistern_Pool', name: 'drawn' } }, say: ['@Cael That’s it. Now bring it round.'] },
                    { when: { time: 45 }, say: ['@Cael Stand between the pool and the fire. The water won’t reach further than it’s let.'] }],
          ends: [{ when: { all: [{ time: 3 }, { many: { prefix: 'Camp_', signal: 'burning', max: 0 } }] }, next: 'camp' }] },
        { id: 'camp', ends: [
            { when: { many: { prefix: 'Camp_Tent', signal: 'burned', min: 1 } }, say: ['@Cael Some of it’s gone. You saved the rest. That counts.', '@Bram Whoever owns that tent is going to be furious. Not at us. Probably.'], do: [{ setFlag: { name: 'lesson2.camp', value: 'some' } }] },
            { when: { time: 0 }, say: ['@Cael All of it, and nothing drowned that didn’t need to be. Good.', '@Bram That was… that was amazing. You were amazing. Don’t let it go to your head.'],
              do: [{ setFlag: { name: 'lesson2.camp', value: 'saved' } }, { grant: { el: 'water', track: 'control', amount: 0.15 } }] } ] },
        // Then the sluice: the Oruun opened it with water, not hands.
        { id: 'sluice', do: [{ npc: { id: 'Cael', role: 'walk', target: { x: 3, z: 11 } } }],
          say: ['@Cael The road runs on under the sluice. The Oruun opened it with water, not hands.', '@Cael The wheel. Put a stream on it and hold it there.'],
          objective: 'Turn the wheel with a stream of water', mark: 'Sluice_Wheel',
          waiting: [{ when: { time: 40 }, say: ['@Bram Maybe get closer to the wheel? I’m just saying. I don’t know water.'] }],
          until: { signal: { obj: 'Sluice_Wheel', name: 'spun' } },
          then: { do: [{ do: { obj: 'Sluice_Gate', action: 'open' } }, { grant: { el: 'water', track: 'control', amount: 0.15 } }],
                  say: ['@Bram It’s going up! The whole thing’s going up!', '@Cael Water doesn’t push. It persuades. Remember that.'] } },
        { id: 'onward', do: [{ setFlag: { name: 'lesson2', value: 'done' } }, { checkpoint: true }, { npc: { id: 'Cael', role: 'lead', route: '0,14; 0,24; -1,40; -1,52' } }],
          say: ['@Cael Saltmere’s past the throat. The sea, and a town that lives with it.'],
          objective: 'Follow Cael south to Saltmere', mark: 'Cael', until: { signal: { obj: 'Zone_South', name: 'inside' } } },
    ],
    card: null,
};
script.talk = {
    Bram: [
        { when: { flag: { name: 'lesson2' } }, say: [['The sea! I’ve never seen the sea. Have you? You haven’t. Ha.'], ['Cael doesn’t eat. Have you noticed? I’ve been watching.']] },
        { say: [['Mira sent bread. I ate some. Most. The bread is a story now.'], ['Dad says hello. He didn’t. But he would have.'], ['You’re different. Not bad different. Taller, somehow.']] },
    ],
    Cael: [
        { when: { flag: { name: 'lesson2' } }, say: [['Water remembers the shape of everything it touched. Be careful what you teach it.']] },
        { say: [['Your friend talks a great deal.'], ['I like him. Don’t tell him.']] },
    ],
};

const out = { ...scene('cistern', 'The Sunken Cistern', L, S, { region: 'saltmere', mood: 'day', far: 150 }), script };
fs.writeFileSync('scenes/cistern.json', JSON.stringify(out, null, 1) + '\n');
console.log(`cistern: ${o.length} objects`);
