// ============================================================
// SURGES — wild power going off on its own
// ============================================================
//
// Until Cael trains an element, it is WILD. Under his charm a wild element is
// silent (core/Progression.js live()). Without it, every so often one of them
// goes off around the player, unasked:
//
//   fire    sparks: the nearest things that burn catch; you are singed
//   earth   the ground jolts: loose things and creatures are thrown up and out,
//           timber nearby cracks
//   water   a lash of water: fires close by go out, things are shoved
//   air     a blast of wind: fans old fires, snuffs young ones, knocks things flat
//
// Anyone standing close is hurt, and it goes in the ledger as the player's
// (cause 'surge'): the world doesn't care that you didn't mean it.
//
// The clock runs 40–90 s when calm, faster under stress: creatures on you, fire
// close, your own health low (data/growth.js SURGE).
//
// Surges run only in the story, and only once the stone has cracked
// (flag charm = 'none' until Cael offers it, then 'worn' or 'refused').
// The story can also call one up (the awakening): surge(el, { target, cause }).
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { EventBus, EV } from '../core/EventBus.js';
import { SURGE } from '../data/growth.js';

const ELS = ['fire', 'earth', 'water', 'air'];
const _p = new THREE.Vector3();

export class Surges {
    constructor({ prog, player, fire, fx, water, world, creatures, vitals }) {
        Object.assign(this, { prog, player, fire, fx, water, world, creatures, vitals });
        this.enabled = true;        // QA switches the random clock off to keep a run repeatable
        this.t = this._roll();
        this.count = 0;
        this.last = null;
    }

    _roll() { return SURGE.every[0] + Math.random() * (SURGE.every[1] - SURGE.every[0]); }

    /** Surges can happen: after the awakening, not under the charm, something still wild. */
    get active() {
        const c = this.prog.flags?.charm;
        return (c === 'none' || c === 'refused') && ELS.some(e => this.prog.wild(e));
    }

    /** How fast the clock runs now: 1 calm, up to 3 in the thick of it. */
    stress() {
        const p = this.player.position, S = SURGE.stress;
        let k = 1;
        if (this.creatures?.all.some(c => c.engaged && c.state !== 'dead' && !c.gone && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < SURGE.creatureRange)) k += S.creatures;
        if (this.fire.burningNear?.(p, SURGE.fireRange)) k += S.fire;
        if (this.vitals && this.vitals.health < 50) k += S.hurt;
        return k;
    }

    update(dt) {
        if (!this.enabled || !this.active) return;
        this.t -= dt * this.stress();
        if (this.t > 0) return;
        this.t = this._roll();
        const wild = ELS.filter(e => this.prog.wild(e));
        this.surge(wild[Math.floor(Math.random() * wild.length)]);
    }

    /**
     * One surge of `el` around the player (or `at`).
     * @param {object} [o]
     * @param {string} [o.cause]   'surge' (the ledger counts it) or 'awakening' (the story's; it doesn't)
     * @param {string} [o.target]  fire only: light this object's pieces first (the awakening: your house)
     */
    surge(el, { cause = 'surge', target = null, at = null } = {}) {
        const p = _p.copy(at || this.player.position);
        const R = SURGE.radius;
        const hurt = [];
        if (el === 'fire') this._fire(p, R, cause, target);
        else if (el === 'earth') this._push(p, R, 5, 3.5, 'impact', 25, cause);
        else if (el === 'water') this._water(p, R, cause);
        else if (el === 'air') this._air(p, R, cause);
        // People close by are hurt, and flinch away.
        for (const o of this.world.objects.values()) {
            const n = o.npc;
            if (!n || o.hidden) continue;
            const q = n.position;
            if (Math.hypot(q.x - p.x, q.z - p.z) < SURGE.people) { n.startle?.(p); hurt.push(n.id); }
        }
        this.count++;
        this.last = { el, cause, hurt };
        EventBus.emit(EV.SURGE, { el, x: p.x, z: p.z, cause, hurt });
        return this.last;
    }

    _fire(p, R, cause, target) {
        this.fx?.burst({ x: p.x, y: p.y + 1, z: p.z }, 70, 0.7, 7);
        const cands = [];
        for (const f of this.fire.flammables.values()) {
            if (f.burning || f.burned) continue;
            const id = f.thing.id;
            const q = f.thing.pos();
            const d = Math.hypot(q.x - p.x, q.z - p.z);
            const mine = target && (id === target || id.startsWith(target + '_'));
            if (mine || (!target && d < R)) cands.push({ t: f.thing, d });
        }
        cands.sort((a, b) => a.d - b.d);
        for (const c of cands.slice(0, target ? 2 : SURGE.ignites)) this.fire.ignite(c.t, cause);
        for (const c of this.creatures?.all || []) if (c.pos.distanceTo(p) < R) c.react('fire', 18, cause === 'surge' ? 'player' : 'environment');
        if (cause === 'surge') this.vitals?.hurt(SURGE.playerHurt, 'wild-fire');
    }

    // Everything loose within R thrown out (and up) from p; creatures take `hit` on `channel`.
    _push(p, R, out, up, channel, hit, cause) {
        for (const e of Physics.all()) {
            const b = e.body;
            if (b.type !== CANNON.Body.DYNAMIC || e.tier === TIER.PLAYER) continue;
            const d = Math.hypot(b.position.x - p.x, b.position.z - p.z);
            if (d > R) continue;
            const k = (1 - d / R) / (1 + b.mass / 20);
            const dx = (b.position.x - p.x) / (d || 1), dz = (b.position.z - p.z) / (d || 1);
            b.wakeUp();
            b.velocity.x += dx * out * k; b.velocity.y += up * k; b.velocity.z += dz * out * k;
            e.data.creature?.react(channel, hit * (1 - d / R), cause === 'surge' ? 'player' : 'environment');
        }
        // Timber close by cracks: a building's panels, a barricade's planks.
        if (channel === 'impact') {
            for (const f of this.fire.flammables.values()) {
                const piece = f.thing.entry?.data.piece, owner = f.thing.entry?.data.owner;
                if (!piece || piece.broken || !owner?.wear) continue;
                const q = f.thing.pos(), d = Math.hypot(q.x - p.x, q.z - p.z);
                if (d < R * 0.6) owner.wear(piece, 0.5 * (1 - d / R), cause, new THREE.Vector3(q.x - p.x, 1, q.z - p.z).normalize().multiplyScalar(3));
            }
        }
        for (let i = 0; i < 16; i++) this.fx?.smoke?.spawn({
            x: p.x + (Math.random() - 0.5) * R, y: p.y + 0.1, z: p.z + (Math.random() - 0.5) * R,
            vx: 0, vy: 1 + Math.random(), vz: 0, max: 1.2, s0: 0.4, s1: 1.2, white: false,
        });
    }

    _water(p, R, cause) {
        for (const f of this.fire.flammables.values()) {
            if (!f.burning) continue;
            const q = f.thing.pos();
            if (Math.hypot(q.x - p.x, q.z - p.z) < R) this.fire.douse(f.thing, cause);
        }
        this._push(p, R, 3, 1.5, 'water', 2, cause);
        for (let i = 0; i < 60; i++) {
            const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 4;
            this.water?.drops?.spawn({ x: p.x, y: p.y + 0.8, z: p.z, vx: Math.cos(a) * v, vy: 2 + Math.random() * 3, vz: Math.sin(a) * v, max: 0.7, s0: 0.24, s1: 0.08 });
        }
    }

    _air(p, R, cause) {
        for (const f of this.fire.flammables.values()) {
            if (!f.burning) continue;
            const q = f.thing.pos();
            if (Math.hypot(q.x - p.x, q.z - p.z) < R) this.fire.wind(f.thing, 1, new THREE.Vector3(q.x - p.x, 0, q.z - p.z).normalize(), cause);
        }
        this._push(p, R * 1.3, 7, 2.5, 'wind', 6, cause);
    }
}
