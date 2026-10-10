// ============================================================
// FIRE FX — every flame, ember, wisp of smoke and puff of steam
// ============================================================
//
// Pools over the GPU particle engine (art/Particles.js): flame (additive,
// white-hot core → orange → ember red as it rises and dies), embers (sparks
// that climb and wander), smoke (three-lobed puffs that billow and drift;
// steam is the same pool, white). Two draw calls carry every particle in the
// game, fire included.
//
// The pools are the budget (§54 "pooled particles"): when they are full, new
// emission is simply skipped, so a whole barricade on fire costs the same as
// one torch. No lights are added for fire: a light per flame would cost every
// lit material on screen. Burning things glow through their own emissive
// instead (FireSystem).
// ============================================================

import { Particles } from './Particles.js';
export { Pool } from './Particles.js';

export class FireFx {
    constructor(scene, { flames = 320, smoke = 120, embers = 90 } = {}) {
        const P = Particles.current;
        this.flame = P.pool(flames, 'flame');
        this.smoke = P.pool(smoke, 'smoke');
        this.embers = P.pool(embers, 'ember');
    }

    /**
     * Fire at `p` (a Vector3). `rate` particles per second, spread over a box
     * `w` wide; `dt` makes the emission frame-rate independent.
     */
    burn(p, dt, { rate = 14, w = 0.5, h = 0.3, size = 0.55, smoke = 0.25 } = {}) {
        let n = rate * dt;
        while (n > 0) {
            if (n < 1 && Math.random() > n) break;
            n -= 1;
            this.flame.spawn({
                x: p.x + (Math.random() - 0.5) * w, y: p.y + (Math.random() - 0.5) * h, z: p.z + (Math.random() - 0.5) * w,
                vx: (Math.random() - 0.5) * 0.4, vy: 0.6 + Math.random() * 0.8, vz: (Math.random() - 0.5) * 0.4,
                max: 0.45 + Math.random() * 0.45, s0: size * (0.8 + Math.random() * 0.5), s1: size * 0.15,
            });
            if (Math.random() < 0.08) this.embers.spawn({                 // now and then an ember climbs out and wanders off
                x: p.x + (Math.random() - 0.5) * w, y: p.y + 0.2, z: p.z + (Math.random() - 0.5) * w,
                vx: (Math.random() - 0.5) * 1.2, vy: 1.4 + Math.random() * 1.6, vz: (Math.random() - 0.5) * 1.2,
                max: 1.0 + Math.random() * 1.2, s0: 0.07, s1: 0.03,
            });
            if (Math.random() < smoke) this.smoke.spawn({
                x: p.x + (Math.random() - 0.5) * w, y: p.y + 0.4, z: p.z + (Math.random() - 0.5) * w,
                vx: (Math.random() - 0.5) * 0.3, vy: 0.5 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.3,
                max: 1.6 + Math.random() * 1.2, s0: size * 0.6, s1: size * 2.4, white: false,
            });
        }
    }

    /** A burst: a fireball landing, a flame pulled out of the coals. */
    burst(p, count = 24, size = 0.5, speed = 3) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u);
            const v = speed * (0.4 + Math.random() * 0.6);
            this.flame.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * r * v, vy: u * v + 1, vz: Math.sin(a) * r * v,
                max: 0.35 + Math.random() * 0.35, s0: size, s1: size * 0.1 });
            if (i % 3 === 0) this.embers.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * r * v * 1.6, vy: u * v * 1.2 + 2, vz: Math.sin(a) * r * v * 1.6,
                max: 0.8 + Math.random() * 0.8, s0: 0.08, s1: 0.03 });
        }
    }

    /** Steam: white puffs from the smoke pool (water meeting fire or hot stone). */
    steam(p, count = 8) {
        let n = count;
        while (n > 0) {
            if (n < 1 && Math.random() > n) break;
            n -= 1;
            this.smoke.spawn({
                x: p.x + (Math.random() - 0.5) * 0.6, y: p.y + Math.random() * 0.3, z: p.z + (Math.random() - 0.5) * 0.6,
                vx: (Math.random() - 0.5) * 0.6, vy: 1.2 + Math.random() * 0.8, vz: (Math.random() - 0.5) * 0.6,
                max: 1.0 + Math.random() * 0.8, s0: 0.35, s1: 1.4, white: true,
            });
        }
    }

    /** The GPU ages every particle (art/Particles.js); kept for callers. */
    update() {}

    stats() { return { flame: this.flame.alive, flameMax: this.flame.n, smoke: this.smoke.alive, smokeMax: this.smoke.n, embers: this.embers.alive }; }
}
