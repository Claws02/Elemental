// ============================================================
// INTENT — what a touch on the world means (docs/CONTEXT_CONTROLS.md)
// ============================================================
//
// Gestures says where a finger is. Intent decides what the player is doing
// with it, from what the finger is on (its MATERIAL) and how the finger
// behaves (drag or hold still). No element selector: context decides.
//
// STATES × INPUTS. Every pair has an explicit outcome; nothing falls through.
//
//              press          drag (>10 px)        still (per frame)          release          target lost
//   idle       pick → one of  —                    —                          —                —
//              holding /
//              pending / no
//   pending    —              cancel → orbit        progress; at 100% commit   cancel → idle    cancel → idle
//   holding    —              move the object;      stone: heat after its      throw / drop     let go → idle
//                             restart stillness     hold time                  → idle
//   done       —              → orbit (idle)        aim fades after 0.4 s      → idle           —
//
//   press on a thing with a MOVE verb     → holding, at once (a rock grabs instantly)
//   press on a thing with only CHANGE     → pending, for that material's hold time
//   press on nothing usable               → not ours: Gestures orbits the camera
//
// Commit of a CHANGE verb:
//   pull    a fireball comes away in the hand → holding it
//   ignite  it catches where it stands        → done
// ============================================================

import { changeVerb } from '../data/materials.js';

const MOVE_PX = 10;          // finger travel that counts as a drag, not a hold
const RANGE = 14;            // how far from the hero a touch can act
const RING_AFTER = 0.2;      // seconds of stillness before a holding ring appears

export class Intent {
    constructor({ camera, hero, channel, interactables, fire, earth }) {
        Object.assign(this, { camera, hero, channel, interactables, fire, earth });
        this.state = 'idle';
        this.thing = null;
        this.verb = null;
        this.t = 0;              // pending: time held still
        this.still = 0;          // holding: time held still
        this.doneT = 0;
        this.x = 0; this.y = 0;  // finger
        this.ax = 0; this.ay = 0; // stillness anchor
        this.element = 'earth';  // the element acting now, or last to act
    }

    _moveElement(thing) {
        const mv = thing.mat.move;
        if (!mv) return null;
        if (mv === 'earth' && !this.earth.canMove(thing.entry)) return null;
        return mv;
    }

    _inRange(thing) { return thing.pos().distanceTo(this.hero.position) <= RANGE; }

    _usable(thing) {
        if (!this._inRange(thing)) return false;
        return !!this._moveElement(thing) || !!changeVerb(thing.mat, this.fire.isBurning(thing));
    }

    // ---- inputs from Gestures --------------------------------------------

    /** A finger lands on the world. Returns true if Intent takes it. */
    press(x, y) {
        if (this.state !== 'idle') return false;
        const thing = this.interactables.pick(x, y, this.camera, t => this._usable(t));
        if (!thing) return false;
        Object.assign(this, { x, y, ax: x, ay: y, thing, t: 0, still: 0 });
        const mv = this._moveElement(thing);
        if (mv) {
            this.channel.grab(thing.entry, mv);
            this.state = 'holding';
            this.element = mv;
            return true;
        }
        this.verb = changeVerb(thing.mat, this.fire.isBurning(thing));
        this.state = 'pending';
        this.channel.aimAt(thing.pos(), this.verb.element);
        return true;
    }

    /** The finger moves. Returns 'orbit' when the gesture should become a camera drag. */
    drag(x, y) {
        this.x = x; this.y = y;
        const moved = Math.hypot(x - this.ax, y - this.ay) > MOVE_PX;
        switch (this.state) {
        case 'holding':
            this.channel.drag(x, y);
            if (moved) { this.ax = x; this.ay = y; this.still = 0; }
            return null;
        case 'pending':
            if (moved) { this._cancel(); return 'orbit'; }
            return null;
        case 'done':
            this._cancel();
            return 'orbit';
        default:
            return null;
        }
    }

    /** The finger lifts. */
    release(r) {
        if (this.state === 'holding') this.channel.release(r);
        this._cancel();
    }

    _cancel() {
        if (this.state !== 'holding') this.channel.aimAt(null);
        this.state = 'idle';
        this.thing = null;
        this.verb = null;
    }

    // ---- per frame -------------------------------------------------------

    update(dt) {
        switch (this.state) {
        case 'pending': {
            const cv = changeVerb(this.thing.mat, this.fire.isBurning(this.thing));
            if (!this._inRange(this.thing) || !cv || cv.verb !== this.verb.verb) { this._cancel(); break; }
            this.channel.aimAt(this.thing.pos(), cv.element);
            this.t += dt;
            if (this.t >= cv.hold) this._commit(cv);
            break;
        }
        case 'holding': {
            if (!this.channel.held) { this._cancel(); break; }
            const cv = changeVerb(this.thing.mat, false);
            this.still += dt;
            if (cv?.verb === 'heat' && this.still >= cv.hold) {
                this.fire.heat(this.thing, dt, 'player');
                this.element = cv.element;
            } else {
                this.element = this.channel.held.element;
            }
            break;
        }
        case 'done':
            this.doneT -= dt;
            if (this.doneT <= 0) this.channel.aimAt(null);
            break;
        }
    }

    _commit(cv) {
        this.element = cv.element;
        if (cv.verb === 'pull') {
            const fb = this.fire.pullFrom(this.thing, 'player');
            if (!fb) { this._cancel(); return; }
            this.channel.grab(fb.entry, 'fire', { lift: 0.4 });
            Object.assign(this, { state: 'holding', thing: fb, still: 0, ax: this.x, ay: this.y });
        } else if (cv.verb === 'ignite') {
            this.fire.ignite(this.thing, 'player');
            this.state = 'done';
            this.doneT = 0.4;
        } else {
            this._cancel();
        }
    }

    /** The progress ring at the finger, or null: { x, y, progress 0..1, element }. */
    ring() {
        if (this.state === 'pending') return { x: this.x, y: this.y, progress: Math.min(1, this.t / this.verb.hold), element: this.verb.element };
        if (this.state === 'holding') {
            const cv = changeVerb(this.thing.mat, false);
            if (cv?.verb === 'heat' && this.still > RING_AFTER) return { x: this.x, y: this.y, progress: Math.min(1, this.still / cv.hold), element: cv.element };
        }
        return null;
    }
}
