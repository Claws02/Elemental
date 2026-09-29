// ============================================================
// EARTH — grab, hold, throw (§9, Phase 1)
// ============================================================
//
// The first element, and the test of the whole game's premise: does moving a
// boulder with your finger feel like power?
//
//   SENSE    Rocks in range glow faintly in Earth's amber when Earth is the
//            active element (§36: "nearby rocks highlight subtly").
//   GRAB     Touch a rock. It lifts off the ground toward the hero's reach.
//            Fat-finger assist: a touch that misses but lands near a rock's
//            on-screen position still takes it.
//   HOLD     Drag. The rock follows the finger across a plane facing the
//            camera, pulled by a spring, never teleported, so it knocks into
//            things on the way. It cannot leave the hero's reach.
//   THROW    Release while moving the finger fast. The swipe's direction on
//            screen becomes the throw's direction in the world (up = away),
//            and its speed becomes the throw's speed.
//   DROP     Release slowly and the rock falls where it is.
//
// Step 6 of §73's physics rule, "record the world event", happens here: a
// thrown rock is tagged with who threw it, which is how the barricade knows
// the player broke it.
// ============================================================

import { ELEMENT } from '../art/Palette.js';
import { EventBus, EV } from '../core/EventBus.js';

export const EARTH = {
    range: 14,           // how far the hero can sense and grab
    reach: 8,            // how far from the hands a held rock may be
    maxMass: 400,        // heavier than this does not move (yet)
    holdSpeed: 18,       // m/s cap while following the finger
    throwMin: 15, throwMax: 36,
    assistPx: 56,        // fat-finger radius
};

const _ray = new THREE.Raycaster();
const _v2 = new THREE.Vector2();
const _p = new THREE.Vector3();

export class EarthSystem {
    constructor({ camera, hero, rocks }) {
        this.camera = camera;
        this.hero = hero;
        this.rocks = rocks;           // physics entries with .mesh
        this.held = null;             // { entry, target: Vector3, plane: THREE.Plane }
        this.active = true;           // Earth is the selected element
        this.time = 0;
        this.throws = 0;
        this.tether = this._makeTether();
    }

    // ---- targeting -------------------------------------------------------

    inRange(e) { return e.body.position.distanceTo(this.hero.body.position) <= EARTH.range && e.body.mass <= EARTH.maxMass; }

    /** What a touch at (x, y) would grab, or null. */
    pickAt(x, y) {
        if (!this.active) return null;
        _v2.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
        _ray.setFromCamera(_v2, this.camera);
        const meshes = this.rocks.filter(e => this.inRange(e)).map(e => e.mesh);
        const hit = _ray.intersectObjects(meshes, true)[0];
        if (hit) {
            let o = hit.object;
            while (o && !meshes.includes(o)) o = o.parent;
            return this.rocks.find(e => e.mesh === o) || null;
        }
        // Fat-finger assist: the nearest in-range rock on screen, if close enough.
        let best = null, bestD = EARTH.assistPx;
        for (const e of this.rocks) {
            if (!this.inRange(e)) continue;
            _p.copy(e.mesh.position).project(this.camera);
            if (_p.z > 1) continue;
            const sx = (_p.x + 1) / 2 * innerWidth, sy = (1 - _p.y) / 2 * innerHeight;
            const d = Math.hypot(sx - x, sy - y);
            if (d < bestD) { bestD = d; best = e; }
        }
        return best;
    }

    // ---- gestures --------------------------------------------------------

    grab(entry) {
        const b = entry.body;
        b.wakeUp();
        const normal = new THREE.Vector3();
        this.camera.getWorldDirection(normal);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal.negate(), entry.mesh.position);
        // It rises first, so the grab reads before the first drag.
        const target = entry.mesh.position.clone();
        target.y = Math.max(target.y + 1.3, 1.4);
        this.held = { entry, target, plane };
        this.hero.faceTarget = target;
        EventBus.emit(EV.OBJECT_GRABBED, { id: entry.id, element: 'earth' });
    }

    drag(entry, x, y) {
        if (!this.held || this.held.entry !== entry) return;
        _v2.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
        _ray.setFromCamera(_v2, this.camera);
        const hit = _ray.ray.intersectPlane(this.held.plane, _p);
        if (hit) this.held.target.copy(hit);
    }

    release(entry, { flick, vx, vy }) {
        if (!this.held || this.held.entry !== entry) return;
        const b = entry.body;
        if (flick) {
            // Screen swipe → world direction: right is the camera's right,
            // up the screen is away from the camera, plus a little loft.
            const fwd = new THREE.Vector3();
            this.camera.getWorldDirection(fwd);
            fwd.y = 0; fwd.normalize();
            const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
            const len = Math.hypot(vx, vy);
            const dir = right.multiplyScalar(vx / len).addScaledVector(fwd, -vy / len);
            dir.y = 0.16;
            dir.normalize();
            const speed = EARTH.throwMin + (EARTH.throwMax - EARTH.throwMin) * Math.min(1, Math.max(0, (len - 900) / 2600));
            this.throwEntry(entry, dir, speed);
        }
        this._let();
    }

    /** Throw a rock along `dir` at `speed`. Also the QA entry point. */
    throwEntry(entry, dir, speed) {
        const b = entry.body;
        b.wakeUp();
        b.velocity.set(dir.x * speed, dir.y * speed, dir.z * speed);
        b.angularVelocity.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
        entry.data.thrownBy = 'player';
        entry.data.thrownAt = performance.now();
        this.hero.anim.throw();
        this.throws++;
        EventBus.emit(EV.OBJECT_THROWN, { id: entry.id, element: 'earth', speed: Math.round(speed), cause: 'player' });
    }

    _let() {
        this.held = null;
        this.hero.faceTarget = null;
    }

    // ---- per frame -------------------------------------------------------

    /** The hero's arm pose while channelling, or null. */
    channelPose() {
        if (!this.held) return null;
        const hp = this.hero.position;
        const t = this.held.entry.mesh.position;
        const dx = t.x - hp.x, dz = t.z - hp.z;
        const flat = Math.hypot(dx, dz);
        const pitch = Math.atan2(t.y - (hp.y + 1.35), Math.max(0.3, flat));
        let yaw = Math.atan2(dx, dz) - this.hero.facing;
        yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
        return { pitch: Math.max(-0.8, Math.min(1.2, pitch)), yaw };
    }

    update(dt) {
        this.time += dt;
        if (this.held) {
            const { entry, target } = this.held;
            const b = entry.body;
            // Keep the target within reach of the hands, and above the ground.
            const hand = this.hero.handPoint(new THREE.Vector3());
            const off = target.clone().sub(hand);
            if (off.length() > EARTH.reach) target.copy(hand).addScaledVector(off.normalize(), EARTH.reach);
            const r = entry.data.radius || 0.5;
            if (target.y < r + 0.15) target.y = r + 0.15;
            // Too far from the hero (they walked away): let go.
            if (b.position.distanceTo(this.hero.body.position) > EARTH.range + 2) { this._let(); }
            else {
                // Spring toward the target: set a desired velocity and ease into it.
                const want = target.clone().sub(b.position).multiplyScalar(9);
                if (want.length() > EARTH.holdSpeed) want.setLength(EARTH.holdSpeed);
                const k = 1 - Math.exp(-14 * dt);
                b.velocity.x += (want.x - b.velocity.x) * k;
                b.velocity.y += (want.y - b.velocity.y) * k + 22 * dt;   // cancel gravity
                b.velocity.z += (want.z - b.velocity.z) * k;
                b.angularVelocity.scale(1 - Math.min(1, 3 * dt), b.angularVelocity);
                b.angularVelocity.y += 1.2 * dt;                          // a slow, living spin
                this.hero.faceTarget = entry.mesh.position;
            }
        }
        this._highlight();
        this._updateTether();
    }

    _highlight() {
        const col = ELEMENT.earth.rune;
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
        for (const e of this.rocks) {
            const m = e.mesh.userData.ownMaterials?.body;
            if (!m) continue;
            let s = 0;
            if (this.held?.entry === e) s = 0.55 + pulse * 0.15;
            else if (this.active && this.inRange(e)) s = 0.05 + pulse * 0.07;
            m.emissive.setHex(col);
            m.emissiveIntensity = s;
        }
    }

    // A string of amber motes from the hero's hand to the held rock.
    _makeTether() {
        const N = 18;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
        const m = new THREE.PointsMaterial({
            color: ELEMENT.earth.rune, size: 0.14, transparent: true, opacity: 0.9,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const pts = new THREE.Points(g, m);
        pts.frustumCulled = false;
        pts.visible = false;
        pts.userData.n = N;
        return pts;
    }

    _updateTether() {
        const t = this.tether;
        if (!this.held) { t.visible = false; return; }
        t.visible = true;
        const a = this.hero.handPoint(new THREE.Vector3());
        const b = this.held.entry.mesh.position;
        const arr = t.geometry.attributes.position.array;
        const n = t.userData.n;
        for (let i = 0; i < n; i++) {
            // Motes travel from hand to rock; each wobbles on its own phase.
            const f = ((i / n) + this.time * 0.9) % 1;
            const w = Math.sin(f * Math.PI) * 0.25;
            arr[i * 3]     = a.x + (b.x - a.x) * f + Math.sin(this.time * 7 + i) * w;
            arr[i * 3 + 1] = a.y + (b.y - a.y) * f + Math.sin(f * Math.PI) * 0.5 + Math.cos(this.time * 5 + i * 1.7) * w;
            arr[i * 3 + 2] = a.z + (b.z - a.z) * f + Math.cos(this.time * 6 + i) * w;
        }
        t.geometry.attributes.position.needsUpdate = true;
    }
}
