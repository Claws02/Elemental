// ============================================================
// GESTURES — one pointer stream, sorted into what the player meant (§35)
// ============================================================
//
// The screen is split by intent, not by buttons:
//
//   bottom-left   MOVE. The bottom half of the left half of the screen. A
//   quarter       floating stick appears wherever the thumb lands in it.
//   everywhere    THE WORLD. What a touch means depends on what it lands on:
//   else
//                   on something grabbable → grab, drag to move it,
//                                            release fast = FLICK (throw),
//                                            release slow = drop
//                   on empty world         → drag orbits the camera
//                   two fingers            → pinch zooms
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
        this.h = handlers;        // { pickAt(x,y) → target|null, grab, drag, release, orbit, zoom }
        this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };   // x,y in -1..1
        this.world = new Map();   // pointerId -> { mode, target, samples: [{x,y,t}] }
        this.keys = new Set();
        this.pinchD = 0;
        this.moveZone = { x: 0.5, y: 0.5 };   // stick lives left of x and below y (fractions of the screen)
        this.stickRadius = 60;

        el.addEventListener('pointerdown', e => this._down(e));
        el.addEventListener('pointermove', e => this._move(e));
        el.addEventListener('pointerup', e => this._up(e));
        el.addEventListener('pointercancel', e => this._up(e, true));
        el.addEventListener('contextmenu', e => e.preventDefault());
        el.addEventListener('wheel', e => { e.preventDefault(); this.h.zoom?.(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
        addEventListener('keydown', e => this.keys.add(e.code));
        addEventListener('keyup', e => this.keys.delete(e.code));
        addEventListener('blur', () => this.keys.clear());
    }

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
        if (this.inMoveZone(e.clientX, e.clientY) && e.pointerType !== 'mouse' && this.stick.id === null) {
            Object.assign(this.stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
            this.h.stick?.({ active: true, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
            return;
        }
        const s = { mode: 'orbit', target: null, samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }], lx: e.clientX, ly: e.clientY };
        if (this.world.size === 0) {
            const target = this.h.pickAt?.(e.clientX, e.clientY);
            if (target) { s.mode = 'grab'; s.target = target; this.h.grab?.(target, e.clientX, e.clientY); }
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
        if (s.mode === 'grab') this.h.drag?.(s.target, e.clientX, e.clientY);
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
            Object.assign(this.stick, { id: null, x: 0, y: 0 });
            this.h.stick?.({ active: false });
            return;
        }
        const s = this.world.get(e.pointerId);
        if (!s) return;
        this.world.delete(e.pointerId);
        if (s.mode === 'grab') {
            const v = this._velocity(s, e);
            const flick = !cancelled && Math.hypot(v.x, v.y) > FLICK_SPEED;
            this.h.release?.(s.target, { flick, vx: v.x, vy: v.y, x: e.clientX, y: e.clientY });
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
