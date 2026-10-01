// ============================================================
// PLAYER CONTROLLER — the hero's body, movement and facing
// ============================================================
//
// The hero is a single dynamic sphere with its rotation locked: cheap, never
// snags on a seam, and it shoves rocks out of the way physically. Movement
// sets the horizontal velocity directly toward the stick's intent
// (camera-relative), with acceleration so starts and stops have weight;
// gravity keeps the vertical.
//
// JUMP     the jump button, a flick up on the stick, or Space: a hop of about
//          a metre, from the ground (or a moment after leaving it).
// CLIMB    walk into a ledge (raised stone, a wall, a crate, a rock, a steep
//          bank) whose top is within reach and the hero pulls up onto it:
//          hands up, haul, a knee over, stand. Reach is higher in the air, so
//          jump then climb gets onto taller things. People and creatures
//          aren't ledges.
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { buildHero, HeroAnimator } from '../art/HeroModel.js';
import { MUD, GLIDE } from '../data/elements.js';
import { WADE } from '../world/WaterBodies.js';
import { Ground } from '../world/Ground.js';

const RADIUS = 0.42;
const WALK = 3.2, RUN = 6.8;
const ACCEL = 28, DECEL = 36;
const TURN = 12;           // rad/s toward the direction of travel
const GRAVITY = 22;        // engine/Physics.js
export const JUMP = { height: 1.1, coyote: 0.12, buffer: 0.15 };
export const CLIMB = {
    reach: 2.3,            // how far above the feet the hands find a ledge top
    low: 0.4,              // anything lower the hero just steps or hops onto
    push: 0.1,             // seconds walking into it before climbing
    time: [0.45, 1.0],     // how long the climb takes: a low ledge … one at full reach
    onto: 0.5,             // how far past the edge the hero ends up
};

export class PlayerController {
    /** `look`: the protagonist's colours from the character creator (art/Palette.js HERO keys). */
    constructor(scene, spawn, look = null) {
        this.rig = buildHero(look || undefined);
        this.anim = new HeroAnimator(this.rig);
        scene.add(this.rig.root);

        const body = new CANNON.Body({ mass: 70, material: Physics.material('player'), fixedRotation: true, linearDamping: 0.0 });
        body.addShape(new CANNON.Sphere(RADIUS));
        body.position.set(spawn.x, Ground.height(spawn.x, spawn.z) + RADIUS + 0.05, spawn.z);
        body.allowSleep = false;
        body.updateMassProperties();
        this.entry = Physics.add({ body, tier: TIER.PLAYER, id: 'Player' });
        this.body = body;
        this.radius = RADIUS;
        this.gliding = false;      // set by Glide (elements/Glide.js)
        this.facing = spawn.facing || 0;
        this.faceTarget = null;       // a world point to face instead of the travel direction
        this.speed = 0;
        this.rig.root.rotation.y = this.facing;
        this.grounded = true;
        this.sinceGround = 0;      // seconds since last on the ground (coyote time)
        this.jumpWant = 0;         // a jump asked for, still waiting to happen (s left)
        this.climb = null;         // { from, up, to, t, T, h } while climbing
        this.pushT = 0;            // how long we've walked into a ledge
    }

    /** Ask to jump (the button, a flick, Space). Happens now, or as soon as the hero lands. */
    jump() { this.jumpWant = JUMP.buffer; }

    get climbing() { return !!this.climb; }

    get position() { return this.rig.root.position; }

    /**
     * @param {number} dt
     * @param {{x:number,y:number,run:number}} move  stick intent
     * @param {number} camYaw  camera yaw, so "up" on the stick is "away from the camera"
     * @param {object|null} channel  { pitch, yaw } while holding something
     */
    update(dt, move, camYaw, channel) {
        const b = this.body;
        if (this.climb) { this._climbing(dt); return; }
        this.grounded = Physics.supported(b) || b.position.y - RADIUS - Ground.height(b.position.x, b.position.z) < 0.08;
        this.sinceGround = this.grounded ? 0 : this.sinceGround + dt;
        // Camera-relative intent: stick up = away from the camera.
        const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
        const ix = -move.x * cos + move.y * sin;
        const iz = move.x * sin + move.y * cos;
        const mag = Math.hypot(ix, iz);
        // Channelling slows the hero: you cannot sprint and hold a boulder.
        const top = (move.run > 0.85 ? RUN : WALK + (RUN - WALK) * Math.max(0, (move.run - 0.3) / 0.55)) * (channel ? 0.45 : 1) * (this.mired > 0 ? MUD.slow : 1) * (this.gliding ? GLIDE.speed : 1) * (this.wading ? WADE.slow : 1);
        let tx = mag > 0.05 ? (ix / mag) * top * Math.min(1, mag) : 0;
        let tz = mag > 0.05 ? (iz / mag) * top * Math.min(1, mag) : 0;
        // Walking into a person: step round them at full speed instead of pushing against them.
        if (mag > 0.05) [tx, tz] = this._sidestep(tx, tz);
        const rate = mag > 0.05 ? ACCEL : DECEL;
        const k = Math.min(1, rate * dt / Math.max(0.001, Math.hypot(tx - b.velocity.x, tz - b.velocity.z)));
        b.velocity.x += (tx - b.velocity.x) * k;
        b.velocity.z += (tz - b.velocity.z) * k;

        // Jump: from the ground, or just after stepping off it.
        if (this.jumpWant > 0) {
            this.jumpWant -= dt;
            if (this.sinceGround < JUMP.coyote && b.velocity.y < 2 && !this.wading) {
                b.velocity.y = Math.sqrt(2 * GRAVITY * JUMP.height);
                this.jumpWant = 0; this.sinceGround = JUMP.coyote;
                this.anim.jump?.();
            }
        }
        // Climb: walking into a ledge within reach.
        if (mag > 0.4 && !channel && !this.gliding) {
            const ledge = this._ledge(ix / mag, iz / mag);
            this.pushT = ledge ? this.pushT + dt : 0;
            if (ledge && this.pushT >= CLIMB.push) this._startClimb(ledge, ix / mag, iz / mag);
        } else this.pushT = 0;

        const p = b.position;
        this.rig.root.position.set(p.x, p.y - RADIUS, p.z);
        this.speed = Math.hypot(b.velocity.x, b.velocity.z);

        // Face the held object, or the way we are going.
        let want = this.facing;
        if (this.faceTarget) want = Math.atan2(this.faceTarget.x - p.x, this.faceTarget.z - p.z);
        else if (this.speed > 0.4) want = Math.atan2(b.velocity.x, b.velocity.z);
        let d = want - this.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.facing += d * Math.min(1, TURN * dt);
        this.rig.root.rotation.y = this.facing;

        this.anim.update(dt, { speed: this.speed, channel });
    }

    /** The target velocity with the part aimed into a person taken out, kept at full speed along their side. */
    _sidestep(tx, tz) {
        const p = this.body.position, sp = Math.hypot(tx, tz);
        for (const e of Physics.all()) {
            if (!e.data?.npc) continue;
            const q = e.body.position, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
            if (d > RADIUS + 0.45 + 0.35 || d < 1e-3 || Math.abs(q.y - p.y) > 1.2) continue;
            const nx = dx / d, nz = dz / d, into = tx * nx + tz * nz;
            if (into <= 0) continue;                                    // already going past or away
            let sx = tx - nx * into, sz = tz - nz * into;
            const sl = Math.hypot(sx, sz);
            if (sl < 0.15 * sp) { sx = -nz * (tx * -nz + tz * nx >= 0 ? 1 : -1); sz = nx * (tx * -nz + tz * nx >= 0 ? 1 : -1); }      // head-on: pick a side
            const k = sp / Math.max(1e-3, Math.hypot(sx, sz));
            tx = sx * k; tz = sz * k;
        }
        return [tx, tz];
    }

    // ---- climbing ----------------------------------------------------------------------------

    /** A ledge ahead along (fx, fz): a solid face, a flat top within reach, room to stand on it. */
    _ledge(fx, fz) {
        const p = this.body.position, feet = p.y - RADIUS;
        const skip = e => !e || e === this.entry || e.data?.npc || e.data?.creature || e.tier === TIER.DEBRIS;
        // A face in front, at knee to chest height.
        let face = null;
        for (const h of [0.3, 0.8]) {
            // From inside the hero (pressed against a wall the sphere sinks into it a little; the hero itself is skipped).
            face = Physics.rayFirst({ x: p.x, y: feet + h, z: p.z }, { x: p.x + fx * (RADIUS + 0.55), y: feet + h, z: p.z + fz * (RADIUS + 0.55) }, skip);
            if (face) break;
        }
        if (!face || Math.abs(face.normal.y) > 0.6 || face.normal.x * fx + face.normal.z * fz > -0.5) return null;      // not a face we walk into
        // Its top: down from above the reach, just past the face.
        const ax = face.point.x + fx * 0.35, az = face.point.z + fz * 0.35;
        const top = Physics.rayFirst({ x: ax, y: feet + CLIMB.reach + 0.3, z: az }, { x: ax, y: feet + 0.1, z: az }, skip);
        if (!top || top.normal.y < 0.75) return null;
        const h = top.point.y - feet;
        if (h < CLIMB.low || h > CLIMB.reach) return null;
        // Room to stand up there, and nothing in the way of the hands going up.
        const stand = { x: ax + fx * (CLIMB.onto - 0.35), y: top.point.y, z: az + fz * (CLIMB.onto - 0.35) };
        if (Physics.rayFirst({ x: stand.x, y: stand.y + 0.1, z: stand.z }, { x: stand.x, y: stand.y + 1.7, z: stand.z }, skip)) return null;
        if (Physics.rayFirst({ x: p.x, y: p.y, z: p.z }, { x: p.x, y: top.point.y + RADIUS + 0.3, z: p.z }, skip)) return null;
        return { h, top: top.point.y, stand };
    }

    _startClimb(ledge, fx, fz) {
        const b = this.body, from = b.position.clone();
        const upY = ledge.top + RADIUS + 0.05;
        const k = Math.max(0, Math.min(1, (ledge.h - CLIMB.low) / (CLIMB.reach - CLIMB.low)));
        this.climb = {
            from, h: ledge.h, t: 0, T: CLIMB.time[0] + (CLIMB.time[1] - CLIMB.time[0]) * k,
            up: new CANNON.Vec3(from.x + fx * 0.12, upY, from.z + fz * 0.12),
            to: new CANNON.Vec3(ledge.stand.x, upY, ledge.stand.z),
        };
        this.facing = Math.atan2(fx, fz);
        this.pushT = 0; this.jumpWant = 0;
        b.type = CANNON.Body.KINEMATIC;          // carried along the climb: no gravity, nothing pushed
        b.collisionResponse = false;
        b.velocity.set(0, 0, 0);
        this.anim.climb?.(this.climb.T);
        this.onClimb?.(ledge.h);
    }

    _climbing(dt) {
        const c = this.climb, b = this.body;
        c.t += dt;
        const u = Math.min(1, c.t / c.T);
        // Up the face for the first 60%, then over the top.
        const want = new CANNON.Vec3();
        if (u < 0.6) { const k = u / 0.6, e = k * k * (3 - 2 * k); c.from.lerp(c.up, e, want); }
        else { const k = (u - 0.6) / 0.4, e = k * k * (3 - 2 * k); c.up.lerp(c.to, e, want); }
        if (dt > 0) b.velocity.set((want.x - b.position.x) / dt, (want.y - b.position.y) / dt, (want.z - b.position.z) / dt);
        const p = b.position;
        this.rig.root.position.set(p.x, p.y - RADIUS, p.z);
        this.rig.root.rotation.y = this.facing;
        this.speed = 0;
        this.anim.update(dt, { speed: 0, channel: null });
        if (u >= 1) {
            b.type = CANNON.Body.DYNAMIC;
            b.collisionResponse = true;
            b.position.copy(c.to);
            b.velocity.set(0, 0, 0);
            b.updateMassProperties();
            this.climb = null;
            this.sinceGround = 0;
        }
    }

    /** Where the hero's hands work from: chest height, a little in front. */
    handPoint(out = new THREE.Vector3()) {
        const p = this.position;
        return out.set(p.x + Math.sin(this.facing) * 0.4, p.y + 1.35, p.z + Math.cos(this.facing) * 0.4);
    }
}
