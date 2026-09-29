// ============================================================
// PLATES — stone pressure plates that know what rests on them
// ============================================================
//
// A plate is a round slab with a rune that lights when a stone rests on it.
// "Rests" means: a rock within the plate's radius, low, nearly still, and not
// in the hand. A plate can also judge HOW the stone arrived: a stone let go
// within `gentleHeight` of the surface was SET DOWN; one dropped from higher
// or thrown was not (Cael's lesson: "Set it down. Don't drop it.").
//
// Counterweight plates are the same, with a chain running up toward what
// they work (the barricade's posts), so the player can read the puzzle.
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { Kit, at } from '../engine/Kit.js';
import { WORLD, ELEMENT } from '../art/Palette.js';
import { EventBus, EV } from '../core/EventBus.js';

export class Plate {
    /**
     * @param {object} o
     * @param {string} o.id
     * @param {THREE.Vector3} o.pos       centre, on the ground
     * @param {number} [o.radius]
     * @param {THREE.Vector3} [o.chainTo]  a point the chain runs up to (counterweights)
     */
    constructor(scene, { id, pos, radius = 0.75, chainTo = null, gentleHeight = 0.6 }) {
        Object.assign(this, { id, pos: pos.clone(), radius, gentleHeight });
        this.weighted = null;        // the rock entry resting on it, or null
        this.letGo = new Map();      // rock entry -> how it was let go near this plate ({ h, thrown }), null while held
        this.gentle = false;         // did that rock arrive gently?
        const k = new Kit();
        k.cyl('body', radius + 0.12, radius + 0.18, 0.12, 16, at(0, 0.06, 0), WORLD.stoneDark, { flat: true });
        k.cyl('body', radius, radius, 0.1, 16, at(0, 0.1, 0), WORLD.stone[3], { flat: true });
        this.group = k.build({ own: true });
        this.group.position.copy(pos);
        scene.add(this.group);
        // Solid: a stone rests on the slab, not through it.
        const body = new CANNON.Body({ mass: 0, material: Physics.material('stone') });
        body.addShape(new CANNON.Cylinder(radius + 0.15, radius + 0.18, 0.15, 12));
        body.position.set(pos.x, 0.075, pos.z);
        Physics.add({ body, tier: TIER.STATIC, id: this.id });
        // The rune: a ring of Earth light, dim until weighted.
        this.runeMat = new THREE.MeshBasicMaterial({ color: ELEMENT.earth.deep, transparent: true, opacity: 0.9 });
        const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.55, radius * 0.7, 24), this.runeMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(pos.x, 0.162, pos.z);
        scene.add(ring);
        this.ring = ring;
        if (chainTo) this._chain(scene, chainTo);
        this.hint = false;
        this.time = 0;
    }

    _chain(scene, to) {
        const k = new Kit();
        const from = this.pos.clone().setY(0.2);
        const d = to.clone().sub(from);
        const n = Math.ceil(d.length() / 0.22);
        for (let i = 0; i < n; i++) {
            const p = from.clone().addScaledVector(d, (i + 0.5) / n);
            k.box('body', 0.07, 0.16, 0.04, at(p.x - this.pos.x, p.y, p.z - this.pos.z, 0, Math.atan2(d.x, d.z), i % 2 ? Math.PI / 2 : 0), WORLD.iron);
        }
        const g = k.build();
        g.position.copy(this.pos);
        scene.add(g);
    }

    /**
     * @param {Array} rocks  physics entries
     * @param {object|null} held  the entry in the hero's hand, if any
     */
    update(dt, rocks, held) {
        this.time += dt;
        let on = null;
        for (const e of rocks) {
            const b = e.body;
            const dx = b.position.x - this.pos.x, dz = b.position.z - this.pos.z;
            const near = Math.hypot(dx, dz) < this.radius + 0.1;
            // Remember how it was let go, while it is close. Each plate keeps
            // its own note: a stone is near one plate and far from the others.
            if (near && held === e) this.letGo.set(e, null);
            if (near && held !== e && this.letGo.get(e) === null) {
                this.letGo.set(e, { h: b.position.y - (e.data.radius || 0.5) - 0.15, thrown: (e.data.thrownAt || 0) > (e.data.droppedAt || 0) });
            }
            if (!near) { if (held !== e) this.letGo.delete(e); continue; }
            if (held === e) continue;
            const r = e.data.radius || 0.5;
            if (b.position.y > r + 0.6) continue;           // resting on the slab (~0.15 up), not hovering over it
            if (b.velocity.length() > 0.5) continue;
            on = e;
            break;
        }
        if (on !== this.weighted) {
            this.weighted = on;
            const lg = on && this.letGo.get(on);
            this.gentle = !!on && !!lg && !lg.thrown && lg.h < this.gentleHeight;
            if (on) EventBus.emit(EV.PLATE, { id: this.id, rock: on.id, gentle: this.gentle });
        }
        const lit = !!this.weighted;
        const pulse = this.hint && !lit ? 0.5 + 0.5 * Math.sin(this.time * 3) : 0;
        this.runeMat.color.setHex(lit ? ELEMENT.earth.rune : ELEMENT.earth.deep);
        this.runeMat.color.lerp(new THREE.Color(ELEMENT.earth.rune), lit ? 0 : pulse * 0.6);
    }
}
