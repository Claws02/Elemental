// ============================================================
// LESSON I — "The Quiet Element" (Cael's first lesson)
// ============================================================
//
// The morning after Veyra. Fire woke in the player there, and it was too much
// to hold; so Cael starts them on Earth, the element that doesn't rush.
// Fire is still in them, WILD (data/growth.js): usable, and dangerous. Cael
// notices every time they reach for it.
//
//   1  LIFT      "That stone. Lift it."                 (the marked stone; only three
//                                                        stones are out, and the other two
//                                                        are too heavy: Cael says so)
//   2  STEADY    hold it for 3 s while it sways         Earth Control +
//   3  SET DOWN  onto the plate, at eye level on its     Earth Control +
//                pedestal, gently: let go within 0.6 m
//                of the surface, not thrown
//      (the rest of the courtyard's stones rise from the ground)
//   4  TRIAL     the sealed passage. Two ways through:
//                  quiet  stones on both counterweight plates (raised,
//                         like the first) lift the
//                         barricade; nothing broken      Earth Control ++
//                  loud   break it (or burn it) open     Power, from the breaking;
//                                                        Cael's trust falls
//   5  CLOSE     Cael's words depend on how; then the lesson card
//
// Both ways pass (agreed): the game shows, it doesn't tell. The world and
// Cael simply remember which it was.
//
// Words are data at the top of the file, not woven into the logic.
// ============================================================

import { THREE } from '../engine/lib.js';
import { EventBus, EV } from '../core/EventBus.js';
import { ELEMENT } from '../art/Palette.js';
import { Plate } from '../world/Plates.js';
import { Cael } from './Cael.js';
import { STATE } from '../world/Destructible.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';

const LINES = {
    intro: [
        'So. The fire in Veyra. That was you.',
        'Fire is the loudest thing in you. We are not starting there.',
        "Earth. It doesn't rush. Neither will you.",
        'That stone. Lift it.',
    ],
    lifted: ["Good. Now hold it. Don't fight it. Feel where it wants to fall."],
    droppedEarly: ['Again. Slower.'],
    steady: ['Steadier.', 'Now set it down on the plate. Set it. Don’t drop it.'],
    slammed: ['That was a drop. Pick it up. Again.'],
    placed: ['There.', 'Stone remembers how it was treated. So do people.'],
    trial: [
        'The passage is sealed. You could break it. You probably want to.',
        "There's a way through that leaves it standing. Find it.",
    ],
    quiet: [
        "It's still standing.",
        'You opened a door without breaking it. Most Wielders never learn that.',
    ],
    loud: [
        "It's open. So is everything else, now.",
        "Power isn't the hard part. You'll find that out.",
    ],
    burned: [
        'I said we were not starting with fire.',
        "Look at it. That's what untrained fire does. It doesn't open things. It ends them.",
    ],
    close: ['Rest. Tomorrow, we do it again.'],
    tooHeavy: ["Too heavy. You're not ready for that one.", 'Not that one. It is beyond you, for now.'],
    reveal: ['More stones. Some you can lift. Some you can’t, yet.'],
    fire1: ['Put it out.'],
    fire2: ["You can't, can you. That's why we don't start there."],
    fireAgain: ['Fire again.', 'Every time you reach for that, something burns that didn’t have to.', 'Stop.'],
};

// Where things stand in the courtyard (see TestRoom's plan).
const PLACES = {
    cael: new THREE.Vector3(-0.4, 0, 2.6),     // ahead of the spawn: the story opens on him, the stones between
    plateA: new THREE.Vector3(-2.2, 0, 5.4),
    weightL: new THREE.Vector3(-5.3, 0, -14.3),
    weightR: new THREE.Vector3(5.3, 0, -14.3),
    stoneA: 1,          // index into room.rocks: a small stone near the spawn
    // The first test has three stones out: the small one, and two too heavy
    // to lift yet, moved beside it. The rest rise after the test.
    heavy: [[2, new THREE.Vector3(1.3, 0, 3.0)], [5, new THREE.Vector3(4.6, 0, 3.2)]],
    plateHeight: 1.5,   // eye level: setting a stone on it takes aim
};

export class Lesson1 {
    constructor({ scene, room, prog, channel, fire, hud, player }) {
        Object.assign(this, { scene, room, prog, channel, fire, hud, player });
        this.cael = new Cael(scene, PLACES.cael, Math.PI);
        const height = PLACES.plateHeight;
        this.plateA = new Plate(scene, { id: 'Lesson1_Plate', pos: PLACES.plateA, height });
        const post = x => new THREE.Vector3(x, 3.1, -16.2);
        this.weights = [
            new Plate(scene, { id: 'Lesson1_WeightL', pos: PLACES.weightL, height, chainTo: post(-3.15) }),
            new Plate(scene, { id: 'Lesson1_WeightR', pos: PLACES.weightR, height, chainTo: post(3.15) }),
        ];
        this.stoneA = room.rocks[PLACES.stoneA];
        this._firstThree();
        this.rising = [];
        this.heavySaidAt = -99;
        this.heavyN = 0;
        this.marker = this._makeMarker(scene);
        this.step = 'intro';
        this.t = 0;
        this.steadyT = 0;
        this.outcome = null;
        this.fireSeen = 0;
        this.fireSaidAt = -99;
        this.time = 0;
        this.queue = [];
        this.sayT = 0;
        prog.flags.caelTrust = prog.flags.caelTrust ?? 0;

        this.off = [
            EventBus.on(EV.FIRE_STARTED, e => { if (e.cause === 'player') this._onPlayerFire(); }),
            EventBus.on(EV.WILD_BURST, () => this._onPlayerFire()),
            EventBus.on(EV.TOO_HEAVY, () => this._onTooHeavy()),
        ];
        this._say(LINES.intro);
        this._objective(null);
        EventBus.emit(EV.LESSON, { id: 'Lesson1', step: 'start' });
    }

    // ---- dialogue ----------------------------------------------------------

    _say(lines) { this.queue.push(...lines); }

    // One line at a time, long enough to read (tap the line to skip it).
    _dialogue(dt) {
        if (this.sayT > 0) {
            this.sayT -= dt;
            if (this.sayT <= 0 || this.hud.skipLine) { this.hud.skipLine = false; this.sayT = 0; this.hud.say(null); }
            return;
        }
        const line = this.queue.shift();
        if (!line) return;
        this.hud.say('Cael', line);
        this.sayT = 1.6 + line.length * 0.055;
    }

    get talking() { return this.sayT > 0 || this.queue.length > 0; }

    _objective(text, progress = null) { this.hud.objective(text, progress); }

    // ---- Cael watches the fire ------------------------------------------

    _onPlayerFire() {
        this.fireSeen++;
        this.prog.flags.caelTrust -= 1;
        if (this.time - this.fireSaidAt < 12) return;
        this.fireSaidAt = this.time;
        if (this.fireSeen === 1) {
            this._say(LINES.fire1);
            // If they can't put it out (they can't: wild Fire can't be taken back), he says so.
            setTimeout(() => { if (this.fire.burningCount() > 0) this._say(LINES.fire2); }, 4000);
        } else {
            this._say([LINES.fireAgain[Math.min(LINES.fireAgain.length - 1, this.fireSeen - 2)]]);
        }
    }

    _onTooHeavy() {
        if (this.time - this.heavySaidAt < 6) return;
        this.heavySaidAt = this.time;
        this._say([LINES.tooHeavy[this.heavyN++ % LINES.tooHeavy.length]]);
    }

    // ---- the stones: three for the first test, the rest after ---------------

    _firstThree() {
        const rocks = this.room.rocks;
        const keep = new Set([PLACES.stoneA, ...PLACES.heavy.map(([i]) => i)]);
        for (const [i, p] of PLACES.heavy) {
            const e = rocks[i];
            const pos = p.clone().setY(e.data.radius);
            Physics.restore(e, pos, e.body.quaternion, TIER.INTERACTIVE, e.body.mass);
            e.spawn = { p: e.body.position.clone(), q: e.body.quaternion.clone() };
        }
        this.hidden = rocks.filter((e, i) => !keep.has(i));
        for (const e of this.hidden) Physics.remove(e);
    }

    // The rest of the stones rise out of the ground where they lie.
    _reveal() {
        for (const e of this.hidden) {
            const r = e.data.radius, to = e.spawn.p.clone();
            this.scene.add(e.mesh);
            e.mesh.position.set(to.x, to.y - 2 * r - 0.1, to.z);
            this.rising.push({ e, to, from: e.mesh.position.y, t: 0 });
        }
        this.hidden = [];
    }

    _rise(dt) {
        for (const s of this.rising) {
            s.t = Math.min(1, s.t + dt / 1.2);
            const k = 1 - (1 - s.t) ** 3;
            s.e.mesh.position.y = s.from + (s.to.y - s.from) * k;
            if (s.t >= 1) Physics.restore(s.e, s.to, s.e.body.quaternion, TIER.INTERACTIVE, s.e.body.mass);
        }
        this.rising = this.rising.filter(s => s.t < 1);
    }

    // ---- the marker: a ring of Earth light over what to use next -----------

    _makeMarker(scene) {
        const m = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 28),
            new THREE.MeshBasicMaterial({ color: ELEMENT.earth.rune, transparent: true, opacity: 0.85 }));
        m.rotation.x = Math.PI / 2;
        m.visible = false;
        scene.add(m);
        return m;
    }

    _mark(pos, y = 0.2) {
        if (!pos) { this.marker.visible = false; this.cael.point = null; return; }
        this.marker.visible = true;
        this.marker.position.set(pos.x, y + Math.sin(this.time * 3) * 0.08, pos.z);
        this.cael.point = new THREE.Vector3(pos.x, y, pos.z);
    }

    // ---- per frame ---------------------------------------------------------

    update(dt) {
        this.time += dt;
        this.t += dt;
        const held = this.channel.held?.entry || null;
        this.plateA.update(dt, this.room.rocks, held);
        for (const w of this.weights) w.update(dt, this.room.rocks, held);
        this.cael.update(dt, this.player.position);
        this._dialogue(dt);
        this._rise(dt);
        const sp = this.stoneA.mesh.position;

        switch (this.step) {
        case 'intro':
            if (this.queue.length <= 1) this._mark(sp, sp.y + 0.9);
            if (!this.talking) this._go('lift');
            break;
        case 'lift':
            this._mark(sp, sp.y + 0.9);
            if (held === this.stoneA) { this._say(LINES.lifted); this._go('steady'); }
            break;
        case 'steady': {
            this._mark(null);
            if (held === this.stoneA) this.steadyT += dt;
            else if (this.steadyT > 0.3) { this.steadyT = 0; this._say(LINES.droppedEarly); }
            this._objective(`Hold it steady · ${Math.min(3, this.steadyT).toFixed(1)} / 3 s`, Math.min(1, this.steadyT / 3));
            if (this.steadyT >= 3) {
                this.prog.grant('earth', 'control', 0.15, 'lesson1:steady');
                this._say(LINES.steady);
                this._go('place');
            }
            break;
        }
        case 'place':
            this._mark(this.plateA.pos, this.plateA.top + 0.35);
            this.plateA.hint = true;
            if (this.plateA.weighted === this.stoneA) {
                if (this.plateA.gentle) {
                    this.plateA.hint = false;
                    this.prog.grant('earth', 'control', 0.15, 'lesson1:place');
                    this._say(LINES.placed);
                    this._say(LINES.reveal);
                    this._reveal();
                    this._go('trialIntro');
                } else if (!this._slamSaid) {
                    this._slamSaid = true;
                    this._say(LINES.slammed);
                }
            } else {
                this._slamSaid = false;
            }
            break;
        case 'trialIntro':
            this._mark(null);
            if (!this.talking) { this._say(LINES.trial); this._go('trial'); }
            break;
        case 'trial': {
            for (const w of this.weights) w.hint = this.t > 20;     // a nudge, if they're stuck
            const b = this.room.barricade;
            if (this.weights.every(w => w.weighted) && !b.raised && !b.raising) b.raise();
            const brokenOpen = [STATE.CRITICAL, STATE.COLLAPSED, STATE.BURNED].includes(b.state);
            if (b.raised || brokenOpen) {
                const s = b.summary();
                this.outcome = s.burned > 0 || (brokenOpen && b.state === STATE.BURNED) ? 'burned' : s.broken > 0 ? 'loud' : 'quiet';
                if (this.outcome === 'quiet') { this.prog.grant('earth', 'control', 0.3, 'lesson1:quiet'); this.prog.flags.caelTrust += 2; }
                else this.prog.flags.caelTrust -= 1;
                this.prog.flags.lesson1 = { outcome: this.outcome, fireSeen: this.fireSeen };
                this.prog._save();
                this._say(LINES[this.outcome]);
                this._say(LINES.close);
                EventBus.emit(EV.LESSON, { id: 'Lesson1', step: 'done', outcome: this.outcome });
                this._go('close');
            }
            break;
        }
        case 'close':
            for (const w of this.weights) w.hint = false;
            if (!this.talking) { this._card(); this._go('done'); }
            break;
        }
    }

    _go(step) {
        this.step = step;
        this.t = 0;
        this._objective({
            lift: 'Lift the marked stone',
            place: 'Set it down on the plate',
            trial: 'Open the sealed passage',
        }[step] ?? null);
        EventBus.emit(EV.LESSON, { id: 'Lesson1', step });
    }

    _card() {
        const p = this.prog;
        const how = { quiet: 'You opened it without breaking it.', loud: 'You broke it open.', burned: 'You burned it open.' }[this.outcome];
        this.hud.card({
            title: 'Lesson I · The Quiet Element',
            lines: [
                how,
                `Earth · Power ${p.level('earth', 'power')} · Control ${p.level('earth', 'control')}`,
                `Fire · wild · Power ${p.level('fire', 'power')}`,
                this.fireSeen ? `You reached for fire ${this.fireSeen === 1 ? 'once' : this.fireSeen + ' times'}. Cael noticed.` : 'You left the fire alone.',
            ],
            buttons: [
                { label: 'Again', href: '?scene=lesson' },
                { label: 'Sandbox', href: '?scene=sandbox' },
            ],
        });
    }
}
