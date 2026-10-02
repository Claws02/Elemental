// ============================================================
// STORY — runs a scene's script: steps, lines, reactions, the end card
// ============================================================
//
// A scene's `script` (docs/SCENES.md) is data, written in Elemental-Editor:
//
//   { id, speaker: 'Cael',                  the character who speaks the lines
//     face: 'Cael',                         the story opens looking at this
//     flags: { caelTrust: 0 },              saved flags this scene starts if unset
//     steps: [ step, … ],                   run in order unless a step says `next`
//     reactions: [ reaction, … ],           the speaker answers what the player does
//     card: { title, lines, buttons } }     shown when a step does { card: true }
//
//   step: { id, say: [lines], objective, mark: objId, do: [actions],
//           waiting: [{ when, say, do }],   each time `when` becomes true in the step
//           until: cond, then: { say, do, next, outcome },
//           ends: [{ when, say, do, next, outcome }] }   first that holds wins
//
// Conditions and actions are listed in src/scene/schema.js. A step whose
// objective contains {held} shows the heldFor timer and a progress bar.
//
// Card text can read the outcome, counters, levels and flags:
//   {outcome|quiet=…|loud=…}   {fireSeen|0=…|1=…|*=You did it # times}   {earth.power}
// ============================================================

import { THREE } from '../engine/lib.js';
import { Ground } from '../world/Ground.js';
import { EventBus, EV } from '../core/EventBus.js';
import { ELEMENT } from '../art/Palette.js';

const EVENTS = {
    playerFire:  [[EV.FIRE_STARTED, e => e.cause === 'player'], [EV.WILD_BURST, () => true]],
    tooHeavy:    [[EV.TOO_HEAVY, () => true]],
    playerBreak: [[EV.PIECE_BROKEN, e => e.cause === 'player']],
    playerThrow: [[EV.OBJECT_THROWN, () => true]],
    playerSurge: [[EV.SURGE, e => e.cause === 'surge']],
};

export class Story {
    /**
     * `hooks` connect the story to the game around it: { checkpoint(), travel(scene, at), ledger, session }.
     * `startStep` resumes at a step (coming back from a checkpoint).
     */
    constructor({ world, script, prog, channel, fire, hud, player, scene, hooks = {}, startStep = null }) {
        Object.assign(this, { world, script, prog, channel, fire, hud, player, hooks });
        this.id = script.id || world.data.id;
        this.steps = script.steps || [];
        this.speaker = script.speaker ? world.objects.get(script.speaker)?.npc || null : null;
        this.speakerName = this.speaker?.name || script.speaker || '';
        this.counters = {};
        this.outcome = null;
        this.queue = [];
        this.sayT = 0;
        this.time = 0;
        this.t = 0;
        this.heldT = 0;
        this.edges = new Map();
        this.step = null;
        this.marker = this._makeMarker(scene);
        for (const [k, v] of Object.entries(script.flags || {})) prog.flags[k] = prog.flags[k] ?? v;

        this.reactions = (script.reactions || []).map(r => ({ ...r, saidAt: -99, said: 0 }));
        this.off = [];
        for (const r of this.reactions) {
            for (const [type, ok] of EVENTS[r.on] || []) this.off.push(EventBus.on(type, e => { if (ok(e)) this._react(r); }));
        }
        EventBus.emit(EV.LESSON, { id: this.id, step: 'start' });
        // Resuming: at the checkpoint's step; a story already finished stays finished.
        const first = startStep === 'done' ? 'done' : startStep && this.steps.some(x => x.id === startStep) ? startStep : this.steps[0]?.id;
        if (first) this.go(first);
    }

    dispose() { this.off.forEach(f => f()); }

    // ---- dialogue ----------------------------------------------------------------

    say(lines) { this.queue.push(...(lines || [])); }

    _dialogue(dt) {
        if (this.sayT > 0) {
            this.sayT -= dt;
            if (this.sayT <= 0 || this.hud.skipLine) { this.hud.skipLine = false; this.sayT = 0; this.hud.say(null); }
            return;
        }
        let line = this.queue.shift();
        if (!line) return;
        // "@Bram It's harvest eve!" is Bram speaking; "@you …" the protagonist; otherwise the script's speaker.
        let who = this.speakerName;
        const m = /^@(\S+)\s+/.exec(line);
        if (m) {
            line = line.slice(m[0].length);
            who = m[1] === 'you' ? (this.hooks.session?.work.custom?.name || 'You') : (this.world.objects.get(m[1])?.item.name || m[1]);
        }
        line = this.fill(line);
        this.hud.say(who, line);
        this.sayT = 1.6 + line.length * 0.055;
    }

    // ---- choices: the step waits until the player picks ------------------------------------

    _offerChoices(s) {
        if (this.choosing || this.talking || !s.choices?.length) return;
        this.choosing = s;
        this.hud.choices?.(s.choices.map(c => this.fill(c.label)), i => this.choose(i));
    }

    /** Pick choice `i` of the current step (the HUD's buttons call this; so can a test). */
    choose(i) {
        const s = this.choosing;
        const c = s?.choices?.[i];
        if (!c) return;
        this.choosing = null;
        this.hud.choices?.(null);
        if (c.flag) this.prog.flags[c.flag.name] = c.flag.value ?? true;
        EventBus.emit(EV.LESSON, { id: this.id, step: this.step, choice: i, label: c.label });
        this.say(c.say);
        this.act(c.do);
        this.go(c.next || this._next(s));
    }

    get talking() { return this.sayT > 0 || this.queue.length > 0; }

    // ---- reactions -------------------------------------------------------------------

    _react(r) {
        if (r.count) this.counters[r.count] = (this.counters[r.count] || 0) + 1;
        if (r.flag) this.prog.flags[r.flag.name] = (this.prog.flags[r.flag.name] || 0) + r.flag.add;
        if (this.time - r.saidAt < (r.throttle ?? 0)) return;
        const lines = r.lines || [];
        if (!lines.length) return;
        r.saidAt = this.time;
        const n = r.count ? this.counters[r.count] : r.said + 1;
        const i = r.cycle ? r.said % lines.length : Math.min(lines.length - 1, n - 1);
        r.said++;
        this.say(lines[i]);
        const f = r.followUp;
        if (f && (!f.firstOnly || n === 1)) setTimeout(() => { if (!f.if || this.test(f.if)) this.say(f.say); }, (f.after || 0) * 1000);
    }

    // ---- conditions ---------------------------------------------------------------------

    /** Does condition `c` hold now? */
    test(c) {
        if (!c) return true;
        const [k, v] = Object.entries(c)[0] || [];
        const held = this.channel.held?.entry?.id || null;
        switch (k) {
        case 'talking': return this.talking === !!v;
        case 'time': return this.t >= v;
        case 'held': return v === '*' ? !!held : held === v;
        case 'heldFor': return this.heldT >= v.secs;
        case 'signal': return this.world.signal(v.obj, v.name);
        case 'wire': return this.world.wires.isLive(v);
        case 'broken': return (this.world.objects.get(v.obj)?.count?.('broken') || 0) >= (v.min ?? 1);
        case 'burned': return (this.world.objects.get(v.obj)?.count?.('burned') || 0) >= (v.min ?? 1);
        case 'burning': return (this.fire.burningCount() > 0) === !!v;
        case 'count': return (this.counters[v.name] || 0) >= (v.min ?? 1);
        case 'flag': { const f = this.prog.flags[v.name]; return v.is === undefined || v.is === '' ? !!f : String(f) === String(v.is); }
        case 'state': return String(this.hooks.session?.state(v.id) ?? '') === String(v.is ?? '');
        case 'ledger': return (this.hooks.ledger?.get(v.tally, v.region) || 0) >= (v.min ?? 1);
        case 'standing': return (this.hooks.ledger?.standing(v.region) ?? 2) >= (v.atLeast ?? 0);
        case 'many': {                 // how many objects whose names start with `prefix` give `signal`
            let n = 0;
            for (const [id, o] of this.world.objects) if (id.startsWith(v.prefix || '') && (!v.type || o.type === v.type) && this.world.signal(id, v.signal)) n++;
            return n >= (v.min ?? 0) && n <= (v.max ?? Infinity);
        }
        case 'all': return v.every(x => this.test(x));
        case 'any': return v.some(x => this.test(x));
        case 'not': return !this.test(v);
        }
        console.warn('[story] unknown condition', c);
        return false;
    }

    // ---- actions ------------------------------------------------------------------------

    /** Run one action, or a list. */
    act(a) {
        if (!a) return;
        if (Array.isArray(a)) { a.forEach(x => this.act(x)); return; }
        const [k, v] = Object.entries(a)[0] || [];
        switch (k) {
        case 'say': this.say(v); break;
        case 'do': this.world.act(v.obj, v.action); break;
        case 'reveal': [].concat(v).forEach(id => this.world.reveal(id)); break;
        case 'hide': [].concat(v).forEach(id => this.world.hide(id)); break;
        case 'grant': this.prog.grant(v.el, v.track, v.amount, `${this.id}:${this.step}`); break;
        case 'flag': this.prog.flags[v.name] = (this.prog.flags[v.name] || 0) + v.add; break;
        case 'count': this.counters[v.name] = (this.counters[v.name] || 0) + (v.add ?? 1); break;
        case 'saveFlag': this.prog.flags[v] = { outcome: this.outcome, ...this.counters }; this.prog._save(); this.hooks.checkpoint?.(); break;
        case 'card': if (v) this._card(); break;
        case 'checkpoint': if (v) this.hooks.checkpoint?.(); break;
        case 'travel': this.hooks.travel?.(v.scene, v.at || 'start'); break;
        case 'setFlag': this.prog.flags[v.name] = v.value === 'true' ? true : v.value === 'false' ? false : isNaN(+v.value) || v.value === '' ? v.value : +v.value; break;
        case 'setState': this.hooks.session?.setState(v.id, v.value || null); break;
        case 'ledger': this.hooks.ledger?.add(v.tally, v.add, v.region); break;
        case 'setElement': this.prog.setState(v.el, v.state); if (v.power !== undefined) this.prog.els[v.el].power = v.power; this.prog._save(); break;
        case 'mood': this.hooks.mood?.(v.name, v.secs ?? 0); break;
        case 'douseAll': this.hooks.douseAll?.(v); break;
        case 'hint': this.hud.hint?.(this.fill(String(v))); break;
        case 'npc': this.world.objects.get(v.id)?.npc?.setRole(v.role, v.target); break;
        case 'protect': this.hooks.protect?.(+v || 0); break;
        case 'flameSpill': this.hooks.flameSpill?.(v); break;
        case 'surge': this.hooks.surge?.(v.el, { cause: v.cause || 'awakening', target: v.target || null }); break;
        default: console.warn('[story] unknown action', a);
        }
    }

    // ---- steps -------------------------------------------------------------------------------

    get current() { return this.steps.find(s => s.id === this.step) || null; }

    go(id) {
        if (this.choosing) { this.choosing = null; this.hud.choices?.(null); }
        this.step = id || 'done';
        this.t = 0;
        this.heldT = 0;
        this.edges.clear();
        const s = this.current;
        this._objective(s);
        this._mark(null);
        EventBus.emit(EV.LESSON, { id: this.id, step: this.step });
        if (!s) return;
        this.say(s.say);
        this.act(s.do);
    }

    _next(s) {
        const i = this.steps.indexOf(s);
        return this.steps[i + 1]?.id || 'done';
    }

    _objective(s, progress = null) {
        if (!s?.objective) { this.hud.objective(null); return; }
        const hf = this._heldFor(s);
        const text = hf ? s.objective.replace('{held}', Math.min(hf.secs, this.heldT).toFixed(1)) : s.objective;
        this.hud.objective(text, hf ? Math.min(1, this.heldT / hf.secs) : progress);
    }

    _heldFor(s) {
        const find = c => {
            if (!c) return null;
            if (c.heldFor) return c.heldFor;
            for (const k of ['all', 'any']) if (c[k]) for (const x of c[k]) { const f = find(x); if (f) return f; }
            return null;
        };
        return find(s.until) || (s.ends || []).map(e => find(e.when)).find(Boolean) || null;
    }

    update(dt) {
        this.time += dt;
        this.t += dt;
        this._dialogue(dt);
        const s = this.current;
        if (!s) { this._mark(null); return; }
        this._mark(s.mark || null);

        // A held-steady timer: runs while the stone is in the hand; a drop
        // after a moment resets it ("Again. Slower.").
        const hf = this._heldFor(s);
        if (hf) {
            const held = this.channel.held?.entry?.id === hf.obj;
            if (held) this.heldT += dt;
            else if (this.heldT > 0.3) { this.heldT = 0; this.say(hf.lost); }
            this._objective(s);
        }

        (s.waiting || []).forEach((w, i) => {
            const now = this.test(w.when), was = this.edges.get(i) || false;
            this.edges.set(i, now);
            if (now && !was) { this.say(w.say); this.act(w.do); }
        });

        if (s.choices?.length) { this._offerChoices(s); return; }
        const ends = s.ends || (s.until ? [{ when: s.until, ...(s.then || {}) }] : []);
        for (const e of ends) {
            if (!this.test(e.when)) continue;
            if (e.outcome) {
                this.outcome = e.outcome;
                EventBus.emit(EV.LESSON, { id: this.id, step: 'done', outcome: e.outcome });
            }
            this.say(e.say);
            this.act(e.do);
            this.go(e.next || this._next(s));
            break;
        }
    }

    // ---- the marker: a ring of Earth light over what to use next ------------------------------

    _makeMarker(scene) {
        const m = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 28),
            new THREE.MeshBasicMaterial({ color: ELEMENT.earth.rune, transparent: true, opacity: 0.85 }));
        m.rotation.x = Math.PI / 2;
        m.visible = false;
        scene.add(m);
        return m;
    }

    _mark(id) {
        const inst = id && this.world.objects.get(id);
        if (!inst || inst.hidden) {
            this.marker.visible = false;
            if (this.speaker) this.speaker.point = null;
            return;
        }
        let x, z, top;
        const e = inst.entries[0];
        if (inst.top) {
            top = inst.top();
            const p = e && inst.type === 'rock' ? e.body.position : inst.item;
            x = p.x; z = p.z;
        } else {
            const b = new THREE.Box3().setFromObject(inst.mesh);
            if (b.isEmpty()) { x = inst.item.x; z = inst.item.z; top = Ground.height(x, z) + 2; }      // a zone, an exit: nothing drawn
            else { top = b.max.y; x = (b.min.x + b.max.x) / 2; z = (b.min.z + b.max.z) / 2; }
        }
        const y = top + 0.35;
        this.marker.visible = true;
        this.marker.position.set(x, y + Math.sin(this.time * 3) * 0.08, z);
        if (this.speaker) this.speaker.point = new THREE.Vector3(x, y, z);
    }

    // ---- the end card ---------------------------------------------------------------------------

    fill(text) {
        return text.replace(/\{([^{}]+)\}/g, (_, body) => {
            const [key, ...cases] = body.split('|');
            let val;
            if (key === 'outcome') val = this.outcome;
            else if (key === 'name') val = this.hooks.session?.work.custom?.name || 'you';
            else if (/^(earth|fire|water|air)\.(power|control)$/.test(key)) { const [el, tr] = key.split('.'); val = this.prog.level(el, tr); }
            else if (/^(earth|fire|water|air)\.state$/.test(key)) val = this.prog.state(key.split('.')[0]);
            else if (key in this.counters) val = this.counters[key];
            else if (key in this.prog.flags) val = this.prog.flags[key];
            else val = 0;
            if (!cases.length) return String(val);
            const map = cases.map(c => c.split('=')).map(([k, ...r]) => [k, r.join('=')]);
            const hit = map.find(([k]) => k === String(val)) || map.find(([k]) => k === '*');
            return hit ? hit[1].replace(/#/g, String(val)) : '';
        });
    }

    _card() {
        const c = this.script.card;
        if (!c) return;
        this.hud.card({
            title: this.fill(c.title || ''),
            lines: (c.lines || []).map(l => this.fill(l)).filter(Boolean),
            // { label, travel: { scene, at } }: the story goes on in another scene.
            buttons: (c.buttons || []).map(b => b.travel ? { ...b, href: '#', go: () => this.hooks.travel?.(b.travel.scene, b.travel.at || 'start') } : b),
        });
    }
}
