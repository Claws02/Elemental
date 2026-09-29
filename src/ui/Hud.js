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
            <div class="hud-hint" id="hud-hint">
                <div><b>Bottom-left thumb</b> move</div>
                <div><b>Touch a rock</b> grab · <b>flick</b> throw</div>
                <div><b>Hold still</b> on fire or wood · <b>touch water</b> stream</div>
            </div>
            <div class="hud-log" id="hud-log"></div>
            <div class="hud-debug" id="hud-debug"></div>
            <div class="hud-objective" id="hud-objective"><span class="text"></span><span class="bar"><i></i></span></div>
            <div class="hud-say" id="hud-say"><b class="who"></b><span class="line"></span></div>
            <div class="hud-card" id="hud-card"></div>
            <div class="hold-ring" id="hold-ring"></div>
            <div class="stick-base" id="stick-base"><div class="stick-knob" id="stick-knob"></div></div>`;
        this.el = id => root.querySelector('#' + id);
        this.setElement('earth');
        this.stick({ active: false });
        this._onResize = () => { if (this.el('stick-base').style.opacity !== '1') this.stick({ active: false }); };
        addEventListener('resize', this._onResize);
        this.onLink = null;          // set to catch the card's buttons instead of following them (the editor's Play mode)
        this.fps = 60; this._acc = 0; this._frames = 0;
        this.skipLine = false;
        this.el('hud-say').addEventListener('pointerdown', e => { e.stopPropagation(); this.skipLine = true; });
        EventBus.on(EV.GROWTH, e => {
            const name = { earth: 'Earth', fire: 'Fire', water: 'Water', air: 'Air' }[e.el];
            this.log(`${name} · ${e.track === 'power' ? 'Power' : 'Control'} ${e.level}`);
        });

        EventBus.on(EV.OBJECT_THROWN, () => this.el('hud-hint').classList.add('gone'));
        EventBus.on(EV.STRUCTURE_STATE, e => {
            if (e.cause === 'rebuilt') { this._onFire.delete(e.id); this.log(`${e.id.includes('Props') ? 'Obstacles' : 'Barricade'} · reset`); return; }
            const who = e.cause === 'player' ? 'by you' : '';
            this.log(`Barricade · ${e.to} ${who}`.trim());
        });
        // Fire is logged once per structure it takes hold of, not per plank.
        this._onFire = new Set();
        EventBus.on(EV.FIRE_STARTED, e => {
            const key = e.id.replace(/_P\d+$/, '');
            if (key === e.id || this._onFire.has(key)) return;
            this._onFire.add(key);
            this.log(`Barricade · on fire${e.cause === 'player' ? ' by you' : ''}`);
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
            a.addEventListener('click', e => { if (this.onLink) { e.preventDefault(); this.onLink(buttons[i].href); } });
        });
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
            `bodies ${p.total} · awake ${p.awake} · debris ${p.debris}\n` +
            (info.barricade ? `barricade ${info.barricade.state} ${info.barricade.broken}/${info.barricade.total}` : 'no barricade') +
            (info.fire ? `\nfire ${info.fire.burning} burning · ${info.fire.burned} burned · particles ${info.fx.flame + info.fx.smoke}` : '');
    }
}
