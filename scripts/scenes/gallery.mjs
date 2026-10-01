// ============================================================
// Builds scenes/gallery.json: every phase 5 model in rows, to look at
// (?scene=gallery). Trees, plants, boulders, architecture, kingdom buildings.
//   node scripts/scenes/gallery.mjs
// ============================================================
import fs from 'fs';
import { TREE_KINDS, PLANT_KINDS, BOULDER_KINDS } from '../../src/data/nature.js';

const o = [];
const add = (id, type, x, z, rotY = 0, p = {}) => o.push({ id, type, x, y: 0, z, rotY, ...p });
add('Spawn', 'spawn', 0, 46, Math.PI, { name: 'start' });
TREE_KINDS.forEach((kind, i) => add(`Tree_${kind}`, 'tree', -44 + i * 8, 36, 0, { kind, height: kind === 'giant' ? 16 : 7, seed: i + 1 }));
PLANT_KINDS.forEach((kind, i) => add(`Plant_${kind}`, 'plant', -39 + i * 6, 26, 0, { kind, size: 1.2, seed: i + 1 }));
BOULDER_KINDS.forEach((kind, i) => add(`Boulder_${kind}`, 'boulder', -40 + i * 9, 16, 0, { kind, size: 2, seed: i + 1 }));
const arch = [
    ['tower', { height: 10, radius: 2.2, style: 'basalt', top: 'crenels' }], ['tower', { height: 10, radius: 2.2, style: 'marble', top: 'dome' }],
    ['town_wall', { length: 10, height: 5, style: 'whitestone' }], ['gatehouse', { width: 4, height: 7, style: 'stone' }],
    ['tent', { size: 5, colour: 'ochre' }], ['chimney', { height: 7 }], ['lamp', {}], ['banner', { colour: 'red' }],
    ['statue', { height: 5, style: 'stone' }], ['fountain', { radius: 2.5, style: 'marble' }], ['dock', { length: 8 }],
];
let x = -46;
arch.forEach(([type, p], i) => { add(`Arch_${i}_${type}`, type, x, 2, 0, { seed: i + 1, ...p }); x += type === 'town_wall' ? 13 : type === 'gatehouse' ? 13 : 8; });
for (const [i, style] of ['stone', 'whitestone', 'marble', 'plank', 'rope'].entries()) add(`Bridge_${style}`, 'bridge', -40 + i * 18, -10, 0, { length: 14, width: 3, rise: 1.2, style, seed: i });
const prefabs = ['thornwick_hall', 'cindrel_house', 'cindrel_forge', 'forge_hall', 'lanthe_stilthouse', 'lanthe_council', 'vaelmont_cell', 'vaelmont_temple', 'sarn_house', 'sarn_matriarch', 'halcyra_villa', 'imperial_palace'];
prefabs.forEach((prefab, i) => add(`Building_${prefab}`, 'prefab', -50 + (i % 6) * 20, -30 - Math.floor(i / 6) * 24, 0, { prefab, style: 'prefab', seed: i + 1 }));
// The bestiary in a row (calm: they don't attack in the gallery).
['emberwing', 'bristleback', 'thornhound', 'shellback', 'cindermite', 'mudling', 'brinecoil', 'galekite', 'frostmaw', 'glasswight', 'sentinel', 'wellspawn']
    .forEach((species, i) => add(`Creature_${species}`, 'creature', -44 + i * 8, 56, 0, { species, count: 1, spread: 0, aggressive: false, elite: false }));
// The people: rulers, companions, each kingdom's folk and guards, facing the camera's row.
const PEOPLE = ['maren', 'vorn', 'oriel', 'senn', 'yessa', 'ilvane', 'corvane', 'bram', 'isolde', 'kestrel', 'verdant_folk', 'verdant_guard', 'ember_folk', 'ember_guard', 'salt_folk', 'salt_guard', 'sky_folk', 'sky_guard', 'glass_folk', 'glass_guard', 'halcyra_folk', 'imperial_guard', 'lantern'];
PEOPLE.forEach((look, i) => add(`Person_${look}`, 'npc', -33 + i * 3, -76, 0, { name: look, look, role: 'idle' }));
const scene = {
    format: 1, id: 'gallery', name: 'Model gallery (phase 5)',
    settings: { ground: { half: 90, style: 'grass' }, profile: 'sandbox', resetProgress: false, resetAfter: 0, region: 'verdant', persistent: false, mood: 'day', view: { far: 170 } },
    objects: o, wires: [],
};
fs.writeFileSync('scenes/gallery.json', JSON.stringify(scene, null, 1) + '\n');
console.log('gallery:', o.length, 'objects');
