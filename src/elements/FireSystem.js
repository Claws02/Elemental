// ============================================================
// FIRE — ignite, heat, spread, burn out (§9, Phase 1)
// ============================================================
//
// Fire acts through the CHANGE verb (hold still, src/data/materials.js), and
// the player gets it two ways (both, by design):
//
//   FROM A SOURCE   hold a brazier's coals, or anything already burning, for
//                   0.25 s and a fireball comes away in your hand. Hold it,
//                   flick it, drop it, like a rock. Pulling fire out of a
//                   burning plank puts that plank out.
//   ON THE SPOT     hold dry timber for 0.6 s and it catches where it stands.
//                   Hold a rock you are carrying still for 1.5 s and it
//                   heats in your grip: stone never burns, but a hot rock
//                   sets alight the wood it hits.
//
// Once alight, fire is its own system and nobody's to control:
//
//   HEAT      every flammable has heat 0..1. Burning things heat what is
//             near them (more strongly what is above: fire climbs). At 1 it
//             catches. Unheated things cool.
//   BURN      a burning thing spends fuel (8 s for a timber panel) and takes
//             damage while it does; the barricade loses the panel when it
//             burns through. Then it is charred and out: burned is a state,
//             and it does not burn twice.
//   CAUSE     fire remembers who started it. Spread inherits the cause, so
//             a whole wall that burns from one player-lit plank is the
//             player's doing (§12).
//
// Water (next checklist item) will be the way to put fire out; until then it
// burns out on its own, or the player pulls it away.
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { EventBus, EV } from '../core/EventBus.js';

export const FIRE = {
    spreadRadius: 1.5,      // metres, centre to centre
    spreadRate: 0.6,        // heat/s given to a neighbour at distance 0 (≈5 s to catch the next panel along, ≈3 s above)
    climb: 1.6,             // multiplier for neighbours above the fire
    cool: 0.15,             // heat/s lost by an unheated flammable
    rockHeat: 0.45,         // heat/s a rock gains while held still in Fire
    rockCool: 0.04,         // heat/s a hot rock loses
    hotIgnites: 0.5,        // a rock this hot sets wood alight on contact
    fireballLife: 4,        // seconds after it leaves the hand
    droppedLife: 1.5,       // seconds after a slow release
    fireballRadius: 0.34,
    originGrace: 1.5,       // seconds a new fireball ignores the thing it was pulled from
};

const EMBER = new THREE.Color(0xff5a2a);
const HOT = new THREE.Color(0xe0300a);
const CHAR = 0.14;

export class FireSystem {
    constructor({ scene, fx, interactables, channel, hero }) {
        Object.assign(this, { scene, fx, interactables, channel, hero });
        this.flammables = new Map();   // thing -> { thing, heat, burning, fuel, fuelMax, burned, cause, heatCause, onBurn }
        this.heatables = new Set();    // things (rocks) that heat but never burn
        this.sources = [];             // { thing, pos } always-lit coals
        this.fireballs = new Set();    // { thing, entry, born }
        this.queue = [];               // contacts recorded during the physics step
        this.time = 0;
        this.ignitions = 0;
        this.embers = [];
    }

    // ---- registration ----------------------------------------------------

    addFlammable(thing, { onBurn = null } = {}) {
        const fl = thing.mat.flammable;
        this.flammables.set(thing, { thing, heat: 0, burning: false, burned: false, fuel: fl.fuel, fuelMax: fl.fuel, ignitesAt: fl.ignitesAt, cause: null, heatCause: null, onBurn });
    }

    addHeatable(thing) {
        this.heatables.add(thing);
        const e = thing.entry;
        e.data.heat = 0;
        e.body.addEventListener('collide', ev => {
            if ((e.data.heat || 0) > FIRE.hotIgnites) this.queue.push({ kind: 'hot', src: thing, other: ev.body.userData });
        });
    }

    addSource(thing, pos) { this.sources.push({ thing, pos }); }

    isBurning(thing) { return !!this.flammables.get(thing)?.burning; }
    isSource(thing) { return this.sources.some(s => s.thing === thing); }
    burningCount() { let n = 0; for (const f of this.flammables.values()) if (f.burning) n++; return n; }
    burnedCount() { let n = 0; for (const f of this.flammables.values()) if (f.burned) n++; return n; }

    // ---- what the player does --------------------------------------------

    /** Set a flammable alight. Returns false if it cannot burn (burned, already burning). */
    ignite(thing, cause) {
        const f = this.flammables.get(thing);
        if (!f || f.burning || f.burned) return false;
        f.burning = true;
        f.heat = 1;
        f.cause = cause;
        this.ignitions++;
        EventBus.emit(EV.FIRE_STARTED, { id: thing.id, cause });
        return true;
    }

    /** Heat a stone the player is holding in Fire. */
    heat(thing, dt, cause) {
        if (!this.heatables.has(thing)) return;
        const d = thing.entry.data;
        const before = d.heat || 0;
        d.heat = Math.min(1, before + FIRE.rockHeat * dt);
        d.heatCause = cause;
        if (before < FIRE.hotIgnites && d.heat >= FIRE.hotIgnites) EventBus.emit(EV.OBJECT_HEATED, { id: thing.id, cause });
    }

    /**
     * Draw a fireball out of coals or a burning thing. The fireball is a new
     * interactable (material "flame") placed just above the source.
     */
    pullFrom(thing, cause) {
        const f = this.flammables.get(thing);
        if (f?.burning) {
            // Taking the fire away puts it out. The heat goes with it.
            f.burning = false;
            f.heat = 0;
            this._glow(thing, 0);
            EventBus.emit(EV.FIRE_OUT, { id: thing.id, cause, pulled: true });
        } else if (!this.isSource(thing)) {
            return null;
        }
        // It comes away toward the hero, clear of what it came out of: a
        // fireball born inside the plank it was pulled from would relight it.
        const src = this.sources.find(s => s.thing === thing);
        const from = src ? src.pos.clone() : thing.pos();
        const toHero = this.hero.handPoint(new THREE.Vector3()).sub(from);
        toHero.y = 0;
        const p = from.addScaledVector(toHero.normalize(), 0.75);
        p.y += 0.45;
        this.fx.burst(p, 18, 0.45, 2.2);
        return this._makeFireball(p, cause, thing);
    }

    _makeFireball(p, cause, origin = null) {
        const R = FIRE.fireballRadius;
        const grp = new THREE.Group();
        grp.add(new THREE.Mesh(new THREE.IcosahedronGeometry(R * 0.7, 1), new THREE.MeshBasicMaterial({ color: 0xffe08a })));
        const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 1.15, 1),
            new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
        grp.add(shell);
        grp.position.copy(p);
        this.scene.add(grp);
        const body = new CANNON.Body({ mass: 1, linearDamping: 0.05, angularDamping: 0.5 });
        body.addShape(new CANNON.Sphere(R));
        body.position.set(p.x, p.y, p.z);
        body.allowSleep = false;
        const entry = Physics.add({ body, mesh: grp, tier: TIER.ELEMENTAL, id: 'Fireball', data: { radius: R, fireball: true, cause } });
        const thing = this.interactables.add({ id: 'Fireball', mesh: grp, entry, material: 'flame' });
        const fb = { thing, entry, born: this.time, created: this.time, origin, shell };
        body.addEventListener('collide', ev => this.queue.push({ kind: 'fireball', fb, other: ev.body.userData }));
        this.fireballs.add(fb);
        return thing;
    }

    _dissipate(fb) {
        if (!this.fireballs.has(fb)) return;
        this.fireballs.delete(fb);
        this.fx.burst(fb.entry.mesh.position, 20, 0.5, 2.5);
        fb.entry.data.gone = true;
        this.interactables.remove(fb.thing);
        Physics.remove(fb.entry);
        fb.entry.mesh.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    }

    _held(entry) { return this.channel.held?.entry === entry; }

    // ---- per frame (after the physics step) ------------------------------

    update(dt) {
        this.time += dt;
        this._contacts();
        this._fadeEmbers(dt);

        for (const s of this.sources) this.fx.burn(s.pos, dt, { rate: 12, w: 0.45, h: 0.15, size: 0.5, smoke: 0.2 });

        // Burning and spreading.
        const burning = [...this.flammables.values()].filter(f => f.burning);
        const heated = new Set();
        for (const f of burning) {
            const p = f.thing.pos();
            f.fuel -= dt;
            f.onBurn?.((100 / f.fuelMax) * dt, f.cause);
            this.fx.burn(p, dt, { rate: 22, w: 0.85, h: 0.8, size: 0.85 });
            // A low, flickering ember glow: the flames carry the fire, the
            // wood only smoulders under them (a strong glow reads as a lamp).
            this._glow(f.thing, 0.16 + Math.sin(this.time * 17 + p.x * 3) * 0.06 + Math.sin(this.time * 7.3) * 0.04);
            for (const o of this.flammables.values()) {
                if (o === f || o.burning || o.burned) continue;
                const q = o.thing.pos();
                const d = p.distanceTo(q);
                if (d >= FIRE.spreadRadius) continue;
                o.heat += FIRE.spreadRate * (1 - d / FIRE.spreadRadius) * (q.y > p.y + 0.3 ? FIRE.climb : 1) * dt;
                o.heatCause = f.cause;
                heated.add(o);
            }
            if (f.fuel <= 0) {
                f.burning = false;
                f.burned = true;
                this._char(f.thing);
                EventBus.emit(EV.FIRE_OUT, { id: f.thing.id, cause: f.cause, burnedOut: true });
            }
        }
        for (const o of this.flammables.values()) {
            if (o.burning || o.burned) continue;
            if (o.heat >= o.ignitesAt) this.ignite(o.thing, o.heatCause || 'environment');
            else if (!heated.has(o) && o.heat > 0) o.heat = Math.max(0, o.heat - FIRE.cool * dt);
        }

        // Hot stones: glow with their heat, cool slowly.
        for (const t of this.heatables) {
            const d = t.entry.data;
            if (!d.heat) continue;
            d.heat = Math.max(0, d.heat - FIRE.rockCool * dt);
            const m = t.mesh.userData.ownMaterials?.body;
            if (m) {
                // Hot stone darkens and glows from within, deep red first.
                m.color.setScalar(1 - d.heat * 0.6);
                m.emissive.copy(HOT);
                m.emissiveIntensity = d.heat * d.heat * (0.7 + Math.sin(this.time * 9 + t.entry.body.id) * 0.08);
                if (d.heat <= 0.001) m.color.setScalar(1);
            }
            if (d.heat > 0.55) this.fx.burn(t.mesh.position, dt, { rate: 4 * d.heat, w: 0.4, h: 0.3, size: 0.3, smoke: 0.5 });
        }

        // Fireballs: burn in the hand; once let go, float on and die out.
        for (const fb of [...this.fireballs]) {
            const e = fb.entry;
            if (!e.body.world) { this._dissipate(fb); continue; }
            const pos = e.mesh.position;
            this.fx.burn(pos, dt, { rate: 34, w: 0.22, h: 0.22, size: 0.5, smoke: 0.08 });
            fb.shell.scale.setScalar(1 + Math.sin(this.time * 23) * 0.12);
            if (this._held(e)) { fb.born = this.time; continue; }
            // Fire is light: most of gravity is cancelled, so a thrown fireball flies flat.
            e.body.velocity.y += 22 * 0.8 * dt;
            const thrown = (e.data.thrownAt || 0) > (e.data.droppedAt || 0);
            if (this.time - fb.born > (thrown ? FIRE.fireballLife : FIRE.droppedLife)) this._dissipate(fb);
        }
    }

    // Contacts recorded inside the physics step, applied now.
    _contacts() {
        const q = this.queue.splice(0);
        for (const c of q) {
            if (c.kind === 'fireball') {
                const fb = c.fb;
                if (!this.fireballs.has(fb) || !c.other || c.other.tier === TIER.PLAYER) continue;
                const other = this.interactables.forEntry(c.other);
                // For a moment after it is pulled, it ignores what it came out of.
                if (other && other === fb.origin && this.time - fb.created < FIRE.originGrace) continue;
                const held = this._held(fb.entry);
                const cause = fb.entry.data.cause || 'player';
                if (other && this.flammables.has(other)) {
                    // Pressed into wood, or thrown at it: it catches.
                    if (this.ignite(other, cause) || !held) this._dissipate(fb);
                    if (held && !this.fireballs.has(fb)) this.channel.let();
                } else if (!held) {
                    if (other && this.heatables.has(other)) {
                        const d = other.entry.data;
                        d.heat = Math.min(1, (d.heat || 0) + 0.6);
                        d.heatCause = cause;
                    }
                    this._dissipate(fb);
                }
            } else if (c.kind === 'hot') {
                const other = c.other && this.interactables.forEntry(c.other);
                const d = c.src.entry.data;
                if (other && this.flammables.has(other) && d.heat > FIRE.hotIgnites) {
                    if (this.ignite(other, d.heatCause || 'environment')) d.heat = Math.max(0, d.heat - 0.15);
                }
            }
        }
    }

    _glow(thing, k) {
        const m = thing.mesh.userData.ownMaterials?.body;
        if (!m) return;
        m.emissive.copy(EMBER);
        m.emissiveIntensity = Math.max(0, k);
    }

    _char(thing) {
        const m = thing.mesh.userData.ownMaterials?.body;
        if (!m) return;
        m.color.setScalar(CHAR);
        m.emissive.copy(EMBER);
        m.emissiveIntensity = 0.1;
        this.embers.push({ m, t: 0 });
    }

    // Charred wood keeps a last glow of embers that dies over a few seconds.
    _fadeEmbers(dt) {
        for (const e of this.embers) { e.t += dt; e.m.emissiveIntensity = 0.1 * Math.max(0, 1 - e.t / 6); }
        this.embers = this.embers.filter(e => e.t < 6);
    }

    stats() {
        return { burning: this.burningCount(), burned: this.burnedCount(), fireballs: this.fireballs.size, ignitions: this.ignitions };
    }
}
