// ============================================================
// ARCHITECTURE — the pieces a kingdom's towns are built from (phase 5)
// ============================================================
//
// Beyond the wall/floor/roof kit (TownModels.js): round towers, bridges,
// docks, town walls, gatehouses, tents, chimneys, lamp posts, banners,
// statues and fountains. Each takes a `style` from WALL_STYLES so a tower in
// Cindrel is basalt and one in Halcyra is marble.
//
// Like the kit, every builder returns { group, boxes } cut from the same
// numbers, so a model and its collider never drift apart. Things you walk on
// (bridge and dock decks, wall walks) are colliders too.
// ============================================================

import { THREE } from '../engine/lib.js';
import { Kit, at, seeded } from '../engine/Kit.js';
import { WORLD } from './Palette.js';
import { COURSED, TOWN } from './TownModels.js';

const pick = (arr, n) => arr[Math.floor(seeded(n) * arr.length) % arr.length];

// A style's main colours: [face, trim, top].
export function palette(style, seed = 1) {
    const C = COURSED[style];
    if (C) return [pick(C.cols, seed), C.cols[1], style === 'marble' ? 0xc8a85a : WORLD.stoneTop];
    return {
        timber: [TOWN.plaster[0], TOWN.beam, WORLD.timber[1]],
        plaster: [TOWN.plaster[1], TOWN.beam, WORLD.stoneTop],
        adobe: [0xc8a070, 0x8a6a48, 0xd0a878],
        driftwood: [0x9a9284, 0x5a5048, 0xa69e90],
    }[style] || [WORLD.stone[0], WORLD.stoneDark, WORLD.stoneTop];
}

/** A round tower: courses of its stone, slit windows, a cone, dome or crenellated top. */
export function towerModel({ height: H = 9, radius: R = 2.2, style = 'stone', top = 'cone', seed = 1 } = {}) {
    const k = new Kit();
    const [face, trim, cap] = palette(style, seed);
    const rings = Math.max(3, Math.round(H / 0.9));
    for (let i = 0; i < rings; i++) {
        const c = new THREE.Color(pick(COURSED[style]?.cols || [face], seed + i)); c.offsetHSL(0, 0, (seeded(seed * 3 + i) - 0.5) * 0.05);
        k.cyl('body', R * (1 - i * 0.004), R * (1 - (i - 1) * 0.004), H / rings + 0.02, 12, at(0, (i + 0.5) * H / rings, 0, 0, i * 0.13, 0), c, { flat: true });
    }
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + 0.3, y = H * (0.35 + 0.18 * (i % 3));
        k.box('sheen', 0.18, 0.9, 0.05, at(Math.cos(a) * (R + 0.01), y, Math.sin(a) * (R + 0.01), 0, -a + Math.PI / 2, 0), TOWN.glass);
    }
    k.cyl('body', R * 1.08, R * 1.08, 0.3, 12, at(0, H + 0.15, 0), trim, { flat: true });
    if (top === 'cone') k.cyl('body', 0.05, R * 1.25, R * 1.6, 12, at(0, H + 0.3 + R * 0.8, 0), style === 'marble' ? 0xb05a38 : TOWN.slate[0], { flat: true });
    else if (top === 'dome') k.geo('body', new THREE.SphereGeometry(R * 1.02, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), at(0, H + 0.3, 0), style === 'marble' ? 0xc8a85a : 0x5a9a88, { flat: true });
    else for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; if (i % 2 === 0) k.box('body', 0.7, 0.6, 0.35, at(Math.cos(a) * R, H + 0.6, Math.sin(a) * R, 0, -a + Math.PI / 2, 0), face, { ch: 0.03 }); }
    k.box('body', 1.1, 2.1, 0.2, at(0, 1.05, R - 0.02), WORLD.timber[1]);           // its door
    return { group: k.build(), boxes: [{ x: 0, y: H / 2, z: 0, w: R * 1.7, h: H, d: R * 1.7 }] };
}

/** A bridge between two banks at the same height: stone arches, a plank span, or a rope bridge. Its deck is walkable. */
export function bridgeModel({ length: L = 14, width: W = 3, rise = 1.2, drop = 0, style = 'stone', seed = 1 } = {}) {
    const k = new Kit();
    const boxes = [];
    const n = Math.max(4, Math.round(L / 1.5));
    // The deck: n segments along x following a gentle arc (rope: a sag), each a walkable box.
    // `drop`: how much higher the +x end stands than the -x end, so each end meets its own bank.
    const yAt = x => (style === 'rope' ? -rise * 0.6 * (1 - (2 * x / L) ** 2) : rise * (1 - (2 * x / L) ** 2)) + drop * x / L;
    for (let i = 0; i < n; i++) {
        const x0 = -L / 2 + i * L / n, x1 = x0 + L / n, y0 = yAt(x0), y1 = yAt(x1), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const len = Math.hypot(x1 - x0, y1 - y0) + 0.04, tilt = Math.atan2(y1 - y0, x1 - x0);
        const m = at(cx, cy + 0.1, 0, 0, 0, tilt);
        if (style === 'stone' || style === 'marble' || style === 'whitestone') k.box('body', len, 0.3, W, m, pick(COURSED[style === 'stone' ? 'stone' : style].cols, seed + i), { ch: 0.03 });
        else for (let p = 0; p < 4; p++) k.box('body', len / 4 - 0.03, 0.08, W - 0.1, new THREE.Matrix4().makeTranslation(cx, cy + 0.2, 0).multiply(new THREE.Matrix4().makeRotationZ(tilt)).multiply(at(-len / 2 + (p + 0.5) * len / 4, 0, 0)), pick(WORLD.timber, seed + i * 4 + p), { ch: 0.01 });
        boxes.push({ x: cx, y: cy + 0.1, z: 0, w: len, h: 0.3, d: W, rz: tilt });
        // Parapets or rails.
        for (const s of [-1, 1]) {
            if (style === 'rope') k.box('body', len, 0.04, 0.04, at(cx, cy + 1.0, s * W / 2, 0, 0, tilt), 0xc8b088);
            else if (style === 'plank') k.box('body', len, 0.08, 0.08, at(cx, cy + 1.0, s * W / 2, 0, 0, tilt), WORLD.timber[2]);
            else k.box('body', len, 0.55, 0.3, at(cx, cy + 0.5, s * (W / 2 - 0.1), 0, 0, tilt), pick(COURSED[style === 'stone' ? 'stone' : style].cols, seed + i + 9), { ch: 0.03 });
            if (style !== 'stone' && style !== 'marble' && style !== 'whitestone' && i % 2 === 0) k.box('body', 0.1, 1.1, 0.1, at(x0, y0 + 0.55, s * W / 2), WORLD.timber[1]);
        }
        boxes.push({ x: cx, y: cy + 0.7, z: -W / 2, w: len, h: 1.1, d: 0.15, rz: tilt }, { x: cx, y: cy + 0.7, z: W / 2, w: len, h: 1.1, d: 0.15, rz: tilt });
    }
    // Piers and arches under a stone bridge; posts under a plank one.
    if (style === 'stone' || style === 'marble' || style === 'whitestone') {
        for (const x of [-L / 2, L / 2]) k.box('body', 1.2, 3, W + 0.4, at(x, yAt(x) - 1.4, 0), pick(COURSED[style === 'stone' ? 'stone' : style].cols, seed + 30), { ch: 0.05 });
    } else if (style === 'plank') {
        for (let x = -L / 2 + 1.5; x < L / 2 - 1; x += 3) for (const s of [-1, 1]) k.box('body', 0.18, 4, 0.18, at(x, yAt(x) - 1.8, s * (W / 2 - 0.2)), WORLD.timber[0]);
    }
    return { group: k.build(), boxes };
}

/** A dock: planks on posts over water, `height` above the ground at its root. */
export function dockModel({ length: L = 10, width: W = 3, height: H = 1.2, seed = 1 } = {}) {
    const k = new Kit();
    const n = Math.max(3, Math.round(L / 0.35));
    for (let i = 0; i < n; i++) k.box('body', W, 0.07, L / n - 0.04, at(0, H, -L / 2 + (i + 0.5) * L / n), pick(WORLD.timber, seed + i), { ch: 0.01 });
    for (let z = -L / 2 + 0.5; z <= L / 2; z += 2.5) for (const s of [-1, 1]) k.box('body', 0.2, H + 2.5, 0.2, at(s * (W / 2 - 0.1), H / 2 - 1.2, z), 0x4a3a2a);
    k.box('body', 0.25, 0.4, 0.25, at(W / 2 - 0.2, H + 0.25, L / 2 - 0.3), 0x3a2e24);      // a mooring post
    return { group: k.build(), boxes: [{ x: 0, y: H, z: 0, w: W, h: 0.12, d: L }] };
}

/** A town wall: courses, crenellations, a walk on top. */
export function townWallModel({ length: L = 10, height: H = 5, style = 'stone', seed = 1 } = {}) {
    const k = new Kit();
    const C = COURSED[style] || COURSED.stone, th = 1.4;
    for (let y = 0, row = 0; y < H - 0.01; y += C.course, row++) {
        let x = -L / 2;
        while (x < L / 2 - 0.01) {
            const bw = Math.min(L / 2 - x, (row % 2 && x === -L / 2 ? C.len * 0.5 : C.len) + seeded(seed + x * 3 + row) * C.len * 0.6);
            k.box('body', bw - 0.03, Math.min(C.course, H - y) - 0.03, th, at(x + bw / 2, y + C.course / 2, 0), pick(C.cols, seed + x * 7 + row), { ch: 0.04, skipBottom: y > 0.01 });
            x += bw;
        }
    }
    for (let x = -L / 2 + 0.4; x < L / 2; x += 1.2) k.box('body', 0.7, 0.7, 0.35, at(x, H + 0.35, th / 2 - 0.15), pick(C.cols, seed + x), { ch: 0.04 });
    return { group: k.build(), boxes: [{ x: 0, y: H / 2, z: 0, w: L, h: H, d: th }, { x: 0, y: H + 0.35, z: th / 2 - 0.15, w: L, h: 0.7, d: 0.35 }] };
}

/** A gatehouse: two square towers and an arch between them. */
export function gatehouseModel({ width: W = 5, height: H = 7, style = 'stone', seed = 1 } = {}) {
    const k = new Kit();
    const C = COURSED[style] || COURSED.stone, tw = 2.6;
    const boxes = [];
    for (const s of [-1, 1]) {
        const x = s * (W / 2 + tw / 2);
        k.box('body', tw, H, tw, at(x, H / 2, 0), pick(C.cols, seed + s), { ch: 0.06 });
        for (let i = 0; i < 4; i++) k.box('body', 0.6, 0.6, 0.6, at(x + (i % 2 - 0.5) * 1.6, H + 0.3, (Math.floor(i / 2) - 0.5) * 1.6), pick(C.cols, seed + i), { ch: 0.04 });
        boxes.push({ x, y: H / 2, z: 0, w: tw, h: H, d: tw });
    }
    k.box('body', W + 0.4, H * 0.3, tw * 0.8, at(0, H * 0.85, 0), pick(C.cols, seed + 7), { ch: 0.06 });
    k.box('glow', 0.3, 0.3, 0.05, at(0, H * 0.82, tw * 0.4 + 0.03, 0, 0, Math.PI / 4), 0xffb347);
    boxes.push({ x: 0, y: H * 0.85, z: 0, w: W + 0.4, h: H * 0.3, d: tw * 0.8 });
    return { group: k.build(), boxes };
}

/** A caravan tent: poles, striped canvas, a door flap. */
export function tentModel({ size: S = 4, colour = 'red', seed = 1 } = {}) {
    const k = new Kit();
    const cols = { red: [0xa04a32, 0xd8c8a0], blue: [0x3a5a8a, 0xd8d0b8], ochre: [0xc08a3a, 0xe0d4b0], green: [0x4a6a3a, 0xd0c8a8] }[colour] || [0xa04a32, 0xd8c8a0];
    // A cone of striped canvas: one triangle per panel from the pole's top to the ground ring, and a low wall below.
    const n = 10, H = S * 0.75, R = S / 2, top = new THREE.Vector3(0, H, 0), wall = 0.6;
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        const p0 = new THREE.Vector3(Math.cos(a0) * R, wall, Math.sin(a0) * R), p1 = new THREE.Vector3(Math.cos(a1) * R, wall, Math.sin(a1) * R);
        k.poly('body', [top, p0, p1], cols[i % 2], new THREE.Vector3(0, H * 0.3, 0));
        k.poly('body', [p0, p1, p1.clone().setY(0), p0.clone().setY(0)], cols[(i + 1) % 2], new THREE.Vector3(0, wall / 2, 0));
    }
    k.box('body', 1.0, 1.6, 0.05, at(0, 0.8, R + 0.02), 0x3a2a1e);      // the doorway's shadow
    k.cyl('body', 0.05, 0.06, H + 0.6, 5, at(0, (H + 0.6) / 2, 0), WORLD.timber[1], { flat: true });
    k.box('body', 0.1, 0.4, 0.02, at(0, H + 0.6, 0.06), cols[0]);       // a pennant
    return { group: k.build(), boxes: [{ x: 0, y: H * 0.4, z: 0, w: S * 0.9, h: H * 0.8, d: S * 0.9 }] };
}

/** A forge chimney: a brick stack with a glowing mouth. */
export function chimneyModel({ height: H = 6, seed = 1 } = {}) {
    const k = new Kit();
    for (let i = 0; i < Math.round(H / 0.5); i++) k.box('body', 1.1 - i * 0.02, 0.5, 1.1 - i * 0.02, at(0, 0.25 + i * 0.5, 0, 0, i * 0.04, 0), pick(COURSED.brick.cols, seed + i), { ch: 0.02 });
    k.box('glow', 0.7, 0.1, 0.7, at(0, H + 0.02, 0), 0xff7a2a);
    return { group: k.build(), boxes: [{ x: 0, y: H / 2, z: 0, w: 1.1, h: H, d: 1.1 }] };
}

/** A lamp post: iron, a glass lantern that glows (Halcyra, Lanthe's bridges, Vaelmont's stairs). */
export function lampModel({ height: H = 3.2 } = {}) {
    const k = new Kit();
    k.cyl('body', 0.05, 0.08, H, 6, at(0, H / 2, 0), WORLD.iron, { flat: true });
    k.box('body', 0.4, 0.06, 0.06, at(0.15, H - 0.1, 0), WORLD.iron);
    k.box('glow', 0.2, 0.3, 0.2, at(0.3, H - 0.35, 0), 0xffd68a);
    return { group: k.build(), boxes: [{ x: 0, y: H / 2, z: 0, w: 0.2, h: H, d: 0.2 }] };
}

/** A banner on a pole: a kingdom's colours. */
export function bannerModel({ height: H = 5, colour = 'green', seed = 1 } = {}) {
    const k = new Kit();
    const c = { green: 0x3a6a3a, red: 0x8a2a24, blue: 0x2a4a7a, white: 0xe8e4da, gold: 0xc8a85a, ochre: 0xb8803a, sky: 0x7aa8c8 }[colour] || 0x3a6a3a;
    k.cyl('body', 0.05, 0.07, H, 6, at(0, H / 2, 0), WORLD.timber[1], { flat: true });
    k.box('body', 0.9, 0.06, 0.06, at(0.45, H - 0.15, 0), WORLD.timber[1]);
    for (let i = 0; i < 4; i++) k.box('body', 0.8, 0.45, 0.03, at(0.45 + Math.sin(i + seed) * 0.03, H - 0.45 - i * 0.44, 0, 0, Math.sin(i * 1.3 + seed) * 0.12, 0), c);
    return { group: k.build(), boxes: [{ x: 0, y: H / 2, z: 0, w: 0.15, h: H, d: 0.15 }] };
}

/** A statue on a plinth: an Oruun figure, robed and faceless, a hand raised. */
export function statueModel({ height: H = 4, style = 'stone', seed = 1 } = {}) {
    const k = new Kit();
    const [face, , cap] = palette(style, seed);
    k.box('body', 1.6, 1, 1.6, at(0, 0.5, 0), face, { ch: 0.06, top: cap });
    const s = (H - 1) / 3;
    k.cyl('body', 0.35 * s, 0.6 * s, 2 * s, 8, at(0, 1 + s, 0), face, { flat: true });
    k.geo('body', new THREE.IcosahedronGeometry(0.3 * s, 0), at(0, 1 + 2.25 * s, 0), face, { flat: true });
    k.box('body', 0.15 * s, 0.9 * s, 0.15 * s, at(0.35 * s, 1 + 2.3 * s, 0, 0, 0, -0.3), face);
    k.box('glow', 0.2, 0.2, 0.02, at(0, 1 + 1.4 * s, 0.4 * s), 0xffb347);
    return { group: k.build(), boxes: [{ x: 0, y: 0.5, z: 0, w: 1.6, h: 1, d: 1.6 }, { x: 0, y: 1 + s, z: 0, w: 1, h: 2 * s, d: 1 }] };
}

/** A fountain: a round basin and a tiered spout (Halcyra's squares). */
export function fountainModel({ radius: R = 2.5, style = 'marble', seed = 1 } = {}) {
    const k = new Kit();
    const [face, , cap] = palette(style, seed);
    k.cyl('body', R, R + 0.1, 0.7, 16, at(0, 0.35, 0), face, { flat: true });
    k.cyl('sheen', R - 0.25, R - 0.25, 0.05, 16, at(0, 0.62, 0), 0x3a8ab0, { flat: true });
    k.cyl('body', 0.3, 0.45, 1.6, 8, at(0, 1.1, 0), face, { flat: true });
    k.cyl('body', 0.9, 0.7, 0.25, 10, at(0, 1.9, 0), cap, { flat: true });
    k.cyl('sheen', 0.25, 0.1, 0.8, 6, at(0, 2.4, 0), 0x8ad0f0, { flat: true });
    return { group: k.build(), boxes: [{ x: 0, y: 0.35, z: 0, w: R * 1.8, h: 0.7, d: R * 1.8 }, { x: 0, y: 1.2, z: 0, w: 0.9, h: 2, d: 0.9 }] };
}
