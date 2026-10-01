// ============================================================
// GESTURES — one pointer stream, sorted into what the player meant (§35)
// ============================================================
//
// The screen is split by intent, not by buttons:
//
//   bottom-left   MOVE. The bottom half of the left half of the screen. A
//   quarter       floating stick appears wherever the thumb lands in it.
//   everywhere    THE WORLD. Intent (src/input/Intent.js) decides what a touch
//   else          on a thing means, from its material and whether the finger
//                 drags or holds still. What Gestures owns:
//                   press/drag/release    handed to Intent while it wants them
//                   release velocity      fast = FLICK (throw), slow = drop
//                   on empty world        drag orbits the camera
//                   two fingers           pinch zooms
//
// The move zone is deliberately only a quarter of the screen: a rock in the
// top left is as grabbable as one on the right (tested on a phone: a
// left-40% strip made the top-left of the view unreachable).
//
// Pointer Events cover touch, mouse and pen with the same code, so the
// prototype is testable at a desk (WASD also moves). Handlers are plain
// callbacks; this module knows nothing about rocks or elements.
// ============================================================

const FLICK_SPEED = 900;      // px/s at release to count as a throw
const VEL_WINDOW = 90;        // ms of history used for release velocity

export class Gestures {
    constructor(el, handlers) {
        this.el = el;
        this.h = handlers;        // { press(x,y) → taken?, second(x,y) → taken? (a second finger while the first acts), drag(x,y,t) → 'orbit'|null, release, orbit, zoom, stick }
        this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };   // x,y in -1..1
        this.world = new Map();   // pointerId -> { mode: world|orbit|pinch, samples: [{x,y,t}] }
        this.keys = new Set();
        this.pinchD = 0;
        this.moveZone = { x: 0.33, y: 0.6 };  // stick lives left of x and below y (fractions of the screen): the bottom-left corner
        this.flick = { px: 40, ms: 260 };    // a quick swipe up on the stick and off is a jump
        this.stickRadius = 60;

        this._off = [];
        const on = (t, type, fn, opts) => { t.addEventListener(type, fn, opts); this._off.push(() => t.removeEventListener(type, fn, opts)); };
        on(el, 'pointerdown', e => this._down(e));
        on(el, 'pointermove', e => this._move(e));
        on(el, 'pointerup', e => this._up(e));
        on(el, 'pointercancel', e => this._up(e, true));
        on(el, 'contextmenu', e => e.preventDefault());
        on(el, 'wheel', e => { e.preventDefault(); this.h.zoom?.(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
        on(window, 'keydown', e => { if (e.code === 'Space' && !e.repeat) { e.preventDefault?.(); this.h.jump?.(); } this.keys.add(e.code); });
        on(window, 'keyup', e => this.keys.delete(e.code));
        on(window, 'blur', () => this.keys.clear());
    }

    /** Stop listening (the editor's Play mode starts and stops the game). */
    dispose() { this._off.forEach(f => f()); this._off = []; this.keys.clear(); }

    /** Movement intent, -1..1 on each axis (x right, y forward). */
    moveVector() {
        let x = this.stick.x, y = this.stick.y;
        const k = this.keys;
        if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
        if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
        if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
        if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
        const len = Math.hypot(x, y);
        if (len > 1) { x /= len; y /= len; }
        return { x, y, run: k.has('ShiftLeft') ? 1 : Math.min(1, Math.hypot(x, y)) };
    }

    /** Is (x, y) in the bottom-left move zone? */
    inMoveZone(x, y) { return x < innerWidth * this.moveZone.x && y > innerHeight * this.moveZone.y; }

    _down(e) {
        // Capture can refuse (a pointer already gone); input must not die with it.
        try { this.el.setPointerCapture?.(e.pointerId); } catch (err) { /* keep going uncaptured */ }
        // The move zone, unless the touch is on something that claims it (the
        // hero stands at the zone's edge in portrait; touching the hero is Air).
        if (this.inMoveZone(e.clientX, e.clientY) && e.pointerType !== 'mouse' && this.stick.id === null && !this.h.claims?.(e.clientX, e.clientY)) {
            Object.assign(this.stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0, t0: e.timeStamp, ly: e.clientY });
            this.h.stick?.({ active: true, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
            return;
        }
        const s = { mode: 'orbit', samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }], lx: e.clientX, ly: e.clientY };
        if (this.world.size === 0) {
            if (this.h.press?.(e.clientX, e.clientY)) s.mode = 'world';
        } else if (this.h.second?.(e.clientX, e.clientY)) {
            // A second finger that means something while the first acts (a combination: touch the hero while streaming).
            s.mode = 'second';
        } else {
            // A second finger on the world turns it into a pinch.
            s.mode = 'pinch';
            for (const o of this.world.values()) if (o.mode === 'orbit') o.mode = 'pinch';
            this.pinchD = 0;
        }
        this.world.set(e.pointerId, s);
    }

    _move(e) {
        if (e.pointerId === this.stick.id) {
            this.stick.ly = e.clientY;
            const dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
            const len = Math.hypot(dx, dy), R = this.stickRadius;
            const k = len > R ? R / len : 1;
            this.stick.x = (dx * k) / R;
            this.stick.y = -(dy * k) / R;
            this.h.stick?.({ active: true, ox: this.stick.ox, oy: this.stick.oy, x: this.stick.x, y: this.stick.y });
            return;
        }
        const s = this.world.get(e.pointerId);
        if (!s) return;
        // Sample every coalesced move at the time it actually happened, so a
        // flick still measures right when the frame rate drops.
        const evs = e.getCoalescedEvents?.() || [];
        for (const c of (evs.length ? evs : [e])) s.samples.push({ x: c.clientX, y: c.clientY, t: c.timeStamp });
        const now = e.timeStamp;
        while (s.samples.length > 2 && now - s.samples[0].t > VEL_WINDOW) s.samples.shift();
        const dx = e.clientX - s.lx, dy = e.clientY - s.ly;
        s.lx = e.clientX; s.ly = e.clientY;
        if (s.mode === 'world') { if (this.h.drag?.(e.clientX, e.clientY, e.timeStamp) === 'orbit') s.mode = 'orbit'; }
        else if (s.mode === 'orbit') this.h.orbit?.(dx, dy);
        else if (s.mode === 'pinch' && this.world.size >= 2) {
            const [a, b] = [...this.world.values()];
            const d = Math.hypot(a.lx - b.lx, a.ly - b.ly);
            if (this.pinchD > 0 && d > 0) this.h.zoom?.(this.pinchD / d);
            this.pinchD = d;
        }
    }

    _up(e, cancelled = false) {
        if (e.pointerId === this.stick.id) {
            // A flick: the thumb went up fast and came off. Jump.
            if (!cancelled && e.timeStamp - this.stick.t0 < this.flick.ms && this.stick.oy - Math.min(this.stick.ly, e.clientY) > this.flick.px) this.h.jump?.();
            Object.assign(this.stick, { id: null, x: 0, y: 0 });
            this.h.stick?.({ active: false });
            return;
        }
        const s = this.world.get(e.pointerId);
        if (!s) return;
        this.world.delete(e.pointerId);
        if (s.mode === 'world') {
            const v = this._velocity(s, e);
            const flick = !cancelled && Math.hypot(v.x, v.y) > FLICK_SPEED;
            this.h.release?.({ flick, vx: v.x, vy: v.y, x: e.clientX, y: e.clientY });
        }
    }

    // Screen velocity over the last VEL_WINDOW ms, px/s. Event timestamps,
    // not frame times: the finger's speed, not the renderer's.
    _velocity(s, e) {
        const now = e.timeStamp;
        const pts = s.samples.concat([{ x: e.clientX, y: e.clientY, t: now }]);
        const a = pts.find(p => now - p.t <= VEL_WINDOW) || pts[0];
        const dt = Math.max(16, now - a.t) / 1000;
        return { x: (e.clientX - a.x) / dt, y: (e.clientY - a.y) / dt };
    }
}
