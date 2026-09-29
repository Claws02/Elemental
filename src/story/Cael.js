// ============================================================
// CAEL — placeholder model and presence (Blender model in Phase 6)
// ============================================================
//
// Built with the hero's jointed rig in his own colours: ash hair, slate
// tunic, a long deep-green cloak, silver trim. A little taller, and still:
// he is the one who uses exactly as much as he needs (§46), so even idle he
// moves less than the player.
//
// He stands where the lesson puts him, turns to watch the player, and can
// point toward something (the stone to lift, the plate to use).
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { buildHero, HeroAnimator } from '../art/HeroModel.js';

const LOOK = {
    skin: 0xb98b68, hair: 0x9a9a94, tunic: 0x2f3a36, trim: 0xb8bcc0,
    cloak: 0x2c4a3a, cloakIn: 0x1e3328, belt: 0x2a2420, trouser: 0x34302a,
    boot: 0x241c16, bracer: 0x4a4238,
};

export class Cael {
    constructor(scene, pos, facing = 0) {
        this.rig = buildHero(LOOK);
        this.rig.root.scale.setScalar(1.06);
        this.rig.root.position.copy(pos);
        this.rig.root.rotation.y = facing;
        this.rig.setElement('earth');
        scene.add(this.rig.root);
        this.anim = new HeroAnimator(this.rig);
        this.facing = facing;
        this.point = null;          // a world point he is pointing at, or null
        // He is solid: the player walks around him.
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Sphere(0.45));
        body.position.set(pos.x, 0.45, pos.z);
        Physics.add({ body, tier: TIER.STATIC, id: 'Cael' });
    }

    get position() { return this.rig.root.position; }

    /** Turn toward the player and breathe; point if asked to. */
    update(dt, hero) {
        const p = this.position, t = this.point || hero;
        let want = Math.atan2(t.x - p.x, t.z - p.z);
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
