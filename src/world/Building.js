// ============================================================
// BUILDING — a village house or barn that can burn (the Veyra fire)
// ============================================================
//
// Four timber walls, each a Destructible grid of panels (so a wall breaks
// piece by piece and loses its support like the barricade), a thatch roof of
// panels that burn and fall in, and oak corner posts that survive as a
// charred frame. Every panel is flammable: fire spreads panel to panel, wall
// to roof, and from one house to the next when they stand close.
//
// DRAW CALLS. Each panel is its own mesh (it has to burn, crack and fall on
// its own), which a whole village can't afford every frame. So an untouched
// building is drawn as ONE merged mesh, and swaps to its panels the moment
// anything happens to it (heat, fire, a hit, water). A quiet village costs a
// handful of draw calls; only the buildings in trouble pay for their panels.
//
// A building is BURNED once half its panels have burned; it tells the world
// once (STRUCTURE_STATE), and a persistent scene remembers it: coming back to
// Veyra, a burned house is a charred frame.
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { Kit, at, seeded, kitMaterials } from '../engine/Kit.js';
import { WORLD } from '../art/Palette.js';
import { plankPanel, timberPost } from '../art/PropModels.js';
import { Destructible, STATE } from './Destructible.js';
import { EventBus, EV } from '../core/EventBus.js';

const PW = 1.0, PH = 0.95, PD = 0.16;
const pick = (arr, n) => arr[Math.floor(seeded(n) * arr.length) % arr.length];
const PLASTER = [0xd9ccae, 0xd2c4a4, 0xe0d4b8];
const THATCH = [0xb89a5a, 0xa98c4f, 0xc4a766];

/** A wattle-and-daub house panel: plaster in a timber frame. Own materials (it burns). */
export function housePanel(seed, w, h, d) {
    const k = new Kit();
    k.box('body', w - 0.02, h - 0.02, d, at(0, 0, 0), pick(PLASTER, seed), { skipBottom: false });
    for (const zs of [1, -1]) {
        k.box('body', 0.1, h, 0.04, at(-w / 2 + 0.05, 0, zs * (d / 2 + 0.02)), WORLD.timberDark);
        k.box('body', w, 0.1, 0.04, at(0, h / 2 - 0.05, zs * (d / 2 + 0.02)), WORLD.timberDark);
        if (seeded(seed * 3.7) > 0.5) k.box('body', Math.hypot(w, h) * 0.9, 0.08, 0.04, at(0, 0, zs * (d / 2 + 0.02), 0, 0, Math.atan2(h, w)), WORLD.timberDark);
    }
    return k.build({ own: true });
}

/** One panel of thatch, laid on the roof's slope. Own materials. */
function thatchPanel(seed, w, len) {
    const k = new Kit();
    k.box('body', w, 0.26, len, at(0, 0, 0), pick(THATCH, seed), { ch: 0.05, skipBottom: false });
    k.box('body', w + 0.02, 0.05, 0.12, at(0, 0.14, len / 2 - 0.08), pick(THATCH, seed + 2));
    return k.build({ own: true });
}

/**
 * @param {object} it  the scene object: { id, x, y, z, rotY, cols, depth, rows, kind, seed }
 */
export function buildingModel(it) {
    // The look alone (the editor): the same panels, in place.
    const g = new THREE.Group();
    for (const w of _walls(it)) for (let r = 0; r < w.rows; r++) for (let c = 0; c < w.cols; c++) {
        const p = (it.kind === 'barn' ? plankPanel : housePanel)(r * 31 + c * 7 + w.i, PW, PH, PD);
        const local = new THREE.Vector3((c - (w.cols - 1) / 2) * PW, PH / 2 + r * PH, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), w.rotY).add(w.origin);
        p.position.copy(local);
        p.rotation.y = w.rotY;
        g.add(p);
    }
    for (const c of _corners(it)) { const post = timberPost(it.rows * PH + 0.3); post.position.copy(c); g.add(post); }
    for (const r of _roof(it)) { const m = thatchPanel(r.seed, r.w, r.len); m.position.copy(r.pos); m.quaternion.copy(r.q); g.add(m); }
    g.add(_gables(it));
    return g;
}

// Gable ends: the triangles under the roof, oak and plaster; they stand (charred) through a fire.
function _gables(it) {
    const k = new Kit();
    const W = it.cols * PW, D = it.depth * PW + 0.8, top = it.rows * PH, rise = D * 0.42;
    for (const sx of [-1, 1]) {
        const m = new THREE.Matrix4().makeTranslation(sx * (W / 2), top, 0).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
        k.prism('body', D - 0.9, rise - 0.15, 0.14, m, it.kind === 'barn' ? WORLD.timber[1] : PLASTER[1]);
        k.box('body', 0.12, rise, 0.12, new THREE.Matrix4().makeTranslation(sx * (W / 2), top + rise / 2, 0), WORLD.timberDark);
    }
    k.box('body', W + 0.6, 0.16, 0.16, at(0, top + rise + 0.02, 0), WORLD.timberDark);          // the ridge beam
    return k.build();
}

function _walls(it) {
    const W = it.cols * PW, D = it.depth * PW, rows = it.rows;
    return [
        { i: 0, origin: new THREE.Vector3(0, 0, D / 2), rotY: 0, cols: it.cols, rows },
        { i: 1, origin: new THREE.Vector3(0, 0, -D / 2), rotY: Math.PI, cols: it.cols, rows },
        { i: 2, origin: new THREE.Vector3(-W / 2, 0, 0), rotY: -Math.PI / 2, cols: it.depth, rows },
        { i: 3, origin: new THREE.Vector3(W / 2, 0, 0), rotY: Math.PI / 2, cols: it.depth, rows },
    ];
}

function _corners(it) {
    const W = it.cols * PW, D = it.depth * PW;
    return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => new THREE.Vector3(sx * (W / 2 + 0.1), 0, sz * (D / 2 + 0.1)));
}

// The roof: two slopes, each a row of thatch panels, in the building's own frame.
function _roof(it) {
    const W = it.cols * PW + 0.6, D = it.depth * PW + 0.8, top = it.rows * PH;
    const rise = D * 0.42, half = D / 2, len = Math.hypot(half, rise), a = Math.atan2(rise, half);
    const out = [];
    const n = it.cols + 1;
    for (const s of [1, -1]) {
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), s * a);
        for (let i = 0; i < n; i++) {
            const x = -W / 2 + (i + 0.5) * (W / n);
            out.push({ seed: i * 5 + (s > 0 ? 0 : 50) + (it.seed || 0), w: W / n - 0.02, len, pos: new THREE.Vector3(x, top + rise / 2, s * half / 2), q, s });
        }
    }
    return out;
}

export class Building {
    constructor(ctx, it) {
        this.id = it.id;
        this.it = it;
        this.scene = ctx.scene;
        this.state = STATE.INTACT;
        this.onRebuild = null;
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rotY || 0);
        const base = new THREE.Vector3(it.x, it.y || 0, it.z);
        const toWorld = v => v.clone().applyQuaternion(q).add(base);

        // Walls: a Destructible each.
        this.walls = _walls(it).map(w => new Destructible({
            id: `${it.id}_W${w.i}`, scene: ctx.scene, cols: w.cols, rows: w.rows, pw: PW, ph: PH, pd: PD,
            origin: toWorld(w.origin), rotY: (it.rotY || 0) + w.rotY, pieceMass: 5, regenAfter: 0,
            build: it.kind === 'barn' ? plankPanel : housePanel,
        }));
        // Corner posts: oak, they stand through a fire.
        this.group = new THREE.Group();
        this.group.position.copy(base);
        this.group.quaternion.copy(q);
        ctx.scene.add(this.group);
        this.entries = [];
        for (const c of _corners(it)) {
            const h = it.rows * PH + 0.3, post = timberPost(h);
            post.position.copy(c);
            this.group.add(post);
            const body = new CANNON.Body({ mass: 0, material: Physics.material('wood') });
            body.addShape(new CANNON.Box(new CANNON.Vec3(0.15, h / 2, 0.15)));
            const p = toWorld(c.clone().setY(h / 2));
            body.position.set(p.x, p.y, p.z);
            this.entries.push(Physics.add({ body, tier: TIER.STATIC, id: it.id + '_Post' }));
        }
        this.group.add(_gables(it));
        // Roof: thatch panels (no physics of their own: one collider per slope, removed when the roof is gone).
        this.roof = _roof(it).map((r, i) => {
            const m = thatchPanel(r.seed, r.w, r.len);
            m.position.copy(r.pos);
            m.quaternion.copy(r.q);
            this.group.add(m);
            return { id: `${it.id}_R${i}`, mesh: m, burned: false, s: r.s };
        });
        this.roofBodies = [1, -1].map(s => {
            const rr = this.roof.find(r => r.s === s);
            const W = it.cols * PW + 0.6;
            const body = new CANNON.Body({ mass: 0, material: Physics.material('wood') });
            body.addShape(new CANNON.Box(new CANNON.Vec3(W / 2, 0.12, _roof(it)[0].len / 2)));
            const p = toWorld(rr.mesh.position.clone().setX(0));
            body.position.set(p.x, p.y, p.z);
            const bq = q.clone().multiply(rr.mesh.quaternion);
            body.quaternion.set(bq.x, bq.y, bq.z, bq.w);
            return Physics.add({ body, tier: TIER.STATIC, id: it.id + '_Roof' });
        });
        this.entries.push(...this.roofBodies);
        ctx.world.solids.push(this.group);
        this.off = EventBus.on(EV.FIRE_OUT, e => this._roofBurned(e));
        this._merge();
    }

    // One mesh for the whole untouched building: every panel's geometry, placed, in shared vertex-colour material.
    _merge() {
        const meshes = [...this.pieces.map(p => p.mesh), ...this.roof.map(r => r.mesh)];
        const parts = [];
        const inv = new THREE.Matrix4().copy(this.group.matrixWorld);
        this.group.updateMatrixWorld(true);
        inv.copy(this.group.matrixWorld).invert();
        for (const m of meshes) {
            m.updateMatrixWorld(true);
            m.traverse(o => {
                if (!o.isMesh || !o.geometry.attributes.color) return;
                const g = o.geometry.clone();
                g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
                parts.push(g);
            });
        }
        const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
        const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
        let off = 0;
        for (const g of parts) {
            pos.set(g.attributes.position.array, off * 3);
            nor.set(g.attributes.normal.array, off * 3);
            col.set(g.attributes.color.array, off * 3);
            off += g.attributes.position.count;
            g.dispose();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.computeBoundingSphere();
        this.merged = new THREE.Mesh(geo, kitMaterials().body);
        this.merged.castShadow = this.merged.receiveShadow = true;
        this.group.add(this.merged);
        for (const m of meshes) m.visible = false;
        this.live = false;
    }

    /** Something is happening to it: show the real panels. */
    goLive() {
        if (this.live) return;
        this.live = true;
        this.merged.visible = false;
        for (const p of this.pieces) p.mesh.visible = true;
        for (const r of this.roof) r.mesh.visible = !r.burned;
    }

    _stirred() {
        if (!this.sys) return false;
        const F = this.sys.fire.flammables;
        for (const w of this.walls) if (w.pending.length || w.state !== STATE.INTACT) return true;
        for (const p of this.pieces) { const f = F.get(this._things.get(p)); if (f && (f.heat > 0.02 || f.burning || f.wet > 0)) return true; }
        for (const r of this.roof) { const f = F.get(r.thing); if (f && (f.heat > 0.02 || f.burning || f.wet > 0)) return true; }
        return false;
    }

    get pieces() { return this.walls.flatMap(w => w.pieces); }

    wire(sys) {
        this.sys = sys;
        const byPiece = this._things = new Map();
        for (const w of this.walls) {
            for (const piece of w.pieces) {
                const thing = sys.interactables.add({ id: piece.id, mesh: piece.mesh, entry: piece.entry, material: 'wood' });
                sys.fire.addFlammable(thing, { onBurn: (amount, cause) => w.burn(piece, amount, cause) });
                byPiece.set(piece, thing);
            }
            w.isBurning = piece => sys.fire.isBurning(byPiece.get(piece));
        }
        for (const r of this.roof) {
            r.thing = sys.interactables.add({ id: r.id, mesh: r.mesh, material: 'thatch' });
            sys.fire.addFlammable(r.thing);
        }
    }

    _roofBurned(e) {
        const r = this.roof.find(x => x.id === e.id);
        if (!r || !e.burnedOut || r.burned) return;
        r.burned = true;
        r.cause = e.cause;
        r.mesh.visible = false;                         // it falls in
        if (this.roof.filter(x => x.s === r.s).every(x => x.burned)) {
            const b = this.roofBodies[r.s > 0 ? 0 : 1];
            if (b.body.world) Physics.remove(b);
        }
    }

    update(dt) {
        if (!this.live && this._stirred()) this.goLive();
        for (const w of this.walls) w.update(dt);
        if (this.state === STATE.BURNED) return;
        const all = this.pieces.length + this.roof.length;
        const burned = this.pieces.filter(p => p.burned).length + this.roof.filter(r => r.burned).length;
        const broken = this.pieces.filter(p => p.broken).length;
        if (burned * 2 >= all) {
            const cause = this._cause();
            this.state = STATE.BURNED;
            EventBus.emit(EV.STRUCTURE_STATE, { id: this.id, from: STATE.DAMAGED, to: STATE.BURNED, cause, name: this.it.kind === 'barn' ? 'Barn' : 'House' });
        } else if (this.state === STATE.INTACT && (burned || broken)) {
            this.state = STATE.DAMAGED;
        }
    }

    // Who burned it: the player if any fire in it was theirs (a fire the player started spreads as theirs).
    _cause() {
        const causes = this.roof.map(r => r.cause).filter(Boolean);
        return causes.includes('player') ? 'player' : causes[0] || 'environment';
    }

    signal(name) {
        if (name === 'burned') return this.state === STATE.BURNED;
        if (name === 'burning') return !!this.sys && (this.roof.some(r => this.sys.fire.isBurning(r.thing)) || this.walls.some(w => w.pieces.some(p => w.isBurning(p))));
        if (name === 'intact') return this.state === STATE.INTACT;
        if (name === 'damaged') return this.state !== STATE.INTACT;
        return false;
    }

    /** Loaded already burned: a charred frame. */
    restoreState(s) {
        if (s !== STATE.BURNED) return;
        this.goLive();
        for (const w of this.walls) w.collapseNow(true);
        for (const r of this.roof) { r.burned = true; r.mesh.visible = false; }
        for (const b of this.roofBodies) Physics.remove(b);
        this.group.traverse(o => { if (o.isMesh && o.material?.color) { o.material = o.material.clone(); o.material.color.setScalar(0.18); } });
        this.state = STATE.BURNED;
    }

    dispose() { this.off(); }
}
