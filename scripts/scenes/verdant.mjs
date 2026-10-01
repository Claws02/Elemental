// ============================================================
// Builds scenes/verdant.json: the Verdant Reach (world bible).
// Farmland, a river, old forest; Thornwick, a river-market town; the
// Lord-Warden's hall; the Sunken Loom (an Oruun ruin) in the river bend.
// Bristlebacks in the fields, Thornhounds in the forest, Emberwings.
//   node scripts/scenes/verdant.mjs
// ============================================================
import fs from 'fs';
import { Land, Dresser, fbm, smooth, pathDist, exits, town, grow, people, scene, dock, river, bridgeAcross, HALF } from './lib/region.mjs';

const SEED = 21;
const L = new Land(240, 2, SEED);
// The river: north to south through the middle-west, a bend round the ruin.
const RIVER = [[-30, -125], [-36, -70], [-22, -30], [-30, 10], [-52, 40], [-44, 80], [-50, 125]];
const FLOOR = 5.5, LEVEL = 4.6;
L.shape((x, z) => {
    const rolling = 6.5 + fbm(x, z, 70, SEED) * 4 + fbm(x, z, 22, SEED + 5) * 0.8;
    const forest = smooth(0, 80, -x - z * 0.3) * 4;                         // the old forest rises in the south-west
    const bank = pathDist(RIVER, x, z);
    const w = smooth(12, 46, bank);                                         // a valley: the land settles to a floor near the river…
    return (rolling + forest) * w + FLOOR * (1 - w) - (1 - smooth(5, 12, bank)) * 3.4;   // …and the channel cut into it
});
// Thornwick on the east bank; farmland north-east; the forest south-west.
const TW = { x: 18, z: 4 };
const S = new Dresser(L, SEED);
const T = town(L, S, {
    id: 'Thornwick', x: TW.x, z: TW.z, r: 30, plazaR: 12,
    buildings: ['thornwick_hall', 'house', 'cottage', { type: 'timber_house', kind: 'house', cols: 5, depth: 4, rows: 3 }, 'cottage', 'house',
                { type: 'timber_house', kind: 'barn', cols: 6, depth: 5, rows: 3 }, 'cottage', 'smithy', 'house'],
    startAngle: -Math.PI / 2,
});
// The market in the plaza; a well; lamps.
for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; S.add(`Thornwick_Stall_${i + 1}`, 'stall', TW.x + Math.cos(a) * 7, TW.z + Math.sin(a) * 7, -a + Math.PI / 2, { width: 2.4, awning: ['red', 'ochre', 'green', 'blue'][i % 4], seed: i }, 2); }
S.add('Thornwick_Well', 'basin', TW.x, TW.z, 0, { seed: 4, owner: 'civilian' }, 2);
// A dock on the river below the town, and a bridge west over it.
const bridgeX = -26, bridgeZ = 4;
river(S, 'River', RIVER, LEVEL, 22);
dock(L, S, 'Thornwick_Dock', 0, 22, -1, 0, LEVEL);
S.add('Start', 'spawn', TW.x + 4, TW.z + 14, Math.PI, { name: 'start' }, 2);
// Roads: exits to the town, through the bridge.
const ends = exits('verdant', L, S, { banner: 'green', surface: 'dirt' });
for (const e of ends) {
    // The west road stops at each bank: the bridge carries it over the river (placed after, on the roads' ground).
    if (e.to === 'veyra') { L.road([[e.x, e.z], [bridgeX - 17, bridgeZ]], 4.5, 'dirt'); L.road([[bridgeX + 9, bridgeZ], [TW.x - 12, TW.z]], 4.5, 'dirt'); }
    else L.road([[e.x, e.z], [(e.x + TW.x) / 2, (e.z + TW.z) / 2 + 6], [TW.x, TW.z]], 4.5, 'dirt');
}
bridgeAcross(L, S, 'Thornwick_Bridge', bridgeX, bridgeZ, 1, 0, LEVEL, { width: 4, rise: 1.4, style: 'stone', seed: 2 });
L.paintCircle(TW.x, TW.z, 12, 'cobble');            // the plaza over the roads' ends
// The Lord-Warden in his hall, folk in the market, guards at the bridge.
const hall = T.spots[0];
S.add('Maren', 'npc', hall.x + Math.sin(hall.face) * 6, hall.z + Math.cos(hall.face) * 6, hall.face + Math.PI, { name: 'Lord-Warden Aldric Maren', look: 'maren', role: 'idle' });
people(S, { id: 'Thornwick', x: TW.x, z: TW.z, folk: 'verdant_folk', guard: 'verdant_guard', n: 6, guards: [[bridgeX + 15, bridgeZ - 3, -Math.PI / 2], [bridgeX + 15, bridgeZ + 3, -Math.PI / 2]] });
// Farmland north-east: fields of hay and fences.
for (let f = 0; f < 4; f++) {
    const fx = 50 + (f % 2) * 30, fz = -55 + Math.floor(f / 2) * 28;
    L.flatten(fx, fz, 14, null, 0.8); L.paintCircle(fx, fz, 11, 'dirt');
    for (let i = 0; i < 6; i++) S.add(`Field_${f + 1}_Hay_${i + 1}`, 'hay', fx - 6 + (i % 3) * 6, fz - 3 + Math.floor(i / 3) * 6, 0, { seed: f * 10 + i, owner: 'civilian' }, 1);
    S.add(`Field_${f + 1}_Fence`, 'b_fence', fx, fz + 12, 0, { length: 22, height: 1.1, seed: f }, 1);
}
S.add('Field_Barn', 'timber_house', 66, -82, 0, { kind: 'barn', cols: 7, depth: 5, rows: 3, seed: 9, owner: 'civilian' }, 9);
// The Sunken Loom: an Oruun weaving-hall half under the river at the bend.
const LOOM = { x: -40, z: 52 };
for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; S.add(`Loom_Pillar_${i + 1}`, 'pillar', LOOM.x + Math.cos(a) * 7, LOOM.z + Math.sin(a) * 7, 0, { height: 3 + (i % 3) * 1.5, broken: i % 2 === 0, seed: i }, 2); }
S.add('Loom_Statue', 'statue', LOOM.x + 9, LOOM.z, -Math.PI / 2, { height: 6, style: 'stone', seed: 5 }, 3);
S.add('Loom_Arch', 'archway', LOOM.x + 4, LOOM.z - 8, 0, { width: 4, height: 4.5 }, 3);
S.add('Loom_Wall_1', 'ruin_wall', LOOM.x + 2, LOOM.z + 9, 0, { length: 8, height: 2.6, runes: true, seed: 3 }, 3);
// Creatures: a boar in the fields, hounds in the forest, a flock over the hills.
S.add('Fields_Boar', 'creature', 70, -40, 0, { species: 'bristleback', count: 1, spread: 2, aggressive: true });
S.add('Forest_Hounds', 'creature', -70, 70, 0, { species: 'thornhound', count: 3, spread: 4, aggressive: true });
S.add('Hills_Flock', 'creature', 60, 60, 0, { species: 'emberwing', count: 3, spread: 5, aggressive: false });
S.add('Ruin_Shellback', 'creature', LOOM.x + 16, LOOM.z + 14, 0, { species: 'shellback', count: 1, spread: 1, aggressive: false });
// Growth: the old forest south-west, meadows elsewhere, reeds on the river.
grow(S, 'Forest', 'forest', { x0: -115, z0: 20, x1: -60, z1: 115 }, { trees: 70, plants: 70, boulders: 10 });
grow(S, 'Woods', 'forest', { x0: -115, z0: -115, x1: -60, z1: -40 }, { trees: 35, plants: 40, boulders: 6 });
grow(S, 'Meadow', 'meadow', { x0: -10, z0: 30, x1: 115, z1: 115 }, { trees: 35, plants: 70, boulders: 10, ok: (x, z, h) => !L.busy(x, z, 3) });
grow(S, 'Upland', 'meadow', { x0: 0, z0: -115, x1: 115, z1: -20 }, { trees: 20, plants: 40, boulders: 8, ok: (x, z) => !L.busy(x, z, 3) });
grow(S, 'Riverbank', 'river', { x0: -75, z0: -115, x1: 5, z1: 115 }, { trees: 18, plants: 50, boulders: 4, ok: (x, z, h) => h > LEVEL + 0.4 && h < FLOOR + 1.5 });
// Paint: river sand and mud, forest moss, rock on the steep.
L.paint((x, z, h, s, cur) => {
    if (cur !== 0) return null;                                 // roads and plazas stay
    const bank = pathDist(RIVER, x, z);
    if (bank < 9 && h < LEVEL + 0.3) return 'mud';
    if (bank < 14 && h < FLOOR + 0.4) return 'sand';
    if (s > 0.55) return 'rock';
    if (-x - z * 0.3 > 70 && fbm(x, z, 15, 3) > -0.2) return 'moss';
    return null;
});
fs.writeFileSync('scenes/verdant.json', JSON.stringify(scene('verdant', 'The Verdant Reach · Thornwick', L, S, { region: 'verdant' }), null, 1) + '\n');
console.log('verdant:', S.objects.length, 'objects');
