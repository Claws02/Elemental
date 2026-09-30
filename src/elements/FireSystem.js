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
//   BUILD     a new fire starts at a quarter strength and builds over 5 s.
//             Caught early it is easy to stop; left alone, several burning
//             planks heat each neighbour from all sides and it runs away.
//             Both are the design: the player's power gets out of hand.
//   BURN      a burning thing spends fuel (8 s for a timber panel) and takes
//             damage while it does; the barricade loses the panel when it
//             burns through. Then it is charred and out: burned is a state,
//             and it does not burn twice.
//   CAUSE     fire remembers who started it. Spread inherits the cause, so
//             a whole wall that burns from one player-lit plank is the
//             player's doing (§12).
//
// Water puts fire out (WaterSystem calls douse / soak / quench here): wet
// timber will not catch or take heat until it dries (20 s).
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { EventBus, EV } from '../core/EventBus.js';
import { WILD } from '../data/growth.js';
import { FIRE } from '../data/elements.js';

// Tuning lives in src/data/elements.js (data, not code).
export { FIRE };

const EMBER = new THREE.Color(0xff5a2a);
const HOT = new THREE.Color(0xe0300a);
const CHAR = 0.14;

export class FireSystem {
    constructor({ scene, fx, interactables, channel, hero, prog }) {
        Object.assign(this, { scene, fx, interactables, channel, hero, prog });
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
        this.flammables.set(thing, { thing, heat: 0, burning: false, burned: false, fuel: fl.fuel, fuelMax: fl.fuel, ignitesAt: fl.ignitesAt, flash: fl.flash || 0, cause: null, heatCause: null, onBurn, wet: 0, dryCol: null });
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

    /** How many burning things are within `r` of point `p` (on the ground plane): the hero standing in fire. */
    burningNear(p, r) {
        let n = 0;
        for (const f of this.flammables.values()) {
            if (!f.burning) continue;
            const q = f.thing.pos();
            if (Math.hypot(q.x - p.x, q.z - p.z) < r && Math.abs(q.y - p.y - 0.8) < 1.6) n++;
        }
        return n;
    }
    isBurned(thing) { return !!this.flammables.get(thing)?.burned; }
    isSource(thing) { return this.sources.some(s => s.thing === thing); }
    burningCount() { let n = 0; for (const f of this.flammables.values()) if (f.burning) n++; return n; }
    burnedCount() { let n = 0; for (const f of this.flammables.values()) if (f.burned) n++; return n; }

    // ---- what the player does --------------------------------------------

    /**
     * Set a flammable alight. Returns false if it cannot burn (burned, already
     * burning, wet). `direct`: the player lit it themselves; with WILD Fire
     * that throws sparks, and a thing or two nearby catches as well.
     */
    ignite(thing, cause, { direct = false } = {}) {
        const f = this.flammables.get(thing);
        if (!f || f.burning || f.burned || f.wet > 0) return false;     // wet timber will not catch
        if (direct && this.prog?.wild('fire')) this._sparks(thing, cause);
        f.burning = true;
        f.heat = 1;
        f.cause = cause;
        f.age = 0;                     // a new fire starts low and builds (FIRE.buildUp)
        this.ignitions++;
        EventBus.emit(EV.FIRE_STARTED, { id: thing.id, cause });
        return true;
    }

    get douseLump() { return FIRE.douseTime; }

    /** How strong a fire is, 0.25 … 1, as it builds. */
    intensity(f) {
        // Dry tinder (hay) flashes: full strength at once, and spreads faster.
        if (f.flash) return f.flash;
        return Math.min(1, FIRE.startIntensity + (1 - FIRE.startIntensity) * (f.age || 0) / FIRE.buildUp);
    }

    /**
     * Wind on a fire. A young, small flame blows out (after FIRE.blowTime of
     * wind); an established fire flares and spreads downwind for a while.
     * Returns 'out', 'fanned' or null.
     */
    wind(thing, amount, dir, cause) {
        const f = this.flammables.get(thing);
        if (!f?.burning) return null;
        if (f.age < FIRE.youngAge) {
            f.blowing = (f.blowing || 0) + amount;
            if (f.blowing >= FIRE.blowTime) {
                f.burning = false; f.heat = 0; f.age = 0; f.blowing = 0;
                this._glow(thing, 0);
                this.fx.steam?.(thing.pos(), 6);
                EventBus.emit(EV.FIRE_OUT, { id: thing.id, cause, blown: true });
                return 'out';
            }
            return null;
        }
        const first = (f.fanUntil || 0) <= this.time;
        f.fanUntil = this.time + FIRE.fanFor;
        f.windDir = dir.clone().setY(0).normalize();
        f.cause = f.cause || cause;
        if (first) EventBus.emit(EV.FIRE_FANNED, { id: thing.id, cause });
        return 'fanned';
    }

    isWet(thing) { return (this.flammables.get(thing)?.wet || 0) > 0; }

    /** Put a fire out with water. Returns true if something was burning. */
    douse(thing, cause) {
        const f = this.flammables.get(thing);
        if (!f?.burning) return false;
        f.burning = false;
        f.heat = 0;
        f.age = 0;
        f.dousing = 0;
        this._glow(thing, 0);
        this.fx.steam?.(thing.pos(), 10);
        EventBus.emit(EV.FIRE_OUT, { id: thing.id, cause, doused: true });
        return true;
    }

    /**
     * Water arriving on timber: `amount` is seconds of steady stream (an
     * orb's burst counts as a lump). A fire fights back: it only goes out
     * after FIRE.douseTime of water, hissing all the while, and recovers if
     * the water slips off. Timber that isn't burning soaks at once.
     */
    wetten(thing, amount, cause) {
        const f = this.flammables.get(thing);
        if (!f || f.burned) return false;
        if (f.burning) {
            f.dousing = (f.dousing || 0) + amount;
            f.wettedAt = this.time;
            this.fx.steam?.(thing.pos(), 18 * Math.min(amount, 0.1) + 1);
            if (f.dousing < FIRE.douseTime) return false;
        }
        return this.soak(thing, cause);
    }

    /** Soak timber: it will not catch, and fire near it does not heat it, for a while. */
    soak(thing, cause) {
        const f = this.flammables.get(thing);
        if (!f || f.burned) return false;
        this.douse(thing, cause);
        const m = thing.mesh.userData.ownMaterials?.body;
        if (m && !f.wet) { f.dryCol = m.color.clone(); m.color.multiplyScalar(0.62).offsetHSL(0.02, -0.1, 0); }
        const first = !f.wet;
        f.wet = thing.mat.soaks || 20;
        f.heat = 0;
        if (first) EventBus.emit(EV.OBJECT_SOAKED, { id: thing.id, cause });
        return true;
    }

    /** Water on hot stone: it cools fast and steams. */
    quench(thing, dt) {
        const d = thing.entry?.data;
        if (!d?.heat) return false;
        d.heat = Math.max(0, d.heat - 1.5 * dt);
        this.fx.steam?.(thing.mesh.position, 30 * dt);
        return true;
    }

    /** A fireball that meets water goes out in a puff of steam. */
    quenchFireball(entry) {
        for (const fb of this.fireballs) if (fb.entry === entry) { this.fx.steam?.(entry.mesh.position, 12); this._dissipate(fb); return true; }
        return false;
    }

    // Wild Fire does more than it was asked: sparks catch a thing or two nearby.
    _sparks(thing, cause) {
        const w = WILD.fire, p = thing.pos();
        const near = [...this.flammables.values()].filter(o => o.thing !== thing && !o.burning && !o.burned && o.wet <= 0 && o.thing.pos().distanceTo(p) < w.sparkRadius);
        const n = w.sparks[0] + Math.floor(Math.random() * (w.sparks[1] - w.sparks[0] + 1));
        for (let i = 0; i < n && near.length; i++) {
            const o = near.splice(Math.floor(Math.random() * near.length), 1)[0];
            this.fx.burst(o.thing.pos(), 8, 0.3, 3);
            this.ignite(o.thing, cause);
        }
    }

    // A wild fireball bursting: everything flammable close by catches.
    _wildBurst(p, cause) {
        for (const o of this.flammables.values()) {
            if (o.burning || o.burned || o.wet > 0) continue;
            if (o.thing.pos().distanceTo(p) < WILD.fire.burstRadius) this.ignite(o.thing, cause);
        }
        this.fx.burst(p, 40, 0.7, 5);
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
        const wild = !!this.prog?.wild('fire');
        const [a, b] = WILD.fire.burstAfter;
        const fb = { thing, entry, born: this.time, created: this.time, origin, shell, wild, burstAt: this.time + a + Math.random() * (b - a) };
        // Held-or-not is judged at the moment of contact (see WaterSystem).
        body.addEventListener('collide', ev => this.queue.push({ kind: 'fireball', fb, other: ev.body.userData, held: this._held(entry) }));
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
            f.age += dt;
            // Water that stopped arriving: the fire recovers.
            if (f.dousing > 0 && this.time - (f.wettedAt || 0) > 0.25) f.dousing = Math.max(0, f.dousing - dt);
            // Fire builds: a fresh flame is small and slow to spread (the
            // player's window to stop it), then it takes hold.
            const k = this.intensity(f);
            const fanned = (f.fanUntil || 0) > this.time;
            f.onBurn?.((100 / f.fuelMax) * dt * (fanned ? 1.4 : 1), f.cause);
            const kv = Math.min(1, k);      // how big it looks: a flash spreads faster, it isn't bigger
            this.fx.burn(p, dt, { rate: 22 * kv * (fanned ? 1.7 : 1), w: 0.85, h: 0.4 + 0.4 * kv, size: (0.5 + 0.35 * kv) * (fanned ? 1.25 : 1) });
            // A low, flickering ember glow: the flames carry the fire, the
            // wood only smoulders under them (a strong glow reads as a lamp).
            this._glow(f.thing, 0.16 + Math.sin(this.time * 17 + p.x * 3) * 0.06 + Math.sin(this.time * 7.3) * 0.04);
            for (const o of this.flammables.values()) {
                if (o === f || o.burning || o.burned || o.wet > 0) continue;
                const q = o.thing.pos();
                const d = p.distanceTo(q);
                // Fanned by wind, fire reaches further and faster downwind.
                const align = fanned && d > 0 ? Math.max(0, q.clone().sub(p).normalize().dot(f.windDir)) : 0;
                const R = FIRE.spreadRadius * (1 + 0.8 * align);
                if (d >= R) continue;
                const wind = fanned ? 1.3 + 1.5 * align : 1;
                o.heat += k * wind * FIRE.spreadRate * (1 - d / R) * (q.y > p.y + 0.3 ? FIRE.climb : 1) * dt;
                o.heatCause = f.cause;
                heated.add(o);
            }
            if (f.fuel <= 0) {
                f.burning = false;
                f.burned = true;
                this._char(f.thing);
                EventBus.emit(EV.FIRE_OUT, { id: f.thing.id, cause: f.cause, burnedOut: true });
                if (f.thing.mat.explodes) this._explode(f);
            }
        }
        for (const o of this.flammables.values()) {
            if (o.wet > 0) {
                o.wet -= dt;
                if (o.wet <= 0) {         // dried out
                    o.wet = 0;
                    const m = o.thing.mesh.userData.ownMaterials?.body;
                    if (m && o.dryCol && !o.burned) m.color.copy(o.dryCol);
                    o.dryCol = null;
                }
                continue;
            }
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
            if (this._held(e)) {
                fb.born = this.time;
                // Untrained, a fireball won't stay: it flickers, then bursts in the hand.
                if (fb.wild) {
                    fb.shell.scale.multiplyScalar(1 + Math.sin(this.time * 41) * 0.15);
                    if (this.time >= fb.burstAt) {
                        this._wildBurst(pos.clone(), fb.entry.data.cause || 'player');
                        this.channel.let();
                        this._dissipate(fb);
                        EventBus.emit(EV.WILD_BURST, { cause: 'player', inHand: true });
                    }
                }
                continue;
            }
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
                const held = c.held;
                const cause = fb.entry.data.cause || 'player';
                if (c.other.data?.creature && !held) {          // a fireball thrown into a creature
                    c.other.data.creature.react('fire', 22, cause);
                    this._dissipate(fb);
                    continue;
                }
                if (fb.wild && !held) {
                    // A wild fireball bursts wide on whatever it hits.
                    this._wildBurst(fb.entry.mesh.position.clone(), cause);
                    this._dissipate(fb);
                    continue;
                }
                if (other && this.flammables.has(other)) {
                    // Pressed into wood, or thrown at it: it catches.
                    if (this.ignite(other, cause, { direct: true }) || !held) this._dissipate(fb);
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

    /**
     * An oil barrel bursts: everything flammable in reach catches, loose
     * things are thrown, timber is split, stone is heated. All of it is
     * whoever lit the barrel's doing.
     */
    _explode(f) {
        const { radius, push, wear } = f.thing.mat.explodes;
        const p = f.thing.pos();
        const cause = f.cause || 'environment';
        this.fx.burst(p, 70, 0.95, 7);
        for (let i = 0; i < 16; i++) this.fx.burn(p, 1, { rate: 1, w: 1.6, h: 1.2, size: 1.1, smoke: 1 });
        const _q = new THREE.Vector3();
        const near = q => { const d = _q.set(q.x, q.y, q.z).distanceTo(p); return d < radius ? 1 - d / radius : 0; };
        for (const o of this.flammables.values()) {
            if (o === f || o.burned || o.wet > 0) continue;
            if (near(o.thing.pos()) > 0) this.ignite(o.thing, cause);
        }
        for (const t of this.heatables) {
            const k = near(t.mesh.position);
            if (k > 0) { t.entry.data.heat = Math.min(1, (t.entry.data.heat || 0) + 0.6 * k); t.entry.data.heatCause = cause; }
        }
        for (const t of this.interactables.things) {
            const piece = t.entry?.data.piece, owner = t.entry?.data.owner;
            if (!piece || piece.broken) continue;
            const k = near(t.pos());
            if (k > 0) owner.wear(piece, wear * k, cause, t.pos().sub(p).normalize().multiplyScalar(6));
        }
        for (const e of Physics.all()) {
            const b = e.body;
            if (b.type !== CANNON.Body.DYNAMIC || e.tier === TIER.PLAYER) continue;
            const k = near(b.position);
            if (k <= 0) continue;
            const d = new THREE.Vector3(b.position.x - p.x, 0, b.position.z - p.z).normalize();
            const v = push * k / (1 + b.mass / 8);
            b.wakeUp();
            b.velocity.x += d.x * v; b.velocity.y += v * 0.8; b.velocity.z += d.z * v;
            b.angularVelocity.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
            e.data.thrownBy = cause; e.data.thrownAt = performance.now();
        }
        EventBus.emit(EV.EXPLOSION, { id: f.thing.id, cause, pos: { x: p.x, y: p.y, z: p.z } });
    }

    _glow(thing, k) {
        const m = thing.mesh.userData.ownMaterials?.body;
        if (!m) return;
        m.emissive.copy(EMBER);
        m.emissiveIntensity = Math.max(0, k);
    }

    /** Already burned when the scene loads (the world remembers). */
    markBurned(thing) {
        const f = this.flammables.get(thing);
        if (!f) return;
        Object.assign(f, { burning: false, burned: true, heat: 0, fuel: 0 });
        this._char(thing);
    }

    _char(thing) {
        const m = thing.mesh.userData.ownMaterials?.body;
        if (!m) return;
        m.color.setScalar(CHAR);
        m.emissive.copy(EMBER);
        m.emissiveIntensity = 0.1;
        this.embers.push({ m, t: 0 });
        if (thing.mat.name === 'hay') thing.mesh.scale.y = 0.3;      // burned to stubble
    }

    // Charred wood keeps a last glow of embers that dies over a few seconds.
    _fadeEmbers(dt) {
        for (const e of this.embers) { e.t += dt; e.m.emissiveIntensity = 0.1 * Math.max(0, 1 - e.t / 6); }
        this.embers = this.embers.filter(e => e.t < 6);
    }

    /** Back to unburnt: for a structure that has been rebuilt. */
    reset(thing) {
        const f = this.flammables.get(thing);
        if (!f) return;
        Object.assign(f, { heat: 0, burning: false, burned: false, fuel: f.fuelMax, cause: null, heatCause: null, age: 0, wet: 0, dryCol: null });
        this.embers = this.embers.filter(e => e.m !== thing.mesh.userData.ownMaterials?.body);
        this._glow(thing, 0);
    }

    stats() {
        return { burning: this.burningCount(), burned: this.burnedCount(), fireballs: this.fireballs.size, ignitions: this.ignitions };
    }
}
