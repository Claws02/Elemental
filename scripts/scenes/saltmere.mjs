// ============================================================
// Builds scenes/saltmere.json: the Saltmere Coast (world bible).
// Tidal flats, islands, stilt-towns joined by rope bridges; Lanthe, the
// city of bridges; the council house; the Drowned Choir (a city rising out
// of the sea). Brinecoils in the shallows, Gale-kites over the islands.
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
const S = new Dresser(L, SEED);
S.add('Sea', 'water', 0, 60, 0, { kind: 'water', width: 260, depth: 140, level: SEA, colour: 0x2a6a90 });
// Lanthe: stilt houses on the islands and the flats, the council house on the big island.
const houses = [];
L.flatten(ISLANDS[0].x, ISLANDS[0].z, 10, 3, 0.7);
S.add('Lanthe_Council', 'prefab', ISLANDS[0].x, ISLANDS[0].z, Math.PI, { prefab: 'lanthe_council', style: 'prefab', seed: 3 }, 9);
const spots = [[-28, 8], [-8, 6], [14, 10], [30, 22], [38, 40], [20, 56], [-30, 40], [-50, 40], [-52, 62], [-24, 66], [6, 86], [22, 74]];
spots.forEach(([x, z], i) => { S.add(`Lanthe_House_${i + 1}`, 'prefab', x, z, Math.atan2(ISLANDS[0].x - x, ISLANDS[0].z - z), { prefab: 'lanthe_stilthouse', style: 'prefab', seed: i + 5 }, 6); houses.push([x, z]); });
for (const [i, [x, z]] of [[-60, 20], [50, 18], [-20, 92], [40, 64]].entries()) dock(L, S, `Lanthe_Dock_${i + 1}`, x, z - 14, 0, 1, SEA, 10);
for (let i = 0; i < 6; i++) S.add(`Lanthe_Lamp_${i + 1}`, 'lamp', ISLANDS[0].x + Math.cos(i) * 9, ISLANDS[0].z + Math.sin(i) * 9, 0, { height: 3 }, 1);
// The Tide-Regent at the council; folk on the island; guards at the shore walk.
S.add('Oriel', 'npc', ISLANDS[0].x, ISLANDS[0].z - 7, Math.PI, { name: 'Tide-Regent Oriel Sand', look: 'oriel', role: 'idle' });
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
grow(S, 'Coast', 'coast', { x0: -115, z0: -115, x1: 115, z1: 20 }, { trees: 40, plants: 80, boulders: 14, ok: (x, z, h) => h > SEA + 0.6 && !L.busy(x, z, 2) });
grow(S, 'Isle', 'coast', { x0: -60, z0: 15, x1: 50, z1: 90 }, { trees: 18, plants: 40, boulders: 4, ok: (x, z, h) => h > SEA + 0.8 && !houses.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < 5) });
for (let i = 0; i < 8; i++) S.add(`Sea_Stack_${i + 1}`, 'boulder', -100 + i * 26, 100 + (i % 2) * 8, i, { kind: 'seastack', size: 2.5 + (i % 3), seed: i }, 4);
L.paint((x, z, h, s, cur) => {
    if (cur !== 0) return null;
    if (h < SEA + 0.4) return 'mud';
    if (h < SEA + 1.6) return 'sand';
    if (s > 0.55) return 'rock';
    return z > -20 && fbm(x, z, 20, 4) > 0.2 ? 'sand' : null;
});
fs.writeFileSync('scenes/saltmere.json', JSON.stringify(scene('saltmere', 'Saltmere Coast · Lanthe', L, S, { region: 'saltmere', mood: 'sea', far: 170 }), null, 1) + '\n');
console.log('saltmere:', S.objects.length, 'objects');
