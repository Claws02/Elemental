// ============================================================
// PROP RESET — testing aid: disturbed props come back as new
// ============================================================
//
// Like the barricade's rebuild: once the props (crates, barrels, dummies,
// hay) have been disturbed (moved, burned) and then left alone for `after`
// seconds with nothing burning or moving, they are all put back. A scene
// turns it on with settings.resetAfter (the sandbox: 60 s); 0 is off.
// ============================================================

import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { EventBus, EV } from '../core/EventBus.js';

export class PropReset {
    constructor(world, after) {
        Object.assign(this, { world, after });
        this.fire = null;
        this.quiet = 0;
    }

    _props() { return this.world.props.filter(p => p.thing); }

    _disturbed(p) {
        if (this.fire.isBurning(p.thing) || this.fire.isBurned(p.thing)) return true;
        return p.entry ? p.entry.body.position.distanceTo(p.home.p) > 0.3 || !p.entry.body.world : false;
    }

    update(dt) {
        if (!this.after || !this.fire) return;
        const props = this._props();
        if (!props.some(p => this._disturbed(p))) { this.quiet = 0; return; }
        const busy = props.some(p => this.fire.isBurning(p.thing) || (p.entry && p.entry.body.world && p.entry.body.velocity.length() > 0.3));
        this.quiet = busy ? 0 : this.quiet + dt;
        if (this.quiet >= this.after) this.reset();
    }

    reset() {
        for (const p of this._props()) {
            if (p.entry) {
                Physics.restore(p.entry, p.home.p, p.home.q, TIER.INTERACTIVE, p.mass);
                if (!p.mesh.parent) this.world.scene.add(p.mesh);
                delete p.entry.data.thrownBy;
            }
            p.mesh.scale.set(1, 1, 1);
            const m = p.mesh.userData.ownMaterials?.body;
            if (m) { m.color.setScalar(1); m.emissiveIntensity = 0; }
            this.fire.reset(p.thing);
        }
        this.quiet = 0;
        EventBus.emit(EV.STRUCTURE_STATE, { id: 'TestRoom_Props', from: 'Disturbed', to: 'Intact', cause: 'rebuilt' });
    }
}
