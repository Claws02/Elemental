// ============================================================
// Builds scenes/emberwall.json: the Emberwall Marches (world bible).
// Basalt highlands, forges, lava channels; Cindrel, a city built in a
// caldera; the Forge-Queen's hall; the Anvil Vaults (the deep mines that
// broke into old vents). Cindermites at the vents, Shellbacks on the
// highlands, Mudlings by the hot springs.
//   node scripts/scenes/emberwall.mjs
// ============================================================
import fs from 'fs';
import { Land, Dresser, fbm, ridge, smooth, pathDist, exits, town, grow, people, scene } from './lib/region.mjs';

const SEED = 33;
const L = new Land(240, 2, SEED);
const CAL = { x: 10, z: -10, r: 42 };                 // the caldera: a ring of rock, the city in the bowl
const LAVA = [[-120, 70], [-70, 55], [-40, 70], [-10, 95], [20, 120]];      // a lava channel across the south-west
L.shape((x, z) => {
    const d = Math.hypot(x - CAL.x, z - CAL.z);
    const highland = 10 + fbm(x, z, 60, SEED) * 6 + ridge(x, z, 90, SEED + 4) * 8;
    const rim = Math.exp(-((d - CAL.r) ** 2) / (2 * 9 ** 2)) * 16;          // the caldera wall
    const bowl = (1 - smooth(CAL.r - 12, CAL.r, d)) * (highland - 8);        // inside, the floor sinks
    const channel = (1 - smooth(3, 10, pathDist(LAVA, x, z))) * 4;
    return highland + rim - bowl - channel;
});
const S = new Dresser(L, SEED);
// Cindrel on the bowl floor; two gates cut through the rim to the south and east.
const C = town(L, S, {
    id: 'Cindrel', x: CAL.x, z: CAL.z, r: 26, plazaR: 10, plaza: 'cobble', height: 6,
    buildings: ['forge_hall', 'cindrel_house', 'cindrel_forge', 'cindrel_house', 'cindrel_house', 'cindrel_forge', 'cindrel_house', 'cindrel_house'],
    startAngle: -Math.PI / 2,
});
for (const [gx, gz, face] of [[CAL.x, CAL.z + CAL.r, 0], [CAL.x + CAL.r, CAL.z, Math.PI / 2]]) {
    L.flatten(gx, gz, 11, 6.2, 0.7);
    S.add(`Cindrel_Gate_${face ? 'East' : 'South'}`, 'gatehouse', gx, gz, face, { width: 5, height: 8, style: 'basalt', seed: 3 }, 9);
}
// Chimneys and braziers through the city; a lava-fed forge pool in the plaza.
for (let i = 0; i < 5; i++) { const a = i * 1.3; S.add(`Cindrel_Chimney_${i + 1}`, 'chimney', CAL.x + Math.cos(a) * 17, CAL.z + Math.sin(a) * 17, 0, { height: 6 + i, seed: i }, 1.5); }
S.add('Cindrel_ForgePool', 'water', CAL.x, CAL.z, 0, { kind: 'lava', width: 5, depth: 5, round: true, level: 6.15 });
for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; S.add(`Cindrel_Brazier_${i + 1}`, 'brazier', CAL.x + Math.cos(a) * 6, CAL.z + Math.sin(a) * 6, 0, { seed: i }, 1); }
// The Forge-Queen at her hall; workers in the plaza; guards at the gates.
const hall = C.spots[0];
S.add('Vorn', 'npc', hall.x + Math.sin(hall.face) * 8, hall.z + Math.cos(hall.face) * 8, hall.face + Math.PI, { name: 'Forge-Queen Talia Vorn', look: 'vorn', role: 'idle' });
people(S, { id: 'Cindrel', x: CAL.x, z: CAL.z, folk: 'ember_folk', guard: 'ember_guard', n: 6, r: 8, guards: [[CAL.x - 3, CAL.z + CAL.r - 5, 0], [CAL.x + 3, CAL.z + CAL.r - 5, 0], [CAL.x + CAL.r - 5, CAL.z - 3, Math.PI / 2]] });
S.add('Start', 'spawn', CAL.x, CAL.z + CAL.r - 9, Math.PI, { name: 'start' }, 2);
// Roads: exits to the gates.
const ends = exits('emberwall', L, S, { banner: 'red', surface: 'dirt', style: 'basalt' });
for (const e of ends) L.road([[e.x, e.z], e.to === 'skyreach' ? [CAL.x + CAL.r + 8, CAL.z] : [CAL.x, CAL.z + CAL.r + 8]], 5, 'dirt');
L.road([[CAL.x, CAL.z + CAL.r + 8], [CAL.x, CAL.z + 12]], 5, 'cobble');
L.road([[CAL.x + CAL.r + 8, CAL.z], [CAL.x + 12, CAL.z]], 5, 'cobble');
// The lava channel, crossed by a basalt bridge where the south road runs.
for (let k = 0; k < LAVA.length - 1; k++) {
    const [ax, az] = LAVA[k], [bx, bz] = LAVA[k + 1];
    S.add(`Lava_Channel_${k + 1}`, 'water', (ax + bx) / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az), { kind: 'lava', width: 10, depth: Math.hypot(bx - ax, bz - az) + 6, level: Math.min(L.at(ax, az), L.at(bx, bz), L.at((ax + bx) / 2, (az + bz) / 2)) + 0.7 });     // just over its own bed
}
// The Anvil Vaults: the mine mouth in the northern highlands, broken vents pouring cindermites.
const MINE = { x: -60, z: -80 };
L.flatten(MINE.x, MINE.z, 12, null, 0.7);
S.add('Vaults_Gate', 'gatehouse', MINE.x, MINE.z - 4, 0, { width: 4, height: 6, style: 'basalt', seed: 7 }, 8);
S.add('Vaults_Statue', 'statue', MINE.x + 7, MINE.z + 2, 0, { height: 5, style: 'basalt', seed: 2 }, 2);
S.add('Vaults_Vent_1', 'creature', MINE.x - 4, MINE.z + 6, 0, { species: 'cindermite', count: 4, spread: 1, aggressive: true, vent: true });
S.add('Vaults_Vent_2', 'creature', MINE.x + 10, MINE.z + 10, 0, { species: 'cindermite', count: 3, spread: 1, aggressive: true, vent: true });
L.road([[MINE.x, MINE.z + 8], [CAL.x - CAL.r * 0.7, CAL.z - CAL.r * 0.7]], 4, 'ash');
// Hot springs on the eastern highland, where the mudlings wallow.
S.add('Hot_Spring', 'water', 80, 60, 0, { kind: 'water', width: 18, depth: 14, round: true, level: L.at(80, 60) + 0.2 });
L.flatten(80, 60, 14, L.at(80, 60) - 0.5, 0.6);
S.add('Spring_Mudlings', 'creature', 72, 52, 0, { species: 'mudling', count: 2, spread: 3, aggressive: true });
S.add('Highland_Shellbacks', 'creature', 70, -70, 0, { species: 'shellback', count: 2, spread: 6, aggressive: false });
// Growth and stone: ash and basalt everywhere outside the city.
const outside = (x, z) => Math.hypot(x - CAL.x, z - CAL.z) > CAL.r + 8 && !L.busy(x, z, 2);
grow(S, 'Ash', 'ash', { x0: -115, z0: -115, x1: 115, z1: 115 }, { trees: 45, plants: 60, boulders: 45, ok: outside });
L.paint((x, z, h, s, cur) => {
    if (cur !== 0) return null;
    const d = Math.hypot(x - CAL.x, z - CAL.z);
    if (pathDist(LAVA, x, z) < 9) return 'basalt';
    if (d < CAL.r - 10) return 'ash';
    if (s > 0.5) return 'basalt';
    return fbm(x, z, 25, 9) > 0.1 ? 'rock' : 'ash';
});
fs.writeFileSync('scenes/emberwall.json', JSON.stringify(scene('emberwall', 'Emberwall Marches · Cindrel', L, S, { region: 'emberwall', mood: 'ember', far: 160 }), null, 1) + '\n');
console.log('emberwall:', S.objects.length, 'objects');
