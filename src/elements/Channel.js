// ============================================================
// CHANNEL — the hero's hands: hold, move, throw, for every element
// ============================================================
//
// Extracted from Phase 1's EarthSystem. Whatever the element, holding works
// the same way, and the player already said it feels right for Earth:
//
//   HOLD     the object follows the finger across a plane facing the camera,
//            pulled by a spring (never teleported), kept within the hero's
//            reach and above the ground, with gravity cancelled
//   THROW    a fast release: swipe direction on screen → world direction
//            (up = away), swipe speed → throw speed
//   DROP     a slow release: it falls where it is
//
// A channel can also AIM at something it is not holding (Fire igniting a
// plank where it stands): the hero reaches toward it and the tether joins
// hand and target, in the colour of the element doing the work.
//
// The hero channels one thing at a time. That is a rule, not a limitation of
// the code: a Conduit's power is in what they choose to touch.
// ============================================================

import { THREE } from '../engine/lib.js';
import { ELEMENT } from '../art/Palette.js';
import { EventBus, EV } from '../core/EventBus.js';

export const HOLD = {
    range: 14,           // how far from the hero a held thing may drift before it is let go
    reach: 8,            // how far from the hands the hold target may be
    holdSpeed: 18,       // m/s cap while following the finger
    throwMin: 15, throwMax: 36,
    gravity: 22,         // Physics' gravity, cancelled while held
};

const _ray = new THREE.Raycaster();
const _v2 = new THREE.Vector2();
const _p = new THREE.Vector3();

export class Channel {
    constructor({ camera, hero, prog }) {
        this.prog = prog;
        this.camera = camera;
        this.hero = hero;
        this.held = null;       // { entry, target, plane, element }
        this.aim = null;        // { pos: Vector3, element } while changing something in place
        this.time = 0;
        this.throws = 0;
        this.tether = this._makeTether();
    }

    get element() { return this.held?.element || this.aim?.element || null; }

    grab(entry, element, { lift = 1.3 } = {}) {
        entry.body.wakeUp();
        const normal = new THREE.Vector3();
        this.camera.getWorldDirection(normal);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal.negate(), entry.mesh.position);
        // It rises first, so the grab reads before the first drag.
        const target = entry.mesh.position.clone();
        target.y = Math.max(target.y + lift, 1.4);
        this.held = { entry, target, plane, element };
        this.aim = null;
        this.hero.faceTarget = target;
        EventBus.emit(EV.OBJECT_GRABBED, { id: entry.id, element });
    }

    /** Reach toward something without holding it. `null` stops. */
    aimAt(pos, element) {
        this.aim = pos ? { pos, element } : null;
        if (!this.held) this.hero.faceTarget = pos || null;
    }

    drag(x, y) {
        if (!this.held) return;
        _v2.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
        _ray.setFromCamera(_v2, this.camera);
        const hit = _ray.ray.intersectPlane(this.held.plane, _p);
        if (hit) this.held.target.copy(hit);
    }

    release({ flick = false, vx = 0, vy = 0 } = {}) {
        if (!this.held) return;
        const { entry, element } = this.held;
        if (flick) {
            const fwd = new THREE.Vector3();
            this.camera.getWorldDirection(fwd);
            fwd.y = 0; fwd.normalize();
            const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
            const len = Math.hypot(vx, vy);
            const dir = right.multiplyScalar(vx / len).addScaledVector(fwd, -vy / len);
            dir.y = 0.16;
            dir.normalize();
            // Earth's throws grow with Earth's Power; the others throw at full reach.
            const max = element === 'earth' ? this.prog.earth('throwMax') : HOLD.throwMax;
            const speed = HOLD.throwMin + (max - HOLD.throwMin) * Math.min(1, Math.max(0, (len - 900) / 2600));
            this.throwEntry(entry, dir, speed, element);
        } else {
            entry.data.droppedAt = performance.now();
            // A slow release is a set-down: it stops following the finger
            // (without this, the wobble of low Control flings it sideways).
            const v = entry.body.velocity;
            v.x *= 0.15; v.z *= 0.15;
            entry.body.angularVelocity.scale(0.2, entry.body.angularVelocity);
            // Low Control: a stone let go slowly still lands hard.
            if (element === 'earth') v.y -= this.prog.earth('slam');
        }
        this.let();
    }

    /** Throw along `dir` at `speed`. Also the QA entry point. */
    throwEntry(entry, dir, speed, element = 'earth') {
        const b = entry.body;
        b.wakeUp();
        b.velocity.set(dir.x * speed, dir.y * speed, dir.z * speed);
        b.angularVelocity.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
        entry.data.thrownBy = 'player';
        entry.data.thrownAt = performance.now();
        this.hero.anim.throw();
        this.throws++;
        EventBus.emit(EV.OBJECT_THROWN, { id: entry.id, element, speed: Math.round(speed), cause: 'player' });
    }

    let() {
        this.held = null;
        this.aim = null;
        this.hero.faceTarget = null;
    }

    /** The hero's arm pose while channelling, or null. */
    pose() {
        const t = this.held?.entry.mesh.position || this.aim?.pos;
        if (!t) return null;
        const hp = this.hero.position;
        const dx = t.x - hp.x, dz = t.z - hp.z;
        const pitch = Math.atan2(t.y - (hp.y + 1.35), Math.max(0.3, Math.hypot(dx, dz)));
        let yaw = Math.atan2(dx, dz) - this.hero.facing;
        yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
        return { pitch: Math.max(-0.8, Math.min(1.2, pitch)), yaw };
    }

    update(dt) {
        this.time += dt;
        if (this.held) {
            const { entry, target } = this.held;
            const b = entry.body;
            if (entry.data.gone || !b.world) { this.let(); }
            else if (b.position.distanceTo(this.hero.body.position) > HOLD.range + 2) { this.let(); }
            else {
                const hand = this.hero.handPoint(new THREE.Vector3());
                const off = target.clone().sub(hand);
                if (off.length() > HOLD.reach) target.copy(hand).addScaledVector(off.normalize(), HOLD.reach);
                const r = entry.data.radius || 0.5;
                if (target.y < r + 0.15) target.y = r + 0.15;
                // Low Earth Control: the held stone drifts about the finger.
                const aim = target.clone();
                if (this.held.element === 'earth') {
                    const w = this.prog.earth('wobble'), t = this.time;
                    aim.x += Math.sin(t * 2.3) * w + Math.sin(t * 5.1) * w * 0.4;
                    aim.y += Math.sin(t * 3.1 + 1) * w * 0.6;
                    aim.z += Math.cos(t * 1.9) * w + Math.cos(t * 4.4) * w * 0.4;
                }
                const want = aim.sub(b.position).multiplyScalar(9);
                if (want.length() > HOLD.holdSpeed) want.setLength(HOLD.holdSpeed);
                const k = 1 - Math.exp(-14 * dt);
                b.velocity.x += (want.x - b.velocity.x) * k;
                b.velocity.y += (want.y - b.velocity.y) * k + HOLD.gravity * dt;
                b.velocity.z += (want.z - b.velocity.z) * k;
                b.angularVelocity.scale(1 - Math.min(1, 3 * dt), b.angularVelocity);
                b.angularVelocity.y += 1.2 * dt;                  // a slow, living spin
                this.hero.faceTarget = entry.mesh.position;
            }
        }
        this._updateTether();
    }

    // A string of motes from the hero's hand to what they are channelling,
    // in the element's colour.
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
        const b = this.held?.entry.mesh.position || this.aim?.pos;
        if (!b) { t.visible = false; return; }
        t.visible = true;
        t.material.color.setHex(ELEMENT[this.element].rune);
        const a = this.hero.handPoint(new THREE.Vector3());
        const arr = t.geometry.attributes.position.array;
        const n = t.userData.n;
        for (let i = 0; i < n; i++) {
            const f = ((i / n) + this.time * 0.9) % 1;
            const w = Math.sin(f * Math.PI) * 0.25;
            arr[i * 3]     = a.x + (b.x - a.x) * f + Math.sin(this.time * 7 + i) * w;
            arr[i * 3 + 1] = a.y + (b.y - a.y) * f + Math.sin(f * Math.PI) * 0.5 + Math.cos(this.time * 5 + i * 1.7) * w;
            arr[i * 3 + 2] = a.z + (b.z - a.z) * f + Math.cos(this.time * 6 + i) * w;
        }
        t.geometry.attributes.position.needsUpdate = true;
    }
}
