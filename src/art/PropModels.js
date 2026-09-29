// ============================================================
// PROP MODELS — rocks, ruins and timber for the Phase 1 test room
// ============================================================
//
// Every builder returns a Kit-built group plus the numbers the physics side
// needs (radius, size), so a model and its collider are always made from the
// same dimensions and can never drift apart.
//
// Ruins carry Earth runes in the glow layer: the ancient civilisations built
// the elements into their architecture (§47), and the first thing the player
// learns is that the stone around them remembers what Earth can do.
// ============================================================

import { THREE } from '../engine/lib.js';
import { Kit, at, seeded } from '../engine/Kit.js';
import { WORLD, ELEMENT } from './Palette.js';

const pick = (arr, n) => arr[Math.floor(seeded(n) * arr.length) % arr.length];

/**
 * A boulder: a jittered, squashed icosahedron with flat facets. `radius` is
 * the collider's; the mesh sits just inside it. Its material is its own, so
 * the Earth highlight can make it glow.
 */
export function rock(seed, radius) {
    const k = new Kit();
    const geo = new THREE.IcosahedronGeometry(radius, 1);
    const pos = geo.attributes.position;
    // Jitter by position, not index: the geometry is unindexed, and shared
    // corners must move together or the rock tears open.
    const sq = 0.78 + seeded(seed * 3.1) * 0.2;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const h = seeded(Math.round(x * 97) * 7.3 + Math.round(y * 97) * 13.1 + Math.round(z * 97) * 17.9 + seed);
        const f = 0.84 + h * 0.2;
        pos.setXYZ(i, x * f, y * f * sq, z * f);
    }
    k.geo('body', geo, null, pick(WORLD.rock, seed), { flat: true });
    // A cap of moss on the top of most rocks: they have lain here a long time.
    if (seeded(seed * 5.7) > 0.3) {
        const moss = new THREE.IcosahedronGeometry(radius * 0.62, 0);
        k.geo('body', moss, at(0, radius * sq * 0.5, 0, 0, seed, 0, 1, 0.3, 1), pick(WORLD.moss, seed + 2), { flat: true });
    }
    const grp = k.build({ own: true });
    return { group: grp, radius: radius * 0.97 };
}

/**
 * The courtyard floor: worn flagstones with dark joints, a single mesh.
 * Returns the group; the collider is a plane.
 */
export function flagstoneFloor(half, tile = 2) {
    const k = new Kit();
    k.shadows = false;
    // The joints: one dark slab under everything.
    k.box('body', half * 2, 0.1, half * 2, at(0, -0.05, 0), 0x4c4841);
    let n = 0;
    for (let x = -half + tile / 2; x < half; x += tile) {
        for (let z = -half + tile / 2; z < half; z += tile) {
            n++;
            const s = seeded(n * 1.37);
            const h = 0.04 + s * 0.03;
            const w = tile - 0.1 - seeded(n * 2.1) * 0.06;
            const col = new THREE.Color(pick(WORLD.flag, n * 3.3));
            col.offsetHSL(0, 0, (seeded(n * 4.9) - 0.5) * 0.05);
            k.box('body', w, h, w, at(x, h / 2 - 0.02, z, 0, (s - 0.5) * 0.04, 0), col, { ch: 0.04 });
            // Grass pushing up through one joint in six.
            if (seeded(n * 6.1) > 0.83) {
                k.box('body', 0.5 + s * 0.6, 0.05, 0.12, at(x + tile / 2 - 0.05, 0.02, z, 0, s * 3, 0), pick(WORLD.grass, n));
            }
        }
    }
    return k.build();
}

/**
 * A run of ruined wall along X, `len` long, `height` at its tallest. Courses
 * of dressed stone with a ragged, mossy top, and a glowing Earth rune on the
 * inner face every few blocks.
 */
export function ruinWall(seed, len, height, { runes = true } = {}) {
    const k = new Kit();
    const depth = 1.0;
    const course = 0.55;
    const rows = Math.round(height / course);
    let bi = 0;
    // Plinth.
    k.box('body', len + 0.2, 0.3, depth + 0.3, at(0, 0.15, 0), WORLD.stoneDark, { ch: 0.06 });
    for (let r = 0; r < rows; r++) {
        let x = -len / 2 + (r % 2 ? 0.5 : 0);
        if (r % 2) k.box('body', 0.5, course - 0.05, depth, at(-len / 2 + 0.25, 0.3 + r * course + course / 2, 0), pick(WORLD.stone, seed + r), { ch: 0.06 });
        while (x < len / 2 - 0.05) {
            bi++;
            const bw = Math.min(len / 2 - x, 0.9 + seeded(seed + bi * 1.9) * 0.8);
            // The top rows crumble: blocks go missing from the ends and the middle.
            const top = r >= rows - 2;
            const gone = top && seeded(seed + bi * 7.7) < (r === rows - 1 ? 0.55 : 0.2);
            if (!gone) {
                const col = new THREE.Color(pick(WORLD.stone, seed + bi * 2.3));
                col.offsetHSL(0, 0, (seeded(seed + bi * 3.9) - 0.5) * 0.06);
                const y = 0.3 + r * course + course / 2;
                k.box('body', bw - 0.05, course - 0.05, depth - seeded(bi) * 0.08, at(x + bw / 2, y, 0), col, { ch: 0.07, top: WORLD.stoneTop });
                if (top && seeded(seed + bi * 9.1) > 0.4) {
                    k.box('body', bw * 0.8, 0.06, depth * 0.7, at(x + bw / 2, y + course / 2 + 0.02, 0), pick(WORLD.moss, bi), { ch: 0.02 });
                }
                // A rune carved into the inner face (+Z), lit from within.
                if (runes && r === 1 && seeded(seed + bi * 11.3) > 0.72) {
                    _rune(k, x + bw / 2, y, depth / 2 + 0.01, ELEMENT.earth.rune);
                }
            }
            x += bw;
        }
    }
    return { group: k.build(), depth, height: 0.3 + rows * course };
}

// The Earth rune: a square within a diamond, three strokes. Simple enough to
// read at a glance and to become a UI icon later.
function _rune(k, x, y, z, col) {
    const s = 0.26;
    k.box('glow', s * 1.4, 0.045, 0.02, at(x, y + s * 0.7, z), col);
    k.box('glow', s * 1.4, 0.045, 0.02, at(x, y - s * 0.7, z), col);
    k.box('glow', 0.045, s * 1.4, 0.02, at(x, y, z), col);
    k.box('glow', s * 1.1, 0.045, 0.02, at(x - s * 0.35, y + s * 0.2, z, 0, 0, 0.8), col);
    k.box('glow', s * 1.1, 0.045, 0.02, at(x + s * 0.35, y + s * 0.2, z, 0, 0, -0.8), col);
}

/** A column of stacked drums with a base and capital. `broken` snaps it off. */
export function pillar(seed, height, { broken = false } = {}) {
    const k = new Kit();
    const r = 0.45;
    k.box('body', r * 2.6, 0.35, r * 2.6, at(0, 0.175, 0), WORLD.stoneDark, { ch: 0.07, top: WORLD.stoneTop });
    const h = broken ? height * (0.35 + seeded(seed) * 0.3) : height;
    const drums = Math.max(1, Math.round((h - 0.35) / 0.9));
    const dh = (h - 0.35 - (broken ? 0 : 0.4)) / drums;
    for (let i = 0; i < drums; i++) {
        const col = pick(WORLD.stone, seed + i);
        k.cyl('body', r * (0.98 - i * 0.01), r, dh - 0.03, 10, at(0, 0.35 + i * dh + dh / 2, 0), col, { flat: true });
    }
    if (!broken) {
        k.box('body', r * 2.5, 0.4, r * 2.5, at(0, h - 0.2, 0), WORLD.stoneTop, { ch: 0.08 });
        k.box('glow', r * 2.52, 0.05, r * 2.52, at(0, h - 0.3, 0), ELEMENT.earth.rune);
    } else {
        // A jagged break: a tilted wedge on the top drum.
        k.cyl('body', r * 0.9, r * 0.95, 0.25, 7, at(0.05, h + 0.05, 0, 0.3, seed, 0.2), pick(WORLD.stone, seed + 9), { flat: true });
    }
    return { group: k.build(), radius: r, height: h + (broken ? 0.2 : 0) };
}

/** A fallen pillar drum, lying on its side. */
export function fallenDrum(seed) {
    const k = new Kit();
    k.cyl('body', 0.44, 0.45, 0.85, 10, at(0, 0, 0, 0, 0, Math.PI / 2), pick(WORLD.stone, seed), { flat: true });
    k.cyl('body', 0.3, 0.3, 0.02, 10, at(0.43, 0, 0, 0, 0, Math.PI / 2), pick(WORLD.moss, seed));
    return k.build();
}

/** An arch: two piers and a lintel with a keystone rune. */
export function archway(width, height) {
    const k = new Kit();
    const pw = 1.1, d = 1.3;
    for (const sx of [-1, 1]) {
        k.box('body', pw, height, d, at(sx * (width / 2 + pw / 2), height / 2, 0), WORLD.stone[1], { ch: 0.1, top: WORLD.stoneTop });
        k.box('body', pw + 0.2, 0.3, d + 0.2, at(sx * (width / 2 + pw / 2), 0.15, 0), WORLD.stoneDark, { ch: 0.06 });
    }
    k.box('body', width + pw * 2 + 0.3, 0.8, d + 0.15, at(0, height + 0.4, 0), WORLD.stone[3], { ch: 0.12, top: WORLD.stoneTop });
    k.box('body', 0.7, 1.0, d + 0.3, at(0, height + 0.45, 0), WORLD.stone[0], { ch: 0.1 });
    _rune(k, 0, height + 0.45, d / 2 + 0.16, ELEMENT.earth.rune);
    return { group: k.build(), pierW: pw, depth: d };
}

/**
 * One panel of the timber barricade: two vertical planks and a batten, with
 * iron nails. `crack` 0..1 darkens and splits it as it takes damage.
 */
export function plankPanel(seed, w, h, d) {
    const k = new Kit();
    const pw = w / 2;
    for (let i = 0; i < 2; i++) {
        const col = new THREE.Color(pick(WORLD.timber, seed + i * 3));
        col.offsetHSL(0, 0, (seeded(seed * 5 + i) - 0.5) * 0.06);
        const hh = h - seeded(seed + i * 1.7) * 0.06;
        k.box('body', pw - 0.04, hh, d, at(-w / 4 + i * pw, 0, 0), col, { ch: 0.03 });
    }
    k.box('body', w - 0.02, 0.16, 0.06, at(0, 0, d / 2 + 0.03), WORLD.timberDark, { ch: 0.02 });
    for (const sx of [-1, 1]) k.box('body', 0.04, 0.04, 0.03, at(sx * w * 0.3, 0, d / 2 + 0.07), WORLD.iron);
    return k.build({ own: true });
}

/** A squared timber post, iron-banded, for the ends of the barricade. */
export function timberPost(h) {
    const k = new Kit();
    k.box('body', 0.3, h, 0.3, at(0, h / 2, 0), WORLD.timber[1], { ch: 0.04 });
    for (const y of [0.4, h - 0.4]) k.box('body', 0.34, 0.08, 0.34, at(0, y, 0), WORLD.iron, { ch: 0.01 });
    k.box('body', 0.34, 0.14, 0.34, at(0, h + 0.07, 0), WORLD.timberDark, { ch: 0.04 });
    return k.build();
}

/**
 * A brazier: a stone bowl of glowing coals on three iron legs. The coals are
 * a fire source (materials: "coals"); FireSystem adds the flames. Returns the
 * group, the coals' world-space offset for the flames, and its footprint.
 */
export function brazier(seed) {
    const k = new Kit();
    for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 + seed;
        k.box('body', 0.07, 0.95, 0.07, at(Math.cos(a) * 0.3, 0.45, Math.sin(a) * 0.3, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25), WORLD.iron, { ch: 0.015 });
    }
    k.cyl('body', 0.36, 0.3, 0.06, 10, at(0, 0.08, 0), WORLD.iron);
    k.cyl('body', 0.52, 0.34, 0.34, 12, at(0, 1.02, 0), WORLD.stoneDark, { flat: true });
    k.cyl('body', 0.56, 0.56, 0.07, 12, at(0, 1.2, 0), WORLD.stone[2], { flat: true });
    // Coals: a heap of faceted lumps, lit from within.
    for (let i = 0; i < 9; i++) {
        const a = seeded(seed * 7 + i) * Math.PI * 2, r = seeded(seed * 3 + i * 1.3) * 0.32;
        const hot = seeded(seed + i * 2.7) > 0.35;
        k.geo(hot ? 'glow' : 'body', new THREE.IcosahedronGeometry(0.09 + seeded(i + seed) * 0.05, 0),
            at(Math.cos(a) * r, 1.22 + seeded(i * 5.1) * 0.05, Math.sin(a) * r, i, i * 2, 0), hot ? 0xff7a2a : 0x2a1a14, { flat: true });
    }
    // A band of Fire's colour: the one lit element in the room besides Earth.
    k.cyl('glow', 0.53, 0.53, 0.035, 12, at(0, 0.98, 0), ELEMENT.fire.rune);
    return { group: k.build(), flameY: 1.3, radius: 0.56, height: 1.25 };
}

/**
 * A basin: a round stone cistern brimming with water, a Water rune on its
 * rim. The water is a source (materials: "water"): touch it and it comes.
 * Returns the group, the water surface's centre height, and its footprint.
 */
export function basin(seed) {
    const k = new Kit();
    k.cyl('body', 0.95, 1.05, 0.25, 14, at(0, 0.125, 0), WORLD.stoneDark, { flat: true });
    k.cyl('body', 0.9, 0.95, 0.55, 14, at(0, 0.5, 0), pick(WORLD.stone, seed), { flat: true });
    // Rim, standing proud of the bowl, and moss where the water spills.
    k.cyl('body', 0.98, 0.98, 0.1, 14, at(0, 0.82, 0), WORLD.stoneTop, { flat: true });
    k.box('body', 0.5, 0.05, 0.14, at(0.62, 0.86, 0.45, 0, 0.6, 0), pick(WORLD.moss, seed));
    k.cyl('sheen', 0.84, 0.84, 0.04, 14, at(0, 0.8, 0), 0x2f7fb0);
    k.cyl('glow', 0.99, 0.99, 0.035, 14, at(0, 0.66, 0), ELEMENT.water.rune);
    return { group: k.build(), surfaceY: 0.82, radius: 1.0, height: 0.87 };
}

/** A wooden crate: plank faces, a darker frame, iron corners. `size` metres. Own materials (it burns). */
export function crate(seed, size = 0.9) {
    const k = new Kit();
    const h = size / 2;
    k.box('body', size, size, size, at(0, 0, 0), pick(WORLD.timber, seed), { ch: 0.03 });
    // Frame battens on every face, proud of the planks: a border and a diagonal brace.
    const f = h + 0.015, D = WORLD.timberDark;
    for (const rot of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const face = (x, y, w, hh, rz = 0) => {
            const m = new THREE.Matrix4().makeRotationY(rot).multiply(at(x, y, f, 0, 0, rz));
            k.box('body', w, hh, 0.03, m, D);
        };
        face(0, h - 0.05, size, 0.1);
        face(0, -h + 0.05, size, 0.1);
        face(h - 0.05, 0, 0.1, size);
        face(-h + 0.05, 0, 0.1, size);
        face(0, 0, size * 1.2, 0.08, Math.PI / 4);
    }
    k.box('body', size + 0.04, 0.03, size + 0.04, at(0, h + 0.01, 0), WORLD.timber[2], { ch: 0.01 });
    return k.build({ own: true });
}

/** An oil barrel: staves, iron hoops, a lid, a dark oily drip. Own materials (it burns, then bursts). */
export function barrel(seed) {
    const k = new Kit();
    k.cyl('body', 0.36, 0.36, 1.0, 12, at(0, 0, 0), 0x6a3a22, { flat: true });
    k.cyl('body', 0.4, 0.4, 0.5, 12, at(0, 0, 0), 0x72402a, { flat: true });       // the belly
    for (const y of [-0.42, -0.17, 0.17, 0.42]) k.cyl('body', 0.41 - Math.abs(y) * 0.1, 0.41 - Math.abs(y) * 0.1, 0.05, 12, at(0, y, 0), WORLD.iron);
    k.cyl('body', 0.34, 0.34, 0.03, 12, at(0, 0.51, 0), 0x4a2a18);
    k.box('body', 0.08, 0.3, 0.03, at(0.18, 0.2, 0.37, 0, 0.45, 0), 0x1a1612);   // an oily stain down the side
    k.box('glow', 0.14, 0.14, 0.02, at(0, 0.05, 0.415, 0, 0, Math.PI / 4), ELEMENT.fire.deep);  // a warning mark
    return k.build({ own: true });
}

/** A training dummy: a post, a crossbar, a stuffed sack body and head. Own materials (it burns). */
export function dummy(seed) {
    const k = new Kit();
    const STRAW = 0xc9a45a, SACK = 0xa88a5e;
    k.box('body', 0.16, 1.9, 0.16, at(0, 0, 0), pick(WORLD.timber, seed), { ch: 0.02 });
    k.box('body', 1.1, 0.12, 0.12, at(0, 0.45, 0), WORLD.timberDark, { ch: 0.02 });
    k.box('body', 0.5, 0.7, 0.34, at(0, 0.3, 0.02), SACK, { ch: 0.08 });
    k.box('body', 0.34, 0.34, 0.3, at(0, 0.88, 0.02), SACK, { ch: 0.08 });
    for (const x of [-0.55, 0.55]) k.box('body', 0.14, 0.2, 0.14, at(x, 0.45, 0), STRAW, { ch: 0.04 });
    k.box('body', 0.52, 0.06, 0.36, at(0, 0.02, 0.02), 0x6b4a2a);               // rope belt
    k.box('body', 0.12, 0.12, 0.03, at(0, 0.3, 0.2), ELEMENT.earth.deep);        // a target mark
    return k.build({ own: true });
}

/** A bundle of dry hay, bound with twine. No collider: it is walked through and burns fast. */
export function hay(seed) {
    const k = new Kit();
    const col = [0xd8b25a, 0xc9a24e, 0xe0bf6a][seed % 3];
    k.box('body', 0.7, 0.36, 0.5, at(0, 0.18, 0, 0, seededAngle(seed), 0), col, { ch: 0.1 });
    k.box('body', 0.72, 0.04, 0.52, at(0, 0.2, 0, 0, seededAngle(seed), 0), 0x7a5a30);
    for (let i = 0; i < 4; i++) {
        const a = seededAngle(seed * 3 + i) * 3;
        k.box('body', 0.03, 0.22, 0.03, at(Math.cos(a) * 0.3, 0.42, Math.sin(a) * 0.2, 0.3, a, 0.2), col);
    }
    return k.build({ own: true });
}

function seededAngle(n) { return (seeded(n * 1.7) - 0.5) * 0.8; }
