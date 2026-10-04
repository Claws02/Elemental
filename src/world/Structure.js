// ============================================================
// STRUCTURE — a building (or a bridge, a dock, a tent) that burns and breaks
// true to what it is made of
// ============================================================
//
// A structure is PIECES: a cell of wall, a strip of roof or floor, a post, a
// door frame, a stretch of deck. Each piece has a material:
//
//   wood     timber, plaster-and-timber, shingle, planks: burns, breaks
//   thatch   burns fast and throws fire to the next roof
//   cloth    canvas: catches quickest, burns out quickest
//   masonry  stone, brick, marble, slate, tile: never burns; breaks only
//            under heavy blows (a thrown rock, falling debris), and falls
//            when what held it up is gone
//
// SUPPORT. Pieces that touch hold each other up; pieces on the ground hold
// everything. Burn the timber storey out from under a slate roof and the
// roof comes down; burn a stone house and its shell stands, gutted.
//
// It is drawn as ONE mesh (world/Skin.js): a piece is a range of vertices,
// charred, glowing or gone. Only a piece that breaks off is its own mesh, for
// as long as it is falling debris.
//
// STATES (signals, and STRUCTURE_STATE events the world remembers):
//   intact → damaged → burned (half of what can burn has) or collapsed
//   (most of it is down). A scene that comes back shows it gutted or fallen.
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { EventBus, EV } from '../core/EventBus.js';
import { buildingWall, buildingRoof, buildingFloor, buildingStairs, buildingPost } from '../art/TownModels.js';
import { Skin } from './Skin.js';

export const STATE = { INTACT: 'Intact', DAMAGED: 'Damaged', BURNED: 'Burned', COLLAPSED: 'Collapsed' };

/** What each material is, as a structure's piece. `touch` is the material it answers touches as (data/materials.js). */
export const PIECE_MATERIALS = {
    wood:    { hp: 100, mass: 6,  phys: 'wood',  touch: 'wood',   burns: true },
    thatch:  { hp: 80,  mass: 4,  phys: 'wood',  touch: 'thatch', burns: true },
    cloth:   { hp: 50,  mass: 2,  phys: 'wood',  touch: 'cloth',  burns: true, vanish: true },     // burned through, it's gone, not debris
    masonry: { hp: 320, mass: 28, phys: 'stone', touch: null,     burns: false },
};
const MIN_IMPACT = 3.0, DAMAGE_PER = 1.2, SPLASH = 0.35;
const BURNED_AT = 0.5, COLLAPSED_AT = 0.7;
const TOUCH = 0.12;           // pieces closer than this hold each other up

// ---- pieces from the building kit (a prefab's walls, floors, roofs, posts, stairs) -----------------

export const STRUCTURAL = new Set(['b_wall', 'b_floor', 'b_roof', 'b_post', 'b_stairs']);
const WALL_BURNS = new Set(['timber', 'plaster', 'driftwood']);
const ROOF_MAT = { thatch: 'thatch', shingle: 'wood', canvas: 'cloth' };

/**
 * Kit items (in the structure's frame: x, y, z, rotY) → pieces { group, boxes, mat }. Boxes are
 * { c: Vector3, q: Quaternion, w, h, d } in the structure's frame. `fixed` collects what never breaks
 * (a ground floor): { group, boxes }.
 */
export function kitPieces(items) {
    const pieces = [], fixed = [];
    for (const it of items) {
        const M = new THREE.Matrix4().makeRotationY(it.rotY || 0).setPosition(it.x || 0, it.y || 0, it.z || 0);
        const add = (made, mat, list = pieces) => {
            const g = new THREE.Group();
            g.add(made.group);
            g.applyMatrix4(M);
            const qItem = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rotY || 0);
            const boxes = made.boxes.map(b => {
                const q = qItem.clone();
                if (b.rx) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), b.rx));
                if (b.rz) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), b.rz));
                return { c: new THREE.Vector3(b.x, b.y, b.z).applyMatrix4(M), q, w: b.w, h: b.h, d: b.d };
            });
            if (boxes.length || made.group.children.length) list.push({ group: g, boxes, mat, kind: it.type });
        };
        if (it.type === 'b_wall') {
            const L = it.length, H = it.height, mat = WALL_BURNS.has(it.style) ? 'wood' : 'masonry';
            const cols = Math.max(1, Math.round(L / 1.5)), rows = Math.max(1, Math.round(H / 1.4));
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const clip = { x0: -L / 2 + (c * L) / cols, x1: -L / 2 + ((c + 1) * L) / cols, y0: (r * H) / rows, y1: ((r + 1) * H) / rows };
                const made = buildingWall({ ...it, part: { clip } });
                if (made.boxes.length) add(made, mat);
            }
            const trims = buildingWall({ ...it, part: 'trims' });
            if (trims.group.children.length) add({ group: trims.group, boxes: [] }, 'wood');       // door and window frames: timber, they burn
        } else if (it.type === 'b_roof') {
            const mat = ROOF_MAT[it.style] || 'masonry';
            if (it.style === 'dome' || it.style === 'flat') add(buildingRoof(it), mat);
            else {
                const n = Math.max(2, Math.round(it.width / 1.6));
                for (let i = 0; i < n; i++) add(buildingRoof({ ...it, part: { span: [-it.width / 2 + (i * it.width) / n, -it.width / 2 + ((i + 1) * it.width) / n] } }), mat);
                const gab = buildingRoof({ ...it, part: 'gables' });
                if (gab.boxes.length) add(gab, 'wood');
            }
        } else if (it.type === 'b_floor') {
            if ((it.y || 0) < 0.3 || it.style !== 'planks') { add(buildingFloor(it), 'masonry', fixed); continue; }
            const n = Math.max(2, Math.round(it.width / 1.6));
            for (let i = 0; i < n; i++) add(buildingFloor({ ...it, part: { span: [-it.width / 2 + (i * it.width) / n, -it.width / 2 + ((i + 1) * it.width) / n] } }), 'wood');
        } else if (it.type === 'b_post') {
            add(buildingPost(it), it.style === 'timber' ? 'wood' : 'masonry');
        } else if (it.type === 'b_stairs') {
            add(buildingStairs(it), it.style === 'stone' ? 'masonry' : 'wood');
        }
    }
    return { pieces, fixed };
}

// ---- the structure ------------------------------------------------------------------------------------

export class Structure {
    /**
     * @param {object} ctx  { scene, world }
     * @param {object} it   the scene object (id, x, y, z, rotY, owner, landmark, name)
     * @param {{ pieces, fixed }} parts   from kitPieces() (or a bridge's, a tent's…)
     */
    constructor(ctx, it, { pieces, fixed = [] }) {
        this.id = it.id;
        this.it = it;
        this.scene = ctx.scene;
        this.state = STATE.INTACT;
        this.pending = [];
        this.frame = new THREE.Group();
        this.frame.position.set(it.x || 0, it.y || 0, it.z || 0);
        this.frame.rotation.y = it.rotY || 0;
        ctx.scene.add(this.frame);
        this.frame.updateMatrixWorld(true);
        const W = this.frame.matrixWorld, qF = this.frame.quaternion;
        this.entries = [];

        // ONE static body for the whole structure, a shape per box (a region has hundreds of pieces: one body each
        // made every physics step pay for them all). Each shape knows its piece; a piece gets a body of its own only
        // when it breaks off and falls.
        const body = this.body = new CANNON.Body({ mass: 0, material: Physics.material('stone') });
        body.position.set(this.frame.position.x, this.frame.position.y, this.frame.position.z);
        body.quaternion.set(qF.x, qF.y, qF.z, qF.w);
        this.shapePiece = new Map();
        const addBox = (b, piece, phys) => {
            const shape = new CANNON.Box(new CANNON.Vec3(Math.max(0.02, b.w / 2), Math.max(0.02, b.h / 2), Math.max(0.02, b.d / 2)));
            shape.material = Physics.material(phys);
            body.addShape(shape, new CANNON.Vec3(b.c.x, b.c.y, b.c.z), new CANNON.Quaternion(b.q.x, b.q.y, b.q.z, b.q.w));
            if (piece) { piece.shapes.push(shape); this.shapePiece.set(shape, piece); }
        };
        // Each piece: its mesh round its own centre (so it falls true).
        this.pieces = pieces.map((p, i) => {
            const m = PIECE_MATERIALS[p.mat];
            // Its extent in the structure's frame: every corner of every (turned) box.
            const box = new THREE.Box3();
            for (const b of p.boxes) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
                box.expandByPoint(new THREE.Vector3(sx * b.w / 2, sy * b.h / 2, sz * b.d / 2).applyQuaternion(b.q).add(b.c));
            if (box.isEmpty()) { p.group.updateMatrixWorld(true); box.setFromObject(p.group); }
            const c = box.getCenter(new THREE.Vector3());
            const wrapper = new THREE.Group();
            wrapper.position.copy(c.clone().applyMatrix4(W));
            wrapper.quaternion.copy(qF);
            p.group.position.sub(c);
            wrapper.add(p.group);
            ctx.scene.add(wrapper);
            const piece = { i, id: `${it.id}_S${i}`, mat: p.mat, m, hp: m.hp, hp0: m.hp, broken: false, burned: false, mesh: wrapper, box, kind: p.kind, entry: null, neighbours: [],
                shapes: [], boxes: p.boxes.map(b => ({ b, off: b.c.clone().sub(c) })) };
            for (const b of p.boxes) addBox(b, piece, m.phys);
            return piece;
        });
        // Fixed parts (a ground floor): drawn in the skin, a plain collider each.
        const fixedMeshes = fixed.map(f => {
            this.frame.add(f.group);
            for (const b of f.boxes) addBox(b, null, 'stone');
            return f.group;
        });
        if (body.shapes.length) {
            this.entry = Physics.add({ body, tier: TIER.STATIC, id: it.id + '_Body', data: { structure: this, owner: this } });
            this.entries.push(this.entry);
            // Which piece was struck: the shape of ours in the contact.
            body.addEventListener('collide', e => {
                const piece = this.shapePiece.get(Physics.shapeOf(e.contact, body));       // our shape in the contact
                if (piece) this._onCollide(piece, e);
            });
        }
        // Who holds whom up: pieces whose boxes come within TOUCH of each other. Grounded: reaching the ground.
        // Generous upward: a roof's slope sits a little above the wall tops it rests on (the eaves overhang).
        const grow = b => new THREE.Box3(b.min.clone().sub(new THREE.Vector3(TOUCH, 0.45, TOUCH)), b.max.clone().add(new THREE.Vector3(TOUCH, 0.45, TOUCH)));
        for (let a = 0; a < this.pieces.length; a++) for (let b = a + 1; b < this.pieces.length; b++) {
            if (grow(this.pieces[a].box).intersectsBox(this.pieces[b].box)) { this.pieces[a].neighbours.push(this.pieces[b]); this.pieces[b].neighbours.push(this.pieces[a]); }
        }
        for (const p of this.pieces) p.grounded = p.box.min.y <= 0.15;
        this.burnable = this.pieces.filter(p => p.m.burns).length;

        this.parts = this.pieces.map(p => ({ mesh: p.mesh, piece: p, gone: () => p.broken }));
        if (fixedMeshes.length) {
            const holder = new THREE.Group();
            for (const g of fixedMeshes) holder.add(g);
            this.frame.add(holder);
            this.parts.push({ mesh: holder, fixed: true });
        }
        this.skin = new Skin(this.frame, this.parts);
        ctx.world.solids.push(this.skin.mesh);
    }

    // ---- what happens to it ---------------------------------------------------------------------------

    // Inside the physics step: only note the hit (changing bodies mid-step corrupts the solver).
    _onCollide(piece, e) {
        if (piece.broken) return;
        const other = e.body, src = other.userData;
        if (!src || other.type === CANNON.Body.STATIC || src.tier === TIER.PLAYER) return;
        // Its own falling pieces start out pressed against their neighbours: the push apart isn't a blow.
        if (src.data?.owner === this) return;
        const speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (speed < MIN_IMPACT) return;
        const cause = src.data?.thrownBy && (performance.now() - src.data.thrownAt) < 6000 ? src.data.thrownBy : 'environment';
        this.pending.push({ piece, amount: speed * other.mass * DAMAGE_PER, cause, vel: new THREE.Vector3(other.velocity.x, other.velocity.y, other.velocity.z) });
    }

    /** A blow (QA, explosions). */
    hit(piece, amount, cause = 'environment', vel = new THREE.Vector3()) { if (!piece.broken) this.pending.push({ piece, amount, cause, vel }); }

    /** Fire eating a piece: `amount` is a share of 100 (its whole burn), whatever the piece's own strength. */
    burn(piece, amount, cause = 'environment') { if (!piece.broken) this.pending.push({ piece, amount: amount * piece.hp0 / 100, cause, vel: new THREE.Vector3(), fire: true }); }

    update(dt = 0) {
        // Asleep until something happens to it (a fire, water, a blow): then the skin follows it every frame, and
        // it goes back to sleep once nothing on it has been burning, heating or wet for a while.
        if (this.pending.length) this.awake = 2;
        if (!this.awake) return;
        if (this.pending.length) {
            const hits = this.pending.splice(0);
            let cause = 'environment';
            for (const h of hits) {
                cause = h.cause;
                if (h.fire) {
                    if (h.piece.hp - h.amount <= 0) h.piece.burned = true;
                    this._damage(h.piece, h.amount, h.cause, h.vel, true);
                    continue;
                }
                this._damage(h.piece, h.amount, h.cause, h.vel);
                for (const n of h.piece.neighbours) this._damage(n, h.amount * SPLASH, h.cause, h.vel.clone().multiplyScalar(0.5));
            }
            this._settle(cause);
            this._state(cause);
        }
        for (const p of this.parts) if (p.piece?.broken && !p.released && p.piece.entry?.body.world) this.skin.release(p);
        this.skin.update();
        if ((this._checkT = (this._checkT || 0) - dt) <= 0) {
            this._checkT = 0.5;
            const F = this.sys?.fire;
            const busy = F && [...this.things.values()].some(t => F.live.has(F.flammables.get(t)));
            this.awake = busy ? 2 : this.awake - 0.5;
            if (this.awake <= 0) { this.awake = 0; this.skin.update(); }
        }
    }

    _damage(piece, amount, cause, vel, quiet = false) {
        if (piece.broken || amount <= 0) return;
        piece.hp -= amount;
        if (!quiet) EventBus.emit(EV.STRUCTURE_DAMAGED, { id: this.id, piece: piece.id, amount: Math.round(amount), cause });
        if (piece.hp <= 0) { this._break(piece, cause, vel); return; }
        if (!piece.m.burns || !quiet) {
            // Cracked: darker as it weakens (fire's own char comes from FireSystem).
            const k = 1 - piece.hp / piece.hp0;
            piece.mesh.userData.ownMaterials?.body.color.setScalar(1 - k * 0.4);
        }
    }

    /** The piece leaves the structure's body, and (if it has any shape) becomes a body of its own. */
    _detach(piece, own = true) {
        for (const sh of piece.shapes) { this.body.removeShape(sh); this.shapePiece.delete(sh); }
        const had = piece.shapes.length;
        piece.shapes = [];
        if (!had || !own) return null;
        const body = new CANNON.Body({ mass: 0, material: Physics.material(piece.m.phys) });
        const q = this.frame.quaternion;
        for (const { b, off } of piece.boxes) body.addShape(new CANNON.Box(new CANNON.Vec3(Math.max(0.02, b.w / 2), Math.max(0.02, b.h / 2), Math.max(0.02, b.d / 2))),
            new CANNON.Vec3(off.x, off.y, off.z), new CANNON.Quaternion(b.q.x, b.q.y, b.q.z, b.q.w));
        body.position.set(piece.mesh.position.x, piece.mesh.position.y, piece.mesh.position.z);
        body.quaternion.set(q.x, q.y, q.z, q.w);
        piece.entry = Physics.add({ body, mesh: piece.mesh, tier: TIER.DESTRUCTIBLE, id: piece.id, data: { piece, owner: this } });
        return piece.entry;
    }

    /** Torn apart all at once (a flood surge): every piece breaks and falls, on `cause`'s account. */
    wreck(cause = 'environment', push = new THREE.Vector3(0, 0, 4)) {
        for (const p of this.pieces) if (!p.broken) this._damage(p, p.hp + 1, cause, push.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3)), true);
        this._settle(cause);
        this._state(cause);
        this.awake = 2;
        this.skin.update();
    }

    /** What a touched shape of this structure's body is (Interactables.forEntry). */
    thingForShape(shape) { const p = this.shapePiece.get(shape); return (p && this.things?.get(p)) || null; }

    _break(piece, cause, vel) {
        piece.broken = true;
        piece.hp = 0;
        piece.cause = cause;
        if (this.isBurning?.(piece)) piece.burned = true;
        // Burned-through canvas is simply gone; a frame with no shape of its own is gone too. Anything else falls.
        if ((piece.burned && piece.m.vanish) || !this._detach(piece)) { this._gone(piece); EventBus.emit(EV.PIECE_BROKEN, { id: this.id, piece: piece.id, cause, burned: piece.burned }); return; }
        const b = piece.entry.body;
        Physics.toDebris(piece.entry, piece.m.mass);
        if (cause !== 'environment') Object.assign(piece.entry.data, { thrownBy: cause, thrownAt: performance.now() });
        b.velocity.set(vel.x * 0.35, vel.y * 0.35 + 1.2, vel.z * 0.35);
        b.angularVelocity.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
        EventBus.emit(EV.PIECE_BROKEN, { id: this.id, piece: piece.id, cause, burned: piece.burned, pos: { x: b.position.x, y: b.position.y, z: b.position.z } });
    }

    // Everything still up must reach the ground through pieces still up; what doesn't, falls.
    _settle(cause) {
        const ok = new Set(), stack = this.pieces.filter(p => p.grounded && !p.broken);
        stack.forEach(p => ok.add(p));
        while (stack.length) for (const n of stack.pop().neighbours) if (!n.broken && !ok.has(n)) { ok.add(n); stack.push(n); }
        for (const p of this.pieces) if (!p.broken && !ok.has(p)) this._break(p, cause, new THREE.Vector3(0, -1, 0));
    }

    _state(cause) {
        if (this.state === STATE.BURNED || this.state === STATE.COLLAPSED) return;
        const broken = this.pieces.filter(p => p.broken).length, burned = this.pieces.filter(p => p.burned).length;
        let next = broken ? STATE.DAMAGED : STATE.INTACT;
        if (this.burnable && burned >= this.burnable * BURNED_AT) next = STATE.BURNED;
        else if (broken >= this.pieces.length * COLLAPSED_AT) next = STATE.COLLAPSED;
        if (next === this.state) return;
        const from = this.state;
        this.state = next;
        if (next === STATE.BURNED || next === STATE.COLLAPSED) cause = this._cause() || cause;
        EventBus.emit(EV.STRUCTURE_STATE, { id: this.id, from, to: next, cause, name: this.it.name || this.it.prefab || this.it.type, owner: this.it.owner, landmark: !!(this.it.landmark || this.it.isLandmark) });
    }

    // Who brought it down: the player if any of it fell or burned by their hand.
    _cause() {
        const causes = this.pieces.filter(p => p.broken).map(p => p.cause || p.fireCause).filter(Boolean);
        return causes.includes('player') ? 'player' : causes[0] || null;
    }

    // ---- fire, touches, signals, memory ------------------------------------------------------------

    wire(sys) {
        this.sys = sys;
        this.things = new Map();
        for (const p of this.pieces) {
            if (!p.m.touch) continue;
            // (A door or window frame has no collider of its own: it still burns, and is gone when it has.)
            const thing = sys.interactables.add({ id: p.id, mesh: p.mesh, entry: p.entry || undefined, material: p.m.touch });
            // Where its fire shows: near its top (a roof's flames over the roof, not inside it). Falling, its centre.
            const up = Math.max(0, (p.box.max.y - p.box.min.y) / 2 - 0.15);
            thing.pos = (out = new THREE.Vector3()) => { p.mesh.getWorldPosition(out); if (!p.broken) out.y += up; return out; };
            const size = Math.max(p.box.max.x - p.box.min.x, p.box.max.z - p.box.min.z, p.box.max.y - p.box.min.y);
            sys.fire.addFlammable(thing, { size, onBurn: (amount, cause) => { p.fireCause = cause; this.burn(p, amount, cause); } });
            this.things.set(p, thing);
        }
        this.isBurning = p => { const t = this.things.get(p); return !!t && sys.fire.isBurning(t); };
        // Wake when fire or water reaches any of it.
        const ids = new Set(this.pieces.map(p => p.id));
        const wake = e => { if (ids.has(e.id)) this.awake = 2; };
        this.off = [EventBus.on(EV.FIRE_STARTED, wake), EventBus.on(EV.OBJECT_SOAKED, wake), EventBus.on(EV.FIRE_OUT, wake)];
    }

    signal(name) {
        if (name === 'burned') return this.state === STATE.BURNED;
        if (name === 'collapsed') return this.state === STATE.COLLAPSED;
        if (name === 'intact') return this.state === STATE.INTACT;
        if (name === 'damaged') return this.state !== STATE.INTACT;
        if (name === 'burning') return !!this.sys && this.pieces.some(p => this.isBurning(p));
        return false;
    }

    /** Loaded as it was left: burned (what burns is gone, the rest scorched and whatever lost its support down) or collapsed. */
    restoreState(s) {
        if (s !== STATE.BURNED && s !== STATE.COLLAPSED) return;
        for (const p of this.pieces) {
            const gone = s === STATE.COLLAPSED || p.m.burns;
            if (gone) this._gone(p);
            else p.mesh.userData.ownMaterials?.body.color.setScalar(0.4);
        }
        // What stood on the burned timber has nothing under it now.
        let fell = true;
        while (fell) {
            fell = false;
            const ok = new Set(), stack = this.pieces.filter(p => p.grounded && !p.broken);
            stack.forEach(p => ok.add(p));
            while (stack.length) for (const n of stack.pop().neighbours) if (!n.broken && !ok.has(n)) { ok.add(n); stack.push(n); }
            for (const p of this.pieces) if (!p.broken && !ok.has(p)) { this._gone(p); fell = true; }
        }
        const fixed = this.parts.find(p => p.fixed);
        if (fixed) fixed.mat.color.setScalar(0.35);
        this.state = s;
        this.skin.update();
    }

    _gone(p) {
        p.broken = true;
        this._detach(p, false);
        if (p.entry) { Physics.remove(p.entry); p.entry = null; }
        if (this.things?.has(p)) this.sys.fire.markBurned?.(this.things.get(p));
    }

    summary() { return { id: this.id, state: this.state, pieces: this.pieces.length, broken: this.pieces.filter(p => p.broken).length, burned: this.pieces.filter(p => p.burned).length, burnable: this.burnable }; }

    dispose() { this.off?.forEach(f => f()); this.skin.dispose(); this.frame.parent?.remove(this.frame); }
}
