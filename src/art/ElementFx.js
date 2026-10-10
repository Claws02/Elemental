// ============================================================
// ELEMENT FX — the elements' own materials, and the ground breaking
// ============================================================
//
//   water stream   a living surface: ripples flowing along it, a fresnel
//                  rim, a sky-tinted sheen, white foam at its head and base
//   fireball       a churning shell of flame round a white-hot core
//   flame jet      tongues of fire streaming along the beam, hot at the axis
//   wind ribbons   translucent strands spiralling along a gust or the wind
//   ground plates  a column raised or a stone pulled breaks the ground into
//                  plates that lever up, hang a moment and settle back
//
// Shaders are cheap on purpose (two or three octaves of value noise, no
// raymarching): a phone pays for every pixel. One material instance per kind,
// shared, with one clock (ElementFx.update), so nothing compiles mid-play
// (Renderer.warm takes `materials`).
//
// Ideas after achrefelouafi/AvatarCastingAbilitiesThreeJS (MIT): an ocean-like
// water surface with fresnel and foam, a churning flame volume, wind ribbons,
// earth that paves and breaks; reduced to what a phone can afford.
// ============================================================

import { THREE } from '../engine/lib.js';
import { EventBus, EV } from '../core/EventBus.js';
import { Ground } from '../world/Ground.js';
import * as Renderer from '../engine/Renderer.js';

const NOISE = /* glsl */`
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ return 0.55 * n3(p) + 0.3 * n3(p * 2.03 + 3.1) + 0.15 * n3(p * 4.1 + 7.7); }`;

const clock = { value: 0 };

// ---- water ---------------------------------------------------------------------------------------------------------

/** The stream's surface. The tube carries uv: x along it (0 at the source, 1 at the head), y round it. */
export function waterStreamMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: clock, uSun: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() } },
        vertexShader: /* glsl */`
            varying vec2 vUv; varying vec3 vN, vW;
            void main() {
                vUv = uv;
                vec4 w = modelMatrix * vec4(position, 1.0);
                vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * w;
            }`,
        fragmentShader: /* glsl */`
            uniform float uTime; uniform vec3 uSun;
            varying vec2 vUv; varying vec3 vN, vW;
            ${NOISE}
            void main() {
                vec3 V = normalize(cameraPosition - vW), N = normalize(vN);
                // Ripples flowing from source to head.
                float flow = fbm3(vec3(vUv.x * 9.0 - uTime * 3.2, vUv.y * 3.0, uTime * 0.6));
                float streaks = smoothstep(0.55, 0.8, fbm3(vec3(vUv.x * 4.0 - uTime * 5.0, vUv.y * 8.0, 1.7)));
                float fres = pow(1.0 - abs(dot(N, V)), 2.2);
                vec3 deep = vec3(0.07, 0.32, 0.55), shallow = vec3(0.32, 0.72, 0.86), sky = vec3(0.75, 0.88, 1.0);
                vec3 col = mix(deep, shallow, 0.35 + 0.5 * flow);
                col = mix(col, sky, fres * 0.7);
                // A sun glint off the moving surface.
                vec3 H = normalize(uSun + V);
                col += vec3(1.0) * pow(max(dot(N, H), 0.0), 60.0) * (0.6 + flow);
                // Foam: white water at the head and where it leaves the surface, and on the bright streaks.
                float foam = smoothstep(0.82, 1.0, vUv.x) * (0.5 + flow) + smoothstep(0.12, 0.0, vUv.x) * 0.7 + streaks * 0.35;
                col = mix(col, vec3(0.95, 0.98, 1.0), clamp(foam, 0.0, 1.0));
                float a = clamp(0.62 + fres * 0.35 + foam * 0.3, 0.0, 0.95);
                gl_FragColor = vec4(col, a);
                #include <colorspace_fragment>
            }`,
        transparent: true, depthWrite: false,
    });
}

// ---- fire ----------------------------------------------------------------------------------------------------------

/** A fireball's shell: flame churning over a sphere, brightest where it faces you edge-on... no: hot at the centre, licking at the rim. */
export function fireShellMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: clock },
        vertexShader: /* glsl */`
            uniform float uTime;
            varying vec3 vN, vW, vP;
            ${NOISE}
            void main() {
                vec3 p = position;
                float n = fbm3(p * 3.0 + vec3(0.0, -uTime * 2.5, uTime * 0.7));
                p += normal * (n - 0.45) * 0.18;                              // the surface boils
                vec4 w = modelMatrix * vec4(p, 1.0);
                vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vP = position;
                gl_Position = projectionMatrix * viewMatrix * w;
            }`,
        fragmentShader: /* glsl */`
            uniform float uTime;
            varying vec3 vN, vW, vP;
            ${NOISE}
            void main() {
                vec3 V = normalize(cameraPosition - vW);
                float facing = abs(dot(normalize(vN), V));
                float n = fbm3(vP * 4.0 + vec3(0.0, -uTime * 3.0, uTime));
                float heat = clamp(facing * 1.0 + n * 0.6 - 0.1, 0.0, 1.0);
                vec3 col = mix(vec3(0.75, 0.12, 0.02), vec3(1.0, 0.55, 0.12), smoothstep(0.1, 0.6, heat));
                col = mix(col, vec3(1.0, 0.95, 0.75), smoothstep(0.7, 1.0, heat));
                float a = smoothstep(0.0, 0.4, heat) * (0.7 + 0.3 * n);
                gl_FragColor = vec4(col * a * 2.2, a);
            }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
}

/** The jet's beam: tongues of flame streaming from the hands to the target. The cone carries uv.y along its length. */
export function flameJetMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: clock, uWild: { value: 0 } },
        vertexShader: /* glsl */`
            varying vec2 vUv; varying vec3 vN, vW;
            void main() {
                vUv = uv;
                vec4 w = modelMatrix * vec4(position, 1.0);
                vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * w;
            }`,
        fragmentShader: /* glsl */`
            uniform float uTime, uWild;
            varying vec2 vUv; varying vec3 vN, vW;
            ${NOISE}
            void main() {
                vec3 V = normalize(cameraPosition - vW);
                float axis = abs(dot(normalize(vN), V));                       // 1 facing you: the hot middle of the beam
                float along = vUv.y;
                float n = fbm3(vec3(vUv.x * 6.0, along * 5.0 - uTime * 7.0, uTime * 1.3));
                float tongues = smoothstep(0.35 - uWild * 0.15, 0.75, n + axis * 0.35);
                float heat = tongues * (0.55 + 0.45 * axis) * (1.0 - along * 0.55);
                vec3 col = mix(vec3(0.85, 0.18, 0.03), vec3(1.0, 0.62, 0.15), smoothstep(0.2, 0.6, heat));
                col = mix(col, vec3(1.0, 0.95, 0.75), smoothstep(0.65, 0.95, heat));
                float a = heat * smoothstep(0.0, 0.08, along) * smoothstep(1.0, 0.85, along);
                gl_FragColor = vec4(col * a * 1.5, a);
            }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
}

// ---- wind ----------------------------------------------------------------------------------------------------------

const RIBBON = { n: 4, segs: 28, turns: 1.4, width: 0.22, gust: 0.55 };

/** Strands spiralling along the wind: built once along +z (length 1), placed and scaled per gust. */
export class WindRibbons {
    constructor(scene) {
        const N = RIBBON.segs;
        this.mat = new THREE.ShaderMaterial({
            uniforms: { uTime: clock, uK: { value: 0 } },
            vertexShader: /* glsl */`
                attribute float aSide;
                varying vec2 vUv;
                void main() { vUv = vec2(uv.x, aSide); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: /* glsl */`
                uniform float uTime, uK;
                varying vec2 vUv;
                ${NOISE}
                void main() {
                    float u = vUv.x;
                    // A bright run travelling out along the strand, broken up by noise.
                    float run = smoothstep(0.35, 0.0, abs(fract(u * 1.5 - uTime * 2.2) - 0.5));
                    float n = fbm3(vec3(u * 10.0 - uTime * 6.0, vUv.y * 3.0, 0.0));
                    float edge = smoothstep(1.0, 0.3, abs(vUv.y * 2.0 - 1.0));
                    float a = (0.25 + 0.75 * run) * (0.4 + 0.6 * n) * edge * smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.7, u) * uK;
                    if (a < 0.01) discard;
                    gl_FragColor = vec4(vec3(0.94, 1.0, 0.97), a * 0.55);
                }`,
            transparent: true, depthWrite: false, side: THREE.DoubleSide,
        });
        this.strands = [];
        for (let k = 0; k < RIBBON.n; k++) {
            const pos = [], uv = [], side = [], idx = [];
            for (let i = 0; i <= N; i++) {
                const u = i / N, a = u * RIBBON.turns * Math.PI * 2 + k * (Math.PI * 2 / RIBBON.n), r = 0.12 + u * 0.9;
                const cx = Math.cos(a) * r, cy = Math.sin(a) * r, w = RIBBON.width * (0.4 + u);
                pos.push(cx - Math.sin(a) * w * 0.5, cy + Math.cos(a) * w * 0.5, u, cx + Math.sin(a) * w * 0.5, cy - Math.cos(a) * w * 0.5, u);
                uv.push(u, 0, u, 1); side.push(0, 1);
                if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
            g.setIndex(idx);
            const m = new THREE.Mesh(g, this.mat);
            m.frustumCulled = false; m.renderOrder = 4;
            this.strands.push(m);
        }
        this.root = new THREE.Group();
        this.strands.forEach(m => this.root.add(m));
        this.root.visible = false;
        scene.add(this.root);
        this.k = 0; this.hold = 0; this.spin = 0;
    }
    /** Along `dir` from `o`, `len` long, `angle` the cone's half-angle; `hold` seconds (a gust) or every frame (the wind). */
    show(o, dir, len, angle, hold = RIBBON.gust) {
        if ((Renderer.quality.fx ?? 1) < 0.5) return;                    // the ladder sheds the ribbons
        this.root.position.copy(o);
        this.root.lookAt(o.x + dir.x, o.y + dir.y, o.z + dir.z);
        const r = Math.tan(angle) * len;
        this.root.scale.set(r, r, len);
        this.hold = Math.max(this.hold, hold);
    }
    update(dt) {
        this.hold -= dt;
        this.k += ((this.hold > 0 ? 1 : 0) - this.k) * Math.min(1, dt * (this.hold > 0 ? 14 : 5));
        this.mat.uniforms.uK.value = this.k;
        this.root.visible = this.k > 0.02;
        if (this.root.visible) { this.spin += dt * 2.6; this.strands.forEach((m, i) => { m.rotation.z = this.spin * (i % 2 ? 1 : 0.8); }); }
    }
}

// ---- earth ---------------------------------------------------------------------------------------------------------

const PLATES = { n: 56, rise: 0.12, hold: 1.2, sink: 1.4 };

/** Ground plates levered up round where the earth was raised or a stone pulled, then settling back (one draw call). */
export class GroundPlates {
    constructor(scene) {
        const g = new THREE.BoxGeometry(1, 0.22, 1, 1, 1, 1);
        // Chamfer the top: a slab, not a box.
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.86); p.setZ(i, p.getZ(i) * 0.86); }
        g.computeVertexNormals();
        this.mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x8a7a66, flatShading: true }), PLATES.n);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.count = 0; this.mesh.castShadow = false; this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
        this.live = [];                        // { x, z, y, size, yaw, tilt, t }
        this.off = [
            EventBus.on(EV.EARTH_RAISED, e => e.cause === 'player' && this.burst(e.x, e.z, 1)),
            EventBus.on(EV.EARTH_PULLED, e => e.cause === 'player' && this.burst(e.x, e.z, 0.5)),
        ];
        this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
    }
    /** A ring of plates round (x, z): k 1 a column (big, many), 0.5 a stone pulled. */
    burst(x, z, k = 1) {
        const fx = Renderer.quality.fx ?? 1;
        if (fx < 0.5) return;
        const n = Math.round((k > 0.7 ? 8 : 5) * Math.min(1, fx));
        const base = Math.random() * 6.283;
        for (let i = 0; i < n; i++) {
            if (this.live.length >= PLATES.n) this.live.shift();
            const a = base + (i / n) * 6.283 + (Math.random() - 0.5) * 0.4, d = (k > 0.7 ? 1.2 : 0.55) + Math.random() * 0.5 * k;
            const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
            this.live.push({ x: px, z: pz, y: Ground.height(px, pz), size: (0.45 + Math.random() * 0.35) * (0.6 + 0.6 * k), yaw: a, tilt: (0.35 + Math.random() * 0.35) * (0.6 + 0.5 * k), t: -Math.random() * 0.06 });
        }
    }
    update(dt) {
        const L = this.live, P = PLATES;
        for (const s of L) s.t += dt;
        while (L.length && L[0].t > P.rise + P.hold + P.sink) L.shift();
        for (let i = 0; i < L.length; i++) {
            const s = L[i], t = Math.max(0, s.t);
            // Levered up on the edge away from the centre, hung a moment, then settling and sinking back into the ground.
            const up = t < P.rise ? t / P.rise : t < P.rise + P.hold ? 1 : 1 - (t - P.rise - P.hold) / P.sink;
            const ease = up * up * (3 - 2 * up);
            this._e.set(0, s.yaw, 0, 'YXZ');
            this._q.setFromEuler(this._e);
            const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.sin(s.yaw), 0, -Math.cos(s.yaw)), -s.tilt * ease);
            this._q.premultiply(tilt);
            this._p.set(s.x, s.y - 0.12 + 0.12 * ease + 0.06 * Math.sin(ease * Math.PI), s.z);
            this._s.set(s.size, 1, s.size * 0.8);
            this._m.compose(this._p, this._q, this._s);
            this.mesh.setMatrixAt(i, this._m);
        }
        this.mesh.count = L.length;
        if (L.length) this.mesh.instanceMatrix.needsUpdate = true;
    }
    dispose() { this.off.forEach(f => f()); this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

// ---- the clock -------------------------------------------------------------------------------------------------------

/** One per game: the shared clock, and the wind ribbons and ground plates. */
export class ElementFx {
    constructor(scene) {
        this.ribbons = new WindRibbons(scene);
        this.plates = new GroundPlates(scene);
        ElementFx.current = this;
    }
    update(dt) { clock.value += dt; this.ribbons.update(dt); this.plates.update(dt); }
    dispose() { this.plates.dispose(); this.ribbons.root.parent?.remove(this.ribbons.root); if (ElementFx.current === this) ElementFx.current = null; }
}
ElementFx.current = null;
