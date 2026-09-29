// ============================================================
// KIT — every model in Elemental is built in code with this
// ============================================================
//
// Adapted from Hundred Block Dash's src/engine/CityKit.js (commit 2b56ae8).
// The accumulator is the same; what changed is the world it builds.
//
// THE DRAW-CALL RULE carries over unchanged. A model is at most three meshes
// however much detail it carries, one per layer:
//
//   body   stone, wood, cloth, skin: vertex-coloured, lit, casts shadows
//   sheen  water, ice, crystal, metal: the same, but smooth and metallic
//   glow   runes, embers, elemental light: vertex-coloured, unlit
//
// Colour lives in the vertices, so one material per layer is shared by every
// model in the world. Detail costs triangles, which phones have plenty of,
// and never draw calls, which they do not.
//
// Two exceptions, both deliberate:
//   - a model that must break apart is built as one Kit per PIECE (a plank,
//     a wall block), because each piece becomes its own physics body;
//   - a model whose material animates (a rock that highlights when Earth is
//     selected) gets its own material via `build({ own: true })`.
// ============================================================

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();
const _q = new THREE.Quaternion(), _e = new THREE.Euler();

export function seeded(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/** A translation (and optional rotation / scale) as a matrix. */
export function at(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
        _q.setFromEuler(_e.set(rx, ry, rz)).clone(), new THREE.Vector3(sx, sy, sz));
}

// Colours are authored in sRGB (what a colour picker shows) and stored in the
// vertices as linear, because the renderer outputs sRGB. Hundred Block Dash
// renders linear-out and authors to suit; Elemental does it the correct way so
// lighting and fog blend the way they look in the palette.
const _linCache = new Map();
function _lin(col) {
    if (col.isColor) return col.clone().convertSRGBToLinear();
    let c = _linCache.get(col);
    if (!c) { c = new THREE.Color(col).convertSRGBToLinear(); _linCache.set(col, c); }
    return c;
}

// One material per layer for the whole world.
let _mats = null;
export function kitMaterials() {
    if (_mats) return _mats;
    _mats = {
        body:  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.0 }),
        sheen: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.35 }),
        glow:  new THREE.MeshBasicMaterial({ vertexColors: true }),
    };
    return _mats;
}

// ------------------------------------------------------------
// The accumulator: triangles in, three meshes out.
// ------------------------------------------------------------
export class Kit {
    constructor() {
        this.L = { body: [], sheen: [], glow: [] };   // flat arrays: x y z nx ny nz r g b per vertex
        this.tris = 0;
        this.shadows = true;
    }

    vert(layer, p, n, c) { this.L[layer].push(p.x, p.y, p.z, n.x, n.y, n.z, c.r, c.g, c.b); }

    /** A convex polygon, wound outward from `centre` (local coordinates), then moved by `m`. */
    poly(layer, pts, col, centre, m) {
        const c = _lin(col);
        // Wind it so the face points away from the solid's centre.
        _a.subVectors(pts[1], pts[0]); _b.subVectors(pts[2], pts[0]); _n.crossVectors(_a, _b);
        const cen = _v.set(0, 0, 0); pts.forEach(p => cen.add(p)); cen.divideScalar(pts.length);
        if (_n.dot(cen.sub(centre)) < 0) pts = pts.slice().reverse();
        const w = m ? pts.map(p => p.clone().applyMatrix4(m)) : pts;
        _a.subVectors(w[1], w[0]); _b.subVectors(w[2], w[0]);
        const nrm = new THREE.Vector3().crossVectors(_a, _b);
        if (nrm.lengthSq() < 1e-12) return;
        nrm.normalize();
        for (let i = 1; i < w.length - 1; i++) {
            this.vert(layer, w[0], nrm, c); this.vert(layer, w[i], nrm, c); this.vert(layer, w[i + 1], nrm, c);
            this.tris++;
        }
    }

    /**
     * A box of w×h×d centred on the origin of `m`, with its edges chamfered by
     * `ch`: flat faces, flat 45° bevels and corner facets, so every edge
     * catches a highlight. `top` colours the upward face differently.
     */
    box(layer, w, h, d, m, col, { ch = 0, top = null, skipBottom = true } = {}) {
        const a = w / 2, b = h / 2, e = d / 2;
        ch = Math.max(0, Math.min(ch, a * 0.45, b * 0.45, e * 0.45));
        const O = new THREE.Vector3();
        const P = (x, y, z) => new THREE.Vector3(x, y, z);
        const ext = [a, b, e];
        const inset = [a - ch, b - ch, e - ch];
        // Main faces: one per axis and sign.
        for (let ax = 0; ax < 3; ax++) for (const s of [-1, 1]) {
            if (skipBottom && ax === 1 && s < 0) continue;
            const u = (ax + 1) % 3, v = (ax + 2) % 3;
            const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) => {
                const p = [0, 0, 0]; p[ax] = s * ext[ax]; p[u] = su * inset[u]; p[v] = sv * inset[v];
                return P(p[0], p[1], p[2]);
            });
            this.poly(layer, q, (ax === 1 && s > 0 && top !== null) ? top : col, O, m);
        }
        if (ch <= 0) return;
        // Edge bevels: between axis i (sign si) and axis j (sign sj), running along k.
        const corner = (sx, sy, sz, which) => {   // the corner facet's vertex nearest axis `which`
            const s = [sx, sy, sz], p = [0, 0, 0];
            for (let k = 0; k < 3; k++) p[k] = s[k] * (k === which ? ext[k] : inset[k]);
            return P(p[0], p[1], p[2]);
        };
        for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
            const k = 3 - i - j;
            for (const si of [-1, 1]) for (const sj of [-1, 1]) {
                if (skipBottom && ((i === 1 && si < 0) || (j === 1 && sj < 0))) continue;
                const s0 = [0, 0, 0], s1 = [0, 0, 0];
                s0[i] = si; s0[j] = sj; s0[k] = -1;
                s1[i] = si; s1[j] = sj; s1[k] = 1;
                const q = [corner(...s0, i), corner(...s0, j), corner(...s1, j), corner(...s1, i)];
                this.poly(layer, q, col, O, m);
            }
        }
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
            if (skipBottom && sy < 0) continue;
            this.poly(layer, [corner(sx, sy, sz, 0), corner(sx, sy, sz, 1), corner(sx, sy, sz, 2)], col, O, m);
        }
    }

    /** A prism: a triangle in the XY plane (x from -w/2..w/2, apex at `apexX`), extruded d along Z. */
    prism(layer, w, h, d, m, col, apexX = 0) {
        const a = w / 2, e = d / 2;
        const O = new THREE.Vector3(apexX / 3, h / 3, 0);
        const P = (x, y, z) => new THREE.Vector3(x, y, z);
        const f = [P(-a, 0, e), P(a, 0, e), P(apexX, h, e)], k = [P(-a, 0, -e), P(a, 0, -e), P(apexX, h, -e)];
        this.poly(layer, f, col, O, m); this.poly(layer, k, col, O, m);
        this.poly(layer, [f[0], f[2], k[2], k[0]], col, O, m);
        this.poly(layer, [f[1], f[2], k[2], k[1]], col, O, m);
    }

    /**
     * Any three.js geometry, keeping its own (smooth) normals, or with `flat`
     * one normal per face: faceted stone, hewn wood, cut crystal.
     */
    geo(layer, geometry, m, col, { flat = false } = {}) {
        const c = _lin(col);
        const g = geometry.index ? geometry.toNonIndexed() : geometry;
        if (m) g.applyMatrix4(m);
        if (flat) g.computeVertexNormals();   // non-indexed, so every face keeps its own normal
        const p = g.attributes.position, n = g.attributes.normal;
        for (let i = 0; i < p.count; i++) {
            this.L[layer].push(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i), c.r, c.g, c.b);
        }
        this.tris += p.count / 3;
        if (g !== geometry) g.dispose();
        geometry.dispose();
    }

    cyl(layer, rTop, rBot, h, seg, m, col, opts) { this.geo(layer, new THREE.CylinderGeometry(rTop, rBot, h, seg), m, col, opts); }

    /**
     * The three meshes, as one group. `own: true` gives this model its own
     * copies of the layer materials, for a model that animates its material.
     */
    build({ own = false } = {}) {
        const shared = kitMaterials();
        const M = own ? { body: shared.body.clone(), sheen: shared.sheen.clone(), glow: shared.glow.clone() } : shared;
        const grp = new THREE.Group();
        for (const layer of ['body', 'sheen', 'glow']) {
            const arr = this.L[layer];
            if (!arr.length) continue;
            const n = arr.length / 9;
            const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
                pos[i * 3] = arr[i * 9];     pos[i * 3 + 1] = arr[i * 9 + 1]; pos[i * 3 + 2] = arr[i * 9 + 2];
                nor[i * 3] = arr[i * 9 + 3]; nor[i * 3 + 1] = arr[i * 9 + 4]; nor[i * 3 + 2] = arr[i * 9 + 5];
                col[i * 3] = arr[i * 9 + 6]; col[i * 3 + 1] = arr[i * 9 + 7]; col[i * 3 + 2] = arr[i * 9 + 8];
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
            g.setAttribute('color', new THREE.BufferAttribute(col, 3));
            g.computeBoundingSphere();
            const mesh = new THREE.Mesh(g, M[layer]);
            mesh.name = 'kit-' + layer;
            if (layer !== 'glow') { mesh.castShadow = this.shadows && layer === 'body'; mesh.receiveShadow = true; }
            grp.add(mesh);
        }
        grp.userData.kitTris = this.tris;
        if (own) grp.userData.ownMaterials = M;
        return grp;
    }
}
