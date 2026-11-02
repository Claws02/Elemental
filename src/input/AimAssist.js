// ============================================================
// AIM ASSIST — throws that land where you meant (docs/CONTROLS_WORKSHOP.md)
// ============================================================
//
// Three settings, saved on the device (Assist by default):
//
//   off      a throw goes exactly where the flick sent it
//   assist   a throw within ASSIST.bend of something worth hitting bends onto it
//            (magnetism: it never pulls a throw that wasn't already close)
//   lock     the best target in front of the camera wears a ring; a flick within
//            ASSIST.lockCone of it goes to it
//
// Worth hitting: a creature still in the fight, and a standing straw man. A throw
// aimed at one leads it by the flight time, and its arc is solved to reach it
// (the world falls at 22 m/s², Physics.js), so a hit is a hit at any range the
// throw can carry. The player's flick always chooses the direction; assist only
// finishes it.
// ============================================================

import { THREE } from '../engine/lib.js';
import { ELEMENT } from '../art/Palette.js';

export const ASSIST = {
    modes: ['off', 'assist', 'lock'],
    bend: 15 * Math.PI / 180,       // assist: how close a throw must already be
    lockCone: 40 * Math.PI / 180,   // lock: how roughly a flick must point at the lock
    range: 28,                      // metres: nothing further is considered
    lockView: 0.62,                 // lock: how far off the camera's centre (radians) a target can be picked
    gravity: 22,
};
const KEY = 'elemental.aim';
const _d = new THREE.Vector3();

export class AimAssist {
    constructor({ scene, camera, hero, world }) {
        Object.assign(this, { scene, camera, hero, world, creatures: null });
        let saved = null;
        try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode: the default */ }
        this.mode = ASSIST.modes.includes(saved) ? saved : 'assist';
        this.locked = null;          // { pos, vel } while in lock mode with something to lock
        this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 28), new THREE.MeshBasicMaterial({ color: ELEMENT.earth.rune, transparent: true, opacity: 0.85, depthWrite: false }));
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.visible = false;
        this.ring.renderOrder = 5;
        scene.add(this.ring);
    }

    setMode(m) {
        if (!ASSIST.modes.includes(m)) return;
        this.mode = m;
        try { localStorage.setItem(KEY, m); } catch (e) { /* not saved: still applies now */ }
        if (m !== 'lock') { this.locked = null; this.ring.visible = false; }
    }
    cycle() { this.setMode(ASSIST.modes[(ASSIST.modes.indexOf(this.mode) + 1) % ASSIST.modes.length]); return this.mode; }

    /** Everything worth hitting now: { pos, vel, size, id }. */
    targets() {
        const out = [], h = this.hero.position;
        for (const c of this.creatures?.all || []) {
            if (c.gone || c.state === 'dead' || c.state === 'off' || c.yielded || c.state === 'held') continue;
            const p = c.body.position;
            if (Math.hypot(p.x - h.x, p.z - h.z) > ASSIST.range) continue;
            out.push({ id: c.id, pos: new THREE.Vector3(p.x, p.y, p.z), vel: new THREE.Vector3(c.body.velocity.x, 0, c.body.velocity.z), size: c.entry?.data?.radius || 0.5 });
        }
        for (const [id, o] of this.world?.objects || []) {
            if (o.type !== 'dummy' || !o.prop?.entry || o.signal?.('down')) continue;
            const p = o.prop.entry.body.position;
            if (Math.hypot(p.x - h.x, p.z - h.z) > ASSIST.range) continue;
            out.push({ id, pos: new THREE.Vector3(p.x, p.y + 0.4, p.z), vel: new THREE.Vector3(), size: 0.4 });
        }
        return out;
    }

    /** Per frame: in lock mode, the best target in front of the camera wears the ring while something is held. */
    update(dt, holding) {
        if (this.mode !== 'lock') return;
        const cam = this.camera.getWorldDirection(_d).setY(0).normalize(), h = this.hero.position;
        let best = null, bestScore = Infinity;
        for (const t of this.targets()) {
            const dx = t.pos.x - h.x, dz = t.pos.z - h.z, dist = Math.hypot(dx, dz);
            const off = Math.acos(Math.max(-1, Math.min(1, (dx * cam.x + dz * cam.z) / Math.max(0.01, dist))));
            if (off > ASSIST.lockView) continue;
            const score = off * 12 + dist + (this.locked?.id === t.id ? -4 : 0);        // keep the lock unless something is clearly better
            if (score < bestScore) { bestScore = score; best = t; }
        }
        this.locked = best;
        this.ring.visible = !!best && holding;
        if (best) { this.ring.position.set(best.pos.x, best.pos.y - best.size * 0.9 + 0.05, best.pos.z); this.ring.rotation.z += dt * 1.5; }
    }

    /**
     * The direction to throw from `from` at `speed`, given the flick's own direction `dir` (unit, horizontal-ish).
     * Returns a unit vector: the flick's, or one that reaches a target.
     */
    resolve(from, dir, speed) {
        if (this.mode === 'off') return dir;
        let pick = null;
        const flat = _d.set(dir.x, 0, dir.z).normalize();
        const angleTo = t => { const dx = t.pos.x - from.x, dz = t.pos.z - from.z, d = Math.hypot(dx, dz); return Math.acos(Math.max(-1, Math.min(1, (dx * flat.x + dz * flat.z) / Math.max(0.01, d)))); };
        if (this.mode === 'lock' && this.locked && angleTo(this.locked) <= ASSIST.lockCone) pick = this.locked;
        else if (this.mode === 'assist') {
            let best = Infinity;
            for (const t of this.targets()) { const a = angleTo(t); if (a <= ASSIST.bend && a < best) { best = a; pick = t; } }
        }
        return pick ? this.ballistic(from, pick, speed) || dir : dir;
    }

    /** The launch direction that reaches `t` (leading its motion) from `from` at `speed`: the low arc, or null if out of reach. */
    ballistic(from, t, speed) {
        const g = ASSIST.gravity;
        let aim = t.pos.clone();
        let out = null;
        for (let i = 0; i < 3; i++) {             // lead: aim where it will be when the throw arrives
            const dx = aim.x - from.x, dz = aim.z - from.z, x = Math.hypot(dx, dz), y = aim.y - from.y;
            const s2 = speed * speed, disc = s2 * s2 - g * (g * x * x + 2 * y * s2);
            if (disc < 0 || x < 0.01) return null;
            const theta = Math.atan2(s2 - Math.sqrt(disc), g * x);
            const tFlight = x / (speed * Math.cos(theta));
            out = new THREE.Vector3(dx / x * Math.cos(theta), Math.sin(theta), dz / x * Math.cos(theta));
            aim = t.pos.clone().addScaledVector(t.vel, tFlight);
        }
        return out;
    }

    dispose() { this.scene.remove(this.ring); this.ring.geometry.dispose(); this.ring.material.dispose(); }
}
