// ============================================================
// ELEMENTAL — the game page: the title, the save slots, and the loop
// between scenes
// ============================================================
//
//   title        Continue (the newest save) · New game (pick a slot) · Load
//   play(scene)  fetch scenes/<id>.json and start it (src/Game.js)
//   dying        back to the last checkpoint: the session drops what happened
//                since, the scene starts again at the checkpoint's place and step
//   an exit      the next scene, arriving at the exit's named start point
//
//   ?scene=<id>  straight into a scene on a save that is never written
//                (development and the QA tests; lesson → lesson1, sandbox → courtyard)
//
// Scenes are data (docs/SCENES.md); nothing here knows what is in them.
// ============================================================

import { startGame } from './Game.js';
import { Session, readSlot, listSlots, deleteSlot, blankSave } from './core/SaveGame.js';

const ALIAS = { lesson: 'lesson1', sandbox: 'courtyard' };
const NEW_GAME_SCENE = 'lesson1';        // becomes the Veyra prologue when it is built

let game = null, session = null;
const cache = new Map();

async function loadScene(id) {
    if (cache.has(id)) return cache.get(id);
    const res = await fetch(`scenes/${encodeURIComponent(id)}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`no scene "${id}" (scenes/${id}.json: ${res.status})`);
    const data = await res.json();
    cache.set(id, data);
    return data;
}

// A stopped game has let its WebGL context go, so each start gets a new canvas.
function freshCanvas() {
    const old = document.getElementById('game');
    const c = document.createElement('canvas');
    c.id = 'game';
    old.replaceWith(c);
    return c;
}

async function play(id, opts = {}) {
    const data = await loadScene(id);
    if (game) { game.stop(); game = null; }
    const canvas = document.body.classList.contains('ready') ? freshCanvas() : document.getElementById('game');
    game = startGame({
        canvas, hudEl: document.getElementById('hud'), data, session, ...opts,
        onDeath: () => backToCheckpoint(),
        onTravel: (to, at) => play(to, { fresh: true, at }).catch(fail),
    });
    // QA handle: the tests drive the game through this, never through private state.
    window.__EL = { ...game.api, mode: id, restart: backToCheckpoint };
    document.body.classList.add('ready');
}

function backToCheckpoint() {
    const cp = session.restore();
    if (!cp) return play(session.work.meta.scene || NEW_GAME_SCENE, { fresh: true });
    return play(cp.scene, { fresh: false, spawnAt: cp.spawn || null, at: cp.at || 'start', step: cp.step || null }).catch(fail);
}

function fail(e) {
    console.error(e);
    document.getElementById('boot-error').textContent = 'Elemental failed to start: ' + e.message;
}

// ---- the title screen -------------------------------------------------------------------------

function title() {
    const t = document.getElementById('title'), menu = document.getElementById('title-menu');
    t.classList.add('on');
    const slots = listSlots();
    const used = slots.filter(s => !s.empty).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    const btn = (label, sub, fn, cls = '') => {
        const b = document.createElement('button');
        b.className = cls;
        b.textContent = label;
        if (sub) { const s = document.createElement('small'); s.textContent = sub; b.append(s); }
        b.onclick = fn;
        return b;
    };
    const when = s => s.savedAt ? new Date(s.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const begin = slot => {
        t.classList.remove('on');
        session = new Session(slot, blankSave(slot));
        play(NEW_GAME_SCENE, { fresh: true }).catch(fail);
    };
    const resume = s => {
        t.classList.remove('on');
        const r = readSlot(s.slot);
        session = new Session(s.slot, r.save);
        const cp = r.save.checkpoint;
        play(cp?.scene || r.save.meta.scene || NEW_GAME_SCENE, { fresh: !cp, spawnAt: cp?.spawn || null, at: cp?.at || 'start', step: cp?.step || null }).catch(fail);
    };
    const main = () => {
        menu.replaceChildren();
        if (used.length) menu.append(btn('Continue', `${used[0].scene || ''} · ${when(used[0])}${used[0].recovered ? ' · recovered from backup' : ''}`, () => resume(used[0]), 'primary'));
        menu.append(btn('New game', used.length ? 'Choose a slot' : 'The story begins', () => (used.length ? slotsMenu('new') : begin(1)), used.length ? '' : 'primary'));
        if (used.length) menu.append(btn('Load', `${used.length} saved`, () => slotsMenu('load')));
    };
    const slotsMenu = mode => {
        menu.replaceChildren();
        for (const s of slots) {
            const sub = s.empty ? 'Empty' : `${s.scene || ''} · ${when(s)}`;
            if (mode === 'load' && s.empty) continue;
            menu.append(btn(`Slot ${s.slot}`, sub, () => {
                if (mode === 'load') return resume(s);
                if (s.empty) return begin(s.slot);
                menu.replaceChildren(
                    Object.assign(document.createElement('p'), { className: 'confirm', textContent: `Start over in slot ${s.slot}? The save there will be replaced.` }),
                    btn('Start over', '', () => { deleteSlot(s.slot); begin(s.slot); }, 'primary'),
                    btn('Back', '', () => slotsMenu('new')));
            }));
        }
        menu.append(btn('Back', '', main));
    };
    main();
}

const param = new URLSearchParams(location.search).get('scene');
if (param && /^[\w-]+$/.test(param)) {
    session = new Session(0, null, { persist: false });
    play(ALIAS[param] || param).catch(fail);
} else {
    title();
}
