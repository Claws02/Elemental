// ============================================================
// REGION — what every kingdom's scene is built from (scripts/scenes/*.mjs)
// ============================================================
//
// A region is a 240 m square of land (Land) dressed with objects (Dresser):
//   exits       zones at the edge to the neighbouring scenes, each with an
//               arrival point (`from_<that scene>`) and a waystone between
//               two banners so you can see the way out
//   a town      a plaza on flattened ground, streets out to the roads, each building where it has a reason to be
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
import { LINKS, NAMES, ROADS } from '../../../src/data/world.js';
import { PREFABS } from '../../../src/data/prefabs.js';
export { LINKS, NAMES };      // the world's graph lives with the game (src/data/world.js): the journey marker reads it too

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
        // A road the story hasn't reached (ROADS): whoever keeps it stands in it, beside the way, until it opens.
        const road = ROADS[`${id}>${to}`];
        if (road?.look) {
            const k = edgePoint(side, along, 11), [ix, iz] = arrive.in;
            S.add(`Roadkeeper_${to}`, 'npc', k.x + iz * 2.5, k.z - ix * 2.5, facing(arrive.in), { name: road.who, look: road.look, role: 'idle', showWhen: `!${road.open}` }, 1);
        }
        ends.push({ to, x: arrive.x, z: arrive.z, in: arrive.in });
        L.road([[e.x, e.z], [arrive.x + arrive.in[0] * 8, arrive.z + arrive.in[1] * 8]], 5, surface);
    }
    return ends;
}

/**
 * A town, laid out for reasons a person would give (docs/AUDIT_2026-10.md §4), not on a ring:
 *   streets   run out from the plaza toward each road out of the region (`region`'s exits), plus any `lanes`
 *             (bearings, radians: direction (cos a, sin a)); houses front them, doors to the street
 *   hall      a landmark prefab: at the head of the plaza (`head`, default opposite the main road, the first
 *             street), `headAt` metres out, facing the plaza: the first thing anyone arriving sees
 *   smithy    a forge or smithy: the street slot nearest `water` (quenching), else the main road in
 *   barn      the slot nearest `fields`; tents the outermost slots (`downwind`, if given); towers by the plaza
 *   houses    the rest, innermost first, spread round the streets
 * `turn` ({ scene: bearing }) bends a road's street; `ends[scene]` (returned) is where it leaves town, for the road out.
 * `clear` is a list of paths ([[x, z], ...], each kept `clearW` wide) no building may stand on: the routes the
 * story walks. `ok(x, z)` vetoes ground (a river bank, a pool). Each building keeps its id and its place in
 * `spots`, so `spots[0]` is still the first building given. Throws if one can't be placed: the lint.
 */
export function town(L, S, { id, x, z, r = 34, plaza = 'cobble', plazaR = 10, buildings = [], height = null, keep = 7, region = null,
                             lanes = [], turn = {}, head = null, headAt = null, water = null, fields = null, downwind = null, clear = [], clearW = 5,
                             ok = () => true, street = 'dirt', seed = 1 }) {
    const h = L.flatten(x, z, r + 10, height, 0.8);
    if (plaza) L.paintCircle(x, z, plazaR, plaza);         // (none: the ground is the plaza, an oasis's shore)
    const R = rng(seed * 7 + 3), ROAD = 2.4;
    // The streets: toward each way out, merged where two leave together.
    // `turn` sets a street's own bearing where the road out can't leave straight (a hall, a river in the way).
    const bearings = [], to = [];
    for (const [side, along, scene] of region ? LINKS[region] || [] : []) { const e = edgePoint(side, along, 7); bearings.push(turn[scene] ?? Math.atan2(e.z - z, e.x - x)); to.push(scene); }
    bearings.push(...lanes); to.push(...lanes.map(() => null));
    const streets = [], ends = {};
    bearings.forEach((a, i) => {
        let k = streets.findIndex(b => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.45);
        if (k < 0) { k = streets.length; streets.push(a); }
        if (to[i]) ends[to[i]] = [x + Math.cos(streets[k]) * (r + 6), z + Math.sin(streets[k]) * (r + 6)];
    });
    for (const a of streets) L.road([[x + Math.cos(a) * (plazaR - 1), z + Math.sin(a) * (plazaR - 1)], [x + Math.cos(a) * (r + 6), z + Math.sin(a) * (r + 6)]], ROAD * 2, street);
    const sizeOf = b => b.type === 'prefab' ? PREFABS[b.prefab].footprint : b.type === 'timber_house' ? [b.cols, b.depth + 0.8]
        : b.type === 'tent' ? [b.size, b.size] : b.type === 'tower' ? [b.radius * 2.2, b.radius * 2.2] : [6, 6];
    const roleOf = b => b.role || (b.type === 'prefab' && PREFABS[b.prefab].landmark ? 'hall' : /forge|smithy/.test(b.prefab || '') ? 'smithy'
        : b.kind === 'barn' ? 'barn' : b.type === 'tent' ? 'tent' : b.type === 'tower' ? 'tower' : 'house');
    const specs = buildings.map((b, i) => { const spec = typeof b === 'string' ? { type: 'prefab', prefab: b, style: 'prefab' } : b; return { i, spec, role: roleOf(spec), size: sizeOf(spec) }; });
    // What a building's corners must keep clear of: other buildings, every street but its own, the story's paths.
    const placed = [];
    const corners = (cx, cz, face, w, d) => [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([u, v]) => [cx + Math.cos(face) * u * w / 2 + Math.sin(face) * v * d / 2, cz - Math.sin(face) * u * w / 2 + Math.cos(face) * v * d / 2]);
    const fits = (cx, cz, face, w, d, own = -1) => {
        const cs = corners(cx, cz, face, w, d);
        if (cs.some(([px, pz]) => Math.hypot(px - x, pz - z) > r + 2 || Math.hypot(px - x, pz - z) < plazaR + 0.5 || !ok(px, pz))) return false;
        for (const [k, a] of streets.entries()) if (k !== own && cs.some(([px, pz]) => pathDist([[x, z], [x + Math.cos(a) * (r + 6), z + Math.sin(a) * (r + 6)]], px, pz) < ROAD + 0.6)) return false;
        for (const c of clear) if (cs.some(([px, pz]) => pathDist(c, px, pz) < clearW / 2)) return false;
        for (const o of placed) if (Math.hypot(o.x - cx, o.z - cz) < (Math.hypot(w, d) + Math.hypot(o.w, o.d)) / 2 * 0.78) return false;
        return true;
    };
    // A street's frontage: where the next building along each side would go.
    const cursor = streets.flatMap((a, k) => [-1, 1].map(side => ({ k, a, side, s: plazaR + 1.5 })));
    const slotFor = (c, w, d) => {
        for (let s = c.s; s + w / 2 < r + 2; s += 1) {
            const u = [Math.cos(c.a), Math.sin(c.a)], n = [-u[1], u[0]], off = c.side * (ROAD + d / 2 + 0.8), along = s + w / 2;
            const bx = x + u[0] * along + n[0] * off, bz = z + u[1] * along + n[1] * off;
            const face = Math.atan2(-c.side * n[0], -c.side * n[1]);                  // the door to the street
            if (fits(bx, bz, face, w, d, c.k)) return { x: bx, z: bz, face, s: along + w / 2 };
        }
        return null;
    };
    const take = (c, slot, b) => { c.used = (c.used || 0) + 1; c.s = slot.s + 1 + R() * 1.6 + (R() < 0.3 ? 2.5 : 0); placed.push({ x: slot.x, z: slot.z, w: b.size[0], d: b.size[1] }); b.at = slot; };
    const best = (b, score) => {
        let top = null;
        for (const c of cursor) { const slot = slotFor(c, ...b.size); if (slot && (!top || score(slot, c) < top.v)) top = { c, slot, v: score(slot, c) }; }
        if (!top) throw new Error(`${id}: no room for ${b.spec.prefab || b.spec.type} (${b.role})`);
        take(top.c, top.slot, b);
    };
    const near = p => slot => Math.hypot(slot.x - p.x, slot.z - p.z);
    const order = { hall: 0, smithy: 1, barn: 2, tower: 3, tent: 4, house: 5 };
    for (const b of [...specs].sort((p, q) => order[p.role] - order[q.role] || p.i - q.i)) {
        const [w, d] = b.size;
        if (b.role === 'hall') {
            const a = head ?? (streets.length ? streets[0] + Math.PI : -Math.PI / 2), dist = headAt ?? plazaR + d / 2 + 2;
            const hx = x + Math.cos(a) * dist, hz = z + Math.sin(a) * dist, face = Math.atan2(x - hx, z - hz);
            if (!fits(hx, hz, face, w, d)) throw new Error(`${id}: the hall doesn't fit at the head of the plaza`);
            placed.push({ x: hx, z: hz, w, d }); b.at = { x: hx, z: hz, face };
        }
        else if (b.role === 'smithy') best(b, water ? near(water) : (slot, c) => (c.k === 0 ? 0 : 100) - slot.s);
        else if (b.role === 'barn') best(b, fields ? near(fields) : slot => -Math.hypot(slot.x - x, slot.z - z));
        else if (b.role === 'tent') best(b, downwind ? (slot) => near(downwind)(slot) : slot => -Math.hypot(slot.x - x, slot.z - z));
        else if (b.role === 'tower') best(b, slot => Math.hypot(slot.x - x, slot.z - z));
        else best(b, (slot, c) => Math.hypot(slot.x - x, slot.z - z) + (c.used || 0) * 4);
    }
    // The lint: every building is placed, inside the town, its door toward a street or the plaza.
    const spots = specs.map(b => {
        const { x: bx, z: bz, face } = b.at, fx = bx + Math.sin(face) * (b.size[1] / 2 + 3), fz = bz + Math.cos(face) * (b.size[1] / 2 + 3);
        const onStreet = Math.hypot(fx - x, fz - z) < plazaR + 4 || streets.some(a => pathDist([[x, z], [x + Math.cos(a) * (r + 6), z + Math.sin(a) * (r + 6)]], fx, fz) < ROAD + 2);
        if (!onStreet) throw new Error(`${id}: ${b.spec.prefab || b.spec.type} #${b.i + 1} doesn't face a street`);
        S.add(`${id}_${String(b.i + 1).padStart(2, '0')}_${b.spec.prefab || b.spec.type}`, b.spec.type, bx, bz, face, { seed: b.i + 3, ...b.spec, role: undefined }, keep);
        return { x: bx, z: bz, a: Math.atan2(bz - z, bx - x), face, role: b.role };
    });
    return { h, spots, streets, ends };       // ends[scene]: where that road's street leaves town
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
