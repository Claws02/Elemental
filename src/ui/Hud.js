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
import { WHAT } from '../data/growth.js';

export class Hud {
    constructor(root) {
        this.root = root;
        root.innerHTML = `
            <div class="hud-element" id="hud-element"><span class="rune"></span><span class="label"></span></div>
            <div class="hud-health" id="hud-health" role="meter" aria-label="Health" aria-valuemin="0" aria-valuemax="100"><i></i></div>
            <div class="hud-rings" id="hud-rings" aria-label="Your elements"></div>
            <div class="hud-levelup" id="hud-levelup" role="status"><b></b><span></span></div>
            <div class="hud-hint" id="hud-hint">
                <div><b>Bottom-left thumb</b> move</div>
                <div><b>Touch a rock</b> grab · <b>flick</b> throw</div>
                <div><b>Hold still</b> on fire or wood · <b>touch water</b> stream</div>
            </div>
            <div class="hud-log" id="hud-log"></div>
            <div class="hud-debug" id="hud-debug"></div>
            <div class="hud-compass" id="hud-compass" aria-hidden="true"><div class="ticks"></div><div class="mark"><i></i><span></span></div><div class="centre"></div></div>
            <div class="hud-gauge" id="hud-gauge" aria-hidden="true"><span class="label"></span><div class="track"><div class="band"></div><div class="fill"></div><div class="needle"></div></div><div class="hold"><i></i></div></div>
            <div class="hud-objective" id="hud-objective"><span class="text"></span><span class="bar"><i></i></span></div>
            <div class="hud-say" id="hud-say"><b class="who"></b><span class="line"></span></div>
            <div class="hud-card" id="hud-card"></div>
            <div class="hold-ring" id="hold-ring"></div>
            <div class="stick-base" id="stick-base"><div class="stick-knob" id="stick-knob"></div></div>
            <div class="hud-choices" id="hud-choices"></div>
            <div class="hud-tip" id="hud-tip"></div>
            <button class="hud-charm" id="hud-charm" type="button" aria-label="Cael's charm"></button>
            <button class="hud-gear" id="hud-gear" type="button" aria-label="Settings and pause"><svg viewBox="0 0 24 24"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg></button>
            <div class="hud-menu" id="hud-menu" role="dialog" aria-label="Paused"><div class="panel"><h2>Paused</h2><div class="items"></div></div></div>
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
        // A level gained: a banner says what it is and what it does (data/growth.js WHAT). Game slows time a beat.
        EventBus.on(EV.GROWTH, e => {
            const name = { earth: 'Earth', fire: 'Fire', water: 'Water', air: 'Air' }[e.el];
            const el = this.el('hud-levelup');
            el.style.setProperty('--rune', '#' + ELEMENT[e.el].rune.toString(16).padStart(6, '0'));
            el.querySelector('b').textContent = `${name} · ${e.track === 'power' ? 'Power' : 'Control'} ${e.level}`;
            el.querySelector('span').textContent = WHAT[e.el]?.[e.track] || '';
            el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
            clearTimeout(this._levelT); this._levelT = setTimeout(() => el.classList.remove('on'), 4200);
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
    /** A gauge (the forge's heat): { label, value, lo, hi, progress } or null. The band is where to hold it; `progress`, how long it's been held there. */
    gauge(g) {
        const el = this.el('hud-gauge');
        el.classList.toggle('on', !!g);
        if (!g) return;
        el.querySelector('.label').textContent = g.label;
        el.querySelector('.band').style.cssText = `left:${g.lo * 100}%;width:${(g.hi - g.lo) * 100}%`;
        const v = Math.max(0, Math.min(1, g.value));
        el.querySelector('.fill').style.width = (v * 100).toFixed(1) + '%';
        el.querySelector('.needle').style.left = (v * 100).toFixed(1) + '%';
        el.classList.toggle('in', v >= g.lo && v <= g.hi);
        el.classList.toggle('over', v > g.hi);
        el.querySelector('.hold i').style.width = (Math.min(1, g.progress || 0) * 100).toFixed(0) + '%';
    }

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

    /**
     * The element rings under the health bar: one per element the hero has (not locked), the outer arc Power and the
     * inner arc Control, each filling toward its next level; the number is the Power level. `els` is Progression's.
     */
    rings(els) {
        const key = Object.entries(els).map(([k, e]) => `${k}${e.state}${Math.round(e.power * 200)}:${Math.round(e.control * 200)}`).join('|');
        if (key === this._ringsKey) return;
        this._ringsKey = key;
        const arc = (r, v) => { const L = 2 * Math.PI * r, f = v >= 1 ? 1 : (v * 10) % 1; return `<circle r="${r}" cx="16" cy="16" stroke-dasharray="${(f * L).toFixed(1)} ${L.toFixed(1)}"/>`; };
        this.el('hud-rings').innerHTML = ['earth', 'water', 'fire', 'air'].filter(k => els[k] && els[k].state !== 'locked').map(k => {
            const e = els[k], col = '#' + ELEMENT[k].rune.toString(16).padStart(6, '0'), lv = Math.floor(Math.min(e.power, 0.999) * 10) + 1;
            return `<div class="ring ${e.state}" style="--rune:${col}" title="${ELEMENT[k].name}: Power ${lv}, Control ${Math.floor(Math.min(e.control, 0.999) * 10) + 1}">`
                + `<svg viewBox="0 0 32 32"><circle class="bg" r="14" cx="16" cy="16"/><circle class="bg" r="10" cx="16" cy="16"/><g class="p">${arc(14, e.power)}</g><g class="c">${arc(10, e.control)}</g></svg><span>${lv}</span></div>`;
        }).join('');
    }

    /**
     * The settings button (top right): opens the pause menu and pauses the game. Resume; Save (here and now);
     * Aim assist (input/AimAssist.js: Off / Assist / Lock, saved on the device); Save and quit to the title.
     * `o`: { assist, pause(bool), save() → true when written, quit() or null (no title to go back to) }.
     */
    menu(o) {
        const gear = this.el('hud-gear'), box = this.el('hud-menu'), items = box.querySelector('.items');
        const btn = (text, sub, fn, cls = '') => {
            const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = text;
            if (sub) { const s = document.createElement('small'); s.textContent = sub; b.append(s); }
            b.onclick = e => { e.stopPropagation(); fn(b); };
            return b;
        };
        const AIM = { off: ['Off', 'exactly where you flick'], assist: ['Assist', 'a throw that\u2019s close bends onto its target'], lock: ['Lock', 'a ring on the target in front; flick roughly toward it'] };
        const render = () => {
            items.replaceChildren(
                btn('Resume', '', close, 'primary'),
                btn('Save', 'here, now', b => { const ok = o.save(); b.querySelector('small').textContent = ok ? 'saved' : 'not saved (a test scene)'; }),
                Object.assign(document.createElement('div'), { className: 'label', textContent: 'Aim assist' }),
                (() => { const row = document.createElement('div'); row.className = 'seg';
                    for (const m of ['off', 'assist', 'lock']) row.append(btn(AIM[m][0], '', () => { o.assist.setMode(m); render(); }, o.assist.mode === m ? 'on' : ''));
                    return row; })(),
                Object.assign(document.createElement('div'), { className: 'note', textContent: AIM[o.assist.mode][1] }),
                ...(o.quit ? [btn('Save and quit', 'to the title', () => { o.save(); close(); o.quit(); })] : []));
        };
        const open = () => { render(); box.classList.add('on'); o.pause(true); };
        const close = () => { box.classList.remove('on'); o.pause(false); };
        gear.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); box.classList.contains('on') ? close() : open(); };
        box.onpointerdown = e => e.stopPropagation();          // the menu is not the world: no orbit, no grab
        this.menuOpen = open; this.menuClose = close;
        // At a desk, Escape opens and closes it.
        removeEventListener('keydown', this._esc || (() => {}));
        this._esc = e => { if (e.code === 'Escape') { e.preventDefault(); box.classList.contains('on') ? close() : open(); } };
        addEventListener('keydown', this._esc);
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
