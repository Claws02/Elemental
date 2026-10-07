// ============================================================
// WATER — a stream while it stays connected, an orb once it breaks off
// ============================================================
//
// Agreed design (docs/CONTEXT_CONTROLS.md, "Water"):
//
//   STREAM   Touch a basin and the water comes: it rises and arcs from the
//            source to whatever the finger points at. While it stays
//            connected it is endless, but it reaches only 8 m from its
//            source: pointed further, it stretches thin and falls short,
//            dropping to the ground where it gives out. Where it lands it
//            sprays:
//              puts fire out and soaks timber (wet timber won't catch, 20 s)
//              cools hot stone in a hiss of steam
//              pushes rocks and debris along the stream
//              wears through timber it is held on: water is not harmless
//   ORB      Yank the finger away from the basin, fast, and the water tears
//            free into an orb in the hand (Intent decides what a yank is);
//            still moving fast when the finger lifts, it is thrown. Limited
//            (one splash), but carried and thrown anywhere. It bursts on
//            whatever it hits.
//
// The stream is a tube mesh along a curve plus pooled droplets. There is no
// fluid simulation: water does not pool or run across the ground (that is
// Phase 2's "water flow approximation").
//
// Everything water does as a consequence is the player's (§12): soaking,
// pushing and wearing through carry cause 'player'.
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { EventBus, EV } from '../core/EventBus.js';
import { Pool } from '../art/FireFx.js';
import { WATER } from '../data/elements.js';
import { Ground } from '../world/Ground.js';
import { SWIM } from '../world/WaterBodies.js';

// Tuning lives in src/data/elements.js (data, not code).
export { WATER };

const SEG = 24, RAD = 6;
const _ray = new THREE.Raycaster();
const _v2 = new THREE.Vector2();

export class WaterSystem {
    constructor({ scene, camera, interactables, channel, hero, fire, fx, solids }) {
        Object.assign(this, { scene, camera, interactables, channel, hero, fire, fx, solids });
        this.sources = [];         // { thing, surface: Vector3 }
        this.stream = null;        // { source, want, target, cur, over }
        this.orbs = new Set();     // { thing, entry, born }
        this.queue = [];
        this.time = 0;
        this.draws = 0;

        this.mat = new THREE.MeshPhongMaterial({
            color: 0x3aa0d8, transparent: true, opacity: 0.78,
            emissive: 0x0c3a5a, emissiveIntensity: 0.6, depthWrite: false, shininess: 60 });
        this.tube = this._makeTube();
        scene.add(this.tube);
        this.drops = new Pool(260, false);
        scene.add(this.drops.points);
    }

    /**
     * A source: its surface point, or for a lake a function giving the point nearest a point
     * (fixed when a stream starts), and whether a point is open water of it (not dry ground over it).
     */
    addSource(thing, surface, surfaceFor = null, contains = null) { this.sources.push({ thing, surface, surfaceFor, contains }); }
    /** How far the hero is from the nearest water of a source (a lake's centre may be far off while its shore is at your feet). */
    reachOf(thing) {
        const s = this.sources.find(q => q.thing === thing);
        if (!s) return Infinity;
        return (s.surfaceFor ? s.surfaceFor(this.hero.position) : s.surface).distanceTo(this.hero.position);
    }
    isSource(thing) { return this.sources.some(s => s.thing === thing); }

    // ---- the stream --------------------------------------------------------

    /**
     * Draw a stream from a source. With a screen point (x, y), a lake or pool
     * gives it up where the finger touched its open water, if that is within
     * WATER.draw of the hero; touched anywhere else (dry ground over hidden
     * water, the far sea), it doesn't, and the touch is the camera's.
     * Without a point, from the point nearest the hero.
     */
    beginStream(thing, x = null, y = null) {
        let source = this.sources.find(s => s.thing === thing);
        if (!source) return false;
        if (source.surfaceFor) {
            const at = x == null ? this.hero.position : this._touched(source, x, y);
            if (!at) return false;
            source = { ...source, surface: source.surfaceFor(at) };
        }
        const start = source.surface.clone();
        this.stream = { source, want: start.clone().setY(start.y + 1.5), target: start.clone().setY(start.y + 1.5), cur: start.clone(), dir: new THREE.Vector3(0, 1, 0) };
        this.tube.visible = true;
        this.draws++;
        EventBus.emit(EV.WATER_DRAWN, { id: thing.id, cause: 'player' });
        return true;
    }

    /** Where the finger meets the source's open water: null if ground is in the way, it isn't this water there, or it's beyond WATER.draw. */
    _touched(source, x, y) {
        _v2.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
        _ray.setFromCamera(_v2, this.camera);
        const r = _ray.ray, lvl = source.surfaceFor(this.hero.position).y;
        if (Math.abs(r.direction.y) < 1e-4) return null;
        const t = (lvl - r.origin.y) / r.direction.y;
        if (t <= 0) return null;
        const p = r.at(t, new THREE.Vector3());
        const g = Ground.raycast(r);
        if (g && r.origin.distanceTo(g) < t - 0.05) return null;          // dry ground first
        if (source.contains && !source.contains(p)) return null;
        if (Math.hypot(p.x - this.hero.position.x, p.z - this.hero.position.z) > WATER.draw) return null;
        return p;
    }

    /** Point the stream at whatever is under the finger. */
    aimStream(x, y) {
        const s = this.stream;
        if (!s) return;
        _v2.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
        _ray.setFromCamera(_v2, this.camera);
        // Never its own basin: aiming the water back at where it comes from is
        // never meant, and the basin often sits between the hero and the target.
        const own = s.source.thing.mesh;
        const meshes = this.solids.filter(m => m !== own)
            .concat(this.interactables.things.filter(t => t.material !== 'waterOrb' && t.mesh !== own).map(t => t.mesh));
        const hit = _ray.intersectObjects(meshes, true)[0];
        const g = Ground.raycast(_ray.ray);
        let p = hit ? hit.point.clone() : g;
        if (hit && g && _ray.ray.origin.distanceTo(g) < hit.distance) p = g;
        if (!p) p = _ray.ray.at(60, new THREE.Vector3());       // the sky: as far as it gets
        p.y = Math.max(p.y, Ground.height(p.x, p.z) + 0.15);
        s.want.copy(p);
        const from = s.source.surface;
        const off = p.clone().sub(from);
        if (off.length() > WATER.reach) {
            // Too far: it gives out at its reach and falls, landing short.
            s.target.copy(from).addScaledVector(off.normalize(), WATER.reach);
            const gy = Ground.height(s.target.x, s.target.z);
            s.target.y = Math.max(gy + 0.15, gy + (s.target.y - gy) * 0.35);
        } else {
            s.target.copy(p);
        }
    }

    /** Break the stream off into an orb at its end. Returns the orb (an interactable). */
    snap() {
        const s = this.stream;
        if (!s) return null;
        const p = s.cur.clone();
        this._endStream();
        return this._makeOrb(p);
    }

    /** Let the stream go: it falls where it ends, in a small splash. */
    collapse() {
        const s = this.stream;
        if (!s) return;
        this.splash(s.cur, 0.5);
        this._endStream();
    }

    /** The stream freezes where it stands (Ice): it ends, and hands back its arc's ends. */
    freeze() {
        const s = this.stream;
        if (!s) return null;
        const arc = { S: s.source.surface.clone(), E: s.cur.clone() };
        this._endStream();
        return arc;
    }

    _endStream() {
        this.stream = null;
        this.tube.visible = false;
    }

    // ---- orbs ------------------------------------------------------------

    _makeOrb(p) {
        const R = WATER.orbRadius;
        const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 2), this.mat);
        mesh.position.copy(p);
        this.scene.add(mesh);
        const body = new CANNON.Body({ mass: 2, linearDamping: 0.02, angularDamping: 0.6 });
        body.addShape(new CANNON.Sphere(R));
        body.position.set(p.x, p.y, p.z);
        body.allowSleep = false;
        const entry = Physics.add({ body, mesh, tier: TIER.ELEMENTAL, id: 'WaterOrb', data: { radius: R, waterOrb: true } });
        const thing = this.interactables.add({ id: 'WaterOrb', mesh, entry, material: 'waterOrb' });
        const orb = { thing, entry, born: this.time };
        // Whether it was held is judged when the contact happens, not later:
        // a touch in the hand must not burst it the moment it is let go.
        body.addEventListener('collide', ev => this.queue.push({ orb, other: ev.body.userData, shape: Physics.otherShape(ev), held: this.channel.held?.entry === entry }));
        this.orbs.add(orb);
        return thing;
    }

    _burst(orb) {
        if (!this.orbs.has(orb)) return;
        this.orbs.delete(orb);
        const p = orb.entry.mesh.position.clone();
        orb.entry.data.gone = true;
        this.interactables.remove(orb.thing);
        Physics.remove(orb.entry);
        orb.entry.mesh.geometry.dispose();
        this.splash(p, 1);
    }

    // ---- what water does ---------------------------------------------------

    /**
     * Everything water does to what is near `p`, within `radius`, with this
     * much of it arriving this frame (`amount`: seconds of stream, or 1 for a
     * whole orb). `dir` pushes along the stream; without it a burst pushes
     * outward.
     */
    _wet(p, radius, amount, dir = null) {
        for (const t of this.interactables.things) {
            const q = t.pos();
            const d = q.distanceTo(p);
            if (d > radius) continue;
            const near = 1 - d / radius;
            if (t.material === 'wood') {
                // A stream brings `amount` seconds of water; a burst a lump,
                // enough to put out what it hits squarely (within ~1 m), not
                // what it only splashes.
                this.fire.wetten(t, dir ? amount : this.fire.douseLump * 2 * near, 'player');
                // Water under pressure wears timber through.
                const piece = t.entry?.data.piece, owner = t.entry?.data.owner;
                if (piece && owner && !piece.broken) {
                    const dmg = dir ? WATER.wear * amount * near : WATER.splashWear * near;
                    const push = (dir || q.clone().sub(p).setY(0.3).normalize()).clone().multiplyScalar(4);
                    owner.wear(piece, dmg, 'player', push);
                }
            } else if (t.material === 'stone') {
                this.fire.quench(t, dir ? amount : 0.6);
            } else if (t.material === 'flame') {
                this.fire.quenchFireball(t.entry);
            }
        }
        // Push light things: rocks, debris. Heavier moves less.
        for (const e of Physics.all()) {
            const b = e.body;
            if (b.type !== CANNON.Body.DYNAMIC || e.tier === TIER.PLAYER || e.data.waterOrb) continue;
            if (this.channel.held?.entry === e) continue;
            const d = b.position.distanceTo(p);
            if (d > radius) continue;
            const k = (1 - d / radius) / (1 + b.mass / 8) * (this.hero.swimming ? SWIM.weak : 1);
            const v = dir ? dir.clone().multiplyScalar(WATER.push * amount * k)
                          : new THREE.Vector3(b.position.x - p.x, 0.6, b.position.z - p.z).normalize().multiplyScalar(WATER.splashPush * k);
            b.wakeUp();
            b.velocity.x += v.x; b.velocity.y += v.y; b.velocity.z += v.z;
            if (v.length() > 0.05) { e.data.thrownBy = 'player'; e.data.thrownAt = performance.now(); }
            e.data.creature?.react('water', (dir ? amount : 1) * k * 4, 'player');     // soaked, pushed, and for an ember bird, grounded
        }
    }

    /** A burst of water at `p` (an orb landing, a stream let go). */
    splash(p, strength = 1) {
        this._wet(p, WATER.splash * (0.5 + 0.5 * strength), strength);
        for (let i = 0; i < 40 * strength; i++) {
            const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 3;
            this.drops.spawn({ x: p.x, y: p.y + 0.1, z: p.z, vx: Math.cos(a) * v, vy: 2 + Math.random() * 3, vz: Math.sin(a) * v,
                max: 0.6 + Math.random() * 0.4, s0: 0.22, s1: 0.08 });
        }
    }

    // ---- per frame (after the physics step) --------------------------------

    update(dt) {
        this.time += dt;
        this._contacts();
        const s = this.stream;
        if (s) {
            if (this.hero.position.distanceTo(s.source.surface) > WATER.range) this.collapse();
            else {
                s.cur.lerp(s.target, 1 - Math.exp(-10 * dt));
                const beyond = s.want.distanceTo(s.source.surface) > WATER.reach;
                this._shapeTube(s, beyond);
                this._wet(s.cur, WATER.spray, dt, s.dir);
                // Spray at the end, and drops shed along the way.
                for (let i = 0; i < 70 * dt; i++) {
                    const v = s.dir.clone().multiplyScalar(2 + Math.random() * 2);
                    this.drops.spawn({ x: s.cur.x, y: s.cur.y, z: s.cur.z, vx: v.x + (Math.random() - 0.5) * 2.5, vy: v.y + 1 + Math.random() * 2, vz: v.z + (Math.random() - 0.5) * 2.5,
                        max: 0.5 + Math.random() * 0.4, s0: 0.2, s1: 0.06 });
                }
            }
        }
        for (const orb of [...this.orbs]) {
            const e = orb.entry;
            if (!e.body.world) { this._burst(orb); continue; }
            const w = 1 + Math.sin(this.time * 11) * 0.08;
            e.mesh.scale.set(w, 2 - w, w);
            if (this.channel.held?.entry === e) { orb.born = this.time; continue; }
            if (this.time - orb.born > WATER.orbLife) this._burst(orb);
        }
        this.drops.update(dt, (k, tint, i) => {
            tint[i * 3] = 0.55; tint[i * 3 + 1] = 0.8; tint[i * 3 + 2] = 0.95;
            return (1 - k) * 0.85;
        }, -12);
    }

    _contacts() {
        for (const c of this.queue.splice(0)) {
            const { orb, other } = c;
            if (!this.orbs.has(orb) || !other || other.tier === TIER.PLAYER) continue;
            const held = c.held;
            const t = this.interactables.forEntry(other, c.shape);
            if (held) {
                // Pressed onto a fire, it puts it out and is spent.
                if (t && this.fire.isBurning(t)) { this._burst(orb); this.channel.let(); }
                continue;
            }
            this._burst(orb);
        }
    }

    // ---- the tube -----------------------------------------------------------

    _makeTube() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * RAD * 3), 3));
        g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((SEG + 1) * RAD * 3), 3));
        const idx = [];
        for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) {
            const a = i * RAD + j, b = i * RAD + (j + 1) % RAD, c = a + RAD, d = b + RAD;
            idx.push(a, c, b, b, c, d);
        }
        g.setIndex(idx);
        const m = new THREE.Mesh(g, this.mat);
        m.frustumCulled = false;
        m.visible = false;
        m.renderOrder = 1;
        return m;
    }

    // A quadratic arc from the water surface, up, and over to the end.
    _shapeTube(s, strained) {
        const S = s.source.surface, E = s.cur;
        const len = S.distanceTo(E);
        const C = S.clone().add(E).multiplyScalar(0.5);
        C.y = Math.max(S.y, E.y) + 0.8 + len * 0.12;
        const pos = this.tube.geometry.attributes.position.array, nor = this.tube.geometry.attributes.normal.array;
        const P = new THREE.Vector3(), T = new THREE.Vector3(), N1 = new THREE.Vector3(), N2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
        // A stream pointed past its reach thins: the player can see it straining.
        const thick = strained ? 0.55 + 0.1 * Math.sin(this.time * 40) : 1;
        for (let i = 0; i <= SEG; i++) {
            const t = i / SEG, u = 1 - t;
            P.set(0, 0, 0).addScaledVector(S, u * u).addScaledVector(C, 2 * u * t).addScaledVector(E, t * t);
            T.set(0, 0, 0).addScaledVector(C.clone().sub(S), 2 * u).addScaledVector(E.clone().sub(C), 2 * t).normalize();
            N1.crossVectors(T, up); if (N1.lengthSq() < 1e-6) N1.set(1, 0, 0); N1.normalize();
            N2.crossVectors(T, N1).normalize();
            const r = (0.17 - 0.07 * t) * thick * (1 + Math.sin(this.time * 14 - t * 12) * 0.12);
            for (let j = 0; j < RAD; j++) {
                const a = j / RAD * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
                const nx = N1.x * ca + N2.x * sa, ny = N1.y * ca + N2.y * sa, nz = N1.z * ca + N2.z * sa;
                const o = (i * RAD + j) * 3;
                pos[o] = P.x + nx * r; pos[o + 1] = P.y + ny * r; pos[o + 2] = P.z + nz * r;
                nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
            }
            if (i === SEG) s.dir.copy(T);
        }
        this.tube.geometry.attributes.position.needsUpdate = true;
        this.tube.geometry.attributes.normal.needsUpdate = true;
        this.tube.geometry.computeBoundingSphere();
    }

    stats() { return { streaming: !!this.stream, orbs: this.orbs.size, drops: this.drops.alive, draws: this.draws }; }
}
