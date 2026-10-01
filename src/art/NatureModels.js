// ============================================================
// NATURE MODELS — trees, plants and stone for every climate (phase 5)
// ============================================================
//
// Each kingdom grows its own: the Verdant Reach's birches, willows and giant
// oaks; Emberwall's charred trees, basalt columns and ember-blooms; the
// Saltmere's palms, dune grass and sea stacks; Skyreach's snowy firs and
// junipers; the Glass Expanse's glass spires, salt pillars and glassblooms.
//
//   treeModel({ kind, height, seed })    → { group, boxes }  (a collider: the trunk)
//   plantModel({ kind, size, seed })     → { group, boxes: [] } (walk through it)
//   boulderModel({ kind, size, seed })   → { group, boxes }  (fixed scenery: not a rock Earth lifts)
//
// Same rules as the rest of the art: Kit-built, flat-shaded, colour per face,
// the glow layer for what shines (embers, crystal, lava).
// ============================================================

import { THREE } from '../engine/lib.js';
import { Kit, at, seeded } from '../engine/Kit.js';
import { WORLD } from './Palette.js';
export { TREE_KINDS, PLANT_KINDS, BOULDER_KINDS } from '../data/nature.js';

const pick = (arr, n) => arr[Math.floor(seeded(n) * arr.length) % arr.length];
const jitter = (geo, seed, amt = 0.15) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const h = seeded(Math.round(x * 53) * 7.1 + Math.round(y * 53) * 3.3 + Math.round(z * 53) * 1.7 + seed);
        p.setXYZ(i, x * (1 - amt / 2 + h * amt), y * (1 - amt / 2 + h * amt), z * (1 - amt / 2 + h * amt));
    }
    return geo;
};

export const NATURE = {
    birchBark: 0xe6e2d8, birchLeaf: [0x9ab84a, 0xa8c45a, 0x8aa83e],
    willow: [0x7a9a48, 0x86a652, 0x6e8e40],
    giantLeaf: [0x3e5e2a, 0x476a30, 0x355226],
    fir: [0x2e4a32, 0x35523a, 0x284430], snow: 0xf0f4f6,
    charred: 0x2a2420, ember: 0xff6a1a,
    palmLeaf: [0x5f8a3a, 0x6a9a42, 0x56803a], palmBark: 0x8a6e4a,
    cypress: [0x3a5a3a, 0x42643f], juniper: [0x4a6a4a, 0x557555],
    glass: [0x9fd8d0, 0xb8e6de, 0x86c8c0], glassGlow: 0x7ff0e0,
    salt: [0xeae4d8, 0xe0dace, 0xf2ece0],
    basalt: [0x2e2c2e, 0x37343a, 0x2a282c], obsidian: 0x1a1620,
    seastack: [0x8a8274, 0x7e786c, 0x968e80],
    flowers: [0xe0b040, 0xd06a8a, 0x8a7ad8, 0xf0f0e0, 0xe08a3a],
    reed: [0x8a9a54, 0x9aa860, 0x7a8a48], dune: [0xc4b06a, 0xb8a460],
    heather: [0x8a5a8a, 0x7a4e7e], mushroom: [0xc84a3a, 0xd8c8a8],
};

// ---- trees -----------------------------------------------------------------------------------------

/** The trees beyond the first three (TownModels.tree draws oak, pine, dead). */
export function treeModel({ kind = 'birch', height: H = 6, seed = 1 } = {}) {
    const k = new Kit();
    let trunkR = 0.14 + H * 0.02, trunkH = H * 0.5;
    const trunk = (col, rt = trunkR * 0.7, rb = trunkR, h = trunkH + 0.3, lean = 0) =>
        k.cyl('body', rt, rb, h, 7, at(0, h / 2, 0, lean, seed, 0), col, { flat: true });
    const blob = (s, x, y, z, col, layer = 'body', detail = 0) => k.geo(layer, jitter(new THREE.IcosahedronGeometry(s, detail), seed + x * 3 + z), at(x, y, z, seed, x, z), col, { flat: true });

    switch (kind) {
    case 'birch': {
        trunkR *= 0.7; trunkH = H * 0.62;
        trunk(NATURE.birchBark);
        for (let i = 0; i < 5; i++) k.box('body', trunkR * 2.1, 0.06, trunkR * 2.1, at(0, 0.6 + i * trunkH / 5, 0, 0, i, 0), 0x2a2622);   // the black bands
        for (let i = 0; i < 4; i++) {
            const a = seeded(seed * 3 + i) * Math.PI * 2, d = i ? 0.45 : 0;
            blob(H * 0.13, Math.cos(a) * d, trunkH + H * 0.08 + i * H * 0.07, Math.sin(a) * d, pick(NATURE.birchLeaf, seed + i));
        }
        break;
    }
    case 'willow': {
        trunkH = H * 0.42; trunk(WORLD.timber[1], trunkR * 0.8, trunkR * 1.2);
        blob(H * 0.24, 0, trunkH + H * 0.12, 0, pick(NATURE.willow, seed));
        // Hanging curtains of leaves.
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + seeded(seed + i), d = H * 0.22;
            k.box('body', 0.35, H * 0.4, 0.08, at(Math.cos(a) * d, trunkH - H * 0.02, Math.sin(a) * d, 0, -a + Math.PI / 2, 0), pick(NATURE.willow, seed + i * 2));
        }
        break;
    }
    case 'giant': {
        // The old forest: a trunk you could live in, roots, a crown far up.
        trunkR = 0.5 + H * 0.04; trunkH = H * 0.55;
        trunk(WORLD.timber[0], trunkR * 0.75, trunkR * 1.15);
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + seeded(seed + i);
            k.box('body', 0.35, 0.5, trunkR * 2.2, at(Math.cos(a) * trunkR * 1.2, 0.2, Math.sin(a) * trunkR * 1.2, 0.35, -a + Math.PI / 2, 0), WORLD.timber[0]);
        }
        for (let i = 0; i < 6; i++) {
            const a = seeded(seed * 7 + i) * Math.PI * 2, d = i ? H * 0.16 : 0;
            blob(H * (0.17 + seeded(seed + i * 3) * 0.06), Math.cos(a) * d, trunkH + H * 0.1 + seeded(i) * H * 0.12, Math.sin(a) * d, pick(NATURE.giantLeaf, seed + i));
        }
        break;
    }
    case 'fir': {
        trunkH = H * 0.25; trunk(WORLD.timber[1]);
        const tiers = 5;
        for (let i = 0; i < tiers; i++) {
            const y = trunkH * 0.6 + i * (H - trunkH * 0.6) / tiers, rad = H * 0.3 * (1 - i / (tiers + 0.6)), h = (H - trunkH) / tiers * 1.6;
            k.cyl('body', 0.02, rad, h, 7, at(0, y + h / 2, 0, 0, i + seed, 0), pick(NATURE.fir, seed + i), { flat: true });
            k.cyl('body', 0.02, rad * 0.75, h * 0.35, 7, at(0, y + h * 0.82, 0, 0, i + seed + 0.3, 0), NATURE.snow, { flat: true });   // snow on each tier
        }
        break;
    }
    case 'charred': {
        trunk(NATURE.charred, trunkR * 0.5, trunkR);
        for (let i = 0; i < 3; i++) {
            const a = seeded(seed * 3 + i) * Math.PI * 2, tilt = 0.5 + seeded(i + seed) * 0.5, len = H * 0.28;
            k.cyl('body', 0.03, 0.08, len, 5, new THREE.Matrix4().makeTranslation(0, trunkH * (0.6 + i * 0.15), 0)
                .multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationZ(tilt)).multiply(at(0, len / 2, 0)), NATURE.charred, { flat: true });
        }
        // Embers still in the cracks.
        for (let i = 0; i < 4; i++) k.box('glow', 0.06, 0.25, 0.04, at(Math.cos(i * 1.7) * trunkR * 0.9, 0.4 + i * trunkH * 0.2, Math.sin(i * 1.7) * trunkR * 0.9, 0, i * 1.7, 0), NATURE.ember);
        break;
    }
    case 'palm': {
        // A curved trunk of rings, a crown of long fronds.
        const segs = 6, lean = 0.12 + seeded(seed) * 0.15;
        let x = 0, y = 0;
        for (let i = 0; i < segs; i++) {
            const h = H * 0.8 / segs;
            k.cyl('body', trunkR * (0.85 - i * 0.05), trunkR * (0.95 - i * 0.05), h * 1.05, 7, at(x, y + h / 2, 0, 0, 0, -lean * (i / segs)), NATURE.palmBark, { flat: true });
            y += h; x += Math.sin(lean * i / segs) * h;
        }
        // Fronds: two segments each, the outer one drooping.
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + seeded(seed + i) * 0.3, len = H * 0.24;
            const base = new THREE.Matrix4().makeTranslation(x, y, 0).multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationZ(0.15));
            k.box('body', len, 0.05, 0.5, base.clone().multiply(at(len / 2, 0, 0)), pick(NATURE.palmLeaf, seed + i));
            k.box('body', len, 0.05, 0.36, base.clone().multiply(new THREE.Matrix4().makeTranslation(len, 0, 0)).multiply(new THREE.Matrix4().makeRotationZ(-0.7)).multiply(at(len / 2, 0, 0)), pick(NATURE.palmLeaf, seed + i + 3));
        }
        k.geo('body', new THREE.IcosahedronGeometry(0.25, 0), at(x, y - 0.2, 0), 0x6a4a2a, { flat: true });     // coconuts
        trunkH = H * 0.8;
        break;
    }
    case 'cypress': {
        trunkH = H * 0.15; trunk(WORLD.timber[1]);
        k.geo('body', jitter(new THREE.ConeGeometry(H * 0.14, H * 0.9, 8, 3), seed, 0.12), at(0, trunkH + H * 0.42, 0, 0, seed, 0), pick(NATURE.cypress, seed), { flat: true });
        break;
    }
    case 'juniper': {
        // Low, wind-bent, clinging to a ledge.
        trunkH = H * 0.4; trunk(WORLD.timber[0], trunkR * 0.6, trunkR, trunkH, 0.4);
        for (let i = 0; i < 3; i++) blob(H * 0.17, 0.5 + i * 0.45, trunkH + i * 0.12, (seeded(seed + i) - 0.5) * 0.6, pick(NATURE.juniper, seed + i));
        break;
    }
    case 'glassbloom': {
        // Not a tree: a growth of fused glass, branching like one. It catches the light.
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + seeded(seed + i), tilt = i ? 0.25 + seeded(seed * 2 + i) * 0.35 : 0, len = H * (i ? 0.55 : 0.95);
            k.geo(i % 2 ? 'glow' : 'body', new THREE.CylinderGeometry(0.02, 0.18 + (i ? 0 : 0.12), len, 5), new THREE.Matrix4().makeRotationY(a)
                .multiply(new THREE.Matrix4().makeRotationZ(tilt)).multiply(at(0, len / 2, 0)), i % 2 ? NATURE.glassGlow : pick(NATURE.glass, seed + i), { flat: true });
        }
        trunkR = 0.3; trunkH = H * 0.6;
        break;
    }
    }
    return { group: k.build(), boxes: [{ x: 0, y: trunkH / 2 + 0.15, z: 0, w: trunkR * 2, h: trunkH + 0.3, d: trunkR * 2 }] };
}

// ---- plants (no collider) ----------------------------------------------------------------------------

export function plantModel({ kind = 'bush', size: S = 1, seed = 1 } = {}) {
    const k = new Kit();
    k.shadows = false;
    const r = n => seeded(seed * 13.7 + n);
    switch (kind) {
    case 'bush':
        for (let i = 0; i < 3; i++) k.geo('body', jitter(new THREE.IcosahedronGeometry(S * (0.45 + r(i) * 0.2), 0), seed + i), at((r(i + 3) - 0.5) * S * 0.7, S * 0.35, (r(i + 6) - 0.5) * S * 0.7, i, i * 2, 0), pick(WORLD.moss, seed + i), { flat: true });
        break;
    case 'fern':
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2 + r(i), len = S * (0.6 + r(i + 9) * 0.3);
            k.box('body', len, 0.03, 0.18 * S, new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(0.5)).multiply(at(len / 2, 0, 0)), pick(NATURE.giantLeaf, seed + i));
        }
        break;
    case 'reeds': case 'tallgrass': case 'dunegrass': case 'heather': case 'snowtuft': {
        const cols = kind === 'reeds' ? NATURE.reed : kind === 'dunegrass' ? NATURE.dune : kind === 'heather' ? NATURE.heather : kind === 'snowtuft' ? [0x8a9a7a, 0x7a8a6e] : WORLD.grass;
        const n = kind === 'reeds' ? 9 : 12, hgt = kind === 'reeds' ? 1.4 : kind === 'heather' ? 0.35 : 0.6;
        for (let i = 0; i < n; i++) {
            const a = r(i) * Math.PI * 2, d = r(i + 20) * 0.45 * S, h = S * hgt * (0.6 + r(i + 40) * 0.6);
            k.box('body', 0.05, h, 0.05, at(Math.cos(a) * d, h / 2, Math.sin(a) * d, (r(i + 60) - 0.5) * 0.5, a, (r(i + 80) - 0.5) * 0.5), pick(cols, seed + i));
            if (kind === 'reeds' && i % 3 === 0) k.box('body', 0.09, 0.25, 0.09, at(Math.cos(a) * d, h + 0.08, Math.sin(a) * d), 0x5a3e24);   // bulrush heads
        }
        if (kind === 'snowtuft') k.geo('body', new THREE.IcosahedronGeometry(0.3 * S, 0), at(0, 0.05, 0, 0, 0, 0, 1.4, 0.4, 1.4), NATURE.snow, { flat: true });
        break;
    }
    case 'flowers':
        for (let i = 0; i < 10; i++) {
            const a = r(i) * Math.PI * 2, d = r(i + 20) * 0.6 * S, h = 0.25 + r(i + 30) * 0.2;
            k.box('body', 0.03, h, 0.03, at(Math.cos(a) * d, h / 2, Math.sin(a) * d), WORLD.grass[1]);
            k.box('body', 0.12, 0.06, 0.12, at(Math.cos(a) * d, h, Math.sin(a) * d, 0, a, 0), pick(NATURE.flowers, seed + i));
        }
        break;
    case 'mushrooms':
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2, d = 0.5 * S, h = 0.12 + r(i) * 0.15;
            k.cyl('body', 0.03, 0.04, h, 5, at(Math.cos(a) * d, h / 2, Math.sin(a) * d), NATURE.mushroom[1], { flat: true });
            k.cyl('body', 0.01, 0.1 + r(i + 5) * 0.06, 0.07, 6, at(Math.cos(a) * d, h + 0.03, Math.sin(a) * d), NATURE.mushroom[0], { flat: true });
        }
        break;
    case 'thornscrub':
        for (let i = 0; i < 9; i++) {
            const a = r(i) * Math.PI * 2, len = S * (0.5 + r(i + 3) * 0.4);
            k.cyl('body', 0.01, 0.04, len, 4, new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(0.6 + r(i) * 0.6)).multiply(at(0, len / 2, 0)), 0x4a3a2a, { flat: true });
        }
        break;
    case 'emberbloom':
        // A volcanic plant: dark leaves round a glowing heart.
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2, len = S * 0.5;
            k.box('body', len, 0.04, 0.2, new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(0.4)).multiply(at(len / 2, 0.05, 0)), 0x3a2a24);
        }
        k.geo('glow', new THREE.IcosahedronGeometry(0.14 * S, 0), at(0, 0.18, 0), NATURE.ember, { flat: true });
        break;
    case 'driftwood':
        k.cyl('body', 0.08 * S, 0.12 * S, 1.8 * S, 6, at(0, 0.1, 0, 0, r(1) * 3, Math.PI / 2), 0xb8a890, { flat: true });
        k.cyl('body', 0.05 * S, 0.06 * S, 0.6 * S, 5, at(0.5 * S, 0.2, 0.1, 0.4, 0.8, Math.PI / 2 - 0.4), 0xa89a80, { flat: true });
        break;
    case 'crystal':
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + r(i), h = S * (0.4 + r(i + 7) * 0.7);
            k.geo(i % 2 ? 'glow' : 'body', new THREE.ConeGeometry(0.1 * S, h, 5), at(Math.cos(a) * 0.2 * S, h / 2, Math.sin(a) * 0.2 * S, (r(i) - 0.5) * 0.6, a, (r(i + 3) - 0.5) * 0.6), i % 2 ? NATURE.glassGlow : pick(NATURE.glass, seed + i), { flat: true });
        }
        break;
    case 'saltcrust':
        for (let i = 0; i < 6; i++) k.box('body', 0.4 + r(i) * 0.5, 0.06, 0.3 + r(i + 4) * 0.5, at((r(i + 8) - 0.5) * S * 1.4, 0.03, (r(i + 12) - 0.5) * S * 1.4, 0, r(i) * 3, 0), pick(NATURE.salt, seed + i));
        break;
    }
    return { group: k.build(), boxes: [] };
}

// ---- boulders: fixed stone scenery (Earth can't lift these) ----------------------------------------------

export function boulderModel({ kind = 'crag', size: S = 2, seed = 1 } = {}) {
    const k = new Kit();
    const r = n => seeded(seed * 7.7 + n);
    let box = { x: 0, y: S * 0.4, z: 0, w: S * 1.4, h: S * 0.8, d: S * 1.4 };
    const lump = (s, x, y, z, col, sq = 0.7, layer = 'body') => k.geo(layer, jitter(new THREE.IcosahedronGeometry(s, 0), seed + x * 5 + z, 0.3), at(x, y, z, r(x) * 3, r(z) * 3, 0, 1, sq, 1), col, { flat: true });
    switch (kind) {
    case 'crag': case 'mossy': case 'snowy':
        lump(S * 0.8, 0, S * 0.35, 0, pick(WORLD.rock, seed));
        lump(S * 0.5, S * 0.6, S * 0.2, S * 0.2, pick(WORLD.rock, seed + 1));
        if (kind === 'mossy') lump(S * 0.55, 0, S * 0.7, 0, pick(WORLD.moss, seed), 0.35);
        if (kind === 'snowy') lump(S * 0.6, 0, S * 0.72, 0, NATURE.snow, 0.3);
        break;
    case 'basalt': {
        // Hexagonal columns, stepped like a stair of giants.
        const n = 7;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2, d = i ? S * 0.45 : 0, h = S * (0.9 + r(i) * 1.3);
            k.cyl('body', S * 0.28, S * 0.3, h, 6, at(Math.cos(a) * d, h / 2, Math.sin(a) * d), pick(NATURE.basalt, seed + i), { flat: true });
        }
        box = { x: 0, y: S, z: 0, w: S * 1.5, h: S * 2, d: S * 1.5 };
        break;
    }
    case 'obsidian':
        for (let i = 0; i < 4; i++) k.geo('body', new THREE.ConeGeometry(S * 0.35, S * (1 + r(i)), 4), at((r(i + 2) - 0.5) * S, S * 0.5, (r(i + 4) - 0.5) * S, (r(i) - 0.5) * 0.7, i, (r(i + 6) - 0.5) * 0.7), NATURE.obsidian, { flat: true });
        break;
    case 'lavarock':
        lump(S * 0.75, 0, S * 0.3, 0, NATURE.basalt[0]);
        for (let i = 0; i < 5; i++) k.box('glow', S * 0.5, 0.05, 0.05, at(0, S * (0.2 + i * 0.1), 0, 0, i * 1.2, 0.3), 0xff5a14);    // glowing cracks
        break;
    case 'seastack':
        for (let i = 0; i < 3; i++) lump(S * (0.7 - i * 0.15), (r(i) - 0.5) * 0.3, S * (0.5 + i * 0.9), 0, pick(NATURE.seastack, seed + i), 0.9);
        box = { x: 0, y: S * 1.4, z: 0, w: S * 1.3, h: S * 2.8, d: S * 1.3 };
        break;
    case 'glassspire':
        k.geo('body', new THREE.ConeGeometry(S * 0.45, S * 3.2, 5), at(0, S * 1.6, 0, 0.08, seed, 0), pick(NATURE.glass, seed), { flat: true });
        k.geo('glow', new THREE.ConeGeometry(S * 0.2, S * 2.2, 5), at(S * 0.4, S * 1.1, 0.1, -0.2, seed + 1, 0), NATURE.glassGlow, { flat: true });
        box = { x: 0, y: S * 1.2, z: 0, w: S * 0.9, h: S * 2.4, d: S * 0.9 };
        break;
    case 'saltpillar':
        for (let i = 0; i < 3; i++) k.cyl('body', S * (0.35 - i * 0.07), S * (0.42 - i * 0.07), S * 1.1, 7, at((r(i) - 0.5) * 0.2, S * (0.55 + i * 1.05), 0, (r(i + 3) - 0.5) * 0.15, i, 0), pick(NATURE.salt, seed + i), { flat: true });
        box = { x: 0, y: S * 1.6, z: 0, w: S * 0.8, h: S * 3.2, d: S * 0.8 };
        break;
    case 'shards':
        for (let i = 0; i < 6; i++) {
            const a = r(i) * Math.PI * 2, d = r(i + 6) * S * 0.7, h = S * (0.5 + r(i + 12) * 0.9);
            k.geo(i % 3 === 0 ? 'glow' : 'body', new THREE.ConeGeometry(S * 0.14, h, 4), at(Math.cos(a) * d, h * 0.4, Math.sin(a) * d, (r(i) - 0.5) * 1.0, a, (r(i + 3) - 0.5) * 1.0), i % 3 === 0 ? NATURE.glassGlow : pick(NATURE.glass, seed + i), { flat: true });
        }
        break;
    }
    return { group: k.build(), boxes: [box] };
}
