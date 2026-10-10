// ============================================================
// PARTICLES — every flame, ember, puff, drop, chip and streak, simulated on the GPU
// ============================================================
//
// Two instanced meshes for the whole game: one ADDITIVE (flame, sparks,
// glows, wind streaks), one ALPHA-blended (smoke, steam, water drops, rock
// chips, dust). A particle is written ONCE, when it is born: where, how fast,
// how long, how big, what colour, what shape. The vertex shader works out
// where it is now (drag, gravity, a little turbulence) and how it looks; the
// CPU never touches it again. Only the slots born this frame are uploaded.
//
// Each Pool is a named PRESET over its own slice of one of the two buffers,
// so a pool's size is still its budget (§54): full, and new emission is
// skipped, the way FireFx's pools always worked. The old `Pool` API
// (spawn({x,y,z,vx,vy,vz,max,s0,s1}), update, alive, points) is kept, so the
// fire, water and air systems didn't change.
//
// Shapes are drawn, not textured (no sprite sheets): soft flame with a hot
// core, a spark stretched along its motion, a smoke puff of three lobes, a
// water drop with a glint, an angular rock chip that tumbles, a dust puff,
// a thin wind streak.
//
// Ideas after achrefelouafi/AvatarCastingAbilitiesThreeJS (MIT): GPU-evaluated
// motion and shape per instance, ring-buffer slots, procedural silhouettes.
// ============================================================

import { THREE } from '../engine/lib.js';

export const KIND = { flame: 0, spark: 1, glow: 2, smoke: 3, drop: 4, chip: 5, dust: 6, streak: 7 };

/**
 * The presets: shape, blend, motion and colour over life. c0/a0 at birth, c1/a1 at death.
 * g: gravity (m/s², +up); drag: per second; turb: wander (m); spin: rad/s (chips).
 */
export const PRESETS = {
    flame:  { kind: 'flame', add: true,  g: 1.2,   drag: 0.6, turb: 0.25, c0: 0xfff2b0, a0: 0.95, c1: 0x5a1408, a1: 0 },
    ember:  { kind: 'spark', add: true,  g: 1.6,   drag: 0.9, turb: 0.5,  c0: 0xffd070, a0: 1,    c1: 0xff4010, a1: 0 },
    spark:  { kind: 'spark', add: true,  g: -9,    drag: 1.2, turb: 0,    c0: 0xfff0c0, a0: 1,    c1: 0xff6020, a1: 0 },
    streak: { kind: 'streak', add: false, g: 0,    drag: 0.4, turb: 0.1,  c0: 0xf4fffa, a0: 0.75, c1: 0xe0f4ec, a1: 0 },   // alpha, not additive: light-on-light vanishes in daylight
    mote:   { kind: 'glow', add: true,   g: 0.2,   drag: 1.5, turb: 0.6,  c0: 0xe8fff4, a0: 0.5,  c1: 0xe8fff4, a1: 0 },
    smoke:  { kind: 'smoke', add: false, g: 0.1,   drag: 0.5, turb: 0.4,  c0: 0x2a2724, a0: 0.38, c1: 0x5a5652, a1: 0 },
    steam:  { kind: 'smoke', add: false, g: 0.6,   drag: 0.8, turb: 0.4,  c0: 0xd8e2ea, a0: 0.5,  c1: 0xeef4f8, a1: 0 },
    drop:   { kind: 'drop', add: false,  g: -12,   drag: 0.1, turb: 0,    c0: 0x8cccf0, a0: 0.9,  c1: 0xb8e4ff, a1: 0.2 },
    mist:   { kind: 'dust', add: false,  g: 0.3,   drag: 2.2, turb: 0.3,  c0: 0xd8f0ff, a0: 0.35, c1: 0xffffff, a1: 0 },
    chip:   { kind: 'chip', add: false,  g: -14,   drag: 0.3, turb: 0,    c0: 0x8a7a64, a0: 1,    c1: 0x6a5c4a, a1: 0, spin: 9 },
    dust:   { kind: 'dust', add: false,  g: 0.15,  drag: 2.6, turb: 0.35, c0: 0x9a8264, a0: 0.6,  c1: 0xb8a68c, a1: 0 },
};

const VERT = /* glsl */`
    attribute vec4 aA;   // p0.xyz, born
    attribute vec4 aB;   // v0.xyz, life
    attribute vec4 aC;   // size0, size1, kind, seed
    attribute vec4 aD;   // colour at birth, alpha
    attribute vec4 aE;   // colour at death, alpha
    attribute vec4 aF;   // gravity, drag, turbulence, spin
    uniform float uTime, uViewH;
    varying vec2 vUv;
    varying float vK, vKind, vSeed, vA;
    varying vec3 vCol;
    void main() {
        float t = uTime - aA.w, k = t / aB.w;
        if (t < 0.0 || k >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        float drag = aF.y, e = drag > 0.001 ? (1.0 - exp(-drag * t)) / drag : t;
        vec3 p = aA.xyz + aB.xyz * e + vec3(0.0, 0.5 * aF.x * t * t, 0.0);
        float s = aC.w * 6.2831;
        p += aF.z * t * vec3(sin(t * 2.3 + s) + 0.5 * sin(t * 4.1 + s * 1.7), 0.3 * sin(t * 1.7 + s * 2.3), cos(t * 2.1 + s * 1.3) + 0.5 * cos(t * 3.7 + s * 2.9));
        vec3 vel = aB.xyz * exp(-drag * t) + vec3(0.0, aF.x * t, 0.0);
        float size = mix(aC.x, aC.y, k);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // Capped near the lens: a puff right at the camera would fill the screen (overdraw is a phone's real limit).
        float px = size * projectionMatrix[1][1] * uViewH * 0.5 / max(0.1, -mv.z), cap = uViewH * 0.16;
        if (px > cap) size *= cap / px;
        vec2 q = position.xy;
        float kind = aC.z;
        if (kind == 1.0 || kind == 7.0) {
            // Sparks and streaks: stretched along their motion on screen.
            vec2 d = (modelViewMatrix * vec4(vel, 0.0)).xy;
            float L = length(d);
            vec2 dir = L > 1e-4 ? d / L : vec2(0.0, 1.0), side = vec2(dir.y, -dir.x);   // (side, dir) keeps the quad's winding: the other way it's culled as a back face
            float len = size * (1.0 + min(L * (kind == 7.0 ? 0.3 : 0.06), kind == 7.0 ? 7.0 : 3.0));
            mv.xy += dir * q.y * len + side * q.x * size * 0.4;
        } else {
            float r = aF.w * t + s;
            mv.xy += mat2(cos(r), sin(r), -sin(r), cos(r)) * q * size;
        }
        gl_Position = projectionMatrix * mv;
        vUv = q * 2.0; vK = k; vKind = kind; vSeed = aC.w;
        vCol = mix(aD.rgb, aE.rgb, k); vA = mix(aD.a, aE.a, k);
    }`;

const FRAG = (additive) => /* glsl */`
    varying vec2 vUv;
    varying float vK, vKind, vSeed, vA;
    varying vec3 vCol;
    void main() {
        vec2 uv = vUv;
        float r = length(uv), a = 0.0;
        vec3 col = vCol;
        if (vKind < 0.5) {                                  // flame: white-hot core, through orange to ember red
            vec3 orange = vec3(1.0, 0.62, 0.22);
            col = vK < 0.35 ? mix(vec3(1.0, 0.95, 0.72), orange, vK / 0.35) : mix(orange, vCol, (vK - 0.35) / 0.65);
            col += vec3(1.0, 0.9, 0.6) * exp(-r * r * 9.0) * (1.0 - vK);
            a = smoothstep(1.0, 0.0, r) * (1.0 - vK) * 0.95;
        } else if (vKind < 1.5) {                           // spark: a hot capsule
            a = smoothstep(1.0, 0.2, length(uv * vec2(2.2, 1.0))) * vA;
            col *= 1.6;
        } else if (vKind < 2.5) {                           // glow
            a = exp(-r * r * 4.0) * vA;
        } else if (vKind < 3.5) {                           // smoke: three soft lobes, darker underneath
            float s = vSeed * 6.2831;
            vec2 o1 = vec2(cos(s), sin(s)) * 0.32, o2 = vec2(cos(s + 2.1), sin(s + 2.1)) * 0.3, o3 = vec2(cos(s + 4.2), sin(s + 4.2)) * 0.28;
            float m = max(max(smoothstep(0.7, 0.0, length(uv - o1)), smoothstep(0.68, 0.0, length(uv - o2))), smoothstep(0.66, 0.0, length(uv - o3)));
            a = m * sin(vK * 3.14159) * vA * 1.6;
            col *= 0.82 + 0.3 * uv.y;
        } else if (vKind < 4.5) {                           // water drop: a bead with a glint
            float disc = smoothstep(1.0, 0.72, r);
            float glint = exp(-dot(uv - vec2(-0.32, 0.34), uv - vec2(-0.32, 0.34)) * 18.0);
            col = mix(col * 0.85, vec3(1.0), glint * 0.9);
            a = disc * vA;
        } else if (vKind < 5.5) {                           // rock chip: an angular shard, faceted
            float d = max(abs(uv.x) * 1.25 + abs(uv.y) * 0.45, abs(uv.y) * 1.05 + abs(uv.x) * 0.2);
            a = step(d, 0.92) * vA * min(1.0, (1.0 - vK) * 6.0);
            col *= uv.x + uv.y > 0.0 ? 1.15 : 0.7;
        } else if (vKind < 6.5) {                           // dust / mist: a wide soft puff
            a = pow(smoothstep(1.0, 0.0, r), 1.5) * sin(vK * 3.14159) * vA;
        } else {                                            // wind streak: a thin line, fading at both ends
            a = exp(-abs(uv.x) * 4.0) * smoothstep(1.0, 0.2, abs(uv.y)) * sin(vK * 3.14159) * vA;
        }
        if (a < 0.01) discard;
        gl_FragColor = ${additive ? 'vec4(col * a, a)' : 'vec4(col, a)'};
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }`;

const STRIDE = { aA: 4, aB: 4, aC: 4, aD: 4, aE: 4, aF: 4 };
const _c0 = new THREE.Color(), _c1 = new THREE.Color();

/** One blend mode's buffer: N instanced quads, carved into pools' slices. */
class Buffer {
    constructor(n, additive) {
        const base = new THREE.PlaneGeometry(1, 1);
        const g = new THREE.InstancedBufferGeometry();
        g.index = base.index;
        g.setAttribute('position', base.getAttribute('position'));
        this.attrs = {};
        for (const [k, w] of Object.entries(STRIDE)) {
            const a = new THREE.InstancedBufferAttribute(new Float32Array(n * w), w);
            a.setUsage(THREE.DynamicDrawUsage);
            g.setAttribute(k, a);
            this.attrs[k] = a;
        }
        for (let i = 0; i < n; i++) this.attrs.aB.array[i * 4 + 3] = 1e-3;     // dead from the start
        g.instanceCount = n;
        this.mat = new THREE.ShaderMaterial({
            vertexShader: VERT, fragmentShader: FRAG(additive),
            uniforms: { uTime: { value: 0 }, uViewH: { value: 800 } },
            transparent: true, depthWrite: false, side: THREE.DoubleSide,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        this.mesh = new THREE.Mesh(g, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = additive ? 3 : 2;
        this.mesh.visible = false;
        Object.assign(this, { n, used: 0, until: -1, lo: Infinity, hi: -1 });
    }
    claim(n) {
        const at = this.used;
        if (at + n > this.n) throw new Error(`particles: ${this.n} slots, asked for ${at + n}`);
        this.used += n;
        return at;
    }
    mark(i, until) { this.lo = Math.min(this.lo, i); this.hi = Math.max(this.hi, i); this.until = Math.max(this.until, until); }
    flush(t) {
        if (this.hi >= this.lo) {
            for (const [k, a] of Object.entries(this.attrs)) { const w = STRIDE[k]; a.clearUpdateRanges(); a.addUpdateRange(this.lo * w, (this.hi - this.lo + 1) * w); a.needsUpdate = true; }
            this.lo = Infinity; this.hi = -1;
        }
        this.mesh.visible = t < this.until;
    }
}

/** A preset over a slice of a buffer, with the old Pool API. */
export class Pool {
    constructor(sys, n, preset) {
        this.sys = sys;
        this.preset = typeof preset === 'string' ? PRESETS[preset] : preset;
        this.buf = this.preset.add ? sys.add : sys.alpha;
        this.n = n;
        this.at = this.buf.claim(n);
        this.cursor = 0;
        this.dies = new Float32Array(n);                     // when each slot's particle is gone
        this.points = this.buf.mesh;                        // callers add it to the scene: the shared mesh, added once
    }

    /** A particle: { x, y, z, vx, vy, vz, max (life s), s0, s1 (size), white? (steam), c0?, c1?, a0? }. False when over budget. */
    spawn(o) {
        const t = this.sys.t;
        let j = -1;
        for (let k = 0; k < 6; k++) { const c = (this.cursor + k) % this.n; if (this.dies[c] <= t) { j = c; break; } }
        if (j < 0) return false;                            // over budget: skip, as the pools always did
        this.cursor = (j + 1) % this.n;
        const P = o.white && this.preset === PRESETS.smoke ? PRESETS.steam : this.preset;
        const i = this.at + j, A = this.buf.attrs, life = Math.max(0.02, o.max || 1);
        _c0.set(o.c0 ?? P.c0); _c1.set(o.c1 ?? P.c1);
        A.aA.array.set([o.x, o.y, o.z, t], i * 4);
        A.aB.array.set([o.vx || 0, o.vy || 0, o.vz || 0, life], i * 4);
        A.aC.array.set([o.s0 ?? 0.3, o.s1 ?? o.s0 ?? 0.3, KIND[P.kind], Math.random()], i * 4);
        A.aD.array.set([_c0.r, _c0.g, _c0.b, o.a0 ?? P.a0], i * 4);
        A.aE.array.set([_c1.r, _c1.g, _c1.b, o.a1 ?? P.a1], i * 4);
        A.aF.array.set([o.g ?? P.g, P.drag, P.turb, (P.spin || 0) * (Math.random() < 0.5 ? -1 : 1)], i * 4);
        this.dies[j] = t + life;
        this.buf.mark(i, t + life);
        return true;
    }

    /** The GPU ages them; kept so the old callers still run. */
    update() {}

    get alive() { const t = this.sys.t; let c = 0; for (let j = 0; j < this.n; j++) if (this.dies[j] > t) c++; return c; }
}

/** The two buffers and the clock. One per game. */
export class Particles {
    constructor(scene, { additive = 1400, alpha = 1600 } = {}) {
        this.t = 0;
        this.add = new Buffer(additive, true);
        this.alpha = new Buffer(alpha, false);
        scene.add(this.add.mesh, this.alpha.mesh);
        Particles.current = this;
    }
    /** A pool of `n` slots with a preset (name or object). */
    pool(n, preset) { return new Pool(this, n, preset); }
    update(dt, viewH) {
        if (!this._freeze) this.t += dt;                     // _freeze: hold every particle still (screenshots, QA)
        for (const b of [this.add, this.alpha]) { b.mat.uniforms.uTime.value = this.t; b.mat.uniforms.uViewH.value = viewH; b.flush(this.t); }
    }
    stats() { return { additive: this.add.used, alpha: this.alpha.used }; }
    dispose() {
        for (const b of [this.add, this.alpha]) { b.mesh.parent?.remove(b.mesh); b.mesh.geometry.dispose(); b.mat.dispose(); }
        if (Particles.current === this) Particles.current = null;
    }
}
Particles.current = null;
