// ============================================================
// Builds scenes/halcyra.json: Halcyra, the imperial capital (world bible).
// A white city round the Mirror Lake; the palace on its island, joined to
// the shore by four marble bridges; villas on the shore; the Lantern Office,
// where the High Lantern keeps his records. Lantern Sentinels stand at the
// bridgeheads. Every kingdom's road ends here.
//   node scripts/scenes/halcyra.mjs
// ============================================================
import fs from 'fs';
import { Land, Dresser, fbm, smooth, exits, grow, people, scene, span } from './lib/region.mjs';

const SEED = 77;
const L = new Land(240, 2, SEED);
const ISLE = 20, SHORE = 60, TOP = 8, LEVEL = 6.5;         // island radius, shore radius, ground height, lake level (a quay's height below: climbable from the water)
L.shape((x, z) => {
    const d = Math.hypot(x, z);
    const land = TOP + fbm(x, z, 60, SEED) * 2.5 * smooth(SHORE + 8, SHORE + 40, d);
    const isle = 1 - smooth(ISLE, ISLE + 6, d), shore = smooth(SHORE - 6, SHORE + 2, d);
    return land * Math.max(isle, shore);                     // the lake bed at 0 between
});
const S = new Dresser(L, SEED);
S.add('Mirror_Lake', 'water', 0, 0, 0, { kind: 'water', width: SHORE * 2 + 4, depth: SHORE * 2 + 4, round: true, level: LEVEL, colour: 0x5a90b0 });
// The island: the palace facing south, fountains, banners, Ilvane before it.
L.flatten(0, 0, ISLE, TOP, 0.9); L.paintCircle(0, 0, ISLE, 'cobble');
S.add('Imperial_Palace', 'prefab', 0, -3, 0, { prefab: 'imperial_palace', style: 'prefab', seed: 1, owner: 'empire' }, 12);
for (const [x, z] of [[-8, 11], [8, 11]]) S.add(`Palace_Fountain_${x < 0 ? 'W' : 'E'}`, 'fountain', x, z, 0, { radius: 2, style: 'marble', seed: 3 }, 2);
S.add('Ilvane', 'npc', 0, 9, 0, { name: 'Empress Ilvane IV', look: 'ilvane', role: 'idle' });
for (const [x, z, f] of [[-3, 6, 0], [3, 6, 0], [-11, -12, Math.PI], [11, -12, Math.PI]]) S.add(`Palace_Guard_${S.objects.length}`, 'npc', x, z, f, { name: 'Imperial Guard', look: 'imperial_guard', role: 'idle' });
// Four marble bridges from the island to the shore, lamps along each.
const DIRS = [['South', 0, 1], ['North', 0, -1], ['East', 1, 0], ['West', -1, 0]];
for (const [name, dx, dz] of DIRS) {
    L.flatten(dx * (SHORE + 4), dz * (SHORE + 4), 7, TOP, 0.8);
    for (const t of [-1, 1]) {
        const side = [dz * 3, -dx * 3];
        S.add(`Bridge_${name}_Lamp_${t > 0 ? 'Shore' : 'Isle'}`, 'lamp', dx * (t > 0 ? SHORE + 3 : ISLE - 2) + side[0], dz * (t > 0 ? SHORE + 3 : ISLE - 2) + side[1], 0, { height: 3.6 }, 1);
    }
    // A Lantern Sentinel at each bridgehead: it binds only those who start trouble.
    S.add(`Bridge_${name}_Sentinel`, 'creature', dx * (SHORE + 6) - dz * 4, dz * (SHORE + 6) + dx * 4, 0, { species: 'sentinel', count: 1, spread: 1, aggressive: false });
}
// The shore city: villas round the lake, three in each quarter between the bridges.
const villas = [];
for (let q = 0; q < 4; q++) for (const off of [0.32, 0.785, 1.25]) {
    const a = q * Math.PI / 2 + off, r = SHORE + 16 + (off === 0.785 ? 4 : 0);
    villas.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, a });
}
// The Lantern Office takes the north-east villa's place.
const OFFICE = villas.splice(villas.findIndex(v => v.x > 0 && v.z < 0 && Math.abs(v.x + v.z) < 1), 1)[0];
villas.forEach((v, i) => {
    L.flatten(v.x, v.z, 8, TOP, 0.75); L.paintCircle(v.x, v.z, 6, 'cobble');
    S.add(`Halcyra_Villa_${i + 1}`, 'prefab', v.x, v.z, Math.atan2(-v.x, -v.z), { prefab: 'halcyra_villa', style: 'prefab', seed: i + 4 }, 7);
    S.add(`Halcyra_Villa_${i + 1}_Lamp`, 'lamp', v.x * 0.86, v.z * 0.86, 0, { height: 3.2 }, 1);
});
L.flatten(OFFICE.x, OFFICE.z, 13, TOP, 0.8); L.paintCircle(OFFICE.x, OFFICE.z, 11, 'cobble');
const of = Math.atan2(-OFFICE.x, -OFFICE.z), ox = Math.sin(of), oz = Math.cos(of), px = oz, pz = -ox;
S.add('Lantern_Office', 'prefab', OFFICE.x, OFFICE.z, of, { prefab: 'halcyra_villa', style: 'basalt', seed: 9, owner: 'empire', landmark: true }, 8);
for (const t of [-1, 1]) {
    S.add(`Lantern_Office_Tower_${t > 0 ? 'R' : 'L'}`, 'tower', OFFICE.x + px * 6.5 * t, OFFICE.z + pz * 6.5 * t, 0, { height: 12, radius: 1.6, style: 'basalt', top: 'crenels', seed: 5 }, 2);
    S.add(`Lantern_Office_Banner_${t > 0 ? 'R' : 'L'}`, 'banner', OFFICE.x + ox * 6 + px * 3 * t, OFFICE.z + oz * 6 + pz * 3 * t, 0, { height: 6, colour: 'gold' }, 1);
}
S.add('Corvane', 'npc', OFFICE.x + ox * 7, OFFICE.z + oz * 7, of, { name: 'High Lantern Corvane', look: 'corvane', role: 'idle' });
S.add('Office_Sentinel', 'creature', OFFICE.x + ox * 9 + px * 5, OFFICE.z + oz * 9 + pz * 5, 0, { species: 'sentinel', count: 1, spread: 1, aggressive: false });
// The lakeside promenade: folk walk the shore, fountains at the quarters.
for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2 + Math.PI / 4; S.add(`Promenade_Fountain_${q + 1}`, 'fountain', Math.cos(a) * (SHORE + 6), Math.sin(a) * (SHORE + 6), 0, { radius: 2.4, style: 'marble', seed: q }, 2); }
for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4, route = [0, 0.25, 0.5, 0.25].map(k => { const b = a + k; return `${(Math.cos(b) * (SHORE + 6)).toFixed(1)},${(Math.sin(b) * (SHORE + 6)).toFixed(1)}`; }).join('; ');
    S.add(`Halcyra_Folk_${i + 1}`, 'npc', Math.cos(a) * (SHORE + 6), Math.sin(a) * (SHORE + 6), a, { name: '', look: 'halcyra_folk', role: 'patrol', route });
}
people(S, { id: 'Isle', x: 0, z: 12, folk: 'halcyra_folk', guard: 'imperial_guard', n: 3, r: 5, guards: [] });
S.add('Start', 'spawn', 0, SHORE + 12, Math.PI, { name: 'start' }, 2);
// Roads: each exit to its nearest bridgehead.
const ends = exits('halcyra', L, S, { banner: 'gold', surface: 'cobble', style: 'marble' });
const heads = DIRS.map(([, dx, dz]) => [dx * (SHORE + 4), dz * (SHORE + 4)]);
for (const e of ends) {
    const h = heads.reduce((b, p) => Math.hypot(p[0] - e.x, p[1] - e.z) < Math.hypot(b[0] - e.x, b[1] - e.z) ? p : b);
    L.road([[e.x, e.z], h], 5, 'cobble');
}
// The shore ring road.
const ring = Array.from({ length: 33 }, (_, i) => { const a = (i / 32) * Math.PI * 2; return [Math.cos(a) * (SHORE + 6), Math.sin(a) * (SHORE + 6)]; });
L.road(ring, 4, 'cobble');
// The bridges last, so each end sits on the ground the roads left: island rim to the shore.
for (const [name, dx, dz] of DIRS) span(L, S, `Bridge_${name}`, [dx * (ISLE - 1), dz * (ISLE - 1)], [dx * (SHORE + 2), dz * (SHORE + 2)], { width: 5, rise: 1.6, style: 'marble', seed: name.length });
// Growth: cypress and gardens round the lake, the open country beyond.
grow(S, 'Garden', 'lake', { x0: -115, z0: -115, x1: 115, z1: 115 }, { trees: 50, plants: 70, boulders: 8, ok: (x, z, h, s) => Math.hypot(x, z) > SHORE + 2 && s < 0.6 && !L.busy(x, z, 2) && !villas.some(v => Math.hypot(v.x - x, v.z - z) < 8) && Math.hypot(OFFICE.x - x, OFFICE.z - z) > 13 });
grow(S, 'Isle', 'lake', { x: 0, z: 0, r: ISLE - 1 }, { trees: 6, plants: 10, boulders: 0, ok: (x, z) => Math.abs(x) > 12 || z > 14 });
L.paint((x, z, h, s, cur) => {
    if (cur !== 0) return null;
    const d = Math.hypot(x, z);
    if (d > ISLE && d < SHORE + 1) return h < LEVEL + 0.5 ? 'sand' : 'grass';
    return fbm(x, z, 25, 3) > 0.45 ? 'moss' : null;
});
fs.writeFileSync('scenes/halcyra.json', JSON.stringify(scene('halcyra', 'Halcyra · the Mirror Lake', L, S, { region: 'capital', mood: 'day', far: 180 }), null, 1) + '\n');
console.log('halcyra:', S.objects.length, 'objects');
