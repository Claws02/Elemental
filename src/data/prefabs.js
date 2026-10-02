// ============================================================
// PREFABS — ready-made buildings, as groups of building-kit pieces
// ============================================================
//
// A prefab is data: kit pieces (src/scene/schema.js, group "Buildings") in
// the building's own frame, centred on the ground under it, front facing +Z.
// A scene places a prefab as one object ({ type: 'prefab', prefab, style });
// the loader expands it into its pieces, and the editor can "break it apart"
// into those same pieces to change one by one.
//
// `style` on the prefab object (stone / timber / plaster) restyles every wall
// that has one; 'prefab' keeps each piece's own.
// ============================================================

const PI = Math.PI, H = PI / 2;

// Four walls round a w × d footprint, `h` high, starting at `y`. `open` sets
// each side's opening: [front, back, left, right].
function box4(w, d, h, y, style, open) {
    const t = 0.3;
    return [
        { type: 'b_wall', x: 0, y, z: d / 2, rotY: 0, length: w + t, height: h, style, opening: open[0] },
        { type: 'b_wall', x: 0, y, z: -d / 2, rotY: PI, length: w + t, height: h, style, opening: open[1] },
        { type: 'b_wall', x: -w / 2, y, z: 0, rotY: -H, length: d - t, height: h, style, opening: open[2] },
        { type: 'b_wall', x: w / 2, y, z: 0, rotY: H, length: d - t, height: h, style, opening: open[3] },
    ];
}

export const PREFABS = {
    cottage: {
        label: 'Cottage', footprint: [6, 4.5],
        pieces: [
            { type: 'b_floor', x: 0, y: 0, z: 0, rotY: 0, width: 6, depth: 4.5, style: 'packed earth' },
            ...box4(6, 4.5, 2.8, 0, 'timber', ['door', 'window', 'window', 'window']),
            { type: 'b_roof', x: 0, y: 2.8, z: 0, rotY: 0, width: 6.8, depth: 5.6, pitch: 2, style: 'thatch', gables: true },
        ],
    },
    house: {
        label: 'Town house', footprint: [6, 6],
        pieces: [
            { type: 'b_floor', x: 0, y: 0, z: 0, rotY: 0, width: 6, depth: 6, style: 'stone' },
            ...box4(6, 6, 3, 0, 'stone', ['door', 'two windows', 'window', 'window']),
            { type: 'b_floor', x: 0, y: 3, z: 0, rotY: 0, width: 6.3, depth: 6.3, style: 'planks' },
            ...box4(6, 6, 2.8, 3.1, 'plaster', ['two windows', 'two windows', 'window', 'window']),
            { type: 'b_roof', x: 0, y: 5.9, z: 0, rotY: 0, width: 6.8, depth: 7, pitch: 2.4, style: 'slate', gables: true },
        ],
    },
    smithy: {
        label: 'Smithy', footprint: [6, 5],
        pieces: [
            { type: 'b_floor', x: 0, y: 0, z: 0, rotY: 0, width: 6, depth: 5, style: 'stone' },
            { type: 'b_wall', x: 0, y: 0, z: -2.5, rotY: PI, length: 6.3, height: 3, style: 'stone', opening: 'none' },
            { type: 'b_wall', x: -3, y: 0, z: 0, rotY: -H, length: 4.7, height: 3, style: 'stone', opening: 'window' },
            { type: 'b_wall', x: 3, y: 0, z: -1.2, rotY: H, length: 2.3, height: 3, style: 'stone', opening: 'none' },
            { type: 'b_post', x: -2.85, y: 0, z: 2.35, rotY: 0, height: 3, style: 'timber' },
            { type: 'b_post', x: 2.85, y: 0, z: 2.35, rotY: 0, height: 3, style: 'timber' },
            { type: 'b_post', x: 0, y: 0, z: 2.35, rotY: 0, height: 3, style: 'timber' },
            { type: 'b_roof', x: 0, y: 3, z: 0, rotY: 0, width: 6.8, depth: 6, pitch: 1.6, style: 'shingle', gables: true },
            { type: 'brazier', x: 1.4, y: 0, z: -1.2, rotY: 0, seed: 7 },
        ],
    },
    tower: {
        label: 'Watchtower', footprint: [4, 4],
        pieces: [
            { type: 'b_floor', x: 0, y: 0, z: 0, rotY: 0, width: 4, depth: 4, style: 'stone' },
            ...box4(4, 4, 3, 0, 'stone', ['door', 'none', 'window', 'window']),
            { type: 'b_floor', x: 0, y: 3, z: 0, rotY: 0, width: 4.3, depth: 4.3, style: 'planks' },
            ...box4(4, 4, 3, 3.1, 'stone', ['window', 'window', 'none', 'none']),
            { type: 'b_floor', x: 0, y: 6.1, z: 0, rotY: 0, width: 4.3, depth: 4.3, style: 'planks' },
            ...box4(4, 4, 2.6, 6.2, 'stone', ['two windows', 'two windows', 'window', 'window']),
            { type: 'b_roof', x: 0, y: 8.8, z: 0, rotY: 0, width: 4.8, depth: 4.8, pitch: 2.6, style: 'slate', gables: true },
        ],
    },
    // ---- the five kingdoms and Halcyra (phase 5) ------------------------------------------------------------
    thornwick_hall: {
        landmark: true,
        label: 'Thornwick: the Lord-Warden\'s hall', footprint: [10, 8],
        pieces: [
            { type: 'b_floor', x: 0, y: 0, z: 0, rotY: 0, width: 10, depth: 8, style: 'stone' },
            ...box4(10, 8, 3.2, 0, 'stone', ['door', 'two windows', 'two windows', 'two windows']),
            { type: 'b_floor', x: 0, y: 3.2, z: 0, rotY: 0, width: 10.3, depth: 8.3, style: 'planks' },
            ...box4(10, 8, 2.8, 3.3, 'timber', ['two windows', 'two windows', 'window', 'window']),
            { type: 'b_roof', x: 0, y: 6.1, z: 0, rotY: 0, width: 10.8, depth: 9.2, pitch: 3, style: 'slate', gables: true },
            { type: 'banner', x: -2.5, y: 0, z: 4.6, rotY: 0, height: 4.5, colour: 'green' },
            { type: 'banner', x: 2.5, y: 0, z: 4.6, rotY: 0, height: 4.5, colour: 'green' },
        ],
    },
    cindrel_house: {
        label: 'Cindrel: basalt house', footprint: [6, 5],
        pieces: [
            { type: 'b_floor', x: 0, y: 0, z: 0, rotY: 0, width: 6, depth: 5, style: 'stone' },
            ...box4(6, 5, 3.2, 0, 'basalt', ['door', 'window', 'window', 'none']),
            { type: 'b_roof', x: 0, y: 3.2, z: 0, rotY: 0, width: 6.4, depth: 5.4, pitch: 0.5, style: 'flat', gables: false },
            { type: 'chimney', x: 2.2, y: 3.2, z: -1.6, rotY: 0, height: 1.6 },
        ],
    },
    cindrel_forge: {
        label: 'Cindrel: forge', footprint: [8, 6],
        pieces: [
            { type: 'b_floor', x: 0, y: 0, z: 0, rotY: 0, width: 8, depth: 6, style: 'stone' },
            { type: 'b_wall', x: 0, y: 0, z: -3, rotY: PI, length: 8.3, height: 3.8, style: 'brick', opening: 'none' },
            { type: 'b_wall', x: -4, y: 0, z: 0, rotY: -H, length: 5.7, height: 3.8, style: 'brick', opening: 'window' },
            { type: 'b_wall', x: 4, y: 0, z: 0, rotY: H, length: 5.7, height: 3.8, style: 'brick', opening: 'arch' },
            { type: 'b_post', x: -3.8, y: 0, z: 2.8, rotY: 0, height: 3.8, style: 'stone' },
            { type: 'b_post', x: 3.8, y: 0, z: 2.8, rotY: 0, height: 3.8, style: 'stone' },
            { type: 'b_roof', x: 0, y: 3.8, z: 0, rotY: 0, width: 8.6, depth: 6.6, pitch: 0.5, style: 'flat', gables: false },
            { type: 'chimney', x: -2.5, y: 0, z: -2.2, rotY: 0, height: 7 },
            { type: 'brazier', x: -1, y: 0, z: -1, rotY: 0, seed: 4 },
        ],
    },
    forge_hall: {
        landmark: true,
        label: 'Cindrel: the Forge-Queen\'s hall', footprint: [14, 10],
        pieces: [
            { type: 'b_floor', x: 0, y: 0, z: 0, rotY: 0, width: 14, depth: 10, style: 'stone' },
            ...box4(14, 10, 4.5, 0, 'basalt', ['arch', 'two windows', 'two windows', 'two windows']),
            { type: 'b_floor', x: 0, y: 4.5, z: 0, rotY: 0, width: 14.3, depth: 10.3, style: 'stone' },
            ...box4(10, 8, 3.5, 4.6, 'brick', ['two windows', 'two windows', 'window', 'window']),
            { type: 'b_roof', x: 0, y: 8.1, z: 0, rotY: 0, width: 10.4, depth: 8.4, pitch: 0.5, style: 'flat', gables: false },
            { type: 'chimney', x: -5.5, y: 0, z: -3.8, rotY: 0, height: 11 },
            { type: 'chimney', x: 5.5, y: 0, z: -3.8, rotY: 0, height: 11 },
            { type: 'banner', x: -3, y: 0, z: 5.6, rotY: 0, height: 6, colour: 'red' },
            { type: 'banner', x: 3, y: 0, z: 5.6, rotY: 0, height: 6, colour: 'red' },
        ],
    },
    lanthe_stilthouse: {
        label: 'Lanthe: stilt house', footprint: [6, 5],
        pieces: [
            ...[[-2.8, -2.3], [2.8, -2.3], [-2.8, 2.3], [2.8, 2.3], [0, -2.3], [0, 2.3]].map(([x, z]) => ({ type: 'b_post', x, y: 0, z, rotY: 0, height: 2.6, style: 'timber' })),
            { type: 'b_floor', x: 0, y: 2.6, z: 0, rotY: 0, width: 6.2, depth: 5.4, style: 'planks' },
            ...box4(6, 5, 2.7, 2.7, 'driftwood', ['door', 'window', 'window', 'window']),
            { type: 'b_roof', x: 0, y: 5.4, z: 0, rotY: 0, width: 6.8, depth: 6.2, pitch: 1.8, style: 'shingle', gables: true },
            { type: 'b_stairs', x: 1.8, y: 0, z: 4.6, rotY: PI, width: 1.1, rise: 2.6, style: 'timber' },
        ],
    },
    lanthe_council: {
        landmark: true,
        label: 'Lanthe: the council house', footprint: [11, 8],
        pieces: [
            ...[-5, -1.7, 1.7, 5].flatMap(x => [-3.7, 0, 3.7].map(z => ({ type: 'b_post', x, y: 0, z, rotY: 0, height: 3, style: 'timber' }))),
            { type: 'b_floor', x: 0, y: 3, z: 0, rotY: 0, width: 11, depth: 8, style: 'planks' },
            ...box4(10, 7, 3.4, 3.1, 'driftwood', ['door', 'two windows', 'two windows', 'two windows']),
            { type: 'b_roof', x: 0, y: 6.5, z: 0, rotY: 0, width: 10.8, depth: 8.4, pitch: 2.6, style: 'shingle', gables: true },
            { type: 'b_stairs', x: 0, y: 0, z: 6.1, rotY: PI, width: 2, rise: 3, style: 'timber' },
            { type: 'banner', x: -5.3, y: 3, z: 4.2, rotY: 0, height: 4, colour: 'blue' },
            { type: 'lamp', x: 2.2, y: 3, z: 3.8, rotY: 0, height: 2.4 },
        ],
    },
    vaelmont_cell: {
        label: 'Vaelmont: monk\'s cell', footprint: [5, 4],
        pieces: [
            { type: 'b_floor', x: 0, y: 0, z: 0, rotY: 0, width: 5, depth: 4, style: 'stone' },
            ...box4(5, 4, 3, 0, 'whitestone', ['door', 'window', 'window', 'none']),
            { type: 'b_roof', x: 0, y: 3, z: 0, rotY: 0, width: 5.6, depth: 5, pitch: 1.6, style: 'copper', gables: true },
        ],
    },
    vaelmont_temple: {
        landmark: true,
        label: 'Vaelmont: the Abbess-Prince\'s temple', footprint: [12, 12],
        pieces: [
            { type: 'b_floor', x: 0, y: 0, z: 0, rotY: 0, width: 12, depth: 12, style: 'stone' },
            ...box4(12, 12, 5, 0, 'whitestone', ['arch', 'two windows', 'two windows', 'two windows']),
            { type: 'b_roof', x: 0, y: 5, z: 0, rotY: 0, width: 12.4, depth: 12.4, pitch: 5, style: 'dome', gables: false },
            { type: 'tower', x: -6.5, y: 0, z: -6.5, rotY: 0, height: 13, radius: 1.8, style: 'whitestone', top: 'cone' },
            { type: 'tower', x: 6.5, y: 0, z: -6.5, rotY: 0, height: 13, radius: 1.8, style: 'whitestone', top: 'cone' },
            { type: 'banner', x: -3.5, y: 0, z: 6.6, rotY: 0, height: 5, colour: 'sky' },
            { type: 'banner', x: 3.5, y: 0, z: 6.6, rotY: 0, height: 5, colour: 'sky' },
        ],
    },
    sarn_house: {
        label: 'Sarn: domed house', footprint: [6, 6],
        pieces: [
            { type: 'b_floor', x: 0, y: 0, z: 0, rotY: 0, width: 6, depth: 6, style: 'packed earth' },
            ...box4(6, 6, 2.8, 0, 'adobe', ['door', 'window', 'none', 'window']),
            { type: 'b_roof', x: 0, y: 2.8, z: 0, rotY: 0, width: 6.2, depth: 6.2, pitch: 2.2, style: 'dome', gables: false },
        ],
    },
    sarn_matriarch: {
        landmark: true,
        label: 'Sarn: the Matriarch\'s tent', footprint: [12, 12],
        pieces: [
            { type: 'tent', x: 0, y: 0, z: 0, rotY: 0, size: 11, colour: 'ochre' },
            { type: 'tent', x: -6.5, y: 0, z: 3, rotY: 0.4, size: 5, colour: 'red' },
            { type: 'tent', x: 6.5, y: 0, z: 3, rotY: -0.4, size: 5, colour: 'blue' },
            { type: 'banner', x: 0, y: 0, z: 6.5, rotY: 0, height: 6, colour: 'ochre' },
            { type: 'brazier', x: -2, y: 0, z: 6, rotY: 0, seed: 9 },
            { type: 'brazier', x: 2, y: 0, z: 6, rotY: 0, seed: 10 },
        ],
    },
    halcyra_villa: {
        label: 'Halcyra: villa', footprint: [8, 7],
        pieces: [
            { type: 'b_floor', x: 0, y: 0, z: 0, rotY: 0, width: 8, depth: 7, style: 'stone' },
            ...box4(8, 7, 3.4, 0, 'marble', ['arch', 'two windows', 'window', 'window']),
            { type: 'b_floor', x: 0, y: 3.4, z: 0, rotY: 0, width: 8.3, depth: 7.3, style: 'stone' },
            ...box4(8, 7, 3, 3.5, 'marble', ['two windows', 'two windows', 'window', 'window']),
            { type: 'b_roof', x: 0, y: 6.5, z: 0, rotY: 0, width: 8.8, depth: 8, pitch: 2, style: 'tile', gables: true },
        ],
    },
    imperial_palace: {
        landmark: true,
        label: 'Halcyra: the imperial palace', footprint: [18, 14],
        pieces: [
            { type: 'b_floor', x: 0, y: 0, z: 0, rotY: 0, width: 18, depth: 14, style: 'stone' },
            ...box4(18, 14, 5, 0, 'marble', ['arch', 'two windows', 'two windows', 'two windows']),
            { type: 'b_floor', x: 0, y: 5, z: 0, rotY: 0, width: 18.3, depth: 14.3, style: 'stone' },
            ...box4(14, 10, 4.5, 5.1, 'marble', ['two windows', 'two windows', 'two windows', 'two windows']),
            { type: 'b_roof', x: 0, y: 9.6, z: 0, rotY: 0, width: 10.4, depth: 10.4, pitch: 5, style: 'dome', gables: false },
            { type: 'tower', x: -9.5, y: 0, z: -7.5, rotY: 0, height: 16, radius: 2.2, style: 'marble', top: 'dome' },
            { type: 'tower', x: 9.5, y: 0, z: -7.5, rotY: 0, height: 16, radius: 2.2, style: 'marble', top: 'dome' },
            { type: 'tower', x: -9.5, y: 0, z: 7.5, rotY: 0, height: 12, radius: 1.8, style: 'marble', top: 'dome' },
            { type: 'tower', x: 9.5, y: 0, z: 7.5, rotY: 0, height: 12, radius: 1.8, style: 'marble', top: 'dome' },
            { type: 'banner', x: -4, y: 0, z: 7.8, rotY: 0, height: 7, colour: 'gold' },
            { type: 'banner', x: 4, y: 0, z: 7.8, rotY: 0, height: 7, colour: 'gold' },
        ],
    },
    shed: {
        label: 'Shed', footprint: [3, 3],
        pieces: [
            ...box4(3, 3, 2.3, 0, 'timber', ['door', 'none', 'none', 'none']),
            { type: 'b_roof', x: 0, y: 2.3, z: 0, rotY: 0, width: 3.6, depth: 3.8, pitch: 1.1, style: 'shingle', gables: true },
        ],
    },
};

/**
 * The pieces of prefab object `it`, placed in the world: its position and
 * turn applied, its style applied, each with an id `<prefab id>.<n>`.
 */
export function expandPrefab(it) {
    const p = PREFABS[it.prefab];
    if (!p) return [];
    const c = Math.cos(it.rotY || 0), s = Math.sin(it.rotY || 0);
    return p.pieces.map((pc, i) => {
        const o = { ...pc, id: `${it.id}.${i + 1}` };
        o.x = (it.x || 0) + pc.x * c + pc.z * s;
        o.z = (it.z || 0) - pc.x * s + pc.z * c;
        o.y = (it.y || 0) + (pc.y || 0);
        o.rotY = (pc.rotY || 0) + (it.rotY || 0);
        if (it.style && it.style !== 'prefab' && pc.type === 'b_wall') o.style = it.style;
        if (it.seed != null && 'seed' in pc === false && pc.type === 'b_wall') o.seed = it.seed + i;
        return o;
    });
}
