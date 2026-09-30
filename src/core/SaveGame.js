// ============================================================
// SAVE GAME — slots, checkpoints, and what the world remembers
// ============================================================
//
// One save per slot (three), on the device, versioned. A save holds only what
// MATTERS, never transient physics:
//
//   meta        slot, when, where, how long played, the protagonist's name
//   progress    element states, Power and Control (Progression), story flags
//   world       persistent world states by id: "Veyra_Barn_North": "burned"
//   ledger      the consequence tallies, by kingdom (Ledger.js)
//   checkpoint  where to come back to: scene, spawn point, story step
//   custom      the protagonist's look
//
// COMMITTED vs PENDING. Play changes a working copy; a CHECKPOINT commits it to
// the slot. Dying goes back to the last checkpoint and drops what happened
// since, so a consequence belongs to something the player finished, never to
// an ordinary death (the brief's rule).
//
// Recovery: every write keeps the previous save as `.bak`. A save that won't
// parse or fails its shape check falls back to the backup, then to a new game.
// The old single save (`elemental.progress`, version 1) migrates into slot 1.
// ============================================================

export const SAVE_VERSION = 2;
export const SLOTS = 3;
const KEY = slot => `elemental.save.${slot}`;
const LEGACY_KEY = 'elemental.progress';

const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* nothing saved */ } },
};

export function blankSave(slot = 1) {
    return {
        version: SAVE_VERSION,
        meta: { slot, created: new Date().toISOString(), savedAt: null, scene: null, chapter: '', playTime: 0, name: '' },
        progress: { profile: 'story', els: null, flags: {} },
        world: {},
        ledger: {},
        checkpoint: null,
        custom: {},
    };
}

// The shape a save must have to be trusted.
function valid(s) {
    return s && typeof s === 'object' && s.version === SAVE_VERSION && s.meta && typeof s.meta === 'object'
        && s.progress && typeof s.progress === 'object' && typeof s.world === 'object' && typeof s.ledger === 'object';
}

/** Bring an older save up to the current version, or null if it can't be. */
export function migrate(s) {
    if (!s || typeof s !== 'object') return null;
    if (s.version === SAVE_VERSION) return s;
    if (s.version === 1 && s.els) {             // the old Progression save
        const n = blankSave(1);
        n.progress.els = s.els;
        n.progress.flags = s.flags || {};
        return n;
    }
    return null;
}

function parse(raw) {
    if (!raw) return null;
    try { const s = migrate(JSON.parse(raw)); return valid(s) ? s : null; } catch (e) { return null; }
}

/** Read a slot: the save, its backup if the save is damaged, or null. `recovered` says which. */
export function readSlot(slot) {
    const main = parse(store.get(KEY(slot)));
    if (main) return { save: main, recovered: false };
    const bak = parse(store.get(KEY(slot) + '.bak'));
    if (bak) return { save: bak, recovered: true };
    if (slot === 1) {
        const legacy = parse(store.get(LEGACY_KEY));
        if (legacy) return { save: legacy, recovered: false, migrated: true };
    }
    return null;
}

export function writeSlot(slot, save) {
    save.meta.slot = slot;
    save.meta.savedAt = new Date().toISOString();
    const prev = store.get(KEY(slot));
    if (prev) store.set(KEY(slot) + '.bak', prev);
    return store.set(KEY(slot), JSON.stringify(save));
}

export function deleteSlot(slot) { store.del(KEY(slot)); store.del(KEY(slot) + '.bak'); if (slot === 1) store.del(LEGACY_KEY); }

/** A summary of each slot for the title screen. */
export function listSlots() {
    const out = [];
    for (let s = 1; s <= SLOTS; s++) {
        const r = readSlot(s);
        out.push(r ? { slot: s, ...r.save.meta, recovered: r.recovered } : { slot: s, empty: true });
    }
    return out;
}

/**
 * The live session: a working copy over a committed save. Systems read and
 * write `session.work`; `checkpoint()` commits it; `restore()` goes back.
 */
export class Session {
    constructor(slot, save = null, { persist = true } = {}) {
        this.slot = slot;
        this.persist = persist;
        this.committed = save ? JSON.parse(JSON.stringify(save)) : blankSave(slot);
        this.work = JSON.parse(JSON.stringify(this.committed));
        this.startedAt = Date.now();
    }

    /** Commit the working copy: this is what dying returns to. */
    checkpoint(where = null) {
        if (where) this.work.checkpoint = where;
        this.work.meta.playTime += (Date.now() - this.startedAt) / 1000;
        this.startedAt = Date.now();
        this.committed = JSON.parse(JSON.stringify(this.work));
        if (this.persist) writeSlot(this.slot, this.committed);
        return this.committed.checkpoint;
    }

    /** Back to the last checkpoint: what happened since is forgotten. */
    restore() {
        this.work = JSON.parse(JSON.stringify(this.committed));
        this.startedAt = Date.now();
        return this.work.checkpoint;
    }

    // World states: the meaningful, lasting changes (a barn burned, a gate raised).
    state(id) { return this.work.world[id] ?? null; }
    setState(id, value) { if (value === null) delete this.work.world[id]; else this.work.world[id] = value; }
}
