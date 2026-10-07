// ============================================================
// Builds scenes/saltmere.json: the Saltmere Coast (world bible).
// Tidal flats, islands, stilt-towns joined by rope bridges; Lanthe, the
// city of bridges; the council house; the Drowned Choir (a city rising out
// of the sea). Brinecoils in the shallows, Gale-kites over the islands.
// Lowtown: a quarter below the sea behind an Oruun sea wall; the wall's
// stone split, the wall opened, and the spring tide comes tonight (the story).
//   node scripts/scenes/saltmere.mjs
// ============================================================
import fs from 'fs';
import { Land, Dresser, fbm, smooth, exits, grow, people, scene, dock, span } from './lib/region.mjs';

const SEED = 44;
const L = new Land(240, 2, SEED);
const SEA = 1.0;                                  // the water level
// Land in the north falling to tidal flats; the sea in the south; islands in the bay.
const ISLANDS = [{ x: -10, z: 30, r: 16 }, { x: 28, z: 44, r: 12 }, { x: -42, z: 52, r: 11 }, { x: 8, z: 72, r: 10 }];
const CHOIR = { x: 60, z: 85 };
L.shape((x, z) => {
    const coast = 7 - smooth(-60, 40, z) * 9 + fbm(x, z, 60, SEED) * 2;     // ~7 m inland, ~-2 m out at sea
    let h = coast;
    for (const I of ISLANDS) h = Math.max(h, 3.2 - (Math.hypot(x - I.x, z - I.z) / I.r) ** 2 * 3 + fbm(x, z, 12, SEED + 3) * 0.3);
    return h;
});
// Lowtown: a floor below the spring tide, ringed by a berm with the Oruun wall on it,
// and a gap where the wall opened (GAP), open to the sea.
const LOW = { x0: -80, x1: -36, z0: -8, z1: 12 }, FLOOR = 1.25, BERM = 3.2, BAND = 4, GAP = { x0: -61.5, x1: -54.5 }, TIDE = 2.0;
const lowDist = (x, z) => Math.hypot(Math.max(LOW.x0 - x, 0, x - LOW.x1), Math.max(LOW.z0 - z, 0, z - LOW.z1));
L.add((x, z, h) => {
    const d = lowDist(x, z), gap = z > LOW.z1 && x > GAP.x0 && x < GAP.x1;
    if (d === 0) return FLOOR - h;
    const top = gap ? FLOOR : BERM;
    if (d <= 1.5) { const k = d / 1.5; return FLOOR + (top - FLOOR) * k * k * (3 - 2 * k) - h; }
    if (d <= BAND) return top - h;
    if (d <= BAND + 6) { const k = (d - BAND) / 6, e = k * k * (3 - 2 * k); return top * (1 - e) + h * e - h; }
    return 0;
});
const S = new Dresser(L, SEED);
// The sea in three sheets round Lowtown (the wall keeps it out); Lowtown's own water lies under its floor till the tide comes in.
S.add('Sea', 'water', 48, 60, 0, { kind: 'water', width: 164, depth: 140, level: SEA, colour: 0x2a6a90 });
S.add('Sea_West', 'water', -107, 60, 0, { kind: 'water', width: 46, depth: 140, level: SEA, colour: 0x2a6a90 });
S.add('Sea_Wall', 'water', -59, 72, 0, { kind: 'water', width: 50, depth: 116, level: SEA, colour: 0x2a6a90 });
S.add('Lowtown_Flood', 'water', -58, 3, 0, { kind: 'water', width: 44, depth: 22, level: FLOOR - 0.8, colour: 0x2a6a90 });
// The wall: on the berm, south, west and east; open in the gap.
for (const [x, len] of [[-76.5, 11], [-66, 9], [-49.5, 9], [-39.5, 9]]) S.add(`Seawall_S_${x < -58 ? 'W' : 'E'}${Math.abs(x) | 0}`, 'ruin_wall', x, LOW.z1 + 2, 0, { length: len, height: 1.4, runes: true, seed: Math.abs(x) | 0 }, 2);
for (const [x, side] of [[LOW.x0 - 2, 'W'], [LOW.x1 + 2, 'E']]) for (const z of [-3, 8]) S.add(`Seawall_${side}_${z < 0 ? 'N' : 'S'}`, 'ruin_wall', x, z, Math.PI / 2, { length: 11, height: 1.4, runes: true, seed: Math.abs(z + x) | 0 }, 2);
// The breach: three Oruun sockets in the gap; set a stone on each and the wall closes itself (Breach_Seal rises).
for (let i = 0; i < 3; i++) S.add(`Breach_Socket_${i + 1}`, 'plate', -60 + i * 2, LOW.z1 + 0.4, 0, { radius: 0.75, height: 1.1 }, 1);
S.add('Breach_Seal', 'ruin_wall', -58, LOW.z1 + 2, 0, { length: 7.4, height: 1.6, runes: true, seed: 21, hidden: true });
S.add('Tidestone', 'standing_stone', -63.5, LOW.z1 + 0.8, 0.2, { height: 3.2, cracked: true, chiselled: true, seed: 17 }, 2);
[[-63, 7, 0.45], [-60, 4.5, 0.44], [-55.5, 6, 0.46], [-52.5, 8.5, 0.44], [-58, 2.5, 0.45]].forEach(([x, z, r], i) => S.add(`Breach_Stone_${i + 1}`, 'rock', x, z, i, { radius: r, seed: 600 + i * 5 }));
// Lowtown's houses, on the floor (not stilts: the wall was their stilts).
[[-74, -3, 0.2], [-68, 4, -0.3], [-47, -2, 0.1], [-43, 5, 0.4]].forEach(([x, z, r], i) => S.add(`Lowtown_House_${i + 1}`, 'timber_house', x, z, r, { kind: 'house', cols: 4, depth: 3, rows: 2, seed: 40 + i, owner: 'civilian' }, 5));
people(S, { id: 'Lowtown', x: -58, z: -2, folk: 'salt_folk', guard: 'salt_guard', n: 3, r: 5 });
// The story's people: the Tide-Regent at her wall, the Tidekeepers at the gap, Cael and Bram on the road down.
S.add('Oriel_Wall', 'npc', -51, 7, Math.PI, { name: 'Tide-Regent Oriel Sand', look: 'oriel', role: 'idle', showWhen: 'lesson2, !saltmere.wall' });
S.add('Nerys', 'npc', -54, 9.5, Math.PI, { name: 'Nerys, Tidekeeper', look: 'tidekeeper', role: 'idle', showWhen: 'lesson2' });
S.add('Tidekeeper_1', 'npc', -63, 9.5, Math.PI, { name: 'Tidekeeper', look: 'tidekeeper', role: 'idle', showWhen: 'lesson2' });
S.add('Cael', 'npc', -24, -98, Math.PI, { name: 'Cael', look: 'cael', role: 'idle', showWhen: 'lesson2' });
S.add('Bram', 'npc', -29, -99, Math.PI, { name: 'Bram', look: 'bram', role: 'idle', showWhen: 'lesson2' });
S.add('Zone_Lowtown', 'trigger', -58, 1, 0, { width: 40, depth: 20, height: 8 });
// Lanthe: stilt houses on the islands and the flats, the council house on the big island.
const houses = [];
L.flatten(ISLANDS[0].x, ISLANDS[0].z, 10, 3, 0.7);
S.add('Lanthe_Council', 'prefab', ISLANDS[0].x, ISLANDS[0].z, Math.PI, { prefab: 'lanthe_council', style: 'prefab', seed: 3 }, 9);
const spots = [[-28, 8], [-8, 6], [14, 10], [30, 22], [38, 40], [20, 56], [-30, 40], [-50, 40], [-52, 62], [-24, 66], [6, 86], [22, 74]];
spots.forEach(([x, z], i) => { S.add(`Lanthe_House_${i + 1}`, 'prefab', x, z, Math.atan2(ISLANDS[0].x - x, ISLANDS[0].z - z), { prefab: 'lanthe_stilthouse', style: 'prefab', seed: i + 5 }, 6); houses.push([x, z]); });
for (const [i, [x, z]] of [[-100, 24], [50, 18], [-20, 92], [40, 64]].entries()) dock(L, S, `Lanthe_Dock_${i + 1}`, x, z - 14, 0, 1, SEA, 10);
for (let i = 0; i < 6; i++) S.add(`Lanthe_Lamp_${i + 1}`, 'lamp', ISLANDS[0].x + Math.cos(i) * 9, ISLANDS[0].z + Math.sin(i) * 9, 0, { height: 3 }, 1);
// The Tide-Regent at the council; folk on the island; guards at the shore walk.
S.add('Oriel', 'npc', ISLANDS[0].x, ISLANDS[0].z - 7, Math.PI, { name: 'Tide-Regent Oriel Sand', look: 'oriel', role: 'idle', showWhen: '!saltmere.away' });
people(S, { id: 'Lanthe', x: ISLANDS[0].x, z: ISLANDS[0].z - 2, folk: 'salt_folk', guard: 'salt_guard', n: 5, r: 7, guards: [[ISLANDS[0].x - 3, ISLANDS[0].z - 22, Math.PI], [ISLANDS[0].x + 3, ISLANDS[0].z - 22, Math.PI]] });
S.add('Start', 'spawn', ISLANDS[0].x, ISLANDS[0].z - 34, 0, { name: 'start' }, 2);
// Roads on the land in the north; exits.
const ends = exits('saltmere', L, S, { banner: 'blue', surface: 'sand' });
for (const e of ends) L.road([[e.x, e.z], [ISLANDS[0].x, ISLANDS[0].z - 34]], 4.5, 'sand');
// Rope bridges between the islands and planks over the flats, placed after the roads so each end sits on its bank.
const rope = { width: 2.2, rise: 0.4, style: 'rope' }, plank = { width: 2.2, rise: 0.3, style: 'plank' };
span(L, S, 'Bridge_Council_East', [ISLANDS[0].x + 12, ISLANDS[0].z + 4], [ISLANDS[1].x - 9, ISLANDS[1].z - 3], rope);
span(L, S, 'Bridge_Council_West', [ISLANDS[0].x - 12, ISLANDS[0].z + 6], [ISLANDS[2].x + 8, ISLANDS[2].z - 2], rope);
span(L, S, 'Bridge_Council_South', [ISLANDS[0].x + 3, ISLANDS[0].z + 13], [ISLANDS[3].x - 2, ISLANDS[3].z - 8], rope);
span(L, S, 'Walk_Shore', [ISLANDS[0].x, ISLANDS[0].z - 13], [ISLANDS[0].x, ISLANDS[0].z - 30], plank);
// The Drowned Choir: a city rising out of the sea, its pillars and a great statue standing in the water.
for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; S.add(`Choir_Pillar_${i + 1}`, 'pillar', CHOIR.x + Math.cos(a) * 11, CHOIR.z + Math.sin(a) * 9, 0, { height: 4 + (i % 3) * 2, broken: i % 3 === 1, seed: i, y: 0 }, 2); }
S.add('Choir_Statue', 'statue', CHOIR.x, CHOIR.z, Math.PI, { height: 10, style: 'whitestone', seed: 8 }, 4);
S.add('Choir_Arch', 'archway', CHOIR.x - 14, CHOIR.z - 6, 0.6, { width: 5, height: 6 }, 3);
// Creatures: brinecoils in the bay, kites over the islands.
S.add('Bay_Brinecoils', 'creature', 30, 95, 0, { species: 'brinecoil', count: 2, spread: 10, aggressive: true });
S.add('Choir_Brinecoil', 'creature', CHOIR.x + 6, CHOIR.z - 8, 0, { species: 'brinecoil', count: 1, spread: 2, aggressive: true });
S.add('Isle_Kites', 'creature', -40, 60, 0, { species: 'galekite', count: 2, spread: 8, aggressive: true });
// Growth: coastal on the land and islands.
grow(S, 'Coast', 'coast', { x0: -115, z0: -115, x1: 115, z1: 20 }, { trees: 40, plants: 80, boulders: 14, ok: (x, z, h) => h > SEA + 0.6 && !L.busy(x, z, 2) && lowDist(x, z) > BAND + 3 });
grow(S, 'Isle', 'coast', { x0: -60, z0: 15, x1: 50, z1: 90 }, { trees: 18, plants: 40, boulders: 4, ok: (x, z, h) => h > SEA + 0.8 && !houses.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < 5) });
for (let i = 0; i < 8; i++) S.add(`Sea_Stack_${i + 1}`, 'boulder', -100 + i * 26, 100 + (i % 2) * 8, i, { kind: 'seastack', size: 2.5 + (i % 3), seed: i }, 4);
L.paint((x, z, h, s, cur) => {
    if (cur !== 0) return null;
    const d = lowDist(x, z);
    if (d === 0) return z > LOW.z1 - 6 ? 'mud' : null;
    if (d <= BAND) return 'flagstone';
    if (h < SEA + 0.4) return 'mud';
    if (h < SEA + 1.6) return 'sand';
    if (s > 0.55) return 'rock';
    return z > -20 && fbm(x, z, 20, 4) > 0.2 ? 'sand' : null;
});

// ---- the story: the sea wall at spring tide (Act II) ----
const sockets = n => ({ many: { prefix: 'Breach_Socket_', type: 'plate', signal: 'weighted', min: n } });
const wall = v => ({ flag: { name: 'saltmere.wall', is: v } });
const script = {
    id: 'Saltmere', speaker: 'Cael', face: 'Oriel_Wall', when: 'lesson2, !act2.saltmere', flags: {},
    reactions: [
        { on: 'playerFire', count: 'fires', throttle: 16, lines: [['@Nerys Not fire. Not here. Not ever, here.'], ['@Cael Wrong element. Very wrong.']] },
    ],
    steps: [
        { id: 'shore', do: [{ setFlag: { name: 'saltmere.away', value: 'yes' } }, { hide: ['Oriel'] }, { npc: { id: 'Cael', role: 'lead', route: '-24,-80; -22,-52; -32,-26; -48,-16; -55,-6' } }, { npc: { id: 'Bram', role: 'follow' } }],
          say: ['@Bram Is that… is that all water? All of it?', '@Cael Saltmere. Lanthe’s on the islands; the Tide-Regent keeps a wall on this shore older than the Empire.',
                '@Cael She wrote to me. The wall’s open, and the spring tide is tonight.'],
          objective: 'Follow Cael down to Lowtown and the sea wall', mark: 'Cael', until: { signal: { obj: 'Zone_Lowtown', name: 'inside' } } },
        { id: 'wall', do: [{ checkpoint: true }, { npc: { id: 'Cael', role: 'walk', target: { x: -57, z: 6 } } }],
          say: ['@Oriel_Wall Cael. And you’ll be the Conduit. The Stonebound’s letter came the day before his.', '@Nerys Regent, they say every stone it touches cracks.',
                '@Oriel_Wall The Stonebound say a great many things, Nerys.', '@Oriel_Wall Lowtown has lived under the sea for eight hundred years. The wall is what lets it be a town.',
                '@Oriel_Wall Three nights ago the stone in it split, and the wall opened. The Tidekeepers have held the water since. They can’t hold a spring tide.',
                '@Cael The Oruun built it to close itself. There are sockets in the gap: give it stones and it remembers its shape.'],
          choices: [
              { label: 'I’ll close it.', flag: { name: 'saltmere.offer', value: 'help' }, say: ['@Oriel_Wall Then close it. Quickly.'] },
              { label: 'They think I did this.', flag: { name: 'saltmere.offer', value: 'doubt' }, say: ['@Oriel_Wall Then show them otherwise. Lowtown drowns either way; help, and they’ll have to decide what you are.'] },
              { label: '(Let Bram answer.)', flag: { name: 'saltmere.offer', value: 'bram' }, say: ['@Bram We’ll do it. Probably. Right?', '@Cael Right.'] },
          ] },
        // The tide comes in: the sea rises; Lowtown fills through the gap unless the wall closes first.
        { id: 'tide', do: [{ checkpoint: true }, { water: { prefix: 'Sea', level: TIDE, secs: 90 } }, { water: { prefix: 'Lowtown_Flood', level: TIDE - 0.05, secs: 100 } },
                           { hint: 'Lift the fallen wall stones and set one on each of the three sockets in the gap.' }],
          say: ['@Nerys The tide’s turned in. Here it comes.', '@Cael Three sockets, three stones. Set them. Don’t drop them.'],
          objective: 'Set a stone on each of the wall’s three sockets', mark: 'Breach_Socket_2',
          waiting: [{ when: sockets(1), say: ['@Cael One.'] }, { when: sockets(2), say: ['@Bram Two! One more!'] },
                    { when: { time: 45 }, say: ['@Nerys It’s over the sill! Lowtown’s taking water!'] },
                    { when: { time: 75 }, say: ['@Oriel_Wall Faster, Conduit, or there’ll be no Lowtown left to argue about.'] }],
          ends: [{ when: { all: [sockets(3), { not: { time: 50 } }] }, do: [{ setFlag: { name: 'saltmere.wall', value: 'held' } }], next: 'sealed' },
                 { when: sockets(3), do: [{ setFlag: { name: 'saltmere.wall', value: 'wet' } }], next: 'sealed' }] },
        { id: 'sealed', do: [{ reveal: ['Breach_Seal'] }, { water: { prefix: 'Lowtown_Flood', level: FLOOR - 0.8, secs: 25 } }, { grant: { el: 'earth', track: 'control', amount: 0.15 } }],
          ends: [
              { when: wall('wet'), say: ['@Bram It’s closing! It’s actually closing itself!', '@Oriel_Wall Lowtown’s wet to the knee. It would have been the roofs.', '@Nerys We’ll draw it out. That much we’re good at.'], do: [{ ledger: { tally: 'care', add: 0.5 } }] },
              { when: { time: 0 }, say: ['@Bram It’s closing! It’s actually closing itself!', '@Oriel_Wall Not a floorboard wet. Eight hundred years, and I’ve never seen the wall do that.', '@Nerys …Neither have I.'], do: [{ ledger: { tally: 'care', add: 1 } }] } ] },
        // The stone: cracked on purpose, again.
        { id: 'stone', do: [{ npc: { id: 'Cael', role: 'walk', target: { x: -62, z: 9 } } }],
          say: ['@Cael The stone that split. Put your hand on it. I need to know.'],
          objective: 'Touch the Tidestone', mark: 'Tidestone', until: { signal: { obj: 'Tidestone', name: 'touched' } } },
        { id: 'marks',
          say: ['@Cael Chisel marks. Square, patient. The same hand as the Watchstone.', '@Cael Once is a grudge. Twice is a pattern.',
                '@Nerys Every stone that breaks, the Conduit’s just been, or is on the way. Doesn’t that bother you?'],
          choices: [
              { label: 'Look at the marks. Someone cut it.', flag: { name: 'saltmere.told', value: 'shown' }, do: [{ ledger: { tally: 'care', add: 0.5 } }],
                say: ['@Nerys …Chisels. Not hands.', '@Nerys I’ll tell the Tidekeepers. They won’t like it. They’ll like it better than the other story.'] },
              { label: 'It bothers me.', flag: { name: 'saltmere.told', value: 'honest' }, say: ['@Nerys Good. It should.'] },
              { label: 'Who told you that?', flag: { name: 'saltmere.told', value: 'asked' },
                say: ['@Nerys A man at the fish market. Grey coat. Paid for his fish in silver with no face on it.', '@Cael …Of course he did.'] },
          ] },
        { id: 'regent', do: [{ water: { prefix: 'Sea', level: SEA, secs: 60 } }, { setFlag: { name: 'saltmere.away', value: '' } }, { setFlag: { name: 'act2.saltmere', value: 'done' } }, { checkpoint: true }],
          say: ['@Oriel_Wall The tide’s turning. It always does, and we’re always surprised.', '@Oriel_Wall Saltmere keeps its accounts in water, Conduit. Tonight they’re in your favour.',
                '@Cael There’ll be more stones. Someone is walking ahead of us with a chisel.', '@Bram Then we walk faster.'],
          until: { talking: false }, then: { do: [{ hint: 'The wall holds. Lanthe is across the bridges; talk to anyone. The road east leads on.' }] } },
    ],
    card: null,
};
const after = { flag: { name: 'act2.saltmere' } };
script.talk = {
    Oriel_Wall: [{ when: after, say: [['Come to the council house when you’re in Lanthe. I keep a chair for people who mend things.']] }, { say: [['The sockets. Quickly.']] }],
    Oriel: [{ when: wall('held'), say: [['Lowtown’s dry. I don’t say that lightly; I’ve never had to say it before.'], ['You’ll always have a chair in Lanthe.']] },
            { when: wall('wet'), say: [['Lowtown’s drying out. Better wet than gone.'], ['The Tidekeepers say you were quick. Not quick enough. Quick.']] },
            { say: [['The sea keeps no grudges. People do.']] }],
    Nerys: [{ when: { flag: { name: 'saltmere.told', is: 'shown' } }, say: [['Chisels. I keep thinking about it. Who brings a chisel to a sea wall?']] },
            { when: after, say: [['The wall’s yours now as much as ours. Don’t make me regret that.']] },
            { say: [['The water’s heavy tonight. Don’t talk to me; lift.']] }],
    Tidekeeper_1: [{ when: after, say: [['Three nights holding the sea. I could sleep for a week.']] }, { say: [['Don’t stand in the gap.']] }],
    Bram: [{ when: after, say: [['I watched a wall close itself. Nobody at home is going to believe me.'], ['The sea smells like Mira’s kitchen when she does fish. I mean that kindly.']] },
           { say: [['Can you swim? I can’t swim. Just so we know.']] }],
    Cael: [{ when: after, say: [['Two stones. The same hand. I’ve been a fool to hope it was coincidence.'], ['Get some rest. The road east is long.']] },
           { say: [['The Oruun never built a thing that couldn’t be put right. That’s the point of them.']] }],
    Lowtown_Folk_1: [{ when: wall('held'), say: [['My floor’s dry! My floor’s never been dry in spring!']] }, { when: wall('wet'), say: [['The water came in to the second step. My grandmother says that’s nothing.']] }],
};
const out = { ...scene('saltmere', 'Saltmere Coast · Lanthe', L, S, { region: 'saltmere', mood: 'sea', far: 170 }), script };
fs.writeFileSync('scenes/saltmere.json', JSON.stringify(out, null, 1) + '\n');
console.log('saltmere:', S.objects.length, 'objects');
