// ============================================================
// Builds scenes/testlands.json: a small terrain scene for qa/terrain.js
// (hills, a lake, a plateau with a house, a far tree for culling).
//   node scripts/scenes/testlands.mjs
// ============================================================
import fs from 'fs';
import { Land, Dresser, fbm, smooth } from './lib/land.mjs';

const L = new Land(120, 2, 7);
// Rolling ground rising to a ridge in the north; a bowl for the lake in the south-west.
L.shape((x, z) => 3 + fbm(x, z, 40, 7) * 2.5 + smooth(10, 55, -z) * 9 - (1 - smooth(6, 22, Math.hypot(x + 25, z - 25))) * 5);
const plateau = L.flatten(20, -20, 12, 8);
L.road([[0, 40], [5, 10], [15, -12]], 4, 'dirt');
L.paint((x, z, h, s) => s > 0.6 ? 'rock' : h < 1.4 ? 'sand' : null);
L.paintCircle(20, -20, 8, 'cobble');

const S = new Dresser(L, 7);
S.add('Spawn', 'spawn', -12, 18, Math.PI * 0.75, { name: 'start' }, 3);
S.add('Lake', 'water', -25, 25, 0, { width: 26, depth: 22, round: true, level: 1.2 });
S.add('Plateau_House', 'timber_house', 20, -24, 0, { kind: 'house', cols: 5, depth: 4, rows: 3, seed: 3, owner: 'civilian' }, 8);
S.add('Hill_Rock', 'rock', 6, 6, 0, { radius: 0.4, seed: 11 }, 1);
S.add('Far_Tree', 'tree', 55, 55, 0, { kind: 'oak', height: 5.5, seed: 3 }, 2);
S.scatter('Tree', 14, { x0: -55, z0: -55, x1: 55, z1: 55 }, (i, x, z, r) => ['tree', { kind: r() < 0.5 ? 'pine' : 'oak', height: 4.5 + r() * 2.5, seed: i + 20 }, 2], (x, z, h) => h > 2);

const scene = {
    format: 1, id: 'testlands', name: 'Terrain test (testing)',
    settings: { profile: 'sandbox', resetProgress: false, resetAfter: 0, region: 'verdant', persistent: false, mood: 'day', terrain: L.terrain(), view: { far: 60 } },
    objects: S.objects, wires: [],
};
fs.writeFileSync('scenes/testlands.json', JSON.stringify(scene, null, 1) + '\n');
console.log('testlands:', S.objects.length, 'objects, plateau at', plateau.toFixed(2), 'm');
