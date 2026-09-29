// ============================================================
// DESTRUCTIBLE — modular structures that break piece by piece (§38)
// ============================================================
//
// A structure is never one big physics object. It is a grid of PIECES, each
// a static body until it breaks, when it becomes budgeted debris. The
// structure's state follows from how many pieces are gone:
//
//   Intact → Damaged → Critical → Collapsed
//
// SUPPORT. After a piece breaks, every remaining piece must still connect to
// the ground (row 0) through intact neighbours, up, down or sideways. Anything
// that no longer does falls. This is what makes a lucky hit on the bottom row
// bring the top down, without simulating the structure.
//
// CAUSE. Each hit carries who is responsible. A rock the player threw is the
// player's for a few seconds after it leaves their hand; that attribution is
// the seed of the consequence system (§12): the world will remember WHO broke
// the wall, not just that it broke.
//
// Every structure has a persistent ID (e.g. "TestRoom_Barricade_01"). Saving
// and restoring the state is a later checklist item; the IDs are here now so
// nothing has to be renamed when it arrives.
// ============================================================

import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { EventBus, EV } from '../core/EventBus.js';

export const STATE = { INTACT: 'Intact', DAMAGED: 'Damaged', CRITICAL: 'Critical', COLLAPSED: 'Collapsed' };

const PIECE_HP = 100;
const MIN_IMPACT = 3.0;          // m/s along the normal; below this a touch is not a hit
const DAMAGE_PER = 1.2;          // damage = impact speed × mass × this
const SPLASH = 0.35;             // share of a hit felt by each neighbour
const CRITICAL_AT = 0.4, COLLAPSE_AT = 0.7;

export class Destructible {
    /**
     * @param {object} o
     * @param {string} o.id       persistent ID
     * @param {THREE.Object3D} o.scene
     * @param {number} o.cols, o.rows
     * @param {number} o.pw, o.ph, o.pd   piece size
     * @param {Function} o.build  (seed, w, h, d) => THREE.Group (with own materials)
     * @param {THREE.Vector3} o.origin   centre of the bottom edge
     * @param {number} o.rotY
     * @param {number} o.pieceMass
     */
    constructor(o) {
        Object.assign(this, { cols: o.cols, rows: o.rows, id: o.id, pieceMass: o.pieceMass ?? 6 });
        this.state = STATE.INTACT;
        this.pieces = [];
        this.pending = [];           // hits collected during the physics step, applied after it
        const q = new CANNON.Quaternion();
        q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), o.rotY || 0);
        const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.rotY || 0);
        for (let r = 0; r < o.rows; r++) for (let c = 0; c < o.cols; c++) {
            const local = new THREE.Vector3((c - (o.cols - 1) / 2) * o.pw, o.ph / 2 + r * o.ph, 0).applyQuaternion(rot);
            const pos = local.add(o.origin);
            const mesh = o.build(r * 31 + c * 7 + 1, o.pw, o.ph, o.pd);
            mesh.position.copy(pos);
            mesh.quaternion.copy(rot);
            o.scene.add(mesh);
            const body = new CANNON.Body({ mass: 0, material: Physics.material('wood') });
            body.addShape(new CANNON.Box(new CANNON.Vec3(o.pw / 2 - 0.01, o.ph / 2 - 0.01, o.pd / 2)));
            body.position.set(pos.x, pos.y, pos.z);
            body.quaternion.copy(q);
            const piece = { r, c, hp: PIECE_HP, broken: false, mesh, entry: null, id: `${o.id}_P${r}${c}` };
            piece.entry = Physics.add({ body, mesh, tier: TIER.DESTRUCTIBLE, id: piece.id, data: { piece, owner: this } });
            body.addEventListener('collide', e => this._onCollide(piece, e));
            this.pieces.push(piece);
        }
    }

    at(r, c) { return (r < 0 || c < 0 || r >= this.rows || c >= this.cols) ? null : this.pieces[r * this.cols + c]; }

    // Runs INSIDE the physics step: only record the hit. Changing a body's
    // type mid-step corrupts the solver, so the work happens in update().
    _onCollide(piece, e) {
        if (piece.broken) return;
        const other = e.body;
        const src = other.userData;
        if (!src || other.type === CANNON.Body.STATIC || src.tier === TIER.PLAYER) return;
        const speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (speed < MIN_IMPACT) return;
        const cause = src.data?.thrownBy && (performance.now() - src.data.thrownAt) < 6000 ? src.data.thrownBy : 'environment';
        this.pending.push({
            piece, amount: speed * other.mass * DAMAGE_PER, cause,
            vel: new THREE.Vector3(other.velocity.x, other.velocity.y, other.velocity.z),
        });
    }

    /** Apply a hit directly (QA, and later fire/water damage). */
    hit(r, c, amount, cause = 'environment', vel = new THREE.Vector3()) {
        const piece = this.at(r, c);
        if (piece && !piece.broken) this.pending.push({ piece, amount, cause, vel });
    }

    update() {
        if (!this.pending.length) return;
        const hits = this.pending.splice(0);
        let cause = 'environment';
        for (const h of hits) {
            cause = h.cause;
            this._damage(h.piece, h.amount, h.cause, h.vel);
            for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                const n = this.at(h.piece.r + dr, h.piece.c + dc);
                if (n) this._damage(n, h.amount * SPLASH, h.cause, h.vel.clone().multiplyScalar(0.5));
            }
        }
        this._settleSupport(cause);
        this._updateState(cause);
    }

    _damage(piece, amount, cause, vel) {
        if (piece.broken || amount <= 0) return;
        piece.hp -= amount;
        EventBus.emit(EV.STRUCTURE_DAMAGED, { id: this.id, piece: piece.id, amount: Math.round(amount), cause });
        if (piece.hp <= 0) { this._break(piece, cause, vel); return; }
        // Cracked: the panel darkens and sags a little on its fixings.
        const k = 1 - piece.hp / PIECE_HP;
        const m = piece.mesh.userData.ownMaterials?.body;
        if (m) m.color.setScalar(1 - k * 0.45);
        piece.mesh.rotateZ((Math.random() - 0.5) * 0.05 * k);
    }

    _break(piece, cause, vel) {
        piece.broken = true;
        piece.hp = 0;
        const b = piece.entry.body;
        Physics.toDebris(piece.entry, this.pieceMass);
        // Falling debris that knocks out more of the wall is still the
        // player's doing if the player started it.
        if (cause !== 'environment') Object.assign(piece.entry.data, { thrownBy: cause, thrownAt: performance.now() });
        const imp = vel.clone().multiplyScalar(this.pieceMass * 0.35);
        b.velocity.set(imp.x / this.pieceMass, imp.y / this.pieceMass + 1.5, imp.z / this.pieceMass);
        b.angularVelocity.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
        EventBus.emit(EV.PIECE_BROKEN, { id: this.id, piece: piece.id, cause, pos: { x: b.position.x, y: b.position.y, z: b.position.z } });
    }

    // Flood-fill from the ground row through intact pieces; whatever the fill
    // does not reach has lost its support and falls.
    _settleSupport(cause) {
        const ok = new Set();
        const stack = this.pieces.filter(p => p.r === 0 && !p.broken);
        stack.forEach(p => ok.add(p));
        while (stack.length) {
            const p = stack.pop();
            for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                const n = this.at(p.r + dr, p.c + dc);
                if (n && !n.broken && !ok.has(n)) { ok.add(n); stack.push(n); }
            }
        }
        for (const p of this.pieces) {
            if (!p.broken && !ok.has(p)) this._break(p, cause, new THREE.Vector3(0, -1, 0));
        }
    }

    _updateState(cause) {
        const gone = this.pieces.filter(p => p.broken).length / this.pieces.length;
        let next = gone === 0 ? STATE.INTACT : gone < CRITICAL_AT ? STATE.DAMAGED : gone < COLLAPSE_AT ? STATE.CRITICAL : STATE.COLLAPSED;
        if (next === STATE.COLLAPSED) {
            for (const p of this.pieces) if (!p.broken) this._break(p, cause, new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
        }
        if (next !== this.state) {
            const from = this.state;
            this.state = next;
            EventBus.emit(EV.STRUCTURE_STATE, { id: this.id, from, to: next, cause });
        }
    }

    summary() {
        return { id: this.id, state: this.state, broken: this.pieces.filter(p => p.broken).length, total: this.pieces.length };
    }
}
