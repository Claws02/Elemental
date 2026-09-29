// ============================================================
// INTERACTABLES — everything a touch can land on, and what it is made of
// ============================================================
//
// One registry for rocks, timber, braziers and fireballs, so a touch is
// resolved the same way whatever it lands on. Each thing has:
//
//   id        persistent ID
//   mesh      what the finger hits
//   entry     its physics entry (null for fixed things like a brazier)
//   material  a key into src/data/materials.js
//   pos()     where it is now (for range, aiming and the fat-finger assist)
//
// Burning state is not stored here; FireSystem answers `isBurning(thing)`.
// ============================================================

import { THREE } from '../engine/lib.js';
import { MATERIALS } from '../data/materials.js';

const ASSIST_PX = 56;       // fat-finger radius
const _ray = new THREE.Raycaster();
const _v2 = new THREE.Vector2();
const _p = new THREE.Vector3();

export class Interactables {
    constructor() {
        this.things = [];
        this.byMesh = new Map();
        this.byEntry = new Map();
    }

    add({ id, mesh, entry = null, material, data = {} }) {
        const t = { id, mesh, entry, material, mat: MATERIALS[material], data, pos: () => mesh.getWorldPosition(new THREE.Vector3()) };
        if (!t.mat) throw new Error(`unknown material "${material}" for ${id}`);
        this.things.push(t);
        this.byMesh.set(mesh, t);
        if (entry) this.byEntry.set(entry, t);
        return t;
    }

    remove(t) {
        const i = this.things.indexOf(t);
        if (i >= 0) this.things.splice(i, 1);
        this.byMesh.delete(t.mesh);
        if (t.entry) this.byEntry.delete(t.entry);
    }

    forEntry(entry) { return this.byEntry.get(entry) || null; }

    /**
     * What a touch at (x, y) lands on. `usable(thing)` filters to things the
     * player can act on right now (in range, has a verb). The exact hit wins;
     * failing that, the nearest usable thing within the assist radius.
     */
    pick(x, y, camera, usable, { assist = true } = {}) {
        _v2.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
        _ray.setFromCamera(_v2, camera);
        const cand = this.things.filter(usable);
        const meshes = cand.map(t => t.mesh);
        const hit = _ray.intersectObjects(meshes, true)[0];
        if (hit) {
            let o = hit.object;
            while (o && !this.byMesh.has(o)) o = o.parent;
            if (o) return this.byMesh.get(o);
        }
        if (!assist) return null;
        let best = null, bestD = ASSIST_PX;
        for (const t of cand) {
            _p.copy(t.pos()).project(camera);
            if (_p.z > 1) continue;
            const d = Math.hypot((_p.x + 1) / 2 * innerWidth - x, (1 - _p.y) / 2 * innerHeight - y);
            if (d < bestD) { bestD = d; best = t; }
        }
        return best;
    }
}
