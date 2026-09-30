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
// State lives in the save session (core/SaveGame.js): Progression reads and
// writes the session's working copy, and a checkpoint puts it on the device.
// The sandbox runs on a session that is never written.
// ============================================================

import { EventBus, EV } from './EventBus.js';
import { GAINS, PROFILES, GROWTH, ABILITIES } from '../data/growth.js';

export class Progression {
    /**
     * @param {string} profile   'story' or 'sandbox' (data/growth.js PROFILES)
     * @param {object} [o]
     * @param {Session} [o.session] the save session to read and write (none: a throwaway one)
     */
    constructor(profile = 'story', { session = null } = {}) {
        this.profile = profile;
        this.session = session;
        const p = session?.work.progress;
        // The sandbox (everything trained) never touches the story's save.
        const story = profile === 'story';
        this.els = story && p?.els ? p.els : JSON.parse(JSON.stringify(PROFILES[profile]));
        this.flags = story && p ? (p.flags ||= {}) : {};
        this._save();
        this._listen();
    }

    state(el) { return this.els[el]?.state || 'locked'; }
    power(el) { return this.els[el]?.power || 0; }
    control(el) { return this.els[el]?.control || 0; }
    /** Can the player use it now: known, and not silenced by the charm (the charm stills what is wild). */
    has(el) { return this.live(el) !== 'locked'; }
    wild(el) { return this.state(el) === 'wild'; }
    /** Cael's charm: 'none' (not offered yet), 'worn', 'refused'; undefined outside the story. */
    charmed() { return this.flags.charm === 'worn'; }
    /** The state as the player feels it: a wild element under the charm is as good as locked. */
    live(el) { const s = this.state(el); return s === 'wild' && this.charmed() ? 'locked' : s; }

    /** An ability or combination (data/growth.js ABILITIES): its elements usable, and learned (the sandbox knows them all). */
    can(ability) {
        const a = ABILITIES[ability];
        if (!a || !a.needs.every(el => this.has(el))) return false;
        return this.profile === 'sandbox' || !!this.flags['learned.' + ability];
    }

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
        const p = this.session?.work.progress;
        if (!p || this.profile !== 'story') return;
        p.profile = 'story';
        p.els = this.els;
        p.flags = this.flags;
    }

    /** Start the story over: the profile's starting states, no flags. */
    reset() {
        this.els = JSON.parse(JSON.stringify(PROFILES[this.profile]));
        for (const k of Object.keys(this.flags)) delete this.flags[k];
        this._save();
    }
}
