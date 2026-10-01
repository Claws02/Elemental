// ============================================================
// MUD — Earth and Water at once: the ground under the stream gives way
// ============================================================
//
// While a stream runs (one finger on it), touch open ground with a second
// finger: Earth loosens the soil where the water is landing, and it turns to
// mud. The stream keeps running.
//
//   in the mud    creatures wade at MUD.slow of their speed (a charge bogs
//                 down), and so does the hero; burning things in it go out
//   it lasts      MUD.last seconds, then dries
//
// The brief (§10) also asks mud to repair structures and make clay: that
// comes with building repair (phase 6, towns).
// ============================================================

import { THREE } from '../engine/lib.js';
import { EventBus, EV } from '../core/EventBus.js';
import { MUD } from '../data/elements.js';
import { Ground } from '../world/Ground.js';
import { drape } from './Lava.js';

export class Mud {
    constructor({ scene, fire, creatures, player }) {
        Object.assign(this, { scene, fire, creatures, player });
        this.patches = [];
        this.n = 0;
        this.mat = new THREE.MeshStandardMaterial({ color: 0x3e2c1c, roughness: 0.35, metalness: 0.05, flatShading: true });
    }

    /** Turn the ground at p to mud. */
    make(p, cause = 'player') {
        const geo = new THREE.CircleGeometry(MUD.radius, 16);
        const pos = geo.attributes.position;
        for (let i = 1; i < pos.count; i++) { const k = 0.8 + Math.random() * 0.3; pos.setXY(i, pos.getX(i) * k, pos.getY(i) * k); }
        geo.rotateX(-Math.PI / 2);
        drape(geo, p.x, p.z, 0.025);
        const mesh = new THREE.Mesh(geo, this.mat);
        mesh.position.set(p.x, 0, p.z);
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        const patch = { id: `Mud_${++this.n}`, p: new THREE.Vector3(p.x, 0, p.z), r: MUD.radius, age: 0, mesh, cause };
        this.patches.push(patch);
        while (this.patches.length > MUD.most) this._dry(this.patches[0]);
        for (const f of this.fire.flammables.values()) if (f.burning && this._in(patch, f.thing.pos()) && Ground.above(f.thing.pos()) < 1.2) this.fire.douse(f.thing, cause);
        EventBus.emit(EV.MUD, { id: patch.id, x: p.x, z: p.z, cause });
        return patch;
    }

    _in(patch, q) { return Math.hypot(q.x - patch.p.x, q.z - patch.p.z) < patch.r; }

    /** Is this point in mud (and low enough to be wading)? */
    at(q) { return Ground.above(q) < 1.4 && this.patches.some(pt => this._in(pt, q)); }

    update(dt) {
        for (const pt of this.patches.slice()) {
            pt.age += dt;
            if (pt.age > MUD.last) { this._dry(pt); continue; }
            if (pt.age > MUD.last - 3) pt.mesh.material = this._drying ||= this.mat.clone();
        }
        if (this._drying) this._drying.color.set(0x5a4632);
        for (const c of this.creatures?.all || []) if (this.at(c.pos)) c.mired = 0.25;
        this.player.mired = this.at(this.player.body.position) ? 0.25 : Math.max(0, (this.player.mired || 0) - dt);
    }

    _dry(pt) {
        this.scene.remove(pt.mesh);
        pt.mesh.geometry.dispose();
        this.patches.splice(this.patches.indexOf(pt), 1);
    }

    dispose() { for (const pt of this.patches.slice()) this._dry(pt); this.mat.dispose(); this._drying?.dispose(); }
}
