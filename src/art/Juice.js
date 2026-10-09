// ============================================================
// JUICE — what makes a hit feel like a hit
// ============================================================
//
// Listens to the game's events and answers them with feel, never with rules:
//
//   shake    camera trauma (squared, so small knocks stay small), fading;
//            falls off with distance from the hero
//   flash    a screen-edge flash: red when you're hurt, warm for a blast
//   flares   bright additive bursts where things land (one draw call)
//   rings    shockwaves along the ground (one draw call)
//   decals   marks left on the ground: scorch, wet, cracked earth; they fade
//            (one draw call)
//
// Every visual is a pooled instanced quad drawn by its own shader: the CPU
// writes a slot when something happens and nothing else; the GPU ages it.
// The quality ladder (Renderer.quality.fx) sheds decals first, then rings,
// and shrinks flares, before the game would drop a frame.
//
// Ideas after achrefelouafi/AvatarCastingAbilitiesThreeJS (MIT): impact
// lights as flares, ground decals, shockwaves, camera shake, screen flash,
// all adapted to a phone's budget.
// ============================================================

import { THREE } from '../engine/lib.js';
import { EventBus, EV } from '../core/EventBus.js';
import { Ground } from '../world/Ground.js';
import * as Renderer from '../engine/Renderer.js';

export const JUICE = {
    shake: { decay: 1.7, offset: 0.32, roll: 0.035, freq: 22, far: 28 },  // trauma per second; metres; radians; Hz; falloff
    flares: 40, rings: 24, decals: 48,
    decalLife: 22,                                                         // seconds a mark stays
    tint: { earth: 0xc8a878, fire: 0xffa040, water: 0x9ad8ff, air: 0xe8f4ff, ice: 0xc8f0ff, dust: 0xb09a7a },
};
const KIND = { scorch: 0, wet: 1, crack: 2 };

const NOISE = /* glsl */`
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.1 + 7.3) + 0.15 * vnoise(p * 4.3 + 1.7); }`;

/** A pool of N instanced quads with per-instance pos (vec3), data (vec4: born, life, size, kind), color (vec3) and extra (vec4). */
class Quads {
    constructor(scene, n, material) {
        const base = new THREE.PlaneGeometry(1, 1);
        const g = new THREE.InstancedBufferGeometry();
        g.index = base.index;
        g.setAttribute('position', base.getAttribute('position'));
        const mk = (k, size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); return a; };
        this.a = { pos: mk('aPos', 3), data: mk('aData', 4), color: mk('aColor', 3), extra: mk('aExtra', 4) };
        for (let i = 0; i < n; i++) this.a.data.array[i * 4 + 1] = 1e-3;     // born 0, a life long over: unseen
        g.instanceCount = n;
        this.mesh = new THREE.Mesh(g, material);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 5;
        scene.add(this.mesh);
        Object.assign(this, { n, i: 0, mat: material, until: -1 });
        this.mesh.visible = false;                       // nothing showing: no draw call
    }
    /** Drawn only while something in it is still alive. */
    tick(t) { this.mesh.visible = t < this.until; }
    /** The next slot (the oldest is reused). */
    put(p, born, life, size, kind, color, extra = [0, 0, 0, 0]) {
        const i = this.i = (this.i + 1) % this.n, A = this.a;
        this.until = Math.max(this.until, born + life);
        A.pos.array.set([p.x, p.y, p.z], i * 3);
        A.data.array.set([born, life, size, kind], i * 4);
        A.color.array.set([color.r, color.g, color.b], i * 3);
        A.extra.array.set(extra, i * 4);
        for (const [k, a] of Object.entries(A)) { const w = a.itemSize; a.clearUpdateRanges(); a.addUpdateRange(i * w, w); a.needsUpdate = true; void k; }
        return i;
    }
    live(t) { let c = 0; const d = this.a.data.array; for (let i = 0; i < this.n; i++) if (t - d[i * 4] < d[i * 4 + 1]) c++; return c; }
    dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}

const flareMat = () => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uK: { value: 1 } },
    vertexShader: /* glsl */`
        attribute vec3 aPos; attribute vec4 aData; attribute vec3 aColor;
        uniform float uTime, uK;
        varying vec2 vUv; varying float vA; varying vec3 vC;
        void main() {
            float age = (uTime - aData.x) / aData.y;
            if (age < 0.0 || age > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
            float s = aData.z * uK * (0.55 + 0.9 * sqrt(age));
            vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
            mv.xy += position.xy * s;
            gl_Position = projectionMatrix * mv;
            vUv = position.xy; vA = pow(1.0 - age, 1.8); vC = aColor;
        }`,
    fragmentShader: /* glsl */`
        varying vec2 vUv; varying float vA; varying vec3 vC;
        void main() {
            float r = length(vUv) * 2.0;
            float glow = exp(-r * r * 5.0);
            float star = max(exp(-abs(vUv.x) * 38.0) * exp(-abs(vUv.y) * 4.0), exp(-abs(vUv.y) * 38.0) * exp(-abs(vUv.x) * 4.0));
            vec3 c = vC * (glow * 1.9 + star * 0.9) + vec3(1.0) * pow(glow, 5.0) * 0.9;     // bright enough to read on a sunlit floor
            gl_FragColor = vec4(c * vA, 1.0);
        }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
});

const ringMat = () => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
        attribute vec3 aPos; attribute vec4 aData; attribute vec3 aColor;
        uniform float uTime;
        varying vec2 vUv; varying float vAge; varying vec3 vC;
        void main() {
            float age = (uTime - aData.x) / aData.y;
            if (age < 0.0 || age > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
            float r = aData.z * (0.15 + 0.85 * (1.0 - pow(1.0 - age, 3.0)));
            vec3 p = aPos + vec3(position.x, 0.0, -position.y) * r * 2.0;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            vUv = position.xy; vAge = age; vC = aColor;
        }`,
    fragmentShader: /* glsl */`
        varying vec2 vUv; varying float vAge; varying vec3 vC;
        void main() {
            float d = length(vUv) * 2.0;
            float w = mix(0.22, 0.05, vAge);
            float band = smoothstep(w, 0.0, abs(d - 0.86)) + 0.25 * smoothstep(0.86, 0.0, d) * (1.0 - vAge);
            float a = band * pow(1.0 - vAge, 1.4) * 0.75;
            if (a < 0.01) discard;
            gl_FragColor = vec4(vC, a);
        }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
});

const decalMat = () => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
        attribute vec3 aPos; attribute vec4 aData; attribute vec3 aColor; attribute vec4 aExtra;   // aExtra: normal xyz, angle
        uniform float uTime;
        varying vec2 vUv; varying float vAge, vKind, vSeed;
        void main() {
            float age = (uTime - aData.x) / aData.y;
            if (age < 0.0 || age > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
            vec3 n = normalize(aExtra.xyz);
            vec3 t = normalize(abs(n.y) < 0.99 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
            vec3 b = cross(n, t);
            float c = cos(aExtra.w), s = sin(aExtra.w);
            vec3 tr = t * c + b * s, br = -t * s + b * c;
            vec3 p = aPos + (tr * position.x + br * position.y) * aData.z + n * 0.03;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            vUv = position.xy; vAge = age; vKind = aData.w; vSeed = aExtra.w;
        }`,
    fragmentShader: /* glsl */`
        varying vec2 vUv; varying float vAge, vKind, vSeed;
        ${NOISE}
        void main() {
            vec2 uv = vUv * 2.0;
            float d = length(uv);
            float n = fbm(uv * 2.4 + vSeed * 3.1);
            float fade = min(1.0, (1.0 - vAge) * 5.0) * min(1.0, vAge * 60.0);
            vec3 col; float a;
            if (vKind < 0.5) {                      // scorch: a charred blotch, embers at its edge while fresh
                float m = smoothstep(1.0, 0.25, d + (n - 0.5) * 0.7);
                float rim = smoothstep(0.2, 0.0, abs(m - 0.35)) * max(0.0, 1.0 - vAge * 8.0);
                col = mix(vec3(0.05, 0.04, 0.035), vec3(1.0, 0.45, 0.1), rim);
                a = max(m * 0.82, rim * 0.9);
            } else if (vKind < 1.5) {               // wet: a dark, soft-edged patch
                float m = smoothstep(1.0, 0.35, d + (n - 0.5) * 0.5);
                col = vec3(0.04, 0.06, 0.09); a = m * 0.58;
            } else {                                // cracked earth: a dent and radial fissures
                float ang = atan(uv.y, uv.x);
                float f = pow(abs(sin(ang * 4.0 + n * 5.0 + vSeed)), 60.0) + pow(abs(sin(ang * 7.0 - n * 4.0 + vSeed * 2.0)), 90.0) * 0.7;
                float lines = f * smoothstep(1.0, 0.15, d) * step(0.12, d);
                float dent = smoothstep(0.45, 0.0, d + (n - 0.5) * 0.3) * 0.5;
                col = vec3(0.08, 0.065, 0.05); a = max(lines, dent) * 0.85;
            }
            a *= fade;
            if (a < 0.01) discard;
            gl_FragColor = vec4(col, a);
        }`,
    transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
});

const _c = new THREE.Color(), _n = new THREE.Vector3();

export class Juice {
    /**
     * @param {object} o
     * @param {THREE.Scene} o.scene
     * @param {object} o.hero        PlayerController (position, anim)
     * @param {object} o.cam         CameraRig (its .cam is shaken)
     */
    constructor({ scene, hero, cam }) {
        Object.assign(this, { scene, hero, cam });
        this.t = 0;
        this.trauma = 0;
        this.flares = new Quads(scene, JUICE.flares, flareMat());
        this.rings = new Quads(scene, JUICE.rings, ringMat());
        this.decals = new Quads(scene, JUICE.decals, decalMat());
        this.flashEl = document.getElementById('fx-flash') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'fx-flash' });
        this.flashT = 0;
        this.off = [
            EventBus.on(EV.IMPACT, e => this._impact(e)),
            EventBus.on(EV.EXPLOSION, e => e.pos && this._blast(e.pos, 1)),
            EventBus.on(EV.FIRESTORM, e => this._blast({ x: e.x, y: Ground.height(e.x, e.z), z: e.z }, 1.4)),
            EventBus.on(EV.SPLASH, e => this._splash(e)),
            EventBus.on(EV.EARTH_RAISED, e => this._earth(e, 1)),
            EventBus.on(EV.EARTH_PULLED, e => this._earth(e, 0.5)),
            EventBus.on(EV.ICE, e => { const p = this._ground(e.x, e.z); this.flare(p, 'ice', 2.2); this.ring(p, 'ice', 2.5); }),
            EventBus.on(EV.MUD, e => this.decal(this._ground(e.x, e.z), 'wet', 2.6)),
            EventBus.on(EV.LAVA, e => { const p = this._ground(e.x, e.z); this.decal(p, 'scorch', 2.8); this.shake(0.3, p); }),
            EventBus.on(EV.PIECE_BROKEN, e => { if (e.pos && e.cause !== 'environment') { this.shake(0.12, e.pos); this.flare(e.pos, 'dust', 1.2); } }),
            EventBus.on(EV.STONE_CAUGHT, () => { const p = this.hero.position; this.flare({ x: p.x, y: p.y + 1.4, z: p.z }, 'earth', 1.0); this.shake(0.12); }),
            EventBus.on(EV.HURT, e => this._hurt(e)),
            EventBus.on(EV.LANDED, e => { const p = { x: e.x, y: e.y, z: e.z }; this.ring(p, 'dust', 1.6 + e.k * 1.5); this.shake(0.12 + e.k * 0.3, p); if (e.k > 0.5) this.decal(p, 'crack', 1.4); }),
            EventBus.on(EV.LANDMARK, () => this.shake(1)),
        ];
    }

    // ---- the pieces --------------------------------------------------------------------------

    /** Add trauma (0..1) from a blow at `at` (falls off with distance from the hero), or felt in full. */
    shake(amount, at = null) {
        let k = 1;
        if (at) { const h = this.hero.position; k = Math.max(0, 1 - Math.hypot(at.x - h.x, at.z - h.z) / JUICE.shake.far); }
        this.trauma = Math.min(1, this.trauma + amount * k);
    }

    flare(p, tint, size = 1.5, life = 0.32) {
        const k = Renderer.quality.fx ?? 1;
        _c.set(JUICE.tint[tint] ?? tint);
        this.flares.put(p, this.t, life, size * (0.6 + 0.4 * k), 0, _c);
    }

    ring(p, tint, size = 2, life = 0.55) {
        if ((Renderer.quality.fx ?? 1) < 0.5) return;                                    // the ladder sheds rings last but one
        _c.set(JUICE.tint[tint] ?? tint);
        this.rings.put({ x: p.x, y: p.y + 0.05, z: p.z }, this.t, life, size, 0, _c);
    }

    decal(p, kind, size = 1.6) {
        if ((Renderer.quality.fx ?? 1) < 0.75) return;                                   // the ladder sheds decals first
        const e = 0.6, gx = Ground.height(p.x + e, p.z) - Ground.height(p.x - e, p.z), gz = Ground.height(p.x, p.z + e) - Ground.height(p.x, p.z - e);
        _n.set(-gx, 2 * e, -gz).normalize();
        this.decals.put({ x: p.x, y: Ground.height(p.x, p.z), z: p.z }, this.t, JUICE.decalLife * (0.8 + Math.random() * 0.4), size, KIND[kind] ?? 0, _c.set(0), [_n.x, _n.y, _n.z, Math.random() * 6.28]);
    }

    /** A screen flash: `color` css, `peak` opacity, over `secs`. Hurt flashes the edges. */
    flash(color, peak = 0.35, secs = 0.35, edge = false) {
        const el = this.flashEl;
        el.style.background = edge ? `radial-gradient(ellipse at center, transparent 45%, ${color} 100%)` : color;
        el.style.transition = 'none';
        el.style.opacity = String(peak);
        void el.offsetWidth;                                                              // restart the fade
        el.style.transition = `opacity ${secs}s ease-out`;
        el.style.opacity = '0';
    }

    // ---- what each event looks like --------------------------------------------------------

    _ground(x, z) { return { x, y: Ground.height(x, z), z }; }

    _impact(e) {
        const energy = Math.min(1, (e.speed * Math.sqrt(e.mass || 1)) / 40);
        if (energy < 0.08) return;
        const p = { x: e.x, y: e.y, z: e.z }, tint = e.element === 'fire' ? 'fire' : e.element === 'water' ? 'water' : 'earth';
        this.flare(p, tint, 0.8 + energy * 2.2, 0.22 + energy * 0.2);
        if (energy > 0.25) this.ring({ x: e.x, y: Ground.height(e.x, e.z), z: e.z }, 'dust', 1 + energy * 2.5);
        if (energy > 0.45 && e.ground) this.decal(p, 'crack', 0.9 + energy * 1.4);
        this.shake(energy * 0.45, p);
    }

    _blast(p, k) {
        this.flare({ x: p.x, y: p.y + 0.5, z: p.z }, 'fire', 3.2 * k, 0.45);
        this.ring(this._ground(p.x, p.z), 'fire', 3.5 * k, 0.6);
        this.decal(p, 'scorch', 2.4 * k);
        this.shake(0.5 * k, p);
        const h = this.hero.position;
        if (Math.hypot(p.x - h.x, p.z - h.z) < 10) this.flash('rgba(255,190,120,1)', 0.22 * k, 0.4);
    }

    _splash(e) {
        const p = this._ground(e.x, e.z);
        this.flare({ x: e.x, y: e.y, z: e.z }, 'water', 1.2 + e.strength, 0.25);
        this.ring(p, 'water', 1.5 + e.strength * 1.5);
        this.decal(p, 'wet', 1.2 + e.strength * 1.2);
    }

    _earth(e, k) {
        const p = this._ground(e.x, e.z);
        if (e.cause && e.cause !== 'player') return;
        this.ring(p, 'dust', 1.4 + k * 1.6, 0.5);
        this.decal(p, 'crack', 1 + k * 1.2);
        this.flare({ x: p.x, y: p.y + 0.3, z: p.z }, 'dust', 0.8 + k, 0.25);
        this.shake(0.1 + k * 0.18, p);
    }

    _hurt(e) {
        const k = Math.min(1, (e.amount || 1) / 20);
        this.hero.anim?.flinch?.();
        this.shake(0.2 + k * 0.5);
        this.flash('rgba(200,20,20,0.9)', 0.35 + k * 0.4, 0.45, true);
    }

    // ---- per frame -------------------------------------------------------------------------

    update(dt) {
        if (!this._freeze) this.t += dt;                 // _freeze: hold every effect still (screenshots, QA)
        for (const q of [this.flares, this.rings, this.decals]) { q.mat.uniforms.uTime.value = this.t; q.tick(this.t); }
        this.flares.mat.uniforms.uK.value = 0.6 + 0.4 * (Renderer.quality.fx ?? 1);
        this.trauma = Math.max(0, this.trauma - JUICE.shake.decay * dt);
    }

    /** After the camera rig has placed the camera: shake it (trauma², smooth noise). */
    apply(cam) {
        if (this.trauma <= 0) return;
        const S = JUICE.shake, a = this.trauma * this.trauma, f = this.t * S.freq;
        const nz = (o) => Math.sin(f + o) * 0.6 + Math.sin(f * 1.7 + o * 2.3) * 0.3 + Math.sin(f * 3.1 + o * 1.1) * 0.1;
        cam.position.x += nz(0.0) * S.offset * a;
        cam.position.y += nz(3.7) * S.offset * a * 0.7;
        cam.position.z += nz(7.1) * S.offset * a;
        cam.rotateZ(nz(11.3) * S.roll * a);
    }

    /** What's live, for tests and the debug readout. */
    stats() { return { flares: this.flares.live(this.t), rings: this.rings.live(this.t), decals: this.decals.live(this.t), trauma: +this.trauma.toFixed(3) }; }

    dispose() { this.off.forEach(f => f()); this.flares.dispose(); this.rings.dispose(); this.decals.dispose(); this.flashEl.style.opacity = '0'; }
}
