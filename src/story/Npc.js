// ============================================================
// NPC — a character standing in a scene (placeholder models until Phase 6)
// ============================================================
//
// Built with the hero's jointed rig in their own colours. Cael is the first:
// ash hair, slate tunic, a long deep-green cloak, silver trim, a little
// taller, and still: he uses exactly as much as he needs (§46), so even idle
// he moves less than the player.
//
// A character turns to watch the player, and can point toward something
// (the stone to lift, the plate to use). A character can also have a ROLE:
//
//   idle      stands, watches you
//   walk      walks to a point, then idles there
//   brigade   carries water from the nearest well or basin to the nearest
//             fire in someone's house and throws it (the Veyra fire)
//   cower     keeps away from creatures
//
// Characters walk in straight lines (no pathfinding yet): scenes lay out
// their routes in the open.
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { buildHero, HeroAnimator } from '../art/HeroModel.js';

export const LOOKS = {
    cael: {
        scale: 1.06,
        skin: 0xb98b68, hair: 0x9a9a94, tunic: 0x2f3a36, trim: 0xb8bcc0,
        cloak: 0x2c4a3a, cloakIn: 0x1e3328, belt: 0x2a2420, trouser: 0x34302a,
        boot: 0x241c16, bracer: 0x4a4238,
    },
    villager: {
        scale: 0.98,
        skin: 0xd0a07a, hair: 0x5a3a22, tunic: 0x8a6a3a, trim: 0xc9b98a,
        cloak: 0x6a5a3a, cloakIn: 0x4a3e28, belt: 0x3a2a1a, trouser: 0x5a4a38,
        boot: 0x3a2a1e, bracer: 0x6a5238,
    },
    elder: {
        scale: 0.96,
        skin: 0xc49a7a, hair: 0xd8d4cc, tunic: 0x5a3a4a, trim: 0xd8c07a,
        cloak: 0x3a2a3a, cloakIn: 0x2a1e2a, belt: 0x2a2420, trouser: 0x3a3430,
        boot: 0x2a2018, bracer: 0x4a3a38,
    },
    smith: {
        scale: 1.08,
        skin: 0xa87858, hair: 0x2a1c14, tunic: 0x5a4a3e, trim: 0x8a6a4a,
        cloak: 0x3a2a20, cloakIn: 0x2a1e18, belt: 0x241a14, trouser: 0x3a3028,
        boot: 0x221810, bracer: 0x5a4030,
    },
    baker: {
        scale: 0.97,
        skin: 0xd8aa86, hair: 0x8a4a2a, tunic: 0xc8b89a, trim: 0x9a5a3a,
        cloak: 0x8a3a2a, cloakIn: 0x5a2a1e, belt: 0x5a3a24, trouser: 0x6a5a48,
        boot: 0x3a2a1e, bracer: 0x8a6a50,
    },
    youth: {
        scale: 1.0,
        skin: 0xc49070, hair: 0x6a4020, tunic: 0x4a6a4a, trim: 0xb8a070,
        cloak: 0x7a5030, cloakIn: 0x4a3020, belt: 0x3a2a1a, trouser: 0x4a4038,
        boot: 0x3a2a1e, bracer: 0x6a5238,
    },
    guard: {
        scale: 1.04,
        skin: 0xb88a66, hair: 0x2a2018, tunic: 0x4a4e56, trim: 0x9aa2aa,
        cloak: 0x6a2a24, cloakIn: 0x4a1e1a, belt: 0x2a2420, trouser: 0x3a3a3e,
        boot: 0x222226, bracer: 0x6a6e76,
    },
};

/** The model alone (the editor shows this). */
export function npcModel(look = 'cael') {
    const L = LOOKS[look] || LOOKS.cael;
    const rig = buildHero(L);
    rig.root.scale.setScalar(L.scale);
    rig.setElement('earth');
    return rig;
}

export class Npc {
    constructor(scene, { id, name, look, pos, facing = 0 }) {
        Object.assign(this, { id, name });
        this.rig = npcModel(look);
        this.rig.root.position.copy(pos);
        this.rig.root.rotation.y = facing;
        scene.add(this.rig.root);
        this.anim = new HeroAnimator(this.rig);
        this.facing = facing;
        this.point = null;          // a world point they are pointing at, or null
        // Solid: the player walks around them.
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Sphere(0.45));
        body.position.set(pos.x, pos.y + 0.45, pos.z);
        this.entry = Physics.add({ body, tier: TIER.STATIC, id });
        this.role = 'idle';
        this.sys = null;           // { fire, world }, set when wired
        this.task = null;          // brigade: 'fetch' | 'carry' | 'throw'
        this.t = 0;
        this.speed = 0;
    }

    setRole(role, target = null) {
        this.role = role;
        this.target = target ? new THREE.Vector3(target.x, 0, target.z) : null;
        this.task = null;
        this.t = 0;
    }

    // Walk toward p at v m/s; true when there.
    _walk(p, dt, v = 2.6) {
        const r = this.rig.root.position;
        const dx = p.x - r.x, dz = p.z - r.z, d = Math.hypot(dx, dz);
        if (d < 0.6) { this.speed = 0; return true; }
        const step = Math.min(d, v * dt);
        r.x += dx / d * step; r.z += dz / d * step;
        this.entry.body.position.set(r.x, r.y + 0.45, r.z);
        this.entry.body.aabbNeedsUpdate = true;
        this.speed = v;
        this._turn(Math.atan2(dx, dz), dt, 8);
        return false;
    }

    _turn(want, dt, k = 3) {
        let d = want - this.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.facing += d * Math.min(1, k * dt);
        this.rig.root.rotation.y = this.facing;
    }

    _nearestFire() {
        const f = this.sys?.fire;
        if (!f) return null;
        const p = this.position;
        let best = null, bd = 30;
        for (const x of f.flammables.values()) {
            if (!x.burning) continue;
            const q = x.thing.pos(), d = Math.hypot(q.x - p.x, q.z - p.z);
            if (d < bd) { bd = d; best = x.thing; }
        }
        return best;
    }

    _nearestWater() {
        const src = this.sys?.world?.basins || [];
        const p = this.position;
        return src.slice().sort((a, b) => a.surface.distanceTo(p) - b.surface.distanceTo(p))[0]?.surface || null;
    }

    _brigade(dt) {
        this.t += dt;
        if (!this.task) this.task = 'fetch';
        if (this.task === 'fetch') {
            const w = this._nearestWater();
            if (!w || this._walk(w, dt, 3)) { this.task = 'fill'; this.t = 0; }
        } else if (this.task === 'fill') {
            this.speed = 0;
            if (this.t > 1.0) { this.task = 'carry'; this.fireTarget = this._nearestFire(); if (!this.fireTarget) this.task = 'wait'; }
        } else if (this.task === 'carry') {
            if (!this.fireTarget || !this.sys.fire.isBurning(this.fireTarget)) this.fireTarget = this._nearestFire();
            if (!this.fireTarget) { this.task = 'wait'; return; }
            const q = this.fireTarget.pos();
            const p = this.position;
            if (Math.hypot(q.x - p.x, q.z - p.z) < 2.2 || this._walk(q, dt, 3)) { this.task = 'throw'; this.t = 0; }
        } else if (this.task === 'throw') {
            this.speed = 0;
            if (this.t > 0.6) {
                if (this.fireTarget) { this.sys.fire.douse(this.fireTarget, 'villager'); this.sys.fx?.steam?.(this.fireTarget.pos(), 8); }
                this.task = 'fetch';
            }
        } else if (this.task === 'wait') {
            this.speed = 0;
            if (this._nearestFire()) this.task = 'fetch';
        }
    }

    _cower(dt) {
        const c = this.sys?.world?.creatures?.all || [];
        const p = this.position;
        const near = c.find(x => x.state !== 'dead' && !x.gone && Math.hypot(x.pos.x - p.x, x.pos.z - p.z) < 6);
        if (near) {
            const away = new THREE.Vector3(p.x - near.pos.x, 0, p.z - near.pos.z).normalize().multiplyScalar(4).add(p);
            this._walk(away, dt, 4);
        } else this.speed = 0;
    }

    get position() { return this.rig.root.position; }

    /** Do their role; turn toward the player (or what they point at) and breathe. */
    update(dt, hero) {
        this.speed = 0;
        if (this.role === 'brigade') this._brigade(dt);
        else if (this.role === 'cower') this._cower(dt);
        else if (this.role === 'walk' && this.target) { if (this._walk(this.target, dt)) this.role = 'idle'; }
        const p = this.position, t = this.point || hero;
        if (!this.speed) this._turn(Math.atan2(t.x - p.x, t.z - p.z), dt, 3);
        let channel = null;
        if (this.point) {
            const dx = this.point.x - p.x, dz = this.point.z - p.z;
            channel = { pitch: Math.atan2(this.point.y - 1.4, Math.max(0.3, Math.hypot(dx, dz))) * 0.6, yaw: 0 };
        }
        this.anim.update(dt, { speed: this.speed, channel });
    }
}
