// ============================================================
// FIRE FX — every flame and wisp of smoke in two draw calls
// ============================================================
//
// Two pooled particle systems, each a single THREE.Points:
//
//   flame   additive, yellow → orange → deep red as it rises and dies
//   smoke   normal blending, grey, slow, grows as it fades
//
// The pools are the budget (§54 "pooled particles"): when they are full, new
// emission is simply skipped, so a whole barricade on fire costs the same
// two draw calls as one torch. No lights are added for fire: a light per
// flame would cost every lit material on screen. Burning things glow through
// their own emissive instead (FireSystem).
// ============================================================

import { THREE } from '../engine/lib.js';

const VERT = /* glsl */`
    attribute float size;
    attribute float alpha;
    attribute vec3 tint;
    uniform float uViewH;
    varying vec3 vTint;
    varying float vAlpha;
    void main() {
        vTint = tint;
        vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * projectionMatrix[1][1] * uViewH * 0.5 / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
    }`;

const FRAG = (additive) => /* glsl */`
    varying vec3 vTint;
    varying float vAlpha;
    void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = ${additive ? 'vec4(vTint * a, a)' : 'vec4(vTint, a)'};
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }`;

const FLAME_COLS = [new THREE.Color(0xfff2b0), new THREE.Color(0xffa23a), new THREE.Color(0xd8401a), new THREE.Color(0x5a1408)];
const _c = new THREE.Color();

class Pool {
    constructor(n, additive) {
        this.n = n;
        this.alive = 0;
        this.p = Array.from({ length: n }, () => ({ life: 0, max: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 0, s1: 0 }));
        const g = new THREE.BufferGeometry();
        this.pos = new Float32Array(n * 3);
        this.size = new Float32Array(n);
        this.alpha = new Float32Array(n);
        this.tint = new Float32Array(n * 3);
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
        g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
        g.setAttribute('tint', new THREE.BufferAttribute(this.tint, 3));
        this.mat = new THREE.ShaderMaterial({
            vertexShader: VERT, fragmentShader: FRAG(additive),
            uniforms: { uViewH: { value: 800 } },
            transparent: true, depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = additive ? 3 : 2;
        this.free = [];
        for (let i = n - 1; i >= 0; i--) this.free.push(i);
    }

    spawn(o) {
        const i = this.free.pop();
        if (i === undefined) return false;          // over budget: skip
        Object.assign(this.p[i], o);
        this.p[i].life = 0;
        this.alive++;
        return true;
    }

    update(dt, colour, rise) {
        for (let i = 0; i < this.n; i++) {
            const q = this.p[i];
            if (q.max <= 0 || q.life >= q.max) { this.size[i] = 0; this.alpha[i] = 0; continue; }
            q.life += dt;
            if (q.life >= q.max) {
                this.size[i] = 0; this.alpha[i] = 0; q.max = 0;
                this.free.push(i); this.alive--;
                continue;
            }
            const k = q.life / q.max;
            q.vy += rise * dt;
            q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
            this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
            this.size[i] = q.s0 + (q.s1 - q.s0) * k;
            this.alpha[i] = colour(k, this.tint, i);
        }
        const g = this.points.geometry;
        g.attributes.position.needsUpdate = true;
        g.attributes.size.needsUpdate = true;
        g.attributes.alpha.needsUpdate = true;
        g.attributes.tint.needsUpdate = true;
    }
}

export class FireFx {
    constructor(scene, { flames = 320, smoke = 120 } = {}) {
        this.flame = new Pool(flames, true);
        this.smoke = new Pool(smoke, false);
        scene.add(this.flame.points, this.smoke.points);
    }

    /**
     * Fire at `p` (a Vector3). `rate` particles per second, spread over a box
     * `w` wide; `dt` makes the emission frame-rate independent.
     */
    burn(p, dt, { rate = 14, w = 0.5, h = 0.3, size = 0.55, smoke = 0.25 } = {}) {
        let n = rate * dt;
        while (n > 0) {
            if (n < 1 && Math.random() > n) break;
            n -= 1;
            this.flame.spawn({
                x: p.x + (Math.random() - 0.5) * w, y: p.y + (Math.random() - 0.5) * h, z: p.z + (Math.random() - 0.5) * w,
                vx: (Math.random() - 0.5) * 0.4, vy: 0.6 + Math.random() * 0.8, vz: (Math.random() - 0.5) * 0.4,
                max: 0.45 + Math.random() * 0.45, s0: size * (0.8 + Math.random() * 0.5), s1: size * 0.15,
            });
            if (Math.random() < smoke) this.smoke.spawn({
                x: p.x + (Math.random() - 0.5) * w, y: p.y + 0.4, z: p.z + (Math.random() - 0.5) * w,
                vx: (Math.random() - 0.5) * 0.3, vy: 0.5 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.3,
                max: 1.6 + Math.random() * 1.2, s0: size * 0.6, s1: size * 2.4,
            });
        }
    }

    /** A burst: a fireball landing, a flame pulled out of the coals. */
    burst(p, count = 24, size = 0.5, speed = 3) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u);
            const v = speed * (0.4 + Math.random() * 0.6);
            this.flame.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * r * v, vy: u * v + 1, vz: Math.sin(a) * r * v,
                max: 0.35 + Math.random() * 0.35, s0: size, s1: size * 0.1 });
        }
    }

    update(dt, viewH) {
        this.flame.mat.uniforms.uViewH.value = viewH;
        this.smoke.mat.uniforms.uViewH.value = viewH;
        this.flame.update(dt, (k, tint, i) => {
            const f = k * (FLAME_COLS.length - 1), j = Math.min(FLAME_COLS.length - 2, Math.floor(f));
            _c.copy(FLAME_COLS[j]).lerp(FLAME_COLS[j + 1], f - j);
            tint[i * 3] = _c.r; tint[i * 3 + 1] = _c.g; tint[i * 3 + 2] = _c.b;
            return (1 - k) * 0.9;
        }, 1.2);
        this.smoke.update(dt, (k, tint, i) => {
            tint[i * 3] = 0.16; tint[i * 3 + 1] = 0.15; tint[i * 3 + 2] = 0.14;
            return Math.sin(k * Math.PI) * 0.35;
        }, 0.1);
    }

    stats() { return { flame: this.flame.alive, flameMax: this.flame.n, smoke: this.smoke.alive, smokeMax: this.smoke.n }; }
}
