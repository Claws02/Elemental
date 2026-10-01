// ============================================================
// CAMERA RIG — third person, collision-aware, frames the interaction
// ============================================================
//
// Orbits a focus point above the hero's shoulders. Two rules on top of that:
//
//   NO CLIPPING. A ray from the focus to the desired camera position is cast
//   against the solid world; if it hits, the camera comes in to just short of
//   the hit (fast in, slow back out, so it never pumps).
//
//   FRAME THE TARGET. While the player holds something, the focus slides
//   toward it, so the object being manipulated never leaves the screen.
// ============================================================

import { THREE } from '../engine/lib.js';
import { Ground } from '../world/Ground.js';

const MIN_DIST = 3.2, MAX_DIST = 13;
const PITCH_MIN = -0.15, PITCH_MAX = 1.2;

export class CameraRig {
    constructor(camera) {
        this.cam = camera;
        this.yaw = Math.PI;         // camera sits behind a hero facing +Z… once turned
        this.pitch = 0.38;
        this.dist = 7.5;
        this.curDist = 7.5;
        this.focus = new THREE.Vector3();
        this.solids = [];           // meshes the camera may not pass through
        this.ray = new THREE.Raycaster();
        this.sensitivity = 0.005;
        this.invertY = false;
    }

    orbit(dx, dy) {
        this.yaw -= dx * this.sensitivity;
        this.pitch += (this.invertY ? -dy : dy) * this.sensitivity;
        this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch));
    }

    zoom(f) { this.dist = Math.max(MIN_DIST, Math.min(MAX_DIST, this.dist * f)); }

    /** The yaw the player controller uses to make stick input camera-relative. */
    get moveYaw() { return this.yaw + Math.PI; }

    update(dt, heroPos, frameTarget = null) {
        const want = new THREE.Vector3(heroPos.x, heroPos.y + 1.6, heroPos.z);
        if (frameTarget) want.lerp(frameTarget, 0.35);
        this.focus.lerp(want, 1 - Math.exp(-10 * dt));

        const dir = new THREE.Vector3(
            Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            Math.cos(this.yaw) * Math.cos(this.pitch));
        let d = this.dist;
        if (this.solids.length) {
            this.ray.set(this.focus, dir);
            this.ray.far = this.dist;
            const hit = this.ray.intersectObjects(this.solids, true)[0];
            if (hit) d = Math.max(1.2, hit.distance - 0.35);
        }
        // In fast, out slow.
        this.curDist += (d - this.curDist) * (d < this.curDist ? 1 - Math.exp(-25 * dt) : 1 - Math.exp(-3 * dt));
        this.cam.position.copy(this.focus).addScaledVector(dir, this.curDist);
        const gy = Ground.height(this.cam.position.x, this.cam.position.z) + 0.3;
        if (this.cam.position.y < gy) this.cam.position.y = gy;
        this.cam.lookAt(this.focus);
    }
}
