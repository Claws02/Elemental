// ============================================================
// HUD — as little as possible (§36: "avoid a giant HUD")
// ============================================================
//
//   - the floating move stick, drawn where the thumb lands
//   - the element acting now, as its rune colour. Context picks it
//     (docs/CONTEXT_CONTROLS.md); the badge only reports it
//   - the hold ring: fills at the finger while a hold-still verb charges
//   - a one-time hint, gone after the first throw
//   - a quiet line when the world records something (the destruction log is
//     the seed of consequence, so the prototype shows it)
//   - a debug readout (fps, draw calls, triangles, physics), on in Phase 1
// ============================================================

import { THREE } from '../engine/lib.js';
import { EventBus, EV } from '../core/EventBus.js';
import { ELEMENT } from '../art/Palette.js';

export class Hud {
    constructor(root) {
        this.root = root;
        root.innerHTML = `
            <div class="hud-element" id="hud-element"><span class="rune"></span><span class="label"></span></div>
            <div class="hud-health" id="hud-health" role="meter" aria-label="Health" aria-valuemin="0" aria-valuemax="100"><i></i></div>
            <div class="hud-hint" id="hud-hint">
                <div><b>Bottom-left thumb</b> move</div>
                <div><b>Touch a rock</b> grab · <b>flick</b> throw</div>
                <div><b>Hold still</b> on fire or wood · <b>touch water</b> stream</div>
            </div>
            <div class="hud-log" id="hud-log"></div>
            <div class="hud-debug" id="hud-debug"></div>
            <div class="hud-compass" id="hud-compass" aria-hidden="true"><div class="ticks"></div><div class="mark"><i></i><span></span></div><div class="centre"></div></div>
            <div class="hud-objective" id="hud-objective"><span class="text"></span><span class="bar"><i></i></span></div>
            <div class="hud-say" id="hud-say"><b class="who"></b><span class="line"></span></div>
            <div class="hud-card" id="hud-card"></div>
            <div class="hold-ring" id="hold-ring"></div>
            <div class="stick-base" id="stick-base"><div class="stick-knob" id="stick-knob"></div></div>
            <div class="hud-choices" id="hud-choices"></div>
            <div class="hud-tip" id="hud-tip"></div>
            <button class="hud-charm" id="hud-charm" type="button" aria-label="Cael's charm"></button>
            <button class="hud-jump" id="hud-jump" type="button" aria-label="Jump"><svg viewBox="0 0 24 24"><path d="M12 5l-6 7h4v6h4v-6h4z"/></svg></button>
            <div class="hud-vignette" id="hud-vignette"></div>
            <div class="hud-died" id="hud-died"><span></span></div>`;
        this.el = id => root.querySelector('#' + id);
        this.setElement('earth');
        this.stick({ active: false });
        this._onResize = () => { if (this.el('stick-base').style.opacity !== '1') this.stick({ active: false }); };
        addEventListener('resize', this._onResize);
        this.onLink = null;          // set to catch the card's buttons instead of following them (the editor's Play mode)
        this.fps = 60; this._acc = 0; this._frames = 0;
        this.skipLine = false;
        EventBus.on(EV.SURGE, e => {
            if (e.cause !== 'surge') return;
            const what = { fire: 'Fire', earth: 'Earth', water: 'Water', air: 'Air' }[e.el];
            this.log(`${what} · it got away from you${e.hurt.length ? ' · someone was hurt' : ''}`);
        });
        this.el('hud-say').addEventListener('pointerdown', e => { e.stopPropagation(); this.skipLine = true; });
        EventBus.on(EV.GROWTH, e => {
            const name = { earth: 'Earth', fire: 'Fire', water: 'Water', air: 'Air' }[e.el];
            this.log(`${name} · ${e.track === 'power' ? 'Power' : 'Control'} ${e.level}`);
        });

        EventBus.on(EV.OBJECT_THROWN, () => this.el('hud-hint').classList.add('gone'));
        EventBus.on(EV.CHECKPOINT, () => { if (this._shown) this.log('Checkpoint'); this._shown = true; });
        EventBus.on(EV.STRUCTURE_STATE, e => {
            if (/_W\d$/.test(e.id)) return;             // one wall of a building: the building speaks for itself
            if (e.cause === 'rebuilt') { this._onFire.delete(e.id); this.log(`${e.id.includes('Props') ? 'Obstacles' : 'Barricade'} · reset`); return; }
            const who = e.cause === 'player' ? 'by you' : '';
            this.log(`${e.name || 'Barricade'} · ${e.to} ${who}`.trim());
        });
        // Fire is logged once per structure it takes hold of, not per plank.
        this._onFire = new Set();
        EventBus.on(EV.FIRE_STARTED, e => {
            const key = e.id.replace(/(_W\d+)?(_P\d+|_R\d+)$/, '');
            if (key === e.id || this._onFire.has(key)) return;
            this._onFire.add(key);
            const what = key.includes('Barricade') ? 'Barricade' : key.replace(/_\d+$/, '').replace(/^.*_/, '');
            this.log(`${what} · on fire${e.cause === 'player' ? ' by you' : ''}`);
        });
    }

    setElement(key) {
        if (this._element === key) return;
        this._element = key;
        const e = ELEMENT[key];
        const box = this.el('hud-element');
        box.style.setProperty('--rune', '#' + new THREE.Color(e.rune).getHexString());
        box.querySelector('.label').textContent = e.name;
    }

    stick(s) {
        const base = this.el('stick-base'), knob = this.el('stick-knob');
        // At rest the stick waits, faint, in the move zone's corner, so the
        // player can see where moving lives.
        if (!s.active) {
            base.style.opacity = 0.35;
            base.style.left = '96px';
            base.style.top = (innerHeight - 110) + 'px';
            knob.style.transform = 'translate(0, 0)';
            return;
        }
        base.style.opacity = 1;
        base.style.left = s.ox + 'px';
        base.style.top = s.oy + 'px';
        knob.style.transform = `translate(${s.x * 60}px, ${-s.y * 60}px)`;
    }

    /** The hold ring at the finger: { x, y, progress, element } or null. */
    ring(r) {
        const el = this.el('hold-ring');
        if (!r) { el.style.opacity = 0; return; }
        const col = '#' + new THREE.Color(ELEMENT[r.element].rune).getHexString();
        el.style.opacity = 1;
        el.style.left = r.x + 'px';
        el.style.top = r.y + 'px';
        el.style.background = `conic-gradient(${col} ${r.progress * 360}deg, rgba(20,16,12,.25) 0)`;
        el.classList.toggle('full', r.progress >= 1);
    }

    /** Hide the free-play hint (a lesson has its own objectives). */
    story() { this.el('hud-hint').classList.add('gone'); }

    /** A subtitle: who is speaking, and the line. `null` clears it. */
    say(who, line) {
        const el = this.el('hud-say');
        if (!who) { el.classList.remove('on'); return; }
        el.querySelector('.who').textContent = who;
        el.querySelector('.line').textContent = line;
        el.classList.add('on');
    }

    /**
     * The compass strip: the half of the horizon you face (`heading`, radians clockwise from north), its letters
     * sliding as you turn; and the objective, a diamond at its bearing with how far it is (pinned to an edge,
     * pointing, when it's behind you). `mark` = { bearing, dist } or null.
     */
    compass(heading, mark = null) {
        const el = this.el('hud-compass');
        if (!this._ticks) {
            const box = el.querySelector('.ticks');
            this._ticks = [];
            for (let d = 0; d < 360; d += 15) {
                const t = document.createElement('b'), name = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 45: 'NE', 135: 'SE', 225: 'SW', 315: 'NW' }[d];
                t.className = name ? (name.length === 1 ? 'card' : 'inter') : 'tick';
                t.textContent = name || '';
                box.appendChild(t);
                this._ticks.push({ t, a: d * Math.PI / 180 });
            }
        }
        const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), HALF = Math.PI / 2;
        const h = Math.round(heading * 180 / Math.PI), m = mark ? `${Math.round(mark.bearing * 90)}:${Math.round(mark.dist)}` : '-';
        if (h === this._h && m === this._m) return;
        this._h = h; this._m = m;
        for (const { t, a } of this._ticks) {
            const r = wrap(a - heading);
            t.style.display = Math.abs(r) > HALF ? 'none' : '';
            t.style.left = (50 + r / HALF * 50).toFixed(2) + '%';
        }
        const mk = el.querySelector('.mark');
        mk.style.display = mark ? '' : 'none';
        if (!mark) return;
        const r = wrap(mark.bearing - heading), edge = Math.abs(r) > HALF;
        mk.style.left = (50 + Math.max(-1, Math.min(1, r / HALF)) * 50).toFixed(2) + '%';
        mk.classList.toggle('behind', edge);
        mk.classList.toggle('left', edge && r < 0);
        mk.querySelector('span').textContent = mark.dist < 1000 ? `${Math.round(mark.dist)} m` : '';
    }

    /** The current objective, with an optional 0..1 progress bar. `null` clears it. */
    objective(text, progress = null) {
        const el = this.el('hud-objective');
        el.classList.toggle('on', !!text);
        if (!text) return;
        el.querySelector('.text').textContent = text;
        el.querySelector('.bar').style.display = progress === null ? 'none' : '';
        if (progress !== null) el.querySelector('.bar i').style.width = (progress * 100).toFixed(0) + '%';
    }

    /** The end-of-lesson card. */
    card({ title, lines, buttons }) {
        const el = this.el('hud-card');
        el.innerHTML = `<h2></h2>${lines.map(() => '<p></p>').join('')}<div class="btns">${buttons.map(() => '<a></a>').join('')}</div>`;
        el.querySelector('h2').textContent = title;
        el.querySelectorAll('p').forEach((p, i) => { p.textContent = lines[i]; });
        el.querySelectorAll('a').forEach((a, i) => {
            a.textContent = buttons[i].label;
            a.href = buttons[i].href;
            a.addEventListener('click', e => {
                if (buttons[i].go) { e.preventDefault(); this.el('hud-card').classList.remove('on'); buttons[i].go(); return; }      // a road on into the world
                if (this.onLink) { e.preventDefault(); this.onLink(buttons[i].href); }
            });
        });
        el.classList.add('on');
    }

    /** A choice: short replies as buttons; `null` clears them. */
    choices(labels, pick) {
        const el = this.el('hud-choices');
        el.replaceChildren();
        el.classList.toggle('on', !!labels);
        if (!labels) return;
        labels.forEach((l, i) => {
            const b = document.createElement('button');
            b.textContent = l;
            b.addEventListener('pointerdown', e => { e.stopPropagation(); pick(i); });
            el.append(b);
        });
    }

    /** Cael's charm, in your pocket: a small button while it can still be put on. `null` hides it. */
    /** The jump button (bottom-right): pressing it jumps. Fires on the touch going down, not up, so it feels immediate. */
    jump(onJump) {
        const el = this.el('hud-jump');
        el.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); onJump(); };
        el.onpointerup = el.onpointercancel = el.onpointerleave = () => el.classList.remove('down');
    }

    charm(onWear) {
        const el = this.el('hud-charm');
        el.classList.toggle('on', !!onWear);
        el.onpointerdown = onWear ? e => { e.stopPropagation(); onWear(); } : null;
    }

    /** A one-line tip for a few seconds (the prologue teaching a gesture). */
    hint(text) {
        const el = this.el('hud-tip');
        el.textContent = text;
        el.classList.add('on');
        clearTimeout(this._tipT);
        this._tipT = setTimeout(() => el.classList.remove('on'), 6000);
    }

    /** The health bar: 0..1. Flashes when it drops. */
    health(frac) {
        const f = Math.max(0, Math.min(1, frac));
        if (Math.abs(f - (this._hp ?? -1)) < 0.002) return;
        const el = this.el('hud-health');
        if (this._hp !== undefined && f < this._hp - 0.001) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
        this._hp = f;
        el.querySelector('i').style.width = (f * 100).toFixed(1) + '%';
        el.classList.toggle('low', f < 0.3);
        el.setAttribute('aria-valuenow', String(Math.round(f * 100)));
    }

    /** Health, shown only as the screen's edges reddening: 0 well … 1 nearly gone. */
    vitals(danger) {
        const v = Math.max(0, Math.min(1, (danger - 0.25) / 0.75));
        if (Math.abs(v - (this._danger ?? -1)) < 0.01) return;
        this._danger = v;
        this.el('hud-vignette').style.opacity = v.toFixed(2);
    }

    /** The screen goes dark before the checkpoint comes back. */
    died(cause) {
        const words = { fire: 'The fire took you.', fall: 'You fell.', fell: 'You fell.', blast: 'The blast took you.', 'wild-fire': 'Your own fire took you.', lava: 'The lava took you.' };
        const el = this.el('hud-died');
        el.querySelector('span').textContent = words[cause] || 'You fell.';
        el.classList.add('on');
    }

    dispose() { removeEventListener('resize', this._onResize); this.root.innerHTML = ''; }

    log(text) {
        const line = document.createElement('div');
        line.textContent = text;
        const log = this.el('hud-log');
        log.appendChild(line);
        setTimeout(() => line.classList.add('fade'), 2600);
        setTimeout(() => line.remove(), 3400);
        while (log.children.length > 3) log.firstChild.remove();
    }

    update(dt, info) {
        this._acc += dt; this._frames++;
        if (this._acc >= 0.5) { this.fps = this._frames / this._acc; this._acc = 0; this._frames = 0; }
        else return;
        const p = info.physics;
        this.el('hud-debug').textContent =
            `${this.fps.toFixed(0)} fps · ${info.calls} calls · ${(info.tris / 1000).toFixed(1)}k tris\n` +
            (info.perf ? `${info.perf.frame.toFixed(1)} ms: logic ${info.perf.update.toFixed(1)} · physics ${info.perf.physics.toFixed(1)} · draw ${info.perf.render.toFixed(1)} · ${info.ratio}× q${info.level}\n` : '') +
            `bodies ${p.total} · awake ${p.awake} · debris ${p.debris}\n` +
            (info.barricade ? `barricade ${info.barricade.state} ${info.barricade.broken}/${info.barricade.total}` : 'no barricade') +
            (info.fire ? `\nfire ${info.fire.burning} burning · ${info.fire.burned} burned · particles ${info.fx.flame + info.fx.smoke}` : '');
    }
}
