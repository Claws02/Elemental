// ============================================================
// GROUND — where the ground is, for everything that needs to know
// ============================================================
//
// A flat scene's ground is y = 0; a terrain scene's is its height field
// (world/Terrain.js). Systems never assume either: they ask here.
//
//   Ground.height(x, z)    the ground's height
//   Ground.raycast(ray)    where a ray (from a touch) first meets the ground, or null
//   Ground.water(x, z)     the water body over this point, if any (world/WaterBodies.js)
//
// buildScene sets it for the scene being played (one at a time).
// ============================================================

import { THREE } from '../engine/lib.js';

const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export const Ground = {
    terrain: null,
    waters: null,
    height(x, z) { return this.terrain ? this.terrain.height(x, z) : 0; },
    raycast(ray) {
        if (this.terrain) return this.terrain.raycast(ray);
        return ray.intersectPlane(_plane, new THREE.Vector3());
    },
    water(x, z) { return this.waters?.at(x, z) || null; },
    /** Height above the ground at a point (things "near the ground" ask this instead of y < k). */
    above(p) { return p.y - this.height(p.x, p.z); },
    reset() { this.terrain = null; this.waters = null; },
};
