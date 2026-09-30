// ============================================================
// FIRESTORM — Fire and Air at once: a fireball blown out into a cone of flame
// ============================================================
//
// Holding a fireball (one finger on it), touch the hero with a second finger:
// Air from the Conduit tears the fireball open and drives it out as a cone of
// flame, from the hero toward where the fireball was held.
//
//   everything that burns in the cone catches; fires already burning in it
//   flare; creatures in it burn and are thrown back; loose things are pushed
//
// It reaches FIRESTORM.reach metres, far past anything a thrown fireball
// lights. Lighting many things at once is excess in the ledger.
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { EventBus, EV } from '../core/EventBus.js';
import { FIRESTORM } from '../data/elements.js';

const _v = new THREE.Vector3();

export class Firestorm {
    constructor({ fire, fx, creatures }) {
        Object.assign(this, { fire, fx, creatures });
        this.count = 0;
    }

    /** How far inside the cone from `o` along `dir` the point q is: 0 outside, up to 1 at the root. */
    _in(o, dir, q) {
        _v.set(q.x - o.x, 0, q.z - o.z);
        const along = _v.dot(dir);
        if (along <= 0 || along > FIRESTORM.reach) return 0;
        const across = _v.addScaledVector(dir, -along).length();
        const wide = along * Math.tan(FIRESTORM.angle) + 0.8;
        return across < wide ? 1 - 0.5 * along / FIRESTORM.reach : 0;
    }

    /** Blow a firestorm from `origin` toward `dir` (flattened). Returns what it lit. */
    blow(origin, dir, cause = 'player') {
        const o = origin.clone(), d = dir.clone().setY(0);
        if (d.lengthSq() < 1e-6) return { lit: 0 };
        d.normalize();
        let lit = 0;
        for (const f of this.fire.flammables.values()) {
            const k = this._in(o, d, f.thing.pos());
            if (!k || f.burned) continue;
            if (f.burning) this.fire.wind(f.thing, 1, d, cause);
            else if (this.fire.ignite(f.thing, cause)) lit++;
        }
        for (const c of this.creatures?.all || []) {
            const k = this._in(o, d, c.pos);
            if (k) c.react('fire', FIRESTORM.burn * k, cause);
        }
        for (const e of Physics.all()) {
            const b = e.body;
            if (b.type !== CANNON.Body.DYNAMIC || e.tier === TIER.PLAYER) continue;
            const k = this._in(o, d, b.position);
            if (!k) continue;
            const dv = FIRESTORM.push * k / (1 + b.mass / 10);
            b.wakeUp();
            b.velocity.x += d.x * dv; b.velocity.y += dv * 0.3; b.velocity.z += d.z * dv;
            e.data.creature?.react('wind', dv, cause);
        }
        // The flame itself: a roar of particles down the cone.
        const side = new THREE.Vector3(-d.z, 0, d.x);
        for (let i = 0; i < 140; i++) {
            const sp = 8 + Math.random() * 8, s = (Math.random() - 0.5) * 2 * Math.tan(FIRESTORM.angle) * sp;
            this.fx?.flame?.spawn({ x: o.x + d.x * 0.6, y: o.y + 1.1, z: o.z + d.z * 0.6,
                vx: d.x * sp + side.x * s, vy: 0.5 + Math.random() * 1.5, vz: d.z * sp + side.z * s,
                max: 0.5 + Math.random() * 0.4, s0: 0.6, s1: 0.15 });
        }
        this.count++;
        EventBus.emit(EV.FIRESTORM, { lit, cause, x: o.x, z: o.z });
        return { lit };
    }
}
