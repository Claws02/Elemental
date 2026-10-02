// ============================================================
// GLIDE — Air under the Conduit: a fall becomes a glide; fire lifts it
// ============================================================
//
// With glide learned (Air), stepping off anything high (a raised column, a
// wall, later cliffs) doesn't drop the hero: Air holds them, falling at most
// GLIDE.fall m/s and moving a little faster than they run. No button: falling
// is the gesture, the stick steers.
//
// THERMALS: gliding over a fire, the hot air rises and carries the hero up
// with it (Fire + Air as traversal). Burn a haystack under a wall and ride
// the heat over it.
// ============================================================

import { EventBus, EV } from '../core/EventBus.js';
import { GLIDE } from '../data/elements.js';
import * as Physics from '../engine/Physics.js';
import { Ground } from '../world/Ground.js';

export class Glide {
    constructor({ player, prog, fire }) {
        Object.assign(this, { player, prog, fire });
        this.gliding = false;
        this.thermal = false;
    }

    /** Before the physics step: hold the fall, find the heat. */
    update(dt) {
        const b = this.player.body, p = b.position;
        const high = Ground.above(p) > this.player.radius + GLIDE.minHeight;
        const was = this.gliding;
        this.gliding = this.prog.can('glide') && high && (b.velocity.y < -GLIDE.trigger || was);      // once gliding, until the ground
        this.player.gliding = this.gliding;
        this.thermal = false;
        if (!this.gliding) { if (was) EventBus.emit(EV.GLIDE, { on: false }); return; }
        if (!was) EventBus.emit(EV.GLIDE, { on: true });
        // Sinking at GLIDE.fall through the whole step: gravity's share of this frame is paid in advance.
        const g = -Physics.getWorld().gravity.y * dt;
        if (b.velocity.y < -GLIDE.fall + g) b.velocity.y = -GLIDE.fall + g;
        // A fire below: the heat rises, and carries the hero with it.
        for (const f of this.fire.live) {          // (only what is alight or heating: never the whole village)
            if (!f.burning) continue;
            const q = f.thing.pos();
            if (q.y < p.y && Math.hypot(q.x - p.x, q.z - p.z) < GLIDE.thermalRadius && p.y - q.y < GLIDE.thermalHeight) { this.thermal = true; break; }
        }
        if (this.thermal) b.velocity.y = Math.min(GLIDE.rise, Math.max(b.velocity.y, 0) + GLIDE.lift * dt);
        this.preVy = b.velocity.y;
    }

    /** After the physics step: gravity over a long frame mustn't turn a glide back into a drop. */
    after() {
        const b = this.player.body;
        if (this.gliding && b.velocity.y < -GLIDE.fall) b.velocity.y = -GLIDE.fall;
        if (this.thermal) b.velocity.y = Math.max(b.velocity.y, this.preVy);    // in the heat, gravity doesn't win
    }
}
