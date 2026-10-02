// ============================================================
// SKIN — a whole building as ONE mesh, even while it burns and breaks
// ============================================================
//
// A building is a few hundred panels that each burn, char, glow and fall on
// their own. Drawing each as its own mesh costs a draw call (and another for
// the shadow) per panel: a burning village went past 500 calls, the frame
// rate fell to 10 on a phone. So every building is drawn as one merged mesh,
// always, and each panel is a RANGE of its vertices. Three per-vertex
// attributes say what has happened to it:
//
//   tint   multiplies its colour     (charred: dark; soaked: darker, cooler)
//   emit   adds glow                 (embers, burning)
//   gone   1 = not drawn             (it broke and fell: the falling piece is
//                                     its own mesh while it is debris)
//
// The fire, water and impact code don't change: each panel still has
// `mesh.userData.ownMaterials.body`, now a stand-in with the same `color`,
// `emissive` and `emissiveIntensity` the code already sets. Once a frame the
// skin copies the panels whose stand-ins changed into the attributes. One
// shared shader draws every building; one depth shader keeps broken panels
// out of the shadows.
// ============================================================

import { THREE } from '../engine/lib.js';
import { kitMaterials } from '../engine/Kit.js';

let _mat = null, _depth = null;

const INJECT_VERTEX = (shader) => {
    shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
attribute vec3 tint;
attribute vec3 emit;
attribute float gone;
varying vec3 vTint;
varying vec3 vEmit;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vTint = tint;
vEmit = emit;
if (gone > 0.5) transformed = vec3(0.0);`);
};

/** The one material every building is drawn with: the kit's body, plus tint, glow and gone. */
export function skinMaterial() {
    if (_mat) return _mat;
    _mat = kitMaterials().body.clone();
    _mat.onBeforeCompile = shader => {
        INJECT_VERTEX(shader);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
varying vec3 vTint;
varying vec3 vEmit;`)
            .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= vTint;`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vEmit;`);
    };
    _mat.customProgramCacheKey = () => 'building-skin';
    return _mat;
}

/** Its shadow: broken panels cast none. */
export function skinDepthMaterial() {
    if (_depth) return _depth;
    _depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    _depth.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
attribute float gone;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
if (gone > 0.5) transformed = vec3(0.0);`);
    };
    _depth.customProgramCacheKey = () => 'building-skin-depth';
    return _depth;
}

/** What fire and water write to: the parts of a material they use. */
export function standIn() {
    return { color: new THREE.Color(1, 1, 1), emissive: new THREE.Color(0, 0, 0), emissiveIntensity: 0, isStandIn: true };
}

export class Skin {
    /**
     * @param {THREE.Object3D} frame  what the merged mesh is placed in (its matrixWorld is the mesh's frame)
     * @param {Array<{ mesh: THREE.Object3D, gone?: () => boolean }>} parts  each panel; `gone()` says it isn't drawn
     * @param {THREE.Object3D[]} [fixed]  meshes that never change (posts, gables, floors): merged in too, not tracked
     */
    constructor(frame, parts, fixed = []) {
        this.parts = parts;
        frame.updateMatrixWorld(true);
        const inv = frame.matrixWorld.clone().invert();
        const pieces = [];         // [geometry, partIndex or -1]
        const take = (root, idx) => {
            root.updateMatrixWorld(true);
            root.traverse(o => {
                if (!o.isMesh || !o.geometry.attributes.color) return;
                const g = o.geometry.clone();
                g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
                pieces.push([g, idx]);
            });
        };
        parts.forEach((p, i) => take(p.mesh, i));
        for (const f of fixed) take(f, -1);
        const count = pieces.reduce((n, [g]) => n + g.attributes.position.count, 0);
        const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
        const tint = new Float32Array(count * 3).fill(1), emit = new Float32Array(count * 3), gone = new Float32Array(count);
        for (const p of parts) p.range = null;
        let off = 0;
        for (const [g, idx] of pieces) {
            const n = g.attributes.position.count;
            pos.set(g.attributes.position.array, off * 3);
            nor.set(g.attributes.normal.array, off * 3);
            col.set(g.attributes.color.array, off * 3);
            if (idx >= 0) {
                const p = parts[idx];
                // A panel's meshes sit together, so its range is one run of vertices.
                p.range = p.range ? { start: p.range.start, count: off + n - p.range.start } : { start: off, count: n };
            }
            off += n;
            g.dispose();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        this.tint = new THREE.BufferAttribute(tint, 3).setUsage(THREE.DynamicDrawUsage);
        this.emit = new THREE.BufferAttribute(emit, 3).setUsage(THREE.DynamicDrawUsage);
        this.gone = new THREE.BufferAttribute(gone, 1).setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('tint', this.tint);
        geo.setAttribute('emit', this.emit);
        geo.setAttribute('gone', this.gone);
        geo.computeBoundingSphere();
        this.mesh = new THREE.Mesh(geo, skinMaterial());
        this.mesh.customDepthMaterial = skinDepthMaterial();
        this.mesh.castShadow = this.mesh.receiveShadow = true;
        this.mesh.name = 'Skin';
        frame.add(this.mesh);
        // Each panel's stand-in, and what was last written for it.
        for (const p of parts) {
            p.mat = standIn();
            p.mesh.userData.ownMaterials = { body: p.mat };
            p.last = [1, 1, 1, 0, 0, 0, 0];
            p.mesh.visible = false;        // the skin draws it; the mesh stays for touches (raycasts) and for falling
        }
    }

    /** Copy every panel whose stand-in changed since last time. Cheap when nothing did. */
    update() {
        let changed = false;
        for (const p of this.parts) {
            if (!p.range) continue;
            const m = p.mat, k = m.emissiveIntensity;
            const v = [m.color.r, m.color.g, m.color.b, m.emissive.r * k, m.emissive.g * k, m.emissive.b * k, p.gone?.() ? 1 : 0];
            const L = p.last;
            if (v.every((x, i) => Math.abs(x - L[i]) < 0.004)) continue;
            p.last = v;
            changed = true;
            const { start, count } = p.range, T = this.tint.array, E = this.emit.array, G = this.gone.array;
            for (let i = start; i < start + count; i++) {
                T[i * 3] = v[0]; T[i * 3 + 1] = v[1]; T[i * 3 + 2] = v[2];
                E[i * 3] = v[3]; E[i * 3 + 1] = v[4]; E[i * 3 + 2] = v[5];
                G[i] = v[6];
            }
        }
        if (changed) { this.tint.needsUpdate = true; this.emit.needsUpdate = true; this.gone.needsUpdate = true; }
        return changed;
    }

    /**
     * A panel leaves the skin as a piece of its own (it broke and falls): its mesh shows, with a real material
     * carrying what the stand-in had (charred, glowing), and no shadow (debris is many and brief).
     */
    release(p) {
        const real = kitMaterials().body.clone();
        real.color.copy(p.mat.color);
        real.emissive.copy(p.mat.emissive);
        real.emissiveIntensity = p.mat.emissiveIntensity;
        p.mesh.traverse(o => { if (o.isMesh) { o.material = real; o.castShadow = false; } });
        p.mesh.userData.ownMaterials = { body: real };
        p.mat = { color: real.color, emissive: real.emissive, get emissiveIntensity() { return real.emissiveIntensity; } };
        p.mesh.visible = true;
        p.released = true;
    }

    dispose() { this.mesh.geometry.dispose(); this.mesh.parent?.remove(this.mesh); }
}
