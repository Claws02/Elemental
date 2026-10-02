// ============================================================
// TALK — tap a person and they talk to you
// ============================================================
//
// Anyone in a scene can be talked to: tap them (within TALK.range). They
// stop what they're doing, turn to you, and say something chosen from what
// the world remembers (data/talk.js), first match wins:
//
//   1. the scene's own lines for them (script.talk[id])
//   2. their house (HOME): you burned it, saved it, both, or someone else
//      burned it. A person's house is the scene's `home` for them, else the
//      nearest lived-in building to where they stand (not a ruler's hall)
//   3. their own lines (NAMED, by id)
//   4. their kingdom's folk or guards, by how the kingdom sees you (FOLK)
//
// Each time you talk to someone they say the next of their lines. Nobody
// talks over the story: while it speaks or waits for a choice, a tap on a
// person does nothing.
//
// What happened to each house, and who did it, is kept in the save
// (session state `<id>@by`, `<id>@saved`), so it's remembered on return.
// ============================================================

import { EventBus, EV } from '../core/EventBus.js';
import { Story } from './Story.js';
import { FOLK, HOME, NAMED, GROUPS, NAMELESS } from '../data/talk.js';
import { PREFABS } from '../data/prefabs.js';

export const TALK = { range: 5, pickPx: 70, hold: 5, homeRange: 22 };
const BURNT = ['Burned', 'Collapsed'];
const HOMES = new Set(['timber_house', 'prefab', 'tent']);      // what a person lives in
const yours = c => c === 'player' || c === 'surge';

export class Talk {
    constructor({ world, story, hud, prog, ledger, session, channel, fire, camera, hero }) {
        Object.assign(this, { world, story, hud, prog, ledger, session, camera, hero });
        this.region = world.data.settings?.region || 'verdant';
        this.queue = [];
        this.sayT = 0;
        this.who = '';
        this.count = new Map();
        this.homes = new Map();
        this.script = world.data.script?.talk || {};
        // Conditions are the story's: with no story here, a stand-in with nothing in progress answers them.
        this.cond = story || Object.assign(Object.create(Story.prototype), { world, prog, channel, fire, counters: {}, t: 0, heldT: 0, sayT: 0, queue: [], hooks: { ledger, session } });
        // Who did what to each house.
        this.off = [
            EventBus.on(EV.STRUCTURE_STATE, e => { if (BURNT.includes(e.to) && world.objects.has(e.id)) session.setState(`${e.id}@by`, yours(e.cause) ? 'you' : e.cause || 'other'); }),
            EventBus.on(EV.FIRE_OUT, e => {
                if (e.burnedOut || !yours(e.cause)) return;
                const b = this._buildingOf(e.id);
                if (b) session.setState(`${b}@saved`, 'you');
            }),
        ];
    }

    dispose() { this.off.forEach(f => f()); }

    get busy() { return this.sayT > 0 || this.queue.length > 0 || !!this.story?.talking || !!this.story?.choosing; }

    // The building a burning piece belongs to: the longest object id it starts with.
    _buildingOf(id) {
        let best = null;
        for (const [oid, o] of this.world.objects) if (id.startsWith(oid) && HOMES.has(o.type) && (!best || oid.length > best.length)) best = oid;
        return best;
    }

    /** A person's house: the scene's `home` for them, else the nearest lived-in building (worked out once). */
    homeOf(npc) {
        if (this.homes.has(npc.id)) return this.homes.get(npc.id);
        const item = this.world.objects.get(npc.id)?.item;
        let home = item?.home && this.world.objects.has(item.home) ? item.home : null;
        if (!home) {
            // From where they stand in the scene (not wherever their round has taken them); never a ruler's hall.
            let d = TALK.homeRange, p = item || npc.position;
            for (const [id, o] of this.world.objects) {
                if (!HOMES.has(o.type) || o.item.owner === 'empire' || o.item.landmark || PREFABS[o.item.prefab]?.landmark) continue;
                const q = o.item, dd = Math.hypot(q.x - p.x, q.z - p.z);
                if (dd < d) { d = dd; home = id; }
            }
        }
        this.homes.set(npc.id, home);
        return home;
    }

    /** The person under the finger (screen x, y), within reach of the hero, or null. */
    pick(x, y) {
        let best = null, bd = TALK.pickPx;
        const h = this.hero.position;
        for (const n of this.world.npcs || []) {
            const p = n.position;
            if (!n.rig.root.parent || Math.hypot(p.x - h.x, p.z - h.z) > TALK.range) continue;
            for (const up of [0.9, 1.5]) {
                const q = p.clone().setY(p.y + up).project(this.camera);
                if (q.z > 1) continue;
                const d = Math.hypot((q.x + 1) / 2 * innerWidth - x, (1 - q.y) / 2 * innerHeight - y);
                if (d < bd) { bd = d; best = n; }
            }
        }
        return best;
    }

    /** A finger on the world: if it's on a person, talk to them. True if it was. */
    press(x, y) {
        const n = this.pick(x, y);
        if (!n) return false;
        if (!this.busy) this.talkTo(n);
        return true;
    }

    /** What they'd say now: one turn's lines. */
    lines(npc) {
        const item = this.world.objects.get(npc.id)?.item || {};
        const [region, kind] = GROUPS[item.look] || [this.region, 'folk'];
        const pick = list => { for (const e of list || []) if (!e.when || this.cond.test(e.when)) return e.say; return null; };
        const say = pick(this.script[npc.id]) || this._home(npc) || pick(NAMED[npc.id]) || this._folk(region, kind);
        return { say, name: item.name || NAMELESS[region]?.[kind] || 'Stranger' };
    }

    _home(npc) {
        const home = this.homeOf(npc);
        if (!home) return null;
        const by = this.session.state(`${home}@by`), saved = this.session.state(`${home}@saved`) === 'you';
        if (by === 'you') return saved ? HOME.burnedSaved : HOME.burnedByYou;
        if (by) return HOME.burnedOther;
        return saved ? HOME.saved : null;
    }

    _folk(region, kind) {
        const pools = FOLK[region]?.[kind] || FOLK.verdant.folk;
        const s = this.ledger?.standing(region) ?? 2;
        return pools[s <= 1 ? 0 : s >= 3 ? 2 : 1];
    }

    talkTo(npc) {
        const { say, name } = this.lines(npc);
        if (!say?.length) return false;
        // A list of turns, or one turn: say the next turn each time.
        const turns = Array.isArray(say[0]) ? say : [say];
        const n = this.count.get(npc.id) || 0;
        this.count.set(npc.id, n + 1);
        this.who = name;
        this.queue.push(...turns[n % turns.length]);
        npc.hold?.(TALK.hold);
        EventBus.emit(EV.TALK, { id: npc.id, n });
        return true;
    }

    update(dt) {
        if (this.sayT > 0) {
            this.sayT -= dt;
            if (this.sayT <= 0 || this.hud.skipLine) { this.hud.skipLine = false; this.sayT = 0; this.hud.say(null); }
            return;
        }
        const line = this.queue.shift();
        if (!line) return;
        this.hud.say(this.who, line);
        this.sayT = 1.6 + line.length * 0.055;
    }
}
