// ============================================================
// AIR — the Conduit's own breath (docs/CONTEXT_CONTROLS.md, "Air")
// ============================================================
//
// Earth needs stone, Fire needs coals or flame, Water needs a basin. Air
// needs nothing: it comes from the hero. Touch the hero, then:
//
//   WIND    drag: a steady cone of wind from the hero toward what the finger
//           points at, ~7 m long, for as long as the finger stays down
//   GUST    flick: one hard blast in the flick's direction
//
// What moving air does:
//   pushes     light things fly, rocks roll (heavy ones barely), a fireball
//              or water orb in flight is deflected
//   fans fire  a young flame (< 2.5 s old) blows out; an established fire
//              flares and spreads DOWNWIND. Blowing on a fire too late
//              drives it across the wall. That is on purpose.
//   breaks     a gust knocks damaged timber loose (steady wind doesn't)
//
// And Air is the MOVE element for loose, light things (a plank knocked out
// of the barricade): Intent routes that through Channel like any hold.
//
// Everything moving air causes is the player's (§12).
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { EventBus, EV } from '../core/EventBus.js';
import { Pool } from '../art/FireFx.js';

export const AIR = {
    touchPx: 60,          // minimum radius of the hero as a touch target
    windLen: 7,           // metres the steady wind reaches
    windAngle: 0.45,      // half-angle of the cone, radians (~26°)
    windPush: 16,         // m/s² on light things in the wind (heavier move less)
    gustLen: 9,
    gustAngle: 0.6,
    gustPush: 12,         // m/s given at once by a gust
    gustWear: 70,         // damage to timber at the gust's heart: breaks damaged planks, cracks sound ones
    looseMass: 12,        // Air lifts loose things up to this heavy
};

const _ray = new THREE.Raycaster();
const _v2 = new THREE.Vector2();
const _ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export class AirSystem {
    constructor({ scene, camera, interactables, channel, hero, fire, solids }) {
        Object.assign(this, { scene, camera, interactables, channel, hero, fire, solids });
        this.wind = null;          // { dir: Vector3, aim: Vector3 } while blowing
        this.time = 0;
        this.gusts = 0;
        this.streaks = new Pool(220, true);
        scene.add(this.streaks.points);
    }

    /** The hero's chest: where Air comes from. */
    origin(out = new THREE.Vector3()) { const p = this.hero.position; return out.set(p.x, p.y + 1.3, p.z); }

    /** Is the screen point (x, y) on the hero (generously)? */
    onHero(x, y) {
        const p = this.hero.position;
        const a = new THREE.Vector3(p.x, p.y + 0.1, p.z).project(this.camera);
        const b = new THREE.Vector3(p.x, p.y + 1.8, p.z).project(this.camera);
        if (a.z > 1 || b.z > 1) return false;
        const ax = (a.x + 1) / 2 * innerWidth, ay = (1 - a.y) / 2 * innerHeight;
        const bx = (b.x + 1) / 2 * innerWidth, by = (1 - b.y) / 2 * innerHeight;
        const cx = (ax + bx) / 2, cy = (ay + by) / 2;
        const r = Math.max(AIR.touchPx, Math.abs(ay - by) * 0.6);
        return Math.hypot(x - cx, (y - cy) * 0.8) < r;
    }

    canMove(entry) { return entry.body.type === CANNON.Body.DYNAMIC && entry.body.mass <= AIR.looseMass; }

    // ---- wind -------------------------------------------------------------

    /** Point the wind at what is under the finger (or along the view, at the sky). */
    aim(x, y) {
        const dir = this._dirTo(x, y);
        if (!this.wind) { this.wind = { dir: dir.clone(), aim: new THREE.Vector3() }; EventBus.emit(EV.WIND, { kind: 'wind', cause: 'player' }); }
        this.wind.dir.lerp(dir, 0.5).normalize();
        this.wind.aim.copy(this.origin()).addScaledVector(this.wind.dir, 3);
    }

    // From the hero's chest toward what is under screen point (x, y).
    _dirTo(x, y) {
        _v2.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
        _ray.setFromCamera(_v2, this.camera);
        const meshes = this.solids.concat(this.interactables.things.map(t => t.mesh));
        const hit = _ray.intersectObjects(meshes, true)[0];
        const g = _ray.ray.intersectPlane(_ground, new THREE.Vector3());
        let p = hit ? hit.point : g;
        if (hit && g && _ray.ray.origin.distanceTo(g) < hit.distance) p = g;
        const o = this.origin();
        const dir = p ? p.clone().sub(o) : _ray.ray.direction.clone();
        const flat = Math.max(0.001, Math.hypot(dir.x, dir.z));
        dir.set(dir.x / flat, Math.max(-0.35, Math.min(0.5, dir.y / flat)), dir.z / flat).normalize();
        return dir;
    }

    stop() { this.wind = null; }

    /** A gust along `dir` (world). */
    gust(dir) {
        const d = dir.clone();
        d.y = Math.max(-0.2, Math.min(0.35, d.y));
        d.normalize();
        this.gusts++;
        this._blow(d, AIR.gustLen, AIR.gustAngle, 0, true);
        const o = this.origin();
        for (let i = 0; i < 60; i++) this._streak(o, d, 14, 0.5);
        EventBus.emit(EV.WIND, { kind: 'gust', cause: 'player' });
    }

    /**
     * A gust from a flick. It goes toward what is under the finger where it
     * lifted: on a phone a flick at a wall 5 m ahead is mostly sideways on
     * screen (depth is squashed), so screen direction alone aims badly. A
     * flick that ends on the hero falls back to screen direction.
     */
    gustFromFlick(vx, vy, x, y) {
        if (x !== undefined && !this.onHero(x, y)) { this.gust(this._dirTo(x, y)); return; }
        const fwd = new THREE.Vector3();
        this.camera.getWorldDirection(fwd);
        fwd.y = 0; fwd.normalize();
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
        const len = Math.hypot(vx, vy) || 1;
        const dir = right.multiplyScalar(vx / len).addScaledVector(fwd, -vy / len);
        dir.y = 0.08;
        this.gust(dir);
    }

    // Everything in the cone from the hero along `dir`. Steady wind: `dt`
    // seconds of it; a gust: dt = 0 and `gust` true.
    _blow(dir, len, angle, dt, gust) {
        const o = this.origin();
        const tan = Math.tan(angle);
        const _q = new THREE.Vector3();
        const inCone = q => {
            const v = _q.set(q.x, q.y, q.z).sub(o);       // q may be a three or a cannon vector
            const along = v.dot(dir);
            if (along <= 0 || along > len) return 0;
            const across = v.addScaledVector(dir, -along).length();
            const wide = along * tan + 0.6;
            // A gust carries its strength further than a steady wind.
            const fall = gust ? 1 - 0.6 * along / len : 1 - along / len;
            return across < wide ? fall * (1 - 0.5 * across / wide) : 0;
        };
        // Fire: blown out if young, fanned if established.
        for (const t of this.interactables.things) {
            if (!this.fire.isBurning(t)) continue;
            const k = inCone(t.pos());
            if (k > 0) this.fire.wind(t, gust ? 1 : dt, dir, 'player');
        }
        // A gust knocks damaged timber loose.
        if (gust) {
            for (const t of this.interactables.things) {
                const piece = t.entry?.data.piece, owner = t.entry?.data.owner;
                if (!piece || piece.broken) continue;
                const k = inCone(t.pos());
                if (k > 0) owner.wear(piece, AIR.gustWear * k, 'player', dir.clone().multiplyScalar(6));
            }
        }
        // Push everything loose. Heavier moves less.
        for (const e of Physics.all()) {
            const b = e.body;
            if (b.type !== CANNON.Body.DYNAMIC || e.tier === TIER.PLAYER || this.channel.held?.entry === e) continue;
            const k = inCone(b.position);
            if (k <= 0) continue;
            const m = k / (1 + b.mass / 4);
            const dv = gust ? AIR.gustPush * m : AIR.windPush * m * dt;
            b.wakeUp();
            b.velocity.x += dir.x * dv; b.velocity.y += (dir.y + 0.25) * dv; b.velocity.z += dir.z * dv;
            if (dv > 0.02) { e.data.thrownBy = 'player'; e.data.thrownAt = performance.now(); }
        }
    }

    _streak(o, dir, speed, spread) {
        const j = () => (Math.random() - 0.5) * spread;
        const v = dir.clone().multiplyScalar(speed * (0.7 + Math.random() * 0.5));
        this.streaks.spawn({
            x: o.x + j() * 0.5, y: o.y + j() * 0.5, z: o.z + j() * 0.5,
            vx: v.x + j() * speed * 0.35, vy: v.y + j() * speed * 0.2, vz: v.z + j() * speed * 0.35,
            max: 0.35 + Math.random() * 0.3, s0: 0.16, s1: 0.04,
        });
    }

    update(dt) {
        this.time += dt;
        if (this.wind) {
            this._blow(this.wind.dir, AIR.windLen, AIR.windAngle, dt, false);
            const o = this.origin();
            for (let i = 0; i < 90 * dt; i++) this._streak(o, this.wind.dir, 9, 0.6);
        }
        this.streaks.update(dt, (k, tint, i) => {
            tint[i * 3] = 0.78; tint[i * 3 + 1] = 0.95; tint[i * 3 + 2] = 0.88;
            return Math.sin(k * Math.PI) * 0.55;
        }, 0);
    }

    stats() { return { blowing: !!this.wind, gusts: this.gusts, streaks: this.streaks.alive }; }
}
