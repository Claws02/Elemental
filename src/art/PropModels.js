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
