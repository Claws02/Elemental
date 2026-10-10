// ============================================================
// FLAME JET — Fire straight from the hands to what you touch
// ============================================================
//
// Touch a creature and keep the finger down: a jet of flame runs from the
// hero's hands to it and follows it while it moves, burning it (FLAME.dps).
// Touch something that burns and hold: the same jet plays on it while Fire's
// hold ring fills, and it catches (the ignite verb, docs/CONTEXT_CONTROLS.md).
//
// WILD Fire doesn't stay on target: the jet sprays, and things that burn near
// where it lands catch too (FLAME.spray). That is how the Veyra fire starts:
// the story names the player's own house (the flameSpill action), and the
// first time the jet plays anywhere near it, it spills onto the roof. The
// ledger doesn't hold that first fire against them (cause 'awakening'); what
// the jet lights after that is theirs. If the jet never comes near, the spill
// happens anyway after `after` seconds: once, either way.
// ============================================================

import { THREE } from '../engine/lib.js';
import { EventBus, EV } from '../core/EventBus.js';
import { FLAME } from '../data/elements.js';
import { flameJetMaterial } from '../art/ElementFx.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();

export class FlameJet {
    constructor({ scene, player, fire, fx, prog, creatures, interactables }) {
        Object.assign(this, { scene, player, fire, fx, prog, creatures, interactables });
        // The beam: a flickering cone of flame from the hands to the target (a unit cone, stretched each frame).
        const geo = new THREE.CylinderGeometry(1, 0.35, 1, 10, 1, true);
        geo.translate(0, 0.5, 0);
        geo.rotateX(Math.PI / 2);                      // along +z, from 0 to 1
        this.beamMat = flameJetMaterial();               // tongues of flame streaming along it (art/ElementFx.js)
        this.beam = new THREE.Mesh(geo, this.beamMat);
        this.core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.beam.add(this.core);
        this.core.scale.set(0.45, 0.45, 1);
        this.beam.visible = false;
        this.beam.frustumCulled = false; this.core.frustumCulled = false;
        scene?.add(this.beam);
        this.t = 0;
        this.target = null;        // { creature } or { thing }
        this.on = false;
        this.spill = null;         // { target: id, radius } from the story
        this.sprayT = 0;
        this.used = 0;             // seconds the jet has played, ever (QA)
    }

    /** Aim the jet at a creature (kept until let go). */
    atCreature(c) { this.target = { creature: c }; this.on = true; }
    /** Play the jet on a thing for a moment (the ignite hold). */
    atThing(t) { this.target = { thing: t }; this.on = true; }
    stop() { this.on = false; this.target = null; if (this.beam) this.beam.visible = false; }

    /** Where the jet lands now, or null. */
    end() {
        const t = this.target;
        if (!t) return null;
        if (t.creature) return (t.creature.state === 'dead' || t.creature.gone) ? null : _b.set(t.creature.pos.x, t.creature.pos.y, t.creature.pos.z);
        return _b.copy(t.thing.pos());
    }

    update(dt) {
        // A spill that never happened (the jet never came near): after `after` seconds it happens anyway, once.
        if (this.spill?.after && (this.spill.t = (this.spill.t || 0) + dt) > this.spill.after) this._spill(null, null, true);
        if (!this.on) { if (this.beam?.visible) this.beam.visible = false; return; }
        const end = this.end();
        if (!end) { this.stop(); return; }
        const from = this.player.handPoint(_a);
        if (from.distanceTo(end) > FLAME.range) { this.stop(); return; }
        this.used += dt;
        this._draw(from, end, dt);
        const c = this.target.creature;
        if (c) c.react('fire', FLAME.dps * dt, 'player');
        // Wild: it sprays, and what burns near where it lands catches.
        if (this.prog.wild('fire')) {
            this.sprayT += dt;
            if (this.sprayT > FLAME.sprayEvery) {
                this.sprayT = 0;
                for (const f of this.fire.flammables.values()) {
                    if (f.burning || f.burned || f.thing === this.target.thing) continue;
                    if (f.thing.pos().distanceTo(end) < FLAME.spray && Math.random() < 0.5) { this.fire.ignite(f.thing, 'player'); break; }
                }
            }
        }
        this._spill(from, end);
    }

    // The story's spill: the first jet anywhere near the named object lights it.
    _spill(from, end, force = false) {
        const s = this.spill;
        if (!s) return;
        const pieces = [...this.fire.flammables.values()].filter(f => (f.thing.id === s.target || f.thing.id.startsWith(s.target + '_')) && !f.burning && !f.burned);
        if (!pieces.length) { this.spill = null; return; }
        const near = !force && pieces.some(f => { const q = f.thing.pos(); return Math.hypot(q.x - end.x, q.z - end.z) < s.radius || Math.hypot(q.x - from.x, q.z - from.z) < s.radius; });
        if (!force && !near) return;
        const at = end || this.player.position;
        pieces.sort((a, b) => a.thing.pos().distanceTo(at) - b.thing.pos().distanceTo(at));
        // The roof first if there is one: thatch is what catches.
        const roof = pieces.filter(f => /_R\d+$/.test(f.thing.id));
        for (const f of (roof.length ? roof : pieces).slice(0, 2)) this.fire.ignite(f.thing, s.cause || 'awakening');
        EventBus.emit(EV.FLAME_SPILL, { target: s.target });
        this.spill = null;
    }

    _draw(from, end, dt) {
        // The beam: stretched from the hands to the target, flickering; wild, it is wider and ragged.
        this.t += dt;
        const wild = this.prog.wild('fire');
        const len0 = from.distanceTo(end);
        const w = (wild ? 0.5 : 0.32) * (0.85 + Math.sin(this.t * 37) * 0.1 + Math.random() * 0.12);
        this.beam.position.copy(from);
        this.beam.lookAt(end);
        this.beam.scale.set(w, w, len0);
        this.beamMat.uniforms.uWild.value = wild ? 1 : 0;
        this.beam.visible = true;
        const n = Math.ceil(FLAME.particles * dt);
        _d.subVectors(end, from);
        const len = _d.length();
        _d.normalize();
        const wide = this.prog.wild('fire') ? 1.6 : 0.6;
        for (let i = 0; i < n; i++) {
            const v = FLAME.speed * (0.8 + Math.random() * 0.4);
            this.fx.flame.spawn({
                x: from.x, y: from.y, z: from.z,
                vx: _d.x * v + (Math.random() - 0.5) * wide, vy: _d.y * v + (Math.random() - 0.5) * wide + 0.4, vz: _d.z * v + (Math.random() - 0.5) * wide,
                max: Math.min(0.6, len / v + 0.05), s0: 0.4, s1: 0.9,
            });
        }
    }
}
