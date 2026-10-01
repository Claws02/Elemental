// ============================================================
// WATER BODIES — lakes, rivers and the sea (phase 5)
// ============================================================
//
// A `water` object is a flat sheet of water at an absolute `level` (metres),
// a rectangle (`width` × `depth`, turned by rotY) or an ellipse (`round`).
// Where the terrain is below the level, there is water.
//
//   a source      touch it and Water draws a stream from the nearest point of
//                 its surface (like a basin, but it never runs dry)
//   wading        shallow water slows the hero; past WADE.deep they can't go
//                 further (no swimming yet): they are held at the last safe step
//   ice           a stream frozen where it lands on open water leaves an ice
//                 floe you can stand on (elements/Ice.js): an ice bridge, a
//                 floe at a time
// ============================================================

import { THREE } from '../engine/lib.js';
import { Ground } from './Ground.js';

export const WADE = { slow: 0.6, deep: 1.25 };

export class WaterBodies {
    constructor() {
        this.bodies = [];
        this.safe = null;
    }

    /** A body from a scene item: { id, x, z, rotY, width, depth, round, level }. */
    add(it, mesh) {
        const b = { id: it.id, x: it.x, z: it.z, rot: it.rotY || 0, w: it.width / 2, d: it.depth / 2, round: !!it.round, level: it.level, mesh };
        this.bodies.push(b);
        return b;
    }

    // Local coordinates of (x, z) in body b.
    _local(b, x, z) {
        const dx = x - b.x, dz = z - b.z, c = Math.cos(-b.rot), s = Math.sin(-b.rot);
        return [dx * c + dz * s, -dx * s + dz * c];
    }
    _in(b, x, z) {
        const [u, v] = this._local(b, x, z);
        return b.round ? (u / b.w) ** 2 + (v / b.d) ** 2 <= 1 : Math.abs(u) <= b.w && Math.abs(v) <= b.d;
    }

    /** The body with water over (x, z), or null. */
    at(x, z) {
        for (const b of this.bodies) if (this._in(b, x, z) && b.level > Ground.height(x, z)) return b;
        return null;
    }

    /** How deep the water is at (x, z) (0 if none). */
    depth(x, z) { const b = this.at(x, z); return b ? b.level - Ground.height(x, z) : 0; }

    /** The point on b's surface nearest p (where a stream is drawn from). */
    nearest(b, p) {
        let [u, v] = this._local(b, p.x, p.z);
        if (b.round) { const k = Math.hypot(u / b.w, v / b.d); if (k > 1) { u /= k; v /= k; } }
        else { u = Math.max(-b.w, Math.min(b.w, u)); v = Math.max(-b.d, Math.min(b.d, v)); }
        // A little way in from the edge, so the stream comes up out of the water.
        u *= 0.97; v *= 0.97;
        const c = Math.cos(b.rot), s = Math.sin(b.rot);
        return new THREE.Vector3(b.x + u * c + v * s, b.level, b.z - u * s + v * c);
    }

    /** Per frame: slow the hero in shallow water, and keep them out of deep water. */
    update(player) {
        const b = player.body, w = this.at(b.position.x, b.position.z);
        // Standing on something above the water (an ice floe, a bridge): not in it.
        const d = w && b.position.y - 0.45 < w.level - 0.15 ? w.level - Ground.height(b.position.x, b.position.z) : 0;
        player.wading = d > 0.35 ? d : 0;
        if (d > WADE.deep && this.safe) {
            b.position.x = this.safe.x; b.position.z = this.safe.z;
            b.velocity.x = 0; b.velocity.z = 0;
        } else if (d < WADE.deep * 0.8) {
            (this.safe ||= { x: 0, z: 0 }).x = b.position.x; this.safe.z = b.position.z;
        }
    }
}

/** The water's look: a sheet, faintly lit, slightly see-through. */
export function waterSheet(it) {
    const geo = it.round ? new THREE.CircleGeometry(1, 40) : new THREE.PlaneGeometry(2, 2, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.scale(it.width / 2, 1, it.depth / 2);
    const mat = new THREE.MeshStandardMaterial({ color: it.colour ?? 0x2f7fa8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.78, emissive: 0x0a2e44, emissiveIntensity: 0.35 });
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    m.renderOrder = 1;
    return m;
}
