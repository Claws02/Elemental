// ============================================================
// TERRAIN — the ground as a height field (phase 5)
// ============================================================
//
// A scene with settings.terrain stands on a square of land `size` metres
// across, sampled every `cell` metres:
//
//   heights   one per grid point, in centimetres (Int16, base64 in the file)
//   paint     one surface per grid point (Uint8 index into SURFACES)
//
// Drawn as square chunks (each its own mesh, so the camera culls what it
// can't see), flat-shaded like the rest of the world, each triangle the
// colour of its surfaces. Physics is one cannon Heightfield.
//
// Everything that needs to know where the ground is asks Ground
// (world/Ground.js), which answers from the terrain, or 0 on a flat scene.
//
// The editor sculpts the same data with brushes (raise, lower, smooth,
// flatten, paint) and rebuilds the chunks it touched: rebuild(i0, j0, i1, j1).
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { kitMaterials, seeded } from '../engine/Kit.js';

/** What the ground can be painted. Order is the file format: append only. */
export const SURFACES = [
    { key: 'grass',  name: 'Grass',      col: [0x5f7d3c, 0x6a8a44, 0x55723a] },
    { key: 'dirt',   name: 'Dirt',       col: [0x7a6248, 0x6e5840, 0x846a4e] },
    { key: 'rock',   name: 'Rock',       col: [0x7b7468, 0x857d70, 0x6f685d] },
    { key: 'sand',   name: 'Sand',       col: [0xcdb88a, 0xc4ae80, 0xd6c296] },
    { key: 'snow',   name: 'Snow',       col: [0xe8eef2, 0xdfe6ec, 0xf2f6f8] },
    { key: 'ash',    name: 'Ash',        col: [0x3e3a38, 0x47423f, 0x353230] },
    { key: 'glass',  name: 'Glass',      col: [0x9fc8c4, 0xb4d8d2, 0x8ab8b6] },
    { key: 'cobble', name: 'Cobbles',    col: [0x8a8478, 0x7e786c, 0x948e82] },
    { key: 'salt',   name: 'Salt flat',  col: [0xe6e0d4, 0xdcd6ca, 0xeee8dc] },
    { key: 'moss',   name: 'Deep moss',  col: [0x3f5a2c, 0x486434, 0x384f28] },
    { key: 'basalt', name: 'Basalt',     col: [0x2e2c2e, 0x353236, 0x28262a] },
    { key: 'mud',    name: 'Mud',        col: [0x4a3826, 0x52402c, 0x433220] },
];
export const SURFACE_INDEX = Object.fromEntries(SURFACES.map((s, i) => [s.key, i]));

const CHUNK = 30;               // cells per chunk side

// ---- the file format -------------------------------------------------------------------------------
const b64 = typeof btoa === 'function' ? { enc: s => btoa(s), dec: s => atob(s) } : { enc: s => Buffer.from(s, 'binary').toString('base64'), dec: s => Buffer.from(s, 'base64').toString('binary') };
function bytesToB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return b64.enc(s); }
function b64ToBytes(str) { const s = b64.dec(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

/** A blank terrain's data: flat at 0, all `surface`. */
export function blankTerrain(size = 240, cell = 2, surface = 'grass') {
    const n = Math.round(size / cell) + 1;
    return encodeTerrain({ size, cell, n, h: new Float32Array(n * n), p: new Uint8Array(n * n).fill(SURFACE_INDEX[surface] ?? 0) });
}

/** { size, cell, n, h: Float32Array metres, p: Uint8Array } → the scene file's settings.terrain. */
export function encodeTerrain({ size, cell, n, h, p }) {
    const cm = new Int16Array(n * n);
    for (let i = 0; i < cm.length; i++) cm[i] = Math.max(-32000, Math.min(32000, Math.round(h[i] * 100)));
    return { size, cell, heights: bytesToB64(new Uint8Array(cm.buffer)), paint: bytesToB64(p) };
}

/** The scene file's settings.terrain → { size, cell, n, h, p }. */
export function decodeTerrain(t) {
    const n = Math.round(t.size / t.cell) + 1;
    const raw = b64ToBytes(t.heights);
    const cm = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1);
    const h = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) h[i] = (cm[i] || 0) / 100;
    const p = t.paint ? b64ToBytes(t.paint) : new Uint8Array(n * n);
    return { size: t.size, cell: t.cell, n, h, p: p.length === n * n ? p : new Uint8Array(n * n) };
}

export class Terrain {
    /** @param {object} data  decoded ({ size, cell, n, h, p }) */
    constructor(data) {
        Object.assign(this, data);
        this.half = this.size / 2;
        this.group = null;           // made when built (queries alone don't need it)
        this.chunks = new Map();
        this.entry = null;
    }

    // ---- queries ------------------------------------------------------------------------
    idx(i, j) { return j * this.n + i; }
    /** Grid coordinates (fractional) of a world point. */
    grid(x, z) { return [(x + this.half) / this.cell, (z + this.half) / this.cell]; }
    inside(x, z) { return Math.abs(x) <= this.half && Math.abs(z) <= this.half; }

    /** Ground height at (x, z), following the triangles as drawn (outside: the nearest edge). */
    height(x, z) {
        let [gx, gz] = this.grid(x, z);
        const m = this.n - 1;
        gx = Math.max(0, Math.min(m - 1e-6, gx)); gz = Math.max(0, Math.min(m - 1e-6, gz));
        const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
        const h = this.h, n = this.n;
        const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
        // Two triangles per cell, split from (i,j) to (i+1,j+1): the same split as the mesh and the physics.
        return fx > fz ? a + (b - a) * fx + (d - b) * fz : a + (d - c) * fx + (c - a) * fz;
    }

    /** The surface (SURFACES entry) nearest (x, z). */
    surface(x, z) {
        const [gx, gz] = this.grid(x, z);
        const i = Math.max(0, Math.min(this.n - 1, Math.round(gx))), j = Math.max(0, Math.min(this.n - 1, Math.round(gz)));
        return SURFACES[this.p[this.idx(i, j)]] || SURFACES[0];
    }

    /** Where a ray first meets the ground, or null. */
    raycast(ray, far = 400) {
        const p = new THREE.Vector3();
        let prev = ray.origin.y - this.height(ray.origin.x, ray.origin.z), tPrev = 0;
        for (let t = 0.5; t <= far; t += t < 40 ? 0.5 : 1.5) {
            ray.at(t, p);
            const d = p.y - this.height(p.x, p.z);
            if (d <= 0 && prev > 0) {
                let lo = tPrev, hi = t;
                for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; ray.at(mid, p); if (p.y - this.height(p.x, p.z) > 0) lo = mid; else hi = mid; }
                return ray.at(hi, p);
            }
            prev = d; tPrev = t;
        }
        return null;
    }

    // ---- building ----------------------------------------------------------------------
    /** Meshes for every chunk, and the physics body. */
    build(scene, { physics = true } = {}) {
        this.group = new THREE.Group();
        this.group.name = 'Terrain';
        const m = this.n - 1;
        for (let cj = 0; cj < m; cj += CHUNK) for (let ci = 0; ci < m; ci += CHUNK) this._chunk(ci, cj);
        this._apron();
        scene.add(this.group);
        if (physics) { this._physics(); this._walls(); }
        return this;
    }

    // Past the edge the land carries on into the fog (never walked on): a ring of ground from the edge outward,
    // starting at the edge's own heights and rolling off, so the world has no cliff where the scene ends.
    _apron() {
        const R = this.size * 0.9, steps = 64, out = 6, pos = [], col = [];
        const c = new THREE.Color();
        const ring = [];
        for (let s = 0; s <= steps; s++) {
            const a = (s / steps) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
            // The point on the square's edge in this direction.
            const k = this.half / Math.max(Math.abs(dx), Math.abs(dz));
            const ex = dx * k, ez = dz * k, eh = this.height(ex * 0.999, ez * 0.999);
            const sf = this.surface(ex * 0.98, ez * 0.98);
            const row = [];
            for (let r = 0; r <= out; r++) {
                const t = r / out, d = k + t * R;
                const roll = Math.sin(a * 5 + r) * 3 + Math.sin(a * 11) * 2;
                row.push([dx * d, eh + (roll + t * 18) * t * t, dz * d, sf]);
            }
            ring.push(row);
        }
        const push = (v, sf) => { pos.push(v[0], v[1], v[2]); c.setHex(sf.col[0]).convertSRGBToLinear(); col.push(c.r, c.g, c.b); };
        for (let s = 0; s < steps; s++) for (let r = 0; r < out; r++) {
            const a = ring[s][r], b = ring[s + 1][r], cc = ring[s + 1][r + 1], d = ring[s][r + 1];
            for (const t of [[a, cc, b], [a, d, cc]]) {
                // Face up whatever the ring's direction.
                const ux = t[1][0] - t[0][0], uz = t[1][2] - t[0][2], vx = t[2][0] - t[0][0], vz = t[2][2] - t[0][2];
                if (uz * vx - ux * vz < 0) t.reverse();
                for (const v of t) push(v, a[3]);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, kitMaterials().body);
        m.name = 'TerrainApron';
        m.receiveShadow = true;
        this.group.add(m);
    }

    // The scene's edge: you can't walk off the world.
    _walls() {
        const H = this.half, t = 1, h = 60;
        for (const [x, z, w, d] of [[H + t, 0, t, H + t], [-H - t, 0, t, H + t], [0, H + t, H + t, t], [0, -H - t, H + t, t]]) {
            const body = new CANNON.Body({ mass: 0 });
            body.addShape(new CANNON.Box(new CANNON.Vec3(w, h, d)));
            body.position.set(x - Math.sign(x) * 1.5, 0, z - Math.sign(z) * 1.5);
            (this.walls ||= []).push(Physics.add({ body, tier: TIER.STATIC, id: 'Edge' }));
        }
    }

    /** Rebuild the chunks covering grid rect [i0..i1] × [j0..j1] (the editor's brushes). */
    rebuild(i0, j0, i1, j1, { physics = false } = {}) {
        for (let cj = Math.floor(Math.max(0, j0 - 1) / CHUNK) * CHUNK; cj <= Math.min(this.n - 2, j1); cj += CHUNK)
            for (let ci = Math.floor(Math.max(0, i0 - 1) / CHUNK) * CHUNK; ci <= Math.min(this.n - 2, i1); ci += CHUNK) this._chunk(ci, cj);
        if (physics) this._physics();
    }

    _chunk(ci, cj) {
        const key = `${ci},${cj}`;
        const old = this.chunks.get(key);
        if (old) { this.group.remove(old); old.geometry.dispose(); }
        const m = this.n - 1, cs = this.cell, H = this.half;
        const i1 = Math.min(m, ci + CHUNK), j1 = Math.min(m, cj + CHUNK);
        const tris = (i1 - ci) * (j1 - cj) * 2;
        const pos = new Float32Array(tris * 9), nor = new Float32Array(tris * 9), col = new Float32Array(tris * 9);
        const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), N = new THREE.Vector3();
        const c = new THREE.Color(), tmp = new THREE.Color();
        let o = 0;
        const P = (i, j, v) => v.set(-H + i * cs, this.h[this.idx(i, j)], -H + j * cs);
        const tri = (ia, ja, ib, jb, ic, jc) => {
            P(ia, ja, A); P(ib, jb, B); P(ic, jc, C);
            N.crossVectors(e1.subVectors(C, A), e2.subVectors(B, A)).normalize();
            if (N.y < 0) N.negate();
            // Colour per corner (its own surface, a gentle variation that is the same wherever the corner is shared),
            // so surfaces blend across a triangle; a steep face shows rock.
            const steep = N.y < 0.62;
            const shade = 1 + (seeded(ia * 3.3 + ja * 9.1 + ic * 0.7) - 0.5) * 0.09;     // each facet a touch lighter or darker
            const corners = [[ia, ja, A], [ib, jb, B], [ic, jc, C]];
            for (const [ci2, cj2, v] of corners) {
                let sf = SURFACES[this.p[this.idx(ci2, cj2)]] || SURFACES[0];
                if (steep && !['snow', 'glass', 'basalt', 'ash', 'salt'].includes(sf.key)) sf = SURFACES[SURFACE_INDEX.rock];
                const r = seeded(ci2 * 7.13 + cj2 * 3.71);
                c.setHex(sf.col[0]).lerp(tmp.setHex(sf.col[1 + Math.floor(r * (sf.col.length - 1)) % (sf.col.length - 1)]), 0.35 * r);
                c.offsetHSL(0, 0, (r - 0.5) * 0.02 - (1 - N.y) * 0.06);
                c.convertSRGBToLinear();
                pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
                nor[o] = N.x; nor[o + 1] = N.y; nor[o + 2] = N.z;
                col[o] = c.r * shade; col[o + 1] = c.g * shade; col[o + 2] = c.b * shade;
                o += 3;
            }
        };
        for (let j = cj; j < j1; j++) for (let i = ci; i < i1; i++) {
            // Split from (i,j) to (i+1,j+1), as height() assumes.
            // Wound counter-clockwise seen from above (the faces look up).
            tri(i, j, i + 1, j + 1, i + 1, j);
            tri(i, j, i, j + 1, i + 1, j + 1);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, kitMaterials().body);
        mesh.receiveShadow = true;
        mesh.name = 'TerrainChunk';
        mesh.userData.chunk = key;
        this.group.add(mesh);
        this.chunks.set(key, mesh);
    }

    _physics() {
        if (this.entry) Physics.remove(this.entry);
        // cannon's Heightfield: data[i][j] along its local x and y, height on local z. Turned -90° about x,
        // local (x, y, z) is world (x, z, -y): so data[i][j] is the height at world (-half + i·cell, +half - j·cell).
        const n = this.n, data = [];
        for (let i = 0; i < n; i++) {
            const col = new Array(n);
            for (let j = 0; j < n; j++) col[j] = this.h[this.idx(i, n - 1 - j)];
            data.push(col);
        }
        const shape = new CANNON.Heightfield(data, { elementSize: this.cell });
        const body = new CANNON.Body({ mass: 0, material: Physics.material('ground') });
        body.addShape(shape);
        body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        body.position.set(-this.half, 0, this.half);
        this.entry = Physics.add({ body, tier: TIER.STATIC, id: 'Ground', data: { ground: true } });
    }

    dispose() {
        for (const m of this.chunks.values()) m.geometry.dispose();
        this.group?.parent?.remove(this.group);
        if (this.entry) Physics.remove(this.entry);
        for (const w of this.walls || []) Physics.remove(w);
    }
}
