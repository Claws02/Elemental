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
//   wind       —              first >10 px: start   the wind keeps blowing     flick: a gust    —
//                             blowing; aim it at                               slow: stop
//                             what is under the
//                             finger
//   stream     —              aim the stream at     —                          flick: snap to   hero walks off:
//                             the finger; a fast                               an orb, throw it collapse → idle
//                             yank away from the                               slow: collapse
//                             basin tears it into
//                             an orb → holding
//
//   press on THE HERO                     → wind (Air comes from the hero; no source needed)
//   press on a water SOURCE               → stream, at once (touch and the water comes)
//   press on a thing with a MOVE verb     → holding, at once (a rock grabs instantly)
//   press on a thing with only CHANGE     → pending, for that material's hold time
//   SECOND FINGER (a combination: the second touch names the second element's source)
//     streaming, on the hero          → the stream freezes (Ice, Water + Air) → done
//     streaming, on open ground       → mud where it lands (Earth + Water); the stream runs on
//     holding a fireball, on the hero → a firestorm toward it (Fire + Air) → done
//   press on OPEN GROUND in reach         → ground (Earth can raise stone there)
//   press on nothing usable               → not ours: Gestures orbits the camera
//
//   ground     —              → orbit (idle)        progress; at 100% a        → idle           —
//                                                   column rises → raising
//   raising    —              → stop (idle)          the column keeps rising    → idle           —
//
// Commit of a CHANGE verb:
//   pull    a fireball comes away in the hand → holding it
//   ignite  it catches where it stands        → done
// ============================================================

import { changeVerb } from '../data/materials.js';
import { WILD } from '../data/growth.js';
import { EARTH } from '../data/elements.js';
import { EventBus, EV } from '../core/EventBus.js';

const MOVE_PX = 10;          // finger travel that counts as a drag, not a hold
const RANGE = 14;            // how far from the hero a touch can act
const RING_AFTER = 0.2;      // seconds of stillness before a holding ring appears
const YANK_PX = 2200;        // px/s away from the basin that tears the water free (deliberate, not a quick aim)
const YANK_WINDOW = 80;      // ms of finger history the yank is measured over

export class Intent {
    constructor({ camera, hero, channel, interactables, fire, earth, water, air, prog, works = null, ice = null, storm = null, mud = null }) {
        Object.assign(this, { camera, hero, channel, interactables, fire, earth, water, air, prog, works, ice, storm, mud });
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

    // The CHANGE verb a thing answers to now, given what the player has
    // learned: none for a locked element; for WILD Fire, quicker to catch and
    // no taking a fire back (pulling flame out of something burning).
    _changeVerb(thing, burning) {
        const cv = changeVerb(thing.mat, burning);
        if (!cv) return null;
        const st = this.prog.live(cv.element);
        if (st === 'locked') return null;
        if (st === 'wild') {
            if (cv.verb === 'pull' && burning) return null;
            // Heating stone in the grip takes trained Fire: untrained, holding
            // a stone still is just holding it (Lesson I's "hold it steady").
            if (cv.verb === 'heat') return null;
            return { ...cv, hold: cv.hold * (WILD[cv.element]?.holdFactor ?? 1) };
        }
        return cv;
    }

    _moveElement(thing) {
        const mv = thing.mat.move;
        if (!mv || !this.prog.has(mv)) return null;
        if (mv === 'earth' && !this.earth.canMove(thing.entry)) return null;
        return mv;
    }

    _inRange(thing) { return thing.pos().distanceTo(this.hero.position) <= RANGE; }

    _usable(thing) {
        if (!this._inRange(thing)) return false;
        if (thing.mat.source === 'water') return this.prog.has('water');
        return !!this._moveElement(thing) || !!this._changeVerb(thing, this.fire.isBurning(thing));
    }

    // ---- inputs from Gestures --------------------------------------------

    /** A finger lands on the world. Returns true if Intent takes it. */
    press(x, y) {
        if (this.state !== 'idle') return false;
        // Priority: a touch exactly on a thing, then the hero (Air), then the
        // fat-finger assist. The hero's touch area is generous, and must not
        // steal a touch that lands squarely on a rock at their feet.
        const usable = t => this._usable(t);
        let thing = this.interactables.pick(x, y, this.camera, usable, { assist: false });
        if (!thing && this.prog.has('earth')) {
            // Squarely on a stone Earth can't lift yet: say so (Cael answers it
            // in the lesson), and don't let the assist hand over a smaller one.
            const stone = this.interactables.pick(x, y, this.camera,
                t => t.mat.move === 'earth' && t.entry?.body.world && this._inRange(t), { assist: false });
            if (stone) { EventBus.emit(EV.TOO_HEAVY, { id: stone.id, mass: stone.entry.body.mass }); return false; }
        }
        if (!thing && this.prog.has('air') && this.air.onHero(x, y)) {
            Object.assign(this, { x, y, ax: x, ay: y, thing: null, state: 'wind', blowing: false, element: 'air' });
            return true;
        }
        thing = thing || this.interactables.pick(x, y, this.camera, usable);
        if (!thing) {
            // Open ground: Earth can raise stone here, if the finger stays still.
            const g = this.works && this.prog.can('raise') ? this.works.groundAt(x, y) : null;
            if (!g) return false;
            Object.assign(this, { x, y, ax: x, ay: y, thing: null, t: 0, state: 'ground', ground: g, column: null, element: 'earth' });
            this.channel.aimAt(g, 'earth');
            return true;
        }
        Object.assign(this, { x, y, ax: x, ay: y, thing, t: 0, still: 0 });
        this.trail = [];
        if (thing.mat.source === 'water' && this.water.beginStream(thing)) {
            this.state = 'stream';
            this.element = 'water';
            this.channel.aimAt(this.water.stream.cur, 'water');
            return true;
        }
        const mv = this._moveElement(thing);
        if (mv) {
            this.channel.grab(thing.entry, mv);
            this.state = 'holding';
            this.element = mv;
            return true;
        }
        this.verb = this._changeVerb(thing, this.fire.isBurning(thing));
        this.state = 'pending';
        this.channel.aimAt(thing.pos(), this.verb.element);
        return true;
    }

    /**
     * A second finger lands while the first acts. Returns true if it means something:
     * while streaming, touching the hero freezes the stream (Water + Air: Ice).
     */
    second(x, y) {
        const held = this.channel.held?.entry;
        // Holding a fireball, touch the hero: Fire + Air, a firestorm toward where the fireball was.
        if (this.state === 'holding' && held?.data.fireball && this.storm && this.prog.can('firestorm') && this.air.onHero(x, y)) {
            const from = this.hero.position.clone(), dir = held.mesh.position.clone().sub(from);
            this.fire.spendFireball(held);
            this.channel.let();
            this.storm.blow(from, dir, 'player');
            this.hero.anim?.throw?.();
            Object.assign(this, { element: 'fire', state: 'done', doneT: 0.4, thing: null });
            return true;
        }
        // Streaming, touch open ground: Earth + Water, mud where the water lands. The stream keeps running.
        if (this.state === 'stream' && this.mud && this.prog.can('mud') && !this.air.onHero(x, y) && this.works?.groundAt(x, y)) {
            this.mud.make(this.water.stream.cur, 'player');
            return true;
        }
        if (this.state === 'stream' && this.ice && this.prog.can('freeze') && this.air.onHero(x, y)) {
            const arc = this.water.freeze();
            if (!arc) return false;
            this.ice.freeze(arc.S, arc.E, 'player');
            this.hero.anim?.throw?.();
            this.element = 'water';
            this.state = 'done';
            this.doneT = 0.4;
            return true;
        }
        return false;
    }

    /** The finger moves. Returns 'orbit' when the gesture should become a camera drag. */
    drag(x, y, t = performance.now()) {
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
        case 'ground':
            if (moved) { this._cancel(); return 'orbit'; }
            return null;
        case 'raising':
            return null;
        case 'wind':
            if (!this.blowing && moved) this.blowing = true;
            if (this.blowing) {
                this.air.aim(x, y);
                this.channel.aimAt(this.air.wind.aim, 'air');
            }
            return null;
        case 'stream':
            this.water.aimStream(x, y);
            if (this._yanked(x, y, t)) this._tearFree();
            return null;
        default:
            return null;
        }
    }

    /** The finger lifts. */
    release(r) {
        if (this.state === 'wind' && r?.flick) {
            this.air.gustFromFlick(r.vx, r.vy, r.x, r.y);
            this.hero.anim.throw();
        }
        if (this.state === 'holding') this.channel.release(r);
        else if (this.state === 'stream') {
            if (r?.flick) {
                // A flick breaks the water off and throws it.
                const orb = this.water.snap();
                if (orb) { this.channel.grab(orb.entry, 'water', { lift: 0 }); this.channel.release(r); }
            } else {
                this.water.collapse();
            }
            this.channel.aimAt(null);
        }
        this._cancel();
    }

    _cancel() {
        if (this.state === 'stream') this.water.collapse();
        if (this.state === 'wind') { this.air.stop(); this.blowing = false; }
        if (this.state !== 'holding') this.channel.aimAt(null);
        this.state = 'idle';
        this.thing = null;
        this.verb = null;
    }

    // ---- per frame -------------------------------------------------------

    update(dt) {
        switch (this.state) {
        case 'pending': {
            const cv = this._changeVerb(this.thing, this.fire.isBurning(this.thing));
            if (!this._inRange(this.thing) || !cv || cv.verb !== this.verb.verb) { this._cancel(); break; }
            this.channel.aimAt(this.thing.pos(), cv.element);
            this.t += dt;
            if (this.t >= cv.hold) this._commit(cv);
            break;
        }
        case 'holding': {
            if (!this.channel.held) { this._cancel(); break; }
            const cv = this._changeVerb(this.thing, false);
            this.still += dt;
            if (cv?.verb === 'heat' && this.still >= cv.hold) {
                this.fire.heat(this.thing, dt, 'player');
                this.element = cv.element;
            } else {
                this.element = this.channel.held.element;
            }
            break;
        }
        case 'ground':
            this.t += dt;
            if (this.t >= EARTH.raise.hold) {
                this.column = this.works.raise(this.ground, 'player');
                this.state = 'raising';
                this.hero.anim?.throw?.();
            }
            break;
        case 'raising':
            this.works.grow(this.column, dt, this.prog.power('earth'));
            this.channel.aimAt(this.column.mesh.position, 'earth');
            break;
        case 'done':
            this.doneT -= dt;
            if (this.doneT <= 0) this.channel.aimAt(null);
            break;
        case 'stream':
            if (!this.water.stream) { this._cancel(); break; }            // it let go (hero walked off)
            break;
        }
    }

    // A yank: the finger moving fast, and away from the basin on screen.
    _yanked(x, y, t) {
        const tr = this.trail;
        tr.push({ x, y, t });
        while (tr.length > 2 && t - tr[0].t > YANK_WINDOW) tr.shift();
        const a = tr[0];
        const dt = Math.max(16, t - a.t) / 1000;
        if (Math.hypot(x - a.x, y - a.y) / dt < YANK_PX) return false;
        const q = this.water.stream.source.surface.clone().project(this.camera);
        const bx = (q.x + 1) / 2 * innerWidth, by = (1 - q.y) / 2 * innerHeight;
        return Math.hypot(x - bx, y - by) > Math.hypot(a.x - bx, a.y - by) + 20;
    }

    // The water tears free of its source: an orb in the hand, still following the finger.
    _tearFree() {
        const orb = this.water.snap();
        if (!orb) return;
        this.channel.grab(orb.entry, 'water', { lift: 0 });
        Object.assign(this, { state: 'holding', thing: orb, still: 0, ax: this.x, ay: this.y });
        this.channel.drag(this.x, this.y);
    }

    _commit(cv) {
        this.element = cv.element;
        if (cv.verb === 'pull') {
            const fb = this.fire.pullFrom(this.thing, 'player');
            if (!fb) { this._cancel(); return; }
            this.channel.grab(fb.entry, 'fire', { lift: 0.4 });
            Object.assign(this, { state: 'holding', thing: fb, still: 0, ax: this.x, ay: this.y });
        } else if (cv.verb === 'ignite') {
            this.fire.ignite(this.thing, 'player', { direct: true });
            this.state = 'done';
            this.doneT = 0.4;
        } else {
            this._cancel();
        }
    }

    /** The progress ring at the finger, or null: { x, y, progress 0..1, element }. */
    ring() {
        if (this.state === 'ground') return { x: this.x, y: this.y, progress: Math.min(1, this.t / EARTH.raise.hold), element: 'earth' };
        if (this.state === 'pending') return { x: this.x, y: this.y, progress: Math.min(1, this.t / this.verb.hold), element: this.verb.element };
        if (this.state === 'holding') {
            const cv = this._changeVerb(this.thing, false);
            if (cv?.verb === 'heat' && this.still > RING_AFTER) return { x: this.x, y: this.y, progress: Math.min(1, this.still / cv.hold), element: cv.element };
        }
        return null;
    }
}
