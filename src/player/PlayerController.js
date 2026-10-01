// ============================================================
// PLAYER CONTROLLER — the hero's body, movement and facing
// ============================================================
//
// The hero is a single dynamic sphere with its rotation locked: cheap, never
// snags on a seam, and it shoves rocks out of the way physically. Movement
// sets the horizontal velocity directly toward the stick's intent
// (camera-relative), with acceleration so starts and stops have weight;
// gravity keeps the vertical.
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
    }

    get position() { return this.rig.root.position; }

    /**
     * @param {number} dt
     * @param {{x:number,y:number,run:number}} move  stick intent
     * @param {number} camYaw  camera yaw, so "up" on the stick is "away from the camera"
     * @param {object|null} channel  { pitch, yaw } while holding something
     */
    update(dt, move, camYaw, channel) {
        const b = this.body;
        // Camera-relative intent: stick up = away from the camera.
        const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
        const ix = -move.x * cos + move.y * sin;
        const iz = move.x * sin + move.y * cos;
        const mag = Math.hypot(ix, iz);
        // Channelling slows the hero: you cannot sprint and hold a boulder.
        const top = (move.run > 0.85 ? RUN : WALK + (RUN - WALK) * Math.max(0, (move.run - 0.3) / 0.55)) * (channel ? 0.45 : 1) * (this.mired > 0 ? MUD.slow : 1) * (this.gliding ? GLIDE.speed : 1) * (this.wading ? WADE.slow : 1);
        const tx = mag > 0.05 ? (ix / mag) * top * Math.min(1, mag) : 0;
        const tz = mag > 0.05 ? (iz / mag) * top * Math.min(1, mag) : 0;
        const rate = mag > 0.05 ? ACCEL : DECEL;
        const k = Math.min(1, rate * dt / Math.max(0.001, Math.hypot(tx - b.velocity.x, tz - b.velocity.z)));
        b.velocity.x += (tx - b.velocity.x) * k;
        b.velocity.z += (tz - b.velocity.z) * k;

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

    /** Where the hero's hands work from: chest height, a little in front. */
    handPoint(out = new THREE.Vector3()) {
        const p = this.position;
        return out.set(p.x + Math.sin(this.facing) * 0.4, p.y + 1.35, p.z + Math.cos(this.facing) * 0.4);
    }
}
