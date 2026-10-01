// ============================================================
// LAND — building a region's ground and dressing it, for the scene scripts
// ============================================================
//
// The region scripts (scripts/scenes/*.mjs) shape land in code, then save it
// as an ordinary scene file the editor opens and sculpts further:
//
//   const L = new Land(240, 2, seed)
//   L.shape((x, z) => …height…)            the landscape
//   L.flatten(x, z, r, h)                   a town's footing
//   L.road([[x, z], …], w, 'dirt')         paint (and ease) a road
//   L.paint((x, z, h, slope) => 'grass')    surfaces
//   L.terrain()                             → settings.terrain
//
//   const S = new Dresser(L, seed)          objects, placed on clear ground
//   S.add(id, type, x, z, rotY, props)
//   S.scatter(prefix, n, area, make)        trees, rocks, grass, away from roads and towns
// ============================================================

import { encodeTerrain, Terrain, SURFACE_INDEX } from '../../../src/world/Terrain.js';

// ---- noise ---------------------------------------------------------------------------------------
export function rng(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function hash(i, j, seed) { let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const fade = t => t * t * (3 - 2 * t);
/** Smooth value noise in about -1..1, `scale` metres per bump. */
export function noise(x, z, scale, seed = 1) {
    const u = x / scale, v = z / scale, i = Math.floor(u), j = Math.floor(v), fu = fade(u - i), fv = fade(v - j);
    const a = hash(i, j, seed), b = hash(i + 1, j, seed), c = hash(i, j + 1, seed), d = hash(i + 1, j + 1, seed);
    return (a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv) * 2 - 1;
}
/** Fractal noise: `oct` octaves, each half the size and `gain` the height. */
export function fbm(x, z, scale, seed = 1, oct = 4, gain = 0.5) {
    let s = 0, amp = 1, norm = 0;
    for (let o = 0; o < oct; o++) { s += noise(x, z, scale, seed + o * 17) * amp; norm += amp; amp *= gain; scale /= 2; }
    return s / norm;
}
/** Ridged noise (mountain crests), 0..1. */
export function ridge(x, z, scale, seed = 1) { return 1 - Math.abs(fbm(x, z, scale, seed, 4, 0.55)); }
export const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// Distance from p to segment ab.
function segDist(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz;
    const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l)) : 0;
    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
export function pathDist(pts, x, z) { let d = Infinity; for (let k = 0; k < pts.length - 1; k++) d = Math.min(d, segDist(x, z, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1])); return d; }

// ---- the land ---------------------------------------------------------------------------------------
export class Land {
    constructor(size = 240, cell = 2, seed = 1) {
        Object.assign(this, { size, cell, seed, half: size / 2 });
        this.n = Math.round(size / cell) + 1;
        this.h = new Float32Array(this.n * this.n);
        this.p = new Uint8Array(this.n * this.n);
        this.roads = [];          // { pts, w } kept clear of scattered things
        this.clearings = [];      // { x, z, r }
    }
    *points() { for (let j = 0; j < this.n; j++) for (let i = 0; i < this.n; i++) yield [j * this.n + i, -this.half + i * this.cell, -this.half + j * this.cell]; }

    shape(fn) { for (const [k, x, z] of this.points()) this.h[k] = fn(x, z); return this; }
    add(fn) { for (const [k, x, z] of this.points()) this.h[k] += fn(x, z, this.h[k]); return this; }

    /** Ease the ground toward height `to` within r (fully flat inside r·inner), e.g. a town's footing. */
    flatten(x, z, r, to = null, inner = 0.65) {
        const target = to ?? this.at(x, z);
        for (const [k, px, pz] of this.points()) {
            const d = Math.hypot(px - x, pz - z);
            if (d > r) continue;
            const w = 1 - smooth(r * inner, r, d);
            this.h[k] += (target - this.h[k]) * w;
        }
        this.clearings.push({ x, z, r: r * 0.9 });
        return target;
    }

    /** A road along pts: painted `surface`, w wide, the ground eased smooth along it. */
    road(pts, w = 4, surface = 'dirt', { ease = 0.7 } = {}) {
        this.roads.push({ pts, w });
        const t = this._q();
        const along = new Float32Array(this.h.length);
        for (const [k, x, z] of this.points()) along[k] = t.height(x, z);
        for (const [k, x, z] of this.points()) {
            const d = pathDist(pts, x, z);
            if (d < w / 2) this.p[k] = SURFACE_INDEX[surface];
            if (d < w) {
                // Average the ground around this point: a road doesn't follow every bump.
                let s = 0, c = 0;
                for (const [dx, dz] of [[-3, 0], [3, 0], [0, -3], [0, 3], [0, 0]]) { s += t.height(x + dx, z + dz); c++; }
                this.h[k] += (s / c - this.h[k]) * ease * (1 - smooth(w * 0.5, w, d));
            }
        }
        return this;
    }

    paint(fn) { for (const [k, x, z] of this.points()) { const key = fn(x, z, this.h[k], this.slope(x, z), this.p[k]); if (key) this.p[k] = SURFACE_INDEX[key] ?? this.p[k]; } return this; }
    paintCircle(x, z, r, surface) { for (const [k, px, pz] of this.points()) if (Math.hypot(px - x, pz - z) < r) this.p[k] = SURFACE_INDEX[surface]; return this; }

    _q() { return this._t ||= new Terrain({ size: this.size, cell: this.cell, n: this.n, h: this.h, p: this.p }); }
    at(x, z) { return this._q().height(x, z); }
    slope(x, z) { const t = this._q(), e = this.cell; return Math.hypot(t.height(x + e, z) - t.height(x - e, z), t.height(x, z + e) - t.height(x, z - e)) / (2 * e); }

    /** Near a road or a clearing (keep scattered things off it). */
    busy(x, z, pad = 0) {
        for (const r of this.roads) if (pathDist(r.pts, x, z) < r.w / 2 + 1.5 + pad) return true;
        for (const c of this.clearings) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
        return false;
    }

    terrain() { return encodeTerrain({ size: this.size, cell: this.cell, n: this.n, h: this.h, p: this.p }); }
}

// ---- dressing ----------------------------------------------------------------------------------------
export class Dresser {
    constructor(land, seed = 1) {
        this.L = land;
        this.r = rng(seed);
        this.objects = [];
        this.taken = [];          // { x, z, r }: placed things scattered ones keep clear of
    }
    add(id, type, x, z, rotY = 0, props = {}, keep = 0) {
        this.objects.push({ id, type, x: +x.toFixed(2), y: 0, z: +z.toFixed(2), rotY: +(+rotY).toFixed(3), ...props });
        if (keep) this.taken.push({ x, z, r: keep });
        return this;
    }
    free(x, z, r) { return !this.taken.some(t => Math.hypot(t.x - x, t.z - z) < t.r + r); }
    /**
     * Scatter up to n things in `area` ({ x, z, r } or { x0, z0, x1, z1 }), on clear ground that `ok(x, z, h, slope)` accepts.
     * make(i, x, z, r()) → [type, props, keep] for each.
     */
    scatter(prefix, n, area, make, ok = () => true) {
        let placed = 0;
        for (let tries = 0; placed < n && tries < n * 30; tries++) {
            let x, z;
            if (area.r !== undefined) { const a = this.r() * Math.PI * 2, d = Math.sqrt(this.r()) * area.r; x = area.x + Math.cos(a) * d; z = area.z + Math.sin(a) * d; }
            else { x = area.x0 + this.r() * (area.x1 - area.x0); z = area.z0 + this.r() * (area.z1 - area.z0); }
            if (Math.abs(x) > this.L.half - 3 || Math.abs(z) > this.L.half - 3) continue;
            const [type, props = {}, keep = 1] = make(placed, x, z, this.r) || [];
            if (!type || this.L.busy(x, z) || !this.free(x, z, keep) || !ok(x, z, this.L.at(x, z), this.L.slope(x, z))) continue;
            this.add(`${prefix}_${String(++placed).padStart(3, '0')}`, type, x, z, this.r() * Math.PI * 2, props, keep);
        }
        return placed;
    }
}
