// ============================================================
// ICE — Water and Air at once: the stream freezes where it stands
// ============================================================
//
// While a stream is running (one finger on it), touch the hero with a second
// finger: Air from the Conduit meets the Water in flight, and the whole arc
// freezes solid. The stream is spent.
//
//   the arc      becomes an ice arch: solid, a barrier creatures stop against
//   where it     creatures within ICE.radius are locked in ice (no moving, no
//   was landing  attacking; a flyer drops; a hard hit does ICE.shatter × damage);
//                fires within it go out in a burst of steam
//
// Ice doesn't last: it melts after ICE.last seconds, much faster beside fire,
// and a thrown rock or a charging beast shatters a segment.
//
// Walkable ice bridges want gaps and rivers to cross: they come with terrain
// (phase 5), freezing where the stream lands on open water.
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { EventBus, EV } from '../core/EventBus.js';
import { ICE } from '../data/elements.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);

/** A point on the stream's arc (the same curve WaterSystem draws): S → up and over → E. */
export function arcPoint(S, C, E, t, out = new THREE.Vector3()) {
    const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    return out.set(a * S.x + b * C.x + c * E.x, a * S.y + b * C.y + c * E.y, a * S.z + b * C.z + c * E.z);
}
export function arcControl(S, E) {
    const C = S.clone().add(E).multiplyScalar(0.5);
    C.y = Math.max(S.y, E.y) + 0.8 + S.distanceTo(E) * 0.12;
    return C;
}

export class Ice {
    constructor({ scene, fire, fx, creatures }) {
        Object.assign(this, { scene, fire, fx, creatures });
        this.arches = [];
        this.mat = new THREE.MeshStandardMaterial({ color: 0xcfeeff, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.72, emissive: 0x2a6a8a, emissiveIntensity: 0.35, flatShading: true });
        this.n = 0;
    }

    /** Freeze an arc from S to E. Returns the arch. */
    freeze(S, E, cause = 'player') {
        const C = arcControl(S, E);
        const len = S.distanceTo(E);
        const N = Math.max(4, Math.min(14, Math.round(len / 0.6)));
        const id = `Ice_${++this.n}`;
        const arch = { id, segs: [], age: 0, cause };
        const geos = [];
        const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
        for (let i = 0; i < N; i++) {
            arcPoint(S, C, E, i / N, p0); arcPoint(S, C, E, (i + 1) / N, p1);
            const mid = p0.clone().add(p1).multiplyScalar(0.5);
            const d = p1.clone().sub(p0), L = d.length() + 0.08;
            _q.setFromUnitVectors(_z, d.normalize());
            const w = 0.5 - 0.15 * Math.abs(i / N - 0.5);      // thicker at the feet
            const g = new THREE.BoxGeometry(w, 0.32, L).toNonIndexed();
            g.applyMatrix4(_m.compose(mid, _q, new THREE.Vector3(1, 1, 1)));
            geos.push(g);
            const body = new CANNON.Body({ mass: 0 });
            body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, 0.16, L / 2)));
            body.position.set(mid.x, mid.y, mid.z);
            body.quaternion.set(_q.x, _q.y, _q.z, _q.w);
            const seg = { arch, entry: null, alive: true, mid };
            seg.entry = Physics.add({ body, tier: TIER.STATIC, id: `${id}_${i}`, data: { ice: seg } });
            body.addEventListener('collide', e => this._hit(seg, e));
            arch.segs.push(seg);
        }
        arch.mesh = new THREE.Mesh(merge(geos), this.mat);
        arch.mesh.castShadow = true;
        this.scene.add(arch.mesh);
        this.arches.push(arch);
        while (this.arches.length > ICE.most) this._melt(this.arches[0]);
        // Where it was landing: whatever is there freezes too.
        for (const c of this.creatures?.all || []) if (c.pos.distanceTo(E) < ICE.radius) c.freeze(ICE.frozen, cause);
        for (const f of this.fire.flammables.values()) {
            if (f.burning && f.thing.pos().distanceTo(E) < ICE.radius) { this.fire.douse(f.thing, cause); this.fx?.steam(f.thing.pos(), 10); }
        }
        EventBus.emit(EV.ICE, { id, x: E.x, z: E.z, segs: N, cause });
        return arch;
    }

    // Runs inside the physics step: a fast heavy thing breaks the segment it hits (handled after the step).
    _hit(seg, e) {
        const other = e.body;
        if (other.type !== CANNON.Body.DYNAMIC || other.userData?.tier === TIER.PLAYER) return;
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (v > ICE.breakSpeed && other.mass >= ICE.breakMass) seg.broken = true;
    }

    update(dt) {
        for (const a of this.arches.slice()) {
            a.age += dt;
            // Beside a fire it goes quickly.
            if (a.segs.some(s => s.alive && this.fire.burningNear?.(s.mid, ICE.fireMelt))) a.age += dt * ICE.fireRate;
            for (const s of a.segs) if (s.alive && s.broken) this._breakSeg(s);
            const left = ICE.last - a.age;
            if (left < 2) a.mesh.scale.setScalar(Math.max(0.05, left / 2));
            if (left <= 0 || a.segs.every(s => !s.alive)) this._melt(a);
        }
    }

    _breakSeg(s) {
        s.alive = false;
        Physics.remove(s.entry);
        this.fx?.steam(s.mid, 6);
        EventBus.emit(EV.ICE_BROKEN, { id: s.entry.id });
    }

    _melt(a) {
        for (const s of a.segs) if (s.alive) { s.alive = false; Physics.remove(s.entry); }
        this.scene.remove(a.mesh);
        a.mesh.geometry.dispose();
        this.arches.splice(this.arches.indexOf(a), 1);
    }

    dispose() { for (const a of this.arches.slice()) this._melt(a); this.mat.dispose(); }
}

// Non-indexed geometries with position + normal into one.
function merge(geos) {
    const n = geos.reduce((k, g) => k + g.attributes.position.count, 0);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (const g of geos) {
        pos.set(g.attributes.position.array, o * 3);
        nor.set(g.attributes.normal.array, o * 3);
        o += g.attributes.position.count;
        g.dispose();
    }
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return m;
}
