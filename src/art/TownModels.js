// ============================================================
// TOWN MODELS — the building kit, trees, stalls, gates and ground
// ============================================================
//
// The pieces towns are made of (docs/SCENES.md). Like PropModels, every
// builder returns the group AND the boxes its collider is made from, in the
// model's own frame, so the two are cut from the same numbers.
//
//   boxes: [{ x, y, z, w, h, d, rx? }]   centre, size, optional tilt about X
//
// Walls run along X and face +Z. Openings (door, window, arch) cut the wall
// into solid rectangles; each rectangle is built and collided separately.
// ============================================================

import { THREE } from '../engine/lib.js';
import { Kit, at, seeded } from '../engine/Kit.js';
import { WORLD, ELEMENT } from './Palette.js';

const pick = (arr, n) => arr[Math.floor(seeded(n) * arr.length) % arr.length];

export const TOWN = {
    plaster: [0xd9ccae, 0xd2c4a4, 0xe0d4b8],
    plasterDark: 0xb8a988,
    beam: 0x4a3524,
    thatch: [0xb89a5a, 0xa98c4f, 0xc4a766],
    slate: [0x4f5761, 0x5a626c, 0x464d56],
    shingle: [0x6e4a32, 0x7a553a, 0x644330],
    glass: 0x28384a,
    dirt: 0x6b5842,
    sand: 0xc9b48a,
    cobble: [0x76716a, 0x6c675f, 0x817b72],
};

const T = 0.3;   // wall thickness

// ---- walls -------------------------------------------------------------------

function _openings(L, H, opening) {
    const door = x => ({ x, w: 1.2, y0: 0, y1: Math.min(2.2, H - 0.3), kind: 'door' });
    const win = x => ({ x, w: 0.9, y0: Math.min(1.0, H * 0.35), y1: Math.min(1.9, H - 0.35), kind: 'window' });
    switch (opening) {
    case 'door': return L >= 1.8 ? [door(0)] : [];
    case 'window': return L >= 1.4 ? [win(0)] : [];
    case 'two windows': return L >= 3.4 ? [win(-L / 4), win(L / 4)] : L >= 1.4 ? [win(0)] : [];
    case 'arch': return L >= 2 ? [{ x: 0, w: Math.min(2.4, L - 1), y0: 0, y1: Math.min(2.8, H - 0.4), kind: 'arch' }] : [];
    default: return [];
    }
}

// The wall minus its openings, as rectangles { x0, x1, y0, y1 }.
function _solids(L, H, holes) {
    const rects = [];
    const xs = [-L / 2];
    const sorted = holes.slice().sort((a, b) => a.x - b.x);
    let x = -L / 2;
    for (const o of sorted) {
        const a = o.x - o.w / 2, b = o.x + o.w / 2;
        if (a > x + 0.01) rects.push({ x0: x, x1: a, y0: 0, y1: H });
        if (o.y0 > 0.01) rects.push({ x0: a, x1: b, y0: 0, y1: o.y0 });
        if (o.y1 < H - 0.01) rects.push({ x0: a, x1: b, y0: o.y1, y1: H });
        x = b;
        xs.push(a, b);
    }
    if (x < L / 2 - 0.01) rects.push({ x0: x, x1: L / 2, y0: 0, y1: H });
    return rects;
}

export function buildingWall({ length: L = 4, height: H = 3, style = 'stone', opening = 'none', seed = 1 } = {}) {
    const k = new Kit();
    const holes = _openings(L, H, opening);
    const rects = _solids(L, H, holes);
    const boxes = [];
    let n = seed * 17;
    for (const r of rects) {
        const w = r.x1 - r.x0, h = r.y1 - r.y0, cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
        boxes.push({ x: cx, y: cy, z: 0, w, h, d: T });
        if (style === 'stone') {
            // Coursed blocks, a little uneven.
            const course = 0.5;
            for (let y = r.y0, row = 0; y < r.y1 - 0.01; y += course, row++) {
                const ch = Math.min(course, r.y1 - y);
                let x = r.x0;
                while (x < r.x1 - 0.01) {
                    n++;
                    const bw = Math.min(r.x1 - x, (row % 2 && x === r.x0 ? 0.4 : 0.7) + seeded(n * 1.9) * 0.5);
                    const col = new THREE.Color(pick(WORLD.stone, n * 2.3));
                    col.offsetHSL(0, 0, (seeded(n * 3.9) - 0.5) * 0.07);
                    k.box('body', bw - 0.03, ch - 0.03, T, at(x + bw / 2, y + ch / 2, 0), col, { ch: 0.04, skipBottom: y > 0.01 });
                    x += bw;
                }
            }
        } else {
            // Plaster over a stone plinth; timber frames it (half-timbered) or tops it.
            const plinth = Math.min(0.45, h);
            if (r.y0 < 0.01) k.box('body', w, plinth, T + 0.04, at(cx, plinth / 2, 0), WORLD.stoneDark, { ch: 0.03 });
            const py0 = Math.max(r.y0, r.y0 < 0.01 ? plinth : r.y0);
            if (r.y1 - py0 > 0.02) k.box('body', w, r.y1 - py0, T, at(cx, (py0 + r.y1) / 2, 0), pick(TOWN.plaster, seed), { skipBottom: true });
            if (style === 'timber') {
                const beam = (x, y, bw, bh, rz = 0) => {
                    for (const zs of [1, -1]) k.box('body', bw, bh, 0.05, at(x, y, zs * (T / 2 + 0.02), 0, 0, rz), TOWN.beam, { ch: 0.01 });
                };
                const posts = Math.max(1, Math.round(w / 1.2));
                for (let i = 0; i <= posts; i++) beam(r.x0 + (w * i) / posts, cy, 0.14, h);
                if (r.y0 < 1.5 && r.y1 > 1.5) beam(cx, 1.5, w, 0.12);
                if (r.y1 >= H - 0.01) beam(cx, H - 0.07, w, 0.14);
                if (w > 1 && h > 1.2 && seeded(seed + r.x0) > 0.35) {
                    const bw = w / posts, by = (Math.max(py0, 1.5) + r.y1) / 2, bh = r.y1 - Math.max(py0, 1.5);
                    if (bh > 0.6) beam(r.x0 + bw / 2, by, Math.hypot(bw, bh) - 0.1, 0.1, Math.atan2(bh, bw));
                }
            } else if (r.y1 >= H - 0.01) {
                k.box('body', w, 0.18, T + 0.08, at(cx, H - 0.09, 0), TOWN.beam, { ch: 0.02 });
            }
        }
    }
    // Opening trims.
    for (const o of holes) {
        if (o.kind === 'door') {
            for (const sx of [-1, 1]) k.box('body', 0.12, o.y1, T + 0.08, at(o.x + sx * (o.w / 2 + 0.03), o.y1 / 2, 0), TOWN.beam, { ch: 0.02 });
            k.box('body', o.w + 0.3, 0.16, T + 0.1, at(o.x, o.y1 + 0.08, 0), TOWN.beam, { ch: 0.02 });
            // The door leaf, standing open against the inside of the wall.
            const leaf = new THREE.Matrix4().makeTranslation(o.x - o.w / 2, 0, -T / 2)
                .multiply(new THREE.Matrix4().makeRotationY(-1.35)).multiply(at(o.w / 2, o.y1 / 2 - 0.02, -0.04));
            k.box('body', o.w - 0.06, o.y1 - 0.06, 0.07, leaf, WORLD.timber[1], { ch: 0.015 });
        } else if (o.kind === 'window') {
            const h = o.y1 - o.y0;
            for (const sx of [-1, 1]) k.box('body', 0.1, h + 0.1, T + 0.06, at(o.x + sx * (o.w / 2 + 0.02), (o.y0 + o.y1) / 2, 0), TOWN.beam, { ch: 0.015 });
            k.box('body', o.w + 0.3, 0.1, T + 0.2, at(o.x, o.y0 - 0.02, 0.02), WORLD.stoneTop, { ch: 0.02 });
            k.box('body', o.w + 0.2, 0.1, T + 0.06, at(o.x, o.y1 + 0.03, 0), TOWN.beam, { ch: 0.015 });
            k.box('sheen', o.w, h, 0.03, at(o.x, (o.y0 + o.y1) / 2, 0), TOWN.glass);
            k.box('body', 0.05, h, 0.05, at(o.x, (o.y0 + o.y1) / 2, 0.02), TOWN.beam);
            // Shutters, folded back on the front face.
            for (const sx of [-1, 1]) k.box('body', o.w / 2, h, 0.05, at(o.x + sx * (o.w * 0.75 + 0.1), (o.y0 + o.y1) / 2, T / 2 + 0.05), pick(WORLD.timber, seed + sx), { ch: 0.01 });
            boxes.push({ x: o.x, y: (o.y0 + o.y1) / 2, z: 0, w: o.w, h, d: 0.1 });   // glass stops rocks
        } else if (o.kind === 'arch') {
            for (const sx of [-1, 1]) k.box('body', 0.3, o.y1, T + 0.12, at(o.x + sx * (o.w / 2 + 0.1), o.y1 / 2, 0), WORLD.stone[3], { ch: 0.04, top: WORLD.stoneTop });
            k.box('body', o.w + 0.6, 0.35, T + 0.14, at(o.x, o.y1 + 0.17, 0), WORLD.stone[1], { ch: 0.05 });
            k.box('glow', 0.18, 0.18, 0.02, at(o.x, o.y1 + 0.17, T / 2 + 0.08, 0, 0, Math.PI / 4), ELEMENT.earth.rune);
        }
    }
    return { group: k.build(), boxes };
}

export function buildingFloor({ width: W = 4, depth: D = 4, style = 'planks' } = {}) {
    const k = new Kit();
    const th = 0.2;
    if (style === 'planks') {
        k.box('body', W, th - 0.03, D, at(0, -0.015, 0), TOWN.beam, { skipBottom: false });
        const n = Math.max(1, Math.round(W / 0.3));
        for (let i = 0; i < n; i++) {
            const pw = W / n;
            k.box('body', pw - 0.02, 0.03, D - 0.02, at(-W / 2 + pw * (i + 0.5), th / 2 - 0.015, 0), pick(WORLD.timber, i * 3.3), { ch: 0.005 });
        }
    } else if (style === 'stone') {
        k.box('body', W, th - 0.03, D, at(0, -0.015, 0), 0x4c4841, { skipBottom: false });
        let n = 0;
        for (let x = -W / 2; x < W / 2 - 0.01; x += 1) for (let z = -D / 2; z < D / 2 - 0.01; z += 1) {
            n++;
            const w = Math.min(1, W / 2 - x), d = Math.min(1, D / 2 - z);
            k.box('body', w - 0.05, 0.04, d - 0.05, at(x + w / 2, th / 2 - 0.02, z + d / 2), pick(WORLD.flag, n * 2.7), { ch: 0.01 });
        }
    } else {
        k.box('body', W, th, D, at(0, 0, 0), TOWN.dirt, { skipBottom: false });
    }
    return { group: k.build(), boxes: [{ x: 0, y: 0, z: 0, w: W, h: th, d: D }] };
}

export function buildingRoof({ width: W = 4, depth: D = 4, pitch: P = 1.8, style = 'thatch', gables = true } = {}) {
    const k = new Kit();
    const half = D / 2, S = Math.hypot(half, P), a = Math.atan2(P, half);
    const th = style === 'thatch' ? 0.32 : 0.14;
    const cols = { thatch: TOWN.thatch, slate: TOWN.slate, shingle: TOWN.shingle }[style] || TOWN.thatch;
    const boxes = [];
    for (const s of [1, -1]) {
        // Tilt about X: the slope rises from the eave at z = ±D/2 to the ridge.
        const slope = (y, z, w, h, d, col, ch = 0.03) => k.box('body', w, h, d,
            new THREE.Matrix4().makeTranslation(0, P / 2, s * half / 2).multiply(new THREE.Matrix4().makeRotationX(s * a)).multiply(at(0, y, z)), col, { ch, skipBottom: false });
        slope(0, 0, W, th, S + 0.1, cols[0]);
        // Courses: tiles, shingles or bands of straw, proud of the slope.
        const rows = Math.max(2, Math.round(S / (style === 'thatch' ? 0.45 : 0.3)));
        for (let i = 0; i < rows; i++) {
            const z = -S / 2 + (i + 0.5) * (S / rows);
            slope(th / 2 + 0.02, z, W + 0.02, 0.05, S / rows - 0.03, cols[(i + 1) % cols.length], 0.01);
        }
        boxes.push({ x: 0, y: P / 2, z: s * half / 2, w: W, h: th, d: S, rx: s * a });
    }
    // Ridge.
    k.box('body', W + 0.1, 0.18, 0.28, at(0, P + 0.02, 0), style === 'thatch' ? cols[2] : TOWN.beam, { ch: 0.04 });
    if (gables) {
        for (const sx of [-1, 1]) {
            const m = new THREE.Matrix4().makeTranslation(sx * (W / 2 - 0.35), 0, 0).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
            k.prism('body', D - 0.5, P - 0.2, 0.2, m, TOWN.plaster[0]);
            k.box('body', 0.12, P, 0.12, new THREE.Matrix4().makeTranslation(sx * (W / 2 - 0.3), P / 2, 0), TOWN.beam);
        }
    }
    return { group: k.build(), boxes };
}

export function buildingStairs({ width: W = 1.2, rise: R = 3, style = 'stone' } = {}) {
    const k = new Kit();
    const n = Math.max(2, Math.round(R / 0.25)), sh = R / n, run = 0.3;
    for (let i = 0; i < n; i++) {
        const col = style === 'stone' ? pick(WORLD.stone, i * 1.7) : pick(WORLD.timber, i * 1.7);
        k.box('body', W, sh * (i + 1), run, at(0, sh * (i + 1) / 2, -i * run - run / 2), col, { ch: 0.02, top: style === 'stone' ? WORLD.stoneTop : null });
    }
    // One ramp collider: the hero walks up it; rocks tumble down it.
    const len = n * run, ang = Math.atan2(R, len), L = Math.hypot(R, len);
    return { group: k.build(), boxes: [{ x: 0, y: R / 2 - 0.1, z: -len / 2, w: W, h: 0.2, d: L, rx: ang }] };
}

export function buildingFence({ length: L = 4, height: H = 1.1, seed = 1 } = {}) {
    const k = new Kit();
    const n = Math.max(1, Math.round(L / 1.5));
    for (let i = 0; i <= n; i++) k.box('body', 0.12, H, 0.12, at(-L / 2 + (L * i) / n, H / 2, 0), pick(WORLD.timber, seed + i), { ch: 0.02 });
    for (const y of [H * 0.35, H * 0.8]) k.box('body', L, 0.09, 0.06, at(0, y, 0.06), pick(WORLD.timber, seed + y), { ch: 0.01 });
    return { group: k.build(), boxes: [{ x: 0, y: H / 2, z: 0, w: L, h: H, d: 0.15 }] };
}

export function buildingPost({ height: H = 3, style = 'timber' } = {}) {
    const k = new Kit();
    if (style === 'stone') {
        k.box('body', 0.45, H, 0.45, at(0, H / 2, 0), WORLD.stone[1], { ch: 0.05, top: WORLD.stoneTop });
    } else {
        k.box('body', 0.22, H, 0.22, at(0, H / 2, 0), WORLD.timber[1], { ch: 0.03 });
        k.box('body', 0.3, 0.12, 0.3, at(0, 0.06, 0), WORLD.stoneDark, { ch: 0.02 });
    }
    const w = style === 'stone' ? 0.45 : 0.22;
    return { group: k.build(), boxes: [{ x: 0, y: H / 2, z: 0, w, h: H, d: w }] };
}

// ---- nature and props -----------------------------------------------------------

export function tree({ height: H = 5, kind = 'oak', seed = 1 } = {}) {
    const k = new Kit();
    const trunkH = kind === 'pine' ? H * 0.35 : H * 0.5;
    const r = 0.16 + H * 0.02;
    k.cyl('body', r * 0.75, r, trunkH + 0.3, 7, at(0, (trunkH + 0.3) / 2, 0, 0, seed, 0), WORLD.timber[2], { flat: true });
    if (kind === 'oak') {
        const n = 4 + Math.floor(seeded(seed) * 3);
        for (let i = 0; i < n; i++) {
            const a = seeded(seed * 3 + i) * Math.PI * 2, d = i === 0 ? 0 : 0.5 + seeded(seed + i * 1.3) * H * 0.12;
            const s = H * (0.16 + seeded(seed * 5 + i) * 0.07);
            k.geo('body', new THREE.IcosahedronGeometry(s, 0), at(Math.cos(a) * d, trunkH + s * 0.7 + seeded(i * 2.1 + seed) * H * 0.12, Math.sin(a) * d, i, i * 2, 0), pick(WORLD.moss, seed + i), { flat: true });
        }
    } else if (kind === 'pine') {
        const tiers = 4;
        for (let i = 0; i < tiers; i++) {
            const y = trunkH * 0.7 + i * (H - trunkH * 0.7) / tiers;
            const rad = (H * 0.28) * (1 - i / (tiers + 0.5));
            k.cyl('body', 0.02, rad, (H - trunkH) / tiers * 1.5, 8, at(0, y + (H - trunkH) / tiers * 0.6, 0, 0, i + seed, 0), 0x3f5a34 + i * 0x020201, { flat: true });
        }
    } else {
        for (let i = 0; i < 4; i++) {
            const a = seeded(seed * 3 + i) * Math.PI * 2, tilt = 0.6 + seeded(i + seed) * 0.4, len = H * 0.3;
            k.cyl('body', 0.04, 0.09, len, 5, new THREE.Matrix4().makeTranslation(0, trunkH * (0.6 + i * 0.12), 0)
                .multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationZ(tilt)).multiply(at(0, len / 2, 0)), WORLD.timberDark, { flat: true });
        }
    }
    return { group: k.build(), boxes: [{ x: 0, y: trunkH / 2 + 0.15, z: 0, w: r * 2, h: trunkH + 0.3, d: r * 2 }] };
}

export function stall({ width: W = 2.4, awning = 'red', seed = 1 } = {}) {
    const k = new Kit();
    const cloth = { red: 0x9a3a2e, blue: 0x2f5a82, green: 0x46703a, ochre: 0xb8862e }[awning] || 0x9a3a2e;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('body', 0.1, sz > 0 ? 2.1 : 2.5, 0.1, at(sx * W / 2, (sz > 0 ? 2.1 : 2.5) / 2, sz * 0.6), WORLD.timber[1], { ch: 0.015 });
    k.box('body', W + 0.1, 0.9, 0.7, at(0, 0.45, 0.35), pick(WORLD.timber, seed), { ch: 0.03 });
    k.box('body', W + 0.2, 0.06, 0.8, at(0, 0.92, 0.35), WORLD.timber[2], { ch: 0.01 });
    const tilt = Math.atan2(0.4, 1.4);
    const n = 6;
    for (let i = 0; i < n; i++) {
        const w = (W + 0.4) / n;
        k.box('body', w, 0.04, 1.6, at(-W / 2 - 0.2 + w * (i + 0.5), 2.35, 0, tilt, 0, 0), i % 2 ? cloth : 0xe6dcc6, { ch: 0.01 });
    }
    // Goods: a few sacks and crates of colour.
    for (let i = 0; i < 4; i++) {
        const x = -W / 2 + 0.35 + i * (W - 0.7) / 3;
        k.box('body', 0.34, 0.2, 0.3, at(x, 1.05, 0.35, 0, seeded(i + seed), 0), [0xb06a32, 0x8a9a3a, 0xc9b06a, 0x7a3a4a][(i + seed) % 4], { ch: 0.05 });
    }
    return { group: k.build(), boxes: [{ x: 0, y: 0.45, z: 0.35, w: W + 0.1, h: 0.9, d: 0.7 }] };
}

/** A portcullis between two stone posts. The grille is returned separately: it slides. */
export function gate({ width: W = 4, height: H = 3.6 } = {}) {
    const k = new Kit();
    for (const sx of [-1, 1]) k.box('body', 0.6, H + 0.6, 0.8, at(sx * (W / 2 + 0.3), (H + 0.6) / 2, 0), WORLD.stone[1], { ch: 0.06, top: WORLD.stoneTop });
    k.box('body', W + 1.4, 0.6, 0.9, at(0, H + 0.3, 0), WORLD.stone[3], { ch: 0.08, top: WORLD.stoneTop });
    k.box('glow', 0.2, 0.2, 0.02, at(0, H + 0.3, 0.46, 0, 0, Math.PI / 4), ELEMENT.earth.rune);
    const g = new Kit();
    const bars = Math.max(2, Math.round(W / 0.4));
    for (let i = 0; i <= bars; i++) g.box('body', 0.07, H, 0.07, at(-W / 2 + (W * i) / bars, H / 2, 0), WORLD.iron, { ch: 0.01 });
    for (let y = 0.5; y < H; y += 0.7) g.box('body', W, 0.08, 0.08, at(0, y, 0.02), WORLD.iron, { ch: 0.01 });
    for (let i = 0; i <= bars; i++) g.cyl('body', 0.0, 0.06, 0.18, 4, at(-W / 2 + (W * i) / bars, -0.06, 0, Math.PI, 0, 0), WORLD.iron);
    return {
        group: k.build(), grille: g.build(),
        boxes: [-1, 1].map(sx => ({ x: sx * (W / 2 + 0.3), y: (H + 0.6) / 2, z: 0, w: 0.6, h: H + 0.6, d: 0.8 })).concat([{ x: 0, y: H + 0.3, z: 0, w: W + 1.4, h: 0.6, d: 0.9 }]),
        grilleBox: { x: 0, y: H / 2, z: 0, w: W, h: H, d: 0.2 },
        posts: [-1, 1].map(sx => new THREE.Vector3(sx * (W / 2 + 0.3), H + 0.6, 0)),
    };
}

// ---- ground -------------------------------------------------------------------------

const GROUND = { grass: WORLD.grass, dirt: [TOWN.dirt, 0x735f47, 0x5f4e3a], sand: [TOWN.sand, 0xc2ad83, 0xd1bd94], cobble: TOWN.cobble, flagstone: WORLD.flag };

/** A flat patch laid on the ground: grass, dirt, cobbles, sand or flagstones. */
export function groundPatch({ width: W = 6, depth: D = 6, style = 'grass', round = false } = {}, seed = 1) {
    const k = new Kit();
    k.shadows = false;
    const cols = GROUND[style] || GROUND.grass;
    const inside = (x, z) => !round || (x * x) / (W * W / 4) + (z * z) / (D * D / 4) <= 1;
    if (round) k.cyl('body', 0.5, 0.5, 0.03, 28, at(0, 0.03, 0, 0, 0, 0, W, 1, D), cols[0]);
    else k.box('body', W, 0.03, D, at(0, 0.03, 0), cols[0]);
    if (style === 'cobble' || style === 'flagstone') {
        const s = style === 'cobble' ? 0.45 : 1.0;
        let n = seed * 11;
        for (let x = -W / 2 + s / 2; x < W / 2; x += s) for (let z = -D / 2 + s / 2; z < D / 2; z += s) {
            n++;
            if (!inside(x, z)) continue;
            const w = s - 0.06 - seeded(n) * 0.05;
            k.box('body', w, 0.04, w, at(x, 0.06, z, 0, (seeded(n * 1.3) - 0.5) * 0.3, 0), pick(cols, n * 2.1), { ch: 0.012 });
        }
    } else {
        // Tufts, stones or ripples to break up the flat colour.
        const n = Math.min(200, Math.floor(W * D * 0.5));
        for (let i = 0; i < n; i++) {
            const x = (seeded(seed + i * 1.7) - 0.5) * W, z = (seeded(seed + i * 2.9) - 0.5) * D;
            if (!inside(x, z)) continue;
            if (style === 'grass') k.box('body', 0.08, 0.14 + seeded(i) * 0.12, 0.08, at(x, 0.1, z, 0.2, i, 0.2), pick(cols, i + 1));
            else k.box('body', 0.25 + seeded(i) * 0.3, 0.02, 0.2, at(x, 0.05, z, 0, i, 0), pick(cols, i + 1));
        }
    }
    return { group: k.build() };
}

/** The scene's base ground, `half` metres each way from the centre. */
export function groundBase(half, style) {
    const k = new Kit();
    k.shadows = false;
    const cols = GROUND[style] || GROUND.grass;
    k.box('body', half * 2, 0.1, half * 2, at(0, -0.05, 0), cols[0]);
    const tile = 4;
    let n = 0;
    for (let x = -half + tile / 2; x < half; x += tile) for (let z = -half + tile / 2; z < half; z += tile) {
        n++;
        const col = new THREE.Color(pick(cols, n * 3.3));
        col.offsetHSL(0, 0, (seeded(n * 4.9) - 0.5) * 0.015);
        k.box('body', tile + 0.01, 0.02, tile + 0.01, at(x, 0.0, z), col);
        if (style === 'grass') for (let i = 0; i < 6; i++) {
            k.box('body', 0.08, 0.16, 0.08, at(x + (seeded(n + i * 1.7) - 0.5) * tile, 0.08, z + (seeded(n + i * 2.3) - 0.5) * tile, 0.2, i, 0.2), pick(cols, n + i));
        }
    }
    return k.build();
}
