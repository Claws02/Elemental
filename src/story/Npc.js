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
// (the stone to lift, the plate to use).
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
    }

    get position() { return this.rig.root.position; }

    /** Turn toward the player and breathe; point if asked to. */
    update(dt, hero) {
        const p = this.position, t = this.point || hero;
        const want = Math.atan2(t.x - p.x, t.z - p.z);
        let d = want - this.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.facing += d * Math.min(1, 3 * dt);
        this.rig.root.rotation.y = this.facing;
        let channel = null;
        if (this.point) {
            const dx = this.point.x - p.x, dz = this.point.z - p.z;
            channel = { pitch: Math.atan2(this.point.y - 1.4, Math.max(0.3, Math.hypot(dx, dz))) * 0.6, yaw: 0 };
        }
        this.anim.update(dt, { speed: 0, channel });
    }
}
