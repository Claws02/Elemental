// ============================================================
// PROGRESSION — what the Conduit can do, and how well
// ============================================================
//
// Each element is LOCKED (not yet known), WILD (it answers, but untrained:
// see WILD in data/growth.js) or TRAINED. Each has POWER and CONTROL, 0 … 1.
//
// Gains come in through the EventBus, so gameplay code never calls this to
// "award" anything: throwing a stone, breaking a plank, lighting a fire with
// wild Fire are all events already, and this listens. Lessons grant Control
// directly (grant()), because restraint is not an event anything else emits.
//
// The story profile is saved on the device (versioned); the sandbox is not.
// ============================================================

import { EventBus, EV } from './EventBus.js';
import { GAINS, PROFILES, GROWTH } from '../data/growth.js';

const SAVE_KEY = 'elemental.progress';
const VERSION = 1;

export class Progression {
    constructor(profile = 'story', { persist = profile === 'story' } = {}) {
        this.profile = profile;
        this.persist = persist;
        this.els = JSON.parse(JSON.stringify(PROFILES[profile]));
        this.flags = {};
        if (persist) this._load();
        this._listen();
    }

    state(el) { return this.els[el]?.state || 'locked'; }
    power(el) { return this.els[el]?.power || 0; }
    control(el) { return this.els[el]?.control || 0; }
    has(el) { return this.state(el) !== 'locked'; }
    wild(el) { return this.state(el) === 'wild'; }

    /** A number from data/growth.js for this element's current Power or Control. */
    earth(key) {
        const f = GROWTH.earth[key];
        const byControl = key === 'wobble' || key === 'slam';
        return f(byControl ? this.control('earth') : this.power('earth'));
    }

    setState(el, state) { this.els[el].state = state; this._save(); }

    /** Add to a track. Emits Growth when a whole level (a tenth) is crossed. */
    grant(el, track, amount, reason = '') {
        const e = this.els[el];
        if (!e || e.state === 'locked') return;
        // Wild elements grow Power only: Control needs training.
        if (track === 'control' && e.state === 'wild') return;
        const before = e[track];
        e[track] = Math.min(1, before + amount);
        if (Math.floor(e[track] * 10) > Math.floor(before * 10)) {
            EventBus.emit(EV.GROWTH, { el, track, level: Math.floor(e[track] * 10) + 1, reason });
        }
        this._save();
    }

    level(el, track) { return Math.floor(this.els[el][track] * 10) + 1; }

    _listen() {
        const g = k => { const x = GAINS[k]; this.grant(x.el, x.track, x.amount, k); };
        EventBus.on(EV.OBJECT_THROWN, e => { if (e.element === 'earth' && e.cause === 'player') g('earthThrow'); });
        EventBus.on(EV.PIECE_BROKEN, e => { if (e.cause === 'player' && !e.burned) g('earthBreak'); });
        EventBus.on(EV.FIRE_STARTED, e => { if (e.cause === 'player' && this.wild('fire')) g('fireWildIgnite'); });
    }

    _save() {
        if (!this.persist) return;
        try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: VERSION, els: this.els, flags: this.flags })); } catch (e) { /* private mode: play on unsaved */ }
    }

    _load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return;
            const s = JSON.parse(raw);
            if (s.version !== VERSION) return;          // migrations go here when VERSION moves
            for (const k of Object.keys(this.els)) if (s.els?.[k]) Object.assign(this.els[k], s.els[k]);
            this.flags = s.flags || {};
        } catch (e) { /* unreadable save: start fresh */ }
    }

    /** Start the story over (title screen, QA). */
    reset() {
        this.els = JSON.parse(JSON.stringify(PROFILES[this.profile]));
        this.flags = {};
        try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing saved */ }
    }
}
