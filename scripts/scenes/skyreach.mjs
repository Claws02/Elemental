// ============================================================
// Builds scenes/skyreach.json: Skyreach Heights (world bible).
// Mountain terraces, monasteries, wind-bridges; Vaelmont, a monastery-city
// on the peaks; the Abbess-Prince's temple; stones that have begun to float;
// the Windless Stair. Gale-kites in the wind, Frostmaws on the high paths.
//   node scripts/scenes/skyreach.mjs
// ============================================================
import fs from 'fs';
import { Land, Dresser, fbm, ridge, smooth, pathDist, exits, town, grow, people, scene, span } from './lib/region.mjs';

const SEED = 55;
const L = new Land(240, 2, SEED);
const PEAK = { x: 30, z: -40 };                 // Vaelmont's plateau
const CHASM = [[-120, 10], [-60, 0], [-10, 20], [40, 40], [120, 30]];
L.shape((x, z) => {
    const d = Math.hypot(x - PEAK.x, z - PEAK.z);
    const massif = 34 * (1 - smooth(0, 120, d)) + ridge(x, z, 70, SEED) * 14 + fbm(x, z, 40, SEED + 1) * 4;
    // Terraces: the slopes stepped into fields, as the monks farm them.
    const terraced = Math.floor(massif / 3.2) * 3.2 + (massif % 3.2) * 0.25;
    const t = smooth(30, 70, d) * (1 - smooth(90, 110, d));
    const h = massif * (1 - t) + terraced * t;
    const chasm = (1 - smooth(4, 13, pathDist(CHASM, x, z))) * 18;
    return h + 6 - chasm;
});
const S = new Dresser(L, SEED);
// Vaelmont: the temple and cells on the summit plateau.
const V = town(L, S, {
    id: 'Vaelmont', x: PEAK.x, z: PEAK.z, r: 24, plazaR: 9, plaza: 'cobble',
    buildings: ['vaelmont_temple', 'vaelmont_cell', 'vaelmont_cell', { type: 'tower', height: 14, radius: 2, style: 'whitestone', top: 'cone' }, 'vaelmont_cell', 'vaelmont_cell', { type: 'tower', height: 11, radius: 1.8, style: 'whitestone', top: 'cone' }],
    startAngle: -Math.PI / 2,
});
for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; S.add(`Vaelmont_Banner_${i + 1}`, 'banner', PEAK.x + Math.cos(a) * 11, PEAK.z + Math.sin(a) * 11, 0, { height: 6, colour: i % 2 ? 'sky' : 'white', seed: i }, 1); }
S.add('Vaelmont_Statue', 'statue', PEAK.x, PEAK.z, Math.PI, { height: 6, style: 'whitestone', seed: 4 }, 2);
const temple = V.spots[0];
S.add('Senn', 'npc', temple.x + Math.sin(temple.face) * 9, temple.z + Math.cos(temple.face) * 9, temple.face + Math.PI, { name: 'Abbess-Prince Senn', look: 'senn', role: 'idle' });
people(S, { id: 'Vaelmont', x: PEAK.x, z: PEAK.z + 2, folk: 'sky_folk', guard: 'sky_guard', n: 5, r: 7, guards: [[PEAK.x - 3, PEAK.z + 22, 0], [PEAK.x + 3, PEAK.z + 22, 0]] });
// Kestrel at the glider launch on the plateau's edge.
L.flatten(PEAK.x + 30, PEAK.z - 6, 7, null, 0.7);
S.add('Glider_Launch', 'dock', PEAK.x + 34, PEAK.z - 6, Math.PI / 2, { length: 8, width: 3, height: 1, seed: 2 });
S.add('Kestrel', 'npc', PEAK.x + 30, PEAK.z - 3, Math.PI / 2, { name: 'Kestrel', look: 'kestrel', role: 'idle' });
S.add('Start', 'spawn', PEAK.x, PEAK.z + 30, Math.PI, { name: 'start' }, 2);
// Roads down the mountain to the exits; the wind-bridge over the chasm.
const ends = exits('skyreach', L, S, { banner: 'sky', surface: 'cobble', style: 'whitestone' });
const crossing = { x: -10, z: 20 };
const nA = [crossing.x, crossing.z - 16], nB = [crossing.x, crossing.z + 16];
for (const e of ends) L.road(e.to === 'emberwall' ? [[e.x, e.z], [-50, -20], [PEAK.x - 20, PEAK.z + 10], [PEAK.x, PEAK.z + 24]] : [[e.x, e.z], [nB[0], nB[1] + 6], [nA[0], nA[1] - 6], [PEAK.x - 10, PEAK.z + 20], [PEAK.x, PEAK.z + 24]], 4, 'dirt');
span(L, S, 'Wind_Bridge', nA, nB, { width: 2.4, rise: 1.2, style: 'rope', seed: 6 });        // after the roads: its ends on the chasm's lips
// The Windless Stair: whitestone flights up a cliff on the west flank, ending at a sealed door.
const STAIR = { x: -70, z: -60 };
L.flatten(STAIR.x, STAIR.z, 9, null, 0.7);
const base = L.at(STAIR.x, STAIR.z);
for (let i = 0; i < 4; i++) S.add(`Stair_${i + 1}`, 'b_stairs', STAIR.x, STAIR.z - 2 - i * 3.2, 0, { width: 2.4, rise: 2.5, style: 'stone', y: i * 2.5 }, 0);
S.add('Stair_Landing', 'b_floor', STAIR.x, STAIR.z - 15, 0, { width: 5, depth: 4, style: 'stone', y: 10 }, 0);
for (const sx of [-2, 2]) S.add(`Stair_Pier_${sx > 0 ? 'R' : 'L'}`, 'pillar', STAIR.x + sx, STAIR.z - 15.5, 0, { height: 10, broken: false, seed: 3 }, 0);
S.add('Stair_Door', 'sealed_door', STAIR.x, STAIR.z - 16.6, 0, { y: 10.1 }, 0);
S.add('Stair_Statue_L', 'statue', STAIR.x - 3, STAIR.z + 2, 0, { height: 5, style: 'whitestone', seed: 1 }, 1);
S.add('Stair_Statue_R', 'statue', STAIR.x + 3, STAIR.z + 2, 0, { height: 5, style: 'whitestone', seed: 2 }, 1);
// Stones that have begun to float: boulders hanging in the air over the chasm.
for (let i = 0; i < 9; i++) { const [x, z] = [-90 + i * 22, 14 + Math.sin(i * 1.7) * 10]; S.add(`Floating_Stone_${i + 1}`, 'boulder', x, z, i, { kind: 'crag', size: 2 + (i % 3), seed: i + 10, y: 10 + (i % 4) * 4 }, 0); }
// Creatures: kites on the wind, frostmaws on the high snow.
S.add('Wind_Kites', 'creature', -20, 30, 0, { species: 'galekite', count: 3, spread: 12, aggressive: true });
S.add('Snow_Frostmaw', 'creature', 70, -80, 0, { species: 'frostmaw', count: 1, spread: 2, aggressive: true });
S.add('Pass_Frostmaw', 'creature', -60, -30, 0, { species: 'frostmaw', count: 1, spread: 2, aggressive: false });
// Growth: alpine everywhere outside the city.
grow(S, 'Alpine', 'alpine', { x0: -115, z0: -115, x1: 115, z1: 115 }, { trees: 60, plants: 70, boulders: 30, ok: (x, z, h, s) => s < 0.7 && Math.hypot(x - PEAK.x, z - PEAK.z) > 34 && !L.busy(x, z, 2) });
L.paint((x, z, h, s, cur) => {
    if (cur !== 0) return null;
    if (h > 38) return 'snow';
    if (s > 0.6) return 'rock';
    if (pathDist(CHASM, x, z) < 12) return 'rock';
    return h > 30 && fbm(x, z, 15, 2) > 0 ? 'snow' : null;
});
fs.writeFileSync('scenes/skyreach.json', JSON.stringify(scene('skyreach', 'Skyreach Heights · Vaelmont', L, S, { region: 'skyreach', mood: 'peaks', far: 190 }), null, 1) + '\n');
console.log('skyreach:', S.objects.length, 'objects');
