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
                <div><b>Hold still</b> on fire or wood · <b>drag empty</b> look</div>
            </div>
            <div class="hud-log" id="hud-log"></div>
            <div class="hud-debug" id="hud-debug"></div>
            <div class="hold-ring" id="hold-ring"></div>
            <div class="stick-base" id="stick-base"><div class="stick-knob" id="stick-knob"></div></div>`;
        this.el = id => root.querySelector('#' + id);
        this.setElement('earth');
        this.stick({ active: false });
        addEventListener('resize', () => { if (this.el('stick-base').style.opacity !== '1') this.stick({ active: false }); });
        this.fps = 60; this._acc = 0; this._frames = 0;

        EventBus.on(EV.OBJECT_THROWN, () => this.el('hud-hint').classList.add('gone'));
        EventBus.on(EV.STRUCTURE_STATE, e => {
            if (e.cause === 'rebuilt') { this._onFire.delete(e.id); this.log('Barricade · rebuilt'); return; }
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
            `barricade ${info.barricade.state} ${info.barricade.broken}/${info.barricade.total}` +
            (info.fire ? `\nfire ${info.fire.burning} burning · ${info.fire.burned} burned · particles ${info.fx.flame + info.fx.smoke}` : '');
    }
}
