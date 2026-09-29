// ============================================================
// EARTH — sense and move stone (§9)
// ============================================================
//
// Earth is the MOVE element for stone (src/data/materials.js). Holding and
// throwing live in Channel.js, shared with every element; what stays here is
// what is Earth's own:
//
//   SENSE    Rocks in range glow faintly in Earth's amber (§36: "nearby rocks
//            highlight subtly"); the one in the hand glows strongly.
//   LIMITS   How far Earth reaches, and how heavy a stone it can lift.
//
// Grab, hold, flick and drop behave exactly as in Phase 1 (the player tested
// them on a phone and asked for no change).
// ============================================================

import { ELEMENT } from '../art/Palette.js';

export const EARTH = {
    range: 14,           // how far the hero can sense and grab
    // How heavy a stone Earth lifts is Earth's Power (data/growth.js).
};

export class EarthSystem {
    constructor({ hero, rocks, channel, prog }) {
        this.prog = prog;
        this.hero = hero;
        this.rocks = rocks;           // physics entries with .mesh
        this.channel = channel;
        this.time = 0;
    }

    canMove(entry) {
        // How heavy a stone Earth can lift grows with Earth's Power.
        if (!this.prog.has('earth') || !entry.body.world) return false;   // not yet in the world (Lesson I raises stones later)
        return entry.body.position.distanceTo(this.hero.body.position) <= EARTH.range && entry.body.mass <= this.prog.earth('maxMass');
    }

    update(dt) {
        this.time += dt;
        const col = ELEMENT.earth.rune;
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
        for (const e of this.rocks) {
            const m = e.mesh.userData.ownMaterials?.body;
            if (!m) continue;
            if ((e.data.heat || 0) > 0.02) continue;      // a hot rock shows its heat, not Earth
            let s = 0;
            if (this.channel.held?.entry === e) s = 0.55 + pulse * 0.15;
            else if (this.canMove(e)) s = 0.05 + pulse * 0.07;
            m.emissive.setHex(col);
            m.emissiveIntensity = s;
        }
    }
}
