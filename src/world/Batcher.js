// ============================================================
// BATCHER — a forest in a handful of draw calls
// ============================================================
//
// A region has hundreds of trees, plants and boulders. Each is its own object
// in the scene file (the editor moves them one by one), but drawn one by one
// they would cost a draw call each. So once a scene is built, the static
// scenery (BATCHED types, not hidden) is merged: one mesh per CELL-metre
// square per material. The colliders stay as they were.
//
// The batches are culled by cell (Game.js), so far forest isn't drawn.
// ============================================================

import { THREE } from '../engine/lib.js';

export const BATCHED = new Set(['tree', 'plant', 'boulder',
    // Fixed architecture: a town's walls and roofs drawn in a few meshes, not one each.
    'b_wall', 'b_floor', 'b_roof', 'b_stairs', 'b_fence', 'b_post', 'tower', 'town_wall', 'gatehouse', 'bridge', 'dock', 'tent', 'chimney', 'lamp', 'banner', 'statue', 'fountain', 'ruin_wall', 'pillar', 'archway', 'stall']);
const CELL = 40;

/** Merge the static scenery among world.objects into world.batches. */
export function batchScenery(scene, world) {
    const cells = new Map();          // "cx,cz|materialUuid" → { mat, parts, cx, cz }
    for (const inst of world.objects.values()) {
        if (!BATCHED.has(inst.type) || inst.structure || inst.hidden || inst.item.hidden || !inst.mesh?.parent) continue;      // a structure burns: it draws itself
        const g = inst.mesh;
        g.updateMatrixWorld(true);
        const cx = Math.floor((inst.item.x || 0) / CELL), cz = Math.floor((inst.item.z || 0) / CELL);
        g.traverse(o => {
            if (!o.isMesh || !o.geometry.attributes.color) return;
            const key = `${cx},${cz}|${o.material.uuid}`;
            const c = cells.get(key) || cells.set(key, { mat: o.material, parts: [], cx, cz, shadow: o.castShadow }).get(key);
            const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
            geo.applyMatrix4(o.matrixWorld);
            c.parts.push(geo);
        });
        g.parent.remove(g);
        inst.batched = true;
    }
    world.batches = [];
    for (const c of cells.values()) {
        const n = c.parts.reduce((k, g) => k + g.attributes.position.count, 0);
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
        let o = 0;
        for (const g of c.parts) {
            pos.set(g.attributes.position.array, o * 3);
            nor.set(g.attributes.normal.array, o * 3);
            col.set(g.attributes.color.array, o * 3);
            o += g.attributes.position.count;
            g.dispose();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, c.mat);
        mesh.castShadow = c.shadow; mesh.receiveShadow = true;
        mesh.name = 'Scenery';
        scene.add(mesh);
        world.batches.push({ mesh, x: (c.cx + 0.5) * CELL, z: (c.cz + 0.5) * CELL });
    }
    return world.batches.length;
}
