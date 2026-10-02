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
//   patrol    walks its route (scene prop `route`: "x,z; x,z; …"), pausing at each point
//   follow    walks with the player (Cael on the road): keeps a step or two away
//
// Anyone caught in one of the player's surges flinches away (startle()).
//
// Characters walk in straight lines (no pathfinding yet): scenes lay out
// their routes in the open.
// ============================================================

import { bakeStill } from '../engine/Kit.js';
import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { buildHero, HeroAnimator } from '../art/HeroModel.js';
import { Ground } from '../world/Ground.js';
import { Kit, at } from '../engine/Kit.js';
import { CHARACTER_LOOKS } from '../data/characters.js';

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

Object.assign(LOOKS, CHARACTER_LOOKS);

/** The model alone (the editor shows this). */
export function npcModel(look = 'cael') {
    const L = LOOKS[look] || LOOKS.cael;
    const rig = buildHero(L);
    rig.root.scale.setScalar(L.scale);
    rig.setElement('earth');
    addExtras(rig, L);
    return rig;
}

// What a person wears and carries, on the rig's joints: neck (head height ~0.19), spine (chest), elbow (hand).
function addExtras(rig, L) {
    const ex = L.extras || [];
    if (!ex.length) return;
    const head = new Kit(), body = new Kit(), hand = new Kit();
    const gold = 0xc8a85a, iron = 0x5a5e66;
    for (const e of ex) {
        switch (e) {
        case 'circlet': head.box('body', 0.27, 0.035, 0.29, at(0, 0.29, 0), gold); break;
        case 'crown':
            head.box('body', 0.27, 0.05, 0.29, at(0, 0.3, 0), gold);
            for (let i = 0; i < 5; i++) head.box('body', 0.03, 0.07, 0.03, at(-0.1 + i * 0.05, 0.36, 0.13), gold);
            head.box('glow', 0.03, 0.03, 0.02, at(0, 0.32, 0.15), 0x7ad0ff);
            break;
        case 'ironcrown':
            head.box('body', 0.28, 0.06, 0.3, at(0, 0.3, 0), iron);
            for (let i = 0; i < 4; i++) head.geo('body', new THREE.ConeGeometry(0.025, 0.1, 4), at(-0.09 + i * 0.06, 0.38, 0.12), iron, { flat: true });
            break;
        case 'shellcirclet': head.box('body', 0.27, 0.03, 0.29, at(0, 0.29, 0), 0xe8dcc8); head.geo('body', new THREE.ConeGeometry(0.04, 0.07, 6), at(0, 0.33, 0.14, Math.PI / 2, 0, 0), 0xf0c8b0, { flat: true }); break;
        case 'hood': head.box('body', 0.3, 0.3, 0.32, at(0, 0.22, -0.03), L.cloak, { ch: 0.06 }); break;
        case 'headwrap': head.box('body', 0.29, 0.13, 0.31, at(0, 0.31, -0.01), L.trim, { ch: 0.05 }); head.box('body', 0.08, 0.2, 0.05, at(0.05, 0.18, -0.15), L.trim); break;
        case 'helm': head.box('body', 0.28, 0.14, 0.3, at(0, 0.3, 0), iron, { ch: 0.05 }); head.box('body', 0.04, 0.1, 0.04, at(0, 0.2, 0.15), iron); break;
        case 'plumedhelm': head.box('body', 0.28, 0.14, 0.3, at(0, 0.3, 0), gold, { ch: 0.05 }); head.box('body', 0.05, 0.12, 0.26, at(0, 0.43, -0.02), 0xb8302a); break;
        case 'goggles': head.box('body', 0.26, 0.05, 0.03, at(0, 0.22, 0.135), 0x4a3a2a); for (const s of [-1, 1]) head.box('sheen', 0.07, 0.05, 0.02, at(s * 0.055, 0.22, 0.15), 0x9ad0e8); break;
        case 'beard': head.box('body', 0.18, 0.1, 0.05, at(0, 0.08, 0.11), L.hair, { ch: 0.02 }); break;
        case 'tail': head.box('body', 0.06, 0.22, 0.05, at(0, 0.08, -0.16, 0.25), L.hair); break;
        case 'robe': body.box('body', 0.44, 0.75, 0.3, at(0, -0.42, 0), L.tunic, { ch: 0.04 }); body.box('body', 0.45, 0.04, 0.31, at(0, -0.79, 0), L.trim); break;
        case 'apron': body.box('body', 0.3, 0.55, 0.03, at(0, -0.05, 0.14), 0x6a4a30); break;
        case 'badge': body.box('glow', 0.06, 0.08, 0.02, at(-0.12, 0.33, 0.135), 0xffd68a); body.box('body', 0.09, 0.11, 0.015, at(-0.12, 0.33, 0.128), gold); break;
        case 'pauldrons': for (const s of [-1, 1]) body.box('body', 0.18, 0.09, 0.22, at(s * 0.26, 0.45, 0, 0, 0, -s * 0.35), iron, { ch: 0.03 }); break;
        case 'scarf': body.box('body', 0.3, 0.07, 0.28, at(0, 0.47, 0), L.trim, { ch: 0.02 }); body.box('body', 0.06, 0.3, 0.03, at(0.08, 0.3, 0.15, 0.1), L.trim); break;
        case 'staff': hand.cyl('body', 0.022, 0.026, 1.7, 6, at(0, -0.1, 0.03), 0x6a4a2a, { flat: true }); hand.geo('glow', new THREE.OctahedronGeometry(0.06, 0), at(0, 0.78, 0.03), L.trim, { flat: true }); break;
        case 'spear': hand.cyl('body', 0.018, 0.02, 2.0, 6, at(0, 0.05, 0.03), 0x5a4030, { flat: true }); hand.geo('body', new THREE.ConeGeometry(0.04, 0.2, 4), at(0, 1.15, 0.03), iron, { flat: true }); break;
        }
    }
    if (head.tris) rig.neck.add(head.build());
    if (body.tris) rig.spine.add(body.build());
    if (hand.tris) { const h = hand.build(); h.position.set(0, -0.3, 0); rig.elbow[0].add(h); }
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
        this.entry = Physics.add({ body, tier: TIER.STATIC, id, data: { npc: this } });
        this.role = 'idle';
        this.sys = null;           // { fire, world }, set when wired
        this.task = null;          // brigade: 'fetch' | 'carry' | 'throw'
        this.t = 0;
        this.speed = 0;
    }

    /** Stop and face the player for `secs` (they're being talked to). */
    hold(secs) { this.held = secs; }

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
        r.y = Ground.height(r.x, r.z);
        this.entry.body.position.set(r.x, r.y + 0.45, r.z);
        this.entry.body.aabbNeedsUpdate = true;
        this.speed = v;
        this._turn(Math.atan2(dx, dz), dt, 8);
        return false;
    }

    // Walk with the player: beside them (not behind, where the camera looks from), on whichever side they're on.
    // Close the gap when it opens, at a run when it's wide; far behind (out of sight), catch up at once.
    _follow(hero, dt) {
        const p = this.position, last = this._heroWas;
        this._heroWas = { x: hero.x, z: hero.z };
        if (last) {
            const mx = hero.x - last.x, mz = hero.z - last.z, m = Math.hypot(mx, mz);
            if (m > 1e-3) {
                this._side = { x: -mz / m, z: mx / m };
                this._sign = (p.x - hero.x) * this._side.x + (p.z - hero.z) * this._side.z >= 0 ? 1 : -1;
            }
        }
        const k0 = (this._sign || 1) * FOLLOW.beside, at = this._side ? { x: hero.x + this._side.x * k0, z: hero.z + this._side.z * k0 } : hero;
        const d = Math.hypot(at.x - p.x, at.z - p.z);
        if (d > FOLLOW.lost) { this._walk(at, 1, 1e6); return; }
        this.following = d > FOLLOW.far || (this.following && d > FOLLOW.near);
        if (this.following) this._walk(at, dt, d > FOLLOW.run ? 7 : 3.6);
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

    /** Caught in a surge: stagger back from `from` and keep away a moment, then carry on. */
    startle(from) {
        const p = this.position;
        const d = new THREE.Vector3(p.x - from.x, 0, p.z - from.z);
        if (d.lengthSq() < 0.01) d.set(1, 0, 0);
        this.flinch = { to: d.normalize().multiplyScalar(3.5).add(p), t: 2.5 };
    }

    get position() { return this.rig.root.position; }

    /** Do their role; turn toward the player (or what they point at) and breathe. */
    update(dt, hero) {
        this.speed = 0;
        if (this.held > 0) this.held -= dt;            // talking: stand, face the player
        else if (this.flinch) {
            this.flinch.t -= dt;
            if (this.flinch.t <= 0 || this._walk(this.flinch.to, dt, 4.5)) this.flinch = null;
        } else if (this.role === 'brigade') this._brigade(dt);
        else if (this.role === 'cower') this._cower(dt);
        else if (this.role === 'walk' && this.target) { if (this._walk(this.target, dt)) this.role = 'idle'; }
        else if (this.role === 'follow' && hero) this._follow(hero, dt);
        else if (this.role === 'patrol' && this.route?.length) {
            // Walk the route, point to point, pausing a moment at each.
            this.leg ??= 0;
            this.pause = Math.max(0, (this.pause || 0) - dt);
            if (!this.pause && this._walk(this.route[this.leg % this.route.length], dt, 1.6)) { this.leg++; this.pause = 1.5; }
        }
        const p = this.position, t = this.point || hero;
        if (!this.speed) this._turn(Math.atan2(t.x - p.x, t.z - p.z), dt, 3);
        let channel = null;
        if (this.point) {
            const dx = this.point.x - p.x, dz = this.point.z - p.z;
            channel = { pitch: Math.atan2(this.point.y - 1.4, Math.max(0.3, Math.hypot(dx, dz))) * 0.6, yaw: 0 };
        }
        // Far off: a still, baked pose (one or two draw calls, no animation work). Near: the full rig.
        const d = Math.hypot((hero?.x ?? p.x) - p.x, (hero?.z ?? p.z) - p.z);
        const far = this.far ? d > NPC_LOD.near : d > NPC_LOD.far;
        if (far !== !!this.far) this._lod(far);
        if (!far) this.anim.update(dt, { speed: this.speed, channel });
    }

    _lod(far) {
        this.far = far;
        const root = this.rig.root;
        if (far && !this.still) {
            this.still = bakeStill(root, o => o.material?.transparent);      // (the contact shadow stays as it is)
            root.add(this.still);
        }
        for (const c of root.children) {
            if (c === this.still) c.visible = far;
            else if (!(c.isMesh && c.material?.transparent)) c.visible = !far;
        }
    }
}

/** People further than `far` from the hero go still (baked); they come alive again inside `near`. */
export const NPC_LOD = { far: 28, near: 24 };
/** follow: keep `beside` m to one side of the player; walk when `far` from there, stop at `near`, run past `run`; past `lost`, catch up at once. */
export const FOLLOW = { beside: 1.8, near: 1, far: 3, run: 5, lost: 40 };
