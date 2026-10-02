// ============================================================
// VITALS — the hero's health, what hurts it, and dying
// ============================================================
//
// Forgiving on purpose (the brief: don't punish experimenting). Health is
// 100; it comes back quickly once nothing has hurt you for a few seconds.
// What hurts:
//
//   standing in fire        a burning thing within reach of your body
//   a blast                 an oil barrel's burst, by distance
//   your own wild fireball  bursting in your hand (untrained Fire)
//   a long fall             landing hard
//   creatures               through hurt(), from their own attacks
//   leaving the world       below the kill floor: straight to the checkpoint
//
// No health bar: the screen's edges redden as health falls (the HUD's
// vignette), and at zero `onDeath` fires once. The game goes back to the
// last checkpoint (SaveGame's Session.restore).
// ============================================================

import { EventBus, EV } from '../core/EventBus.js';
import { Ground } from '../world/Ground.js';

export const VITALS = {
    max: 100,
    regenAfter: 3.5,      // seconds without harm before healing starts
    regen: 22,            // health per second once healing
    fire: 26,             // per second, standing in a fire
    fireReach: 1.1,       // metres from a burning thing's centre to the hero's
    blast: 55,            // at the centre of a blast, falling to 0 at its edge
    blastRadius: 4,
    wildBurst: 18,
    fallSafe: 13,         // m/s landing speed that does no harm…
    fallPer: 7,           // …and health per m/s above it
    killY: -12,
};

export class Vitals {
    constructor({ player, fire }) {
        Object.assign(this, { player, fire });     // player: the lava flows ask where the hero stands
        this.health = VITALS.max;
        this.since = 99;            // seconds since last hurt
        this.dead = false;
        this.onDeath = null;
        this.invulnerable = false;  // QA and cutscenes
        this.floor = 0;             // health can't be taken below this (the story sets it where the player can't yet fight back)
        this._vy = 0;
        this.off = [
            EventBus.on(EV.EXPLOSION, e => {
                if (!e.pos) return;
                const p = this.player.position;
                const d = Math.hypot(e.pos.x - p.x, e.pos.y - p.y - 0.9, e.pos.z - p.z);
                if (d < VITALS.blastRadius) this.hurt(VITALS.blast * (1 - d / VITALS.blastRadius), 'blast');
            }),
            EventBus.on(EV.WILD_BURST, e => { if (e.inHand) this.hurt(VITALS.wildBurst, 'wild-fire'); }),
        ];
    }

    dispose() { this.off.forEach(f => f()); }

    hurt(amount, cause = 'unknown', from = null) {
        if (this.dead || this.invulnerable || amount <= 0) return;
        this.health = Math.max(this.floor, this.health - amount);
        this.since = 0;
        EventBus.emit(EV.HURT, { amount: Math.round(amount), cause, from, health: Math.round(this.health) });
        if (this.health <= 0) this._die(cause);
    }

    heal(amount) { this.health = Math.min(VITALS.max, this.health + amount); }

    _die(cause) {
        if (this.dead) return;
        this.dead = true;
        EventBus.emit(EV.DIED, { cause });
        this.onDeath?.(cause);
    }

    update(dt) {
        if (this.dead) return;
        const b = this.player.body, p = this.player.position;
        // Out of the world.
        if (b.position.y < Ground.height(b.position.x, b.position.z) + VITALS.killY) { this.health = 0; this._die('fell'); return; }
        // Landing: the downward speed just before it stopped. Water breaks a fall.
        const vy = b.velocity.y;
        if (this._vy < -VITALS.fallSafe && vy > this._vy + 8 && !this.player.water) this.hurt((-this._vy - VITALS.fallSafe) * VITALS.fallPer, 'fall');
        this._vy = vy;
        // Standing in fire.
        const near = this.fire.burningNear?.(p, VITALS.fireReach) || 0;
        if (near) this.hurt(VITALS.fire * Math.min(2, near) * dt, 'fire');
        // Healing.
        this.since += dt;
        if (this.since > VITALS.regenAfter && this.health < VITALS.max) this.heal(VITALS.regen * dt);
    }

    /** 0 (well) … 1 (nearly dead): the HUD reddens the screen's edges by this. */
    get danger() { return 1 - this.health / VITALS.max; }
}
