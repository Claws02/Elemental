// ============================================================
// REGION — what every kingdom's scene is built from (scripts/scenes/*.mjs)
// ============================================================
//
// A region is a 240 m square of land (Land) dressed with objects (Dresser):
//   exits       zones at the edge to the neighbouring scenes, each with an
//               arrival point (`from_<that scene>`) and a waystone between
//               two banners so you can see the way out
//   a town      buildings ringed round a plaza on flattened ground, facing in
//   roads       painted and eased, linking the town to the exits
//   scenery     each climate's trees, plants and boulders, kept off roads
//   people      a ruler at their hall, folk who walk the plaza, guards
//
// THE WORLD MAP (linked scenes, not open world): Halcyra in the middle joined
// to all five kingdoms; the kingdoms in a ring; Veyra off the Verdant Reach.
// ============================================================

import { Land, Dresser, fbm, ridge, smooth, rng, pathDist } from './land.mjs';
export { Land, Dresser, fbm, ridge, smooth, rng, pathDist };

export const SIZE = 240, HALF = SIZE / 2;

// Where each exit sits: which edge (N = -z, S = +z, E = +x, W = -x) and how far along it (-1..1).
export const LINKS = {
    veyra:     [['E', 0, 'gate']],
    gate:      [['W', 0, 'veyra'], ['E', 0, 'verdant']],      // the Oruun Gate: Lesson I on the road
    lesson1:   [],
    verdant:   [['W', 0, 'gate'], ['E', 0, 'halcyra'], ['N', -0.3, 'emberwall'], ['S', -0.3, 'saltmere']],
    emberwall: [['S', -0.4, 'verdant'], ['S', 0.4, 'halcyra'], ['E', 0, 'skyreach']],
    skyreach:  [['W', 0, 'emberwall'], ['S', -0.4, 'halcyra'], ['S', 0.4, 'glass']],
    glass:     [['N', 0, 'skyreach'], ['W', -0.4, 'halcyra'], ['W', 0.4, 'saltmere']],
    saltmere:  [['N', -0.3, 'verdant'], ['E', -0.4, 'halcyra'], ['E', 0.4, 'glass']],
    halcyra:   [['W', 0, 'verdant'], ['N', -0.4, 'emberwall'], ['N', 0.4, 'skyreach'], ['E', 0, 'glass'], ['S', 0, 'saltmere']],
};
export const NAMES = { veyra: 'Veyra', gate: 'The Oruun Gate', verdant: 'Verdant Reach', emberwall: 'Emberwall Marches', saltmere: 'Saltmere Coast', skyreach: 'Skyreach Heights', glass: 'The Glass Expanse', halcyra: 'Halcyra' };

// A point on an edge, `inset` metres in, and the direction pointing into the scene.
export function edgePoint(side, along, inset = 6) {
    const a = along * (HALF - 30);
    return {
        N: { x: a, z: -HALF + inset, in: [0, 1] }, S: { x: a, z: HALF - inset, in: [0, -1] },
        E: { x: HALF - inset, z: a, in: [-1, 0] }, W: { x: -HALF + inset, z: a, in: [1, 0] },
    }[side];
}
const facing = ([dx, dz]) => Math.atan2(dx, dz);

/** Every exit of `id`: the zone, the arrival point, a waystone and banners, flat ground and a road stub. Returns road ends. */
export function exits(id, L, S, { banner = 'green', surface = 'dirt', style = 'stone' } = {}) {
    const ends = [];
    for (const [side, along, to] of LINKS[id] || []) {
        const e = edgePoint(side, along, 7), arrive = edgePoint(side, along, 16);
        const across = side === 'N' || side === 'S';
        L.flatten(arrive.x, arrive.z, 12);
        S.add(`Exit_${to}`, 'exit', e.x, e.z, across ? 0 : Math.PI / 2, { to, at: `from_${id}`, label: NAMES[to] || to, width: 10, depth: 4, height: 6 });
        S.add(`Start_from_${to}`, 'spawn', arrive.x, arrive.z, facing(arrive.in), { name: `from_${to}` }, 4);
        // The waystone: an Oruun marker, a banner either side.
        const sx = across ? 6 : 0, sz = across ? 0 : 6;
        S.add(`Waystone_${to}`, 'statue', e.x + sx, e.z + sz, facing(arrive.in), { height: 4, style, seed: to.length }, 2);
        S.add(`Banner_${to}_a`, 'banner', e.x - sx * 1.2, e.z - sz * 1.2, 0, { height: 5, colour: banner }, 1);
        ends.push({ to, x: arrive.x, z: arrive.z, in: arrive.in });
        L.road([[e.x, e.z], [arrive.x + arrive.in[0] * 8, arrive.z + arrive.in[1] * 8]], 5, surface);
    }
    return ends;
}

/**
 * A town: flat ground at (x, z) radius r, a plaza of `plaza` surface, and buildings (prefab names, or
 * { type, ...props }) ringed round it facing in. Returns { h, spots } (each building's place).
 */
export function town(L, S, { id, x, z, r = 34, plaza = 'cobble', plazaR = 10, buildings = [], ring = 0.7, startAngle = 0, height = null, keep = 7 }) {
    const h = L.flatten(x, z, r + 10, height, 0.8);
    L.paintCircle(x, z, plazaR, plaza);
    const spots = [];
    buildings.forEach((b, i) => {
        const a = startAngle + (i / buildings.length) * Math.PI * 2, d = r * ring + (i % 2) * 3;
        const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d, face = Math.atan2(x - bx, z - bz);
        const spec = typeof b === 'string' ? { type: 'prefab', prefab: b, style: 'prefab' } : b;
        S.add(`${id}_${String(i + 1).padStart(2, '0')}_${spec.prefab || spec.type}`, spec.type, bx, bz, face, { seed: i + 3, ...spec }, keep);
        spots.push({ x: bx, z: bz, a, face });
    });
    return { h, spots };
}

/** Each climate's growth: [tree kinds, plant kinds, boulder kinds]. */
export const CLIMATES = {
    meadow:  { trees: ['oak', 'oak', 'birch', 'pine', 'willow'], plants: ['tallgrass', 'flowers', 'bush', 'fern', 'tallgrass'], boulders: ['mossy', 'crag'] },
    forest:  { trees: ['giant', 'oak', 'birch', 'pine', 'giant'], plants: ['fern', 'mushrooms', 'bush', 'fern', 'tallgrass'], boulders: ['mossy'] },
    river:   { trees: ['willow', 'birch'], plants: ['reeds', 'reeds', 'flowers', 'tallgrass'], boulders: ['mossy'] },
    ash:     { trees: ['charred', 'charred', 'dead'], plants: ['thornscrub', 'emberbloom', 'thornscrub'], boulders: ['basalt', 'obsidian', 'lavarock', 'crag'] },
    coast:   { trees: ['palm', 'cypress', 'palm'], plants: ['dunegrass', 'dunegrass', 'driftwood', 'reeds'], boulders: ['seastack', 'crag'] },
    alpine:  { trees: ['fir', 'fir', 'juniper', 'pine'], plants: ['snowtuft', 'heather', 'tallgrass'], boulders: ['snowy', 'crag'] },
    glass:   { trees: ['glassbloom', 'dead'], plants: ['crystal', 'saltcrust', 'thornscrub'], boulders: ['glassspire', 'shards', 'saltpillar'] },
    lake:    { trees: ['cypress', 'willow', 'birch'], plants: ['flowers', 'reeds', 'bush'], boulders: ['crag'] },
};
const pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];

/** Scatter a climate's trees, plants and boulders over `area`, where ok(x, z, h, slope) allows. */
export function grow(S, prefix, climate, area, { trees = 40, plants = 60, boulders = 12, ok = () => true, treeH = [4.5, 8] } = {}) {
    const C = CLIMATES[climate];
    S.scatter(`${prefix}_Tree`, trees, area, (i, x, z, r) => {
        const kind = pick(C.trees, r);
        return ['tree', { kind, height: kind === 'giant' ? 13 + r() * 6 : treeH[0] + r() * (treeH[1] - treeH[0]), seed: i + 1 }, kind === 'giant' ? 3 : 1.5];
    }, ok);
    S.scatter(`${prefix}_Plant`, plants, area, (i, x, z, r) => ['plant', { kind: pick(C.plants, r), size: 0.8 + r() * 0.8, seed: i + 1 }, 0.6], ok);
    S.scatter(`${prefix}_Stone`, boulders, area, (i, x, z, r) => ['boulder', { kind: pick(C.boulders, r), size: 1.2 + r() * 2.2, seed: i + 1 }, 3], ok);
}

/** A dock from the bank out over the water: walks from (x, z) along (dx, dz) to where the water is a metre deep. */
export function dock(L, S, id, x, z, dx, dz, level, length = 9) {
    let px = x, pz = z;
    for (let i = 0; i < 80 && L.at(px, pz) > level - 1; i++) { px += dx; pz += dz; }
    const cx = px - dx * length * 0.3, cz = pz - dz * length * 0.3;
    S.add(id, 'dock', cx, cz, Math.atan2(dx, dz), { length, width: 3, height: Math.max(0.3, level + 0.6 - L.at(cx, cz)), seed: id.length });
}

/** A river along pts: a water sheet per stretch, each turned along it, all at `level`. */
export function river(S, id, pts, level, width = 24) {
    for (let k = 0; k < pts.length - 1; k++) {
        const [ax, az] = pts[k], [bx, bz] = pts[k + 1], len = Math.hypot(bx - ax, bz - az);
        S.add(`${id}_${k + 1}`, 'water', (ax + bx) / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az), { kind: 'water', width, depth: len + width * 0.6, level });
    }
}

/**
 * A bridge from bank point a to bank point b ([x, z] each): its ends sit on the ground there (deck top
 * 5 cm above it), the far end `drop` higher if the banks differ, so you walk straight on and off.
 */
export function span(L, S, id, a, b, { width = 3, rise = 1.2, style = 'stone', seed = id.length, owner = 'civilian' } = {}) {
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ha = L.at(a[0], a[1]), hb = L.at(b[0], b[1]);
    S.add(id, 'bridge', mx, mz, Math.atan2(-(b[1] - a[1]), b[0] - a[0]), { length: +len.toFixed(2), width, rise, drop: +(hb - ha).toFixed(2), style, seed, owner, y: +((ha + hb) / 2 - 0.2 - L.at(mx, mz)).toFixed(2) }, 3);
    return { a, b, len };
}

/** A bridge across water at `level`: from (x, z) out both ways along (dx, dz) to where the bank stands `clear` above it, then `onto` further. */
export function bridgeAcross(L, S, id, x, z, dx, dz, level, { clear = 0.6, onto = 1.5, ...opts } = {}) {
    const d = Math.hypot(dx, dz); dx /= d; dz /= d;
    const bank = s => { let t = 0; while (t < 80 && L.at(x + dx * s * t, z + dz * s * t) < level + clear) t += 0.5; t += onto; return [x + dx * s * t, z + dz * s * t]; };
    return span(L, S, id, bank(-1), bank(1), opts);
}

/** Folk who walk the plaza (a loop round it), guards who stand at a post. */
export function people(S, { id, x, z, folk, guard, n = 5, guards = [], r = 7 }) {
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, route = [0, 1, 2, 3].map(k => { const b = a + k * Math.PI / 2; return `${(x + Math.cos(b) * r).toFixed(1)},${(z + Math.sin(b) * r).toFixed(1)}`; }).join('; ');
        S.add(`${id}_Folk_${i + 1}`, 'npc', x + Math.cos(a) * r, z + Math.sin(a) * r, a, { name: '', look: folk, role: 'patrol', route });
    }
    guards.forEach(([gx, gz, face], i) => S.add(`${id}_Guard_${i + 1}`, 'npc', gx, gz, face, { name: 'Guard', look: guard, role: 'idle' }));
}

/** The scene file. */
export function scene(id, name, L, S, { region, mood = 'day', far = 170, persistent = true } = {}) {
    return {
        format: 1, id, name,
        settings: { profile: 'story', resetProgress: false, resetAfter: 0, region, persistent, mood, terrain: L.terrain(), view: { far } },
        objects: S.objects, wires: [],
    };
}
