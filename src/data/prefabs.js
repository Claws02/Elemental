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
