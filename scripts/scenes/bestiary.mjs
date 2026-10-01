// ============================================================
// Builds scenes/bestiary.json: every phase 5 creature in its own pen, for
// qa/bestiary.js and to meet them (?scene=bestiary). A pond for the brinecoil,
// a vent for the cindermites.
//   node scripts/scenes/bestiary.mjs
// ============================================================
import fs from 'fs';
import { Land, Dresser, fbm, smooth } from './lib/land.mjs';

const L = new Land(120, 2, 11);
L.shape((x, z) => 2 + fbm(x, z, 50, 11) * 0.8 - (1 - smooth(4, 14, Math.hypot(x - 30, z - 30))) * 3.5);
L.paint((x, z, h) => h < 1.2 ? 'sand' : null);
const S = new Dresser(L, 11);
S.add('Spawn', 'spawn', 0, 0, 0, { name: 'start' }, 3);
S.add('Pond', 'water', 30, 30, 0, { width: 24, depth: 24, round: true, level: 1.2 });
const pens = [['shellback', -30, -30], ['cindermite', 0, -30], ['mudling', 30, -30], ['galekite', -30, 0], ['frostmaw', 30, 0], ['glasswight', -30, 30], ['sentinel', 0, 30], ['wellspawn', 0, -10]];
for (const [species, x, z] of pens) S.add(`Pen_${species}`, 'creature', x, z, 0, { species, count: species === 'cindermite' ? 4 : 1, spread: 1.5, aggressive: false, elite: false, vent: species === 'cindermite' });
S.add('Pen_brinecoil', 'creature', 30, 30, 0, { species: 'brinecoil', count: 1, spread: 1, aggressive: false, elite: false });
S.add('Hay_1', 'hay', 4, -26, 0, { seed: 1 });
for (let i = 0; i < 4; i++) S.add(`Rock_${i + 1}`, 'rock', -4 + i * 2, 4, 0, { radius: 0.4 + i * 0.05, seed: 50 + i });
const scene = {
    format: 1, id: 'bestiary', name: 'Bestiary (testing)',
    settings: { profile: 'sandbox', resetProgress: false, resetAfter: 0, region: 'verdant', persistent: false, mood: 'day', terrain: L.terrain(), view: { far: 120 } },
    objects: S.objects, wires: [],
};
fs.writeFileSync('scenes/bestiary.json', JSON.stringify(scene, null, 1) + '\n');
console.log('bestiary:', S.objects.length, 'objects');
