// ============================================================
// Builds scenes/glass.json: the Glass Expanse (world bible).
// A desert of fused glass and salt round the scar of the ancient sealing;
// Sarn, a caravan city at an oasis; the Matriarch's tents; the Sealed
// Heart at the centre of the scar. Glass-wights guard the scar; Wellspawn
// wander out of it.
//   node scripts/scenes/glass.mjs
// ============================================================
import fs from 'fs';
import { Land, Dresser, fbm, smooth, exits, town, grow, people, scene } from './lib/region.mjs';

const SEED = 66;
const L = new Land(240, 2, SEED);
const SCAR = { x: 40, z: 30, r: 46 };          // the glassed crater
const OASIS = { x: -50, z: -20 };
L.shape((x, z) => {
    const dunes = 5 + Math.sin(x * 0.06 + fbm(x, z, 40, SEED) * 2) * 2.4 + fbm(x, z, 30, SEED + 2) * 2;
    const d = Math.hypot(x - SCAR.x, z - SCAR.z);
    const crater = (1 - smooth(SCAR.r * 0.4, SCAR.r, d)) * -6 + Math.exp(-((d - SCAR.r) ** 2) / 60) * 3;
    const oasis = (1 - smooth(6, 20, Math.hypot(x - OASIS.x, z - OASIS.z))) * -3;
    return dunes + crater + oasis;
});
const S = new Dresser(L, SEED);
// Sarn round the oasis: domed houses, tents, the Matriarch's tents at the head.
const T = town(L, S, {
    id: 'Sarn', x: OASIS.x, z: OASIS.z, r: 30, plazaR: 0, plaza: 'sand', ring: 0.95, height: L.at(OASIS.x + 28, OASIS.z),
    buildings: ['sarn_matriarch', 'sarn_house', { type: 'tent', size: 5, colour: 'red' }, 'sarn_house', { type: 'tent', size: 6, colour: 'blue' }, 'sarn_house', { type: 'tent', size: 5, colour: 'ochre' }, 'sarn_house', { type: 'tent', size: 4, colour: 'green' }],
    startAngle: Math.PI,
});
// The town's flattening filled the oasis: dig it again.
const pool = L.flatten(OASIS.x, OASIS.z, 14, L.at(OASIS.x, OASIS.z) - 2.5, 0.5);
S.add('Oasis', 'water', OASIS.x, OASIS.z, 0, { kind: 'water', width: 22, depth: 18, round: true, level: pool + 1.7 });
const camp = T.spots[0];
S.add('Yessa', 'npc', camp.x + Math.sin(camp.face) * 9, camp.z + Math.cos(camp.face) * 9, camp.face + Math.PI, { name: 'Matriarch Yessa Keth', look: 'yessa', role: 'idle' });
people(S, { id: 'Sarn', x: OASIS.x, z: OASIS.z, folk: 'glass_folk', guard: 'glass_guard', n: 6, r: 17, guards: [[OASIS.x + 30, OASIS.z - 3, Math.PI / 2], [OASIS.x + 30, OASIS.z + 3, Math.PI / 2]] });
S.add('Start', 'spawn', OASIS.x + 34, OASIS.z, -Math.PI / 2, { name: 'start' }, 2);
grow(S, 'Oasis', 'coast', { x: OASIS.x, z: OASIS.z, r: 16 }, { trees: 12, plants: 18, boulders: 0, ok: (x, z, h) => h > pool + 1.9 });
// Exits and the caravan roads.
const ends = exits('glass', L, S, { banner: 'ochre', surface: 'sand', style: 'stone' });
for (const e of ends) L.road([[e.x, e.z], [OASIS.x + 30, OASIS.z]], 5, 'sand');
L.road([[OASIS.x + 30, OASIS.z], [SCAR.x - SCAR.r, SCAR.z]], 4, 'salt');
// The Sealed Heart: Oruun ruins at the scar's centre, ringed by statues that face it.
for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; S.add(`Heart_Statue_${i + 1}`, 'statue', SCAR.x + Math.cos(a) * 14, SCAR.z + Math.sin(a) * 14, Math.atan2(-Math.cos(a), -Math.sin(a)), { height: 7, style: 'stone', seed: i }, 2); }
S.add('Heart_Door', 'sealed_door', SCAR.x, SCAR.z, 0, {}, 3);
S.add('Heart_Arch', 'archway', SCAR.x, SCAR.z + 4, 0, { width: 6, height: 7 }, 3);
for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.2; S.add(`Heart_Pillar_${i + 1}`, 'pillar', SCAR.x + Math.cos(a) * 24, SCAR.z + Math.sin(a) * 24, 0, { height: 3 + (i % 4) * 2, broken: i % 2 === 0, seed: i }, 2); }
// Creatures: wights guard the scar, wellspawn wander out of it.
S.add('Scar_Wights', 'creature', SCAR.x - 18, SCAR.z, 0, { species: 'glasswight', count: 3, spread: 12, aggressive: false });
S.add('Scar_Wellspawn', 'creature', SCAR.x + 20, SCAR.z + 20, 0, { species: 'wellspawn', count: 1, spread: 2, aggressive: true });
S.add('Dune_Wellspawn', 'creature', -10, 70, 0, { species: 'wellspawn', count: 1, spread: 2, aggressive: false });
// Growth: glass in the scar, salt and thornscrub in the dunes.
grow(S, 'Scar', 'glass', { x: SCAR.x, z: SCAR.z, r: SCAR.r }, { trees: 18, plants: 40, boulders: 35, ok: (x, z) => Math.hypot(x - SCAR.x, z - SCAR.z) > 18 });
grow(S, 'Dunes', 'glass', { x0: -115, z0: -115, x1: 115, z1: 115 }, { trees: 8, plants: 40, boulders: 20, ok: (x, z) => Math.hypot(x - SCAR.x, z - SCAR.z) > SCAR.r + 6 && Math.hypot(x - OASIS.x, z - OASIS.z) > 36 && !L.busy(x, z, 2) });
L.paint((x, z, h, s, cur) => {
    if (cur !== 0) return null;
    const d = Math.hypot(x - SCAR.x, z - SCAR.z);
    if (d < SCAR.r * 0.85) return 'glass';
    if (Math.hypot(x - OASIS.x, z - OASIS.z) < 15) return 'grass';
    if (fbm(x, z, 30, 7) > 0.35) return 'salt';
    return 'sand';
});
fs.writeFileSync('scenes/glass.json', JSON.stringify(scene('glass', 'The Glass Expanse · Sarn', L, S, { region: 'glass', mood: 'glare', far: 190 }), null, 1) + '\n');
console.log('glass:', S.objects.length, 'objects');
