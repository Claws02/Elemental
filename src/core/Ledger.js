// ============================================================
// LEDGER — what the player's power has done, kingdom by kingdom
// ============================================================
//
// Never a good/evil meter, and never shown as a number. The world reads it:
// rulers, guards, villagers, Cael (docs/SCENES.md, the world bible).
//
// Per kingdom (the scene's settings.region), five tallies:
//   harm     things that belonged to someone, damaged or burned by the player
//   care     fires the player put out, things rebuilt, people shielded
//   excess   force far beyond what the moment needed (a wall smashed flat
//            where a gap would do; every pool of lava)
//   spared   creatures driven off rather than killed
//   killed   creatures killed
//
// Only objects someone OWNS count (scene prop `owner`: civilian, empire): a
// training dummy or a wild ruin is fair game. Everything arrives through the
// EventBus, already carrying who caused it.
// ============================================================

import { EventBus, EV } from './EventBus.js';

export const TALLIES = ['harm', 'care', 'excess', 'spared', 'killed'];
export const REGIONS = ['verdant', 'emberwall', 'saltmere', 'skyreach', 'glass', 'capital'];

// How a kingdom sees you, from its own tallies. The names are the world's words.
export const STANDING = ['the cause of all this', 'dangerous', 'unpredictable', 'necessary', 'saviour'];

// A surge is the player's own power going off: the world counts it as theirs.
const yours = c => c === 'player' || c === 'surge';

export class Ledger {
    /**
     * @param {Session} session  the save session (the tallies live in its working copy)
     * @param {string} region    the kingdom this scene is in
     * @param {Function} ownerOf id → 'civilian' | 'empire' | 'none'
     */
    constructor(session, region, ownerOf) {
        Object.assign(this, { session, region, ownerOf });
        this._burst = [];
        this.off = [
            EventBus.on(EV.PIECE_BROKEN, e => {
                if (!yours(e.cause) || !this._owned(e.id)) return;
                this.add('harm', 1);
                // Many pieces at once from one act of force: excess.
                const t = e.t;
                this._burst = this._burst.filter(x => t - x < 1).concat(t);
                if (this._burst.length === 5) this.add('excess', 1);
            }),
            EventBus.on(EV.STRUCTURE_STATE, e => {
                if (yours(e.cause) && ['Collapsed', 'Burned'].includes(e.to) && this._owned(e.id)) this.add('harm', 3);
            }),
            EventBus.on(EV.FIRE_STARTED, e => { if (yours(e.cause) && this._owned(e.id)) this.add('harm', 0.5); }),
            // Lava is excess by nature: far more than any moment needs.
            EventBus.on(EV.LAVA, e => { if (e.cause === 'player') this.add('excess', 1); }),
            // People caught in a surge.
            EventBus.on(EV.SURGE, e => { if (e.cause === 'surge' && e.hurt?.length) this.add('harm', e.hurt.length); }),
            EventBus.on(EV.FIRE_OUT, e => { if (e.cause === 'player' && (e.doused || e.blown || e.pulled) && this._owned(e.id)) this.add('care', 0.5); }),
            EventBus.on(EV.CREATURE, e => {
                if (e.cause !== 'player') return;
                if (e.to === 'dead') this.add('killed', 1);
                if (e.to === 'fled') this.add('spared', 1);
            }),
        ];
    }

    dispose() { this.off.forEach(f => f()); }

    _owned(id) { const o = this.ownerOf(String(id).replace(/_P\d+$/, '')); return o === 'civilian' || o === 'empire'; }

    _book(region = this.region) {
        const L = this.session.work.ledger;
        return (L[region] ||= { harm: 0, care: 0, excess: 0, spared: 0, killed: 0 });
    }

    add(tally, amount, region = this.region) {
        const b = this._book(region);
        b[tally] = Math.round(((b[tally] || 0) + amount) * 100) / 100;
        EventBus.emit(EV.LEDGER, { region, tally, amount, total: b[tally] });
    }

    get(tally, region = this.region) { return region === '*' ? this.total(tally) : this._book(region)[tally] || 0; }
    total(tally) { return Object.values(this.session.work.ledger).reduce((n, b) => n + (b[tally] || 0), 0); }

    /** 0..4 into STANDING: care lifts it, harm and excess pull it down; a ruler's flag can tip it. */
    standing(region = this.region) {
        const b = this._book(region);
        const tip = this.session.work.progress.flags?.[`standing.${region}`] || 0;
        const score = b.care - b.harm - 0.5 * b.excess + 0.25 * b.spared + tip;
        return score >= 6 ? 4 : score >= 1.5 ? 3 : score > -1.5 ? 2 : score > -6 ? 1 : 0;
    }
    standingWord(region = this.region) { return STANDING[this.standing(region)]; }

    /** All the harm the player's power has done, everywhere: the chaos behind the endings. */
    chaos() { return this.total('harm') + this.total('excess') + 0.5 * this.total('killed'); }
}
