// ============================================================
// ELEMENTAL — the game page
// ============================================================
//
// Picks the scene from the address and plays it (src/Game.js):
//
//   ?scene=lesson    Lesson I, Cael's first lesson   (scenes/lesson1.json)
//   ?scene=sandbox   the courtyard, every element     (scenes/courtyard.json)
//   ?scene=<id>      any scene in scenes/, e.g. one made in Elemental-Editor
//   neither          the title screen
//
// Scenes are data (docs/SCENES.md); nothing here knows what is in them.
// ============================================================

import { startGame } from './Game.js';

const ALIAS = { lesson: 'lesson1', sandbox: 'courtyard' };

async function boot(id) {
    const res = await fetch(`scenes/${encodeURIComponent(id)}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`no scene "${id}" (scenes/${id}.json: ${res.status})`);
    const data = await res.json();
    const { api } = startGame({ canvas: document.getElementById('game'), hudEl: document.getElementById('hud'), data });
    // QA handle: the tests drive the game through this, never through private state.
    window.__EL = { ...api, mode: id };
    document.body.classList.add('ready');
}

const param = new URLSearchParams(location.search).get('scene');
if (param && /^[\w-]+$/.test(param)) {
    boot(ALIAS[param] || param).catch(e => {
        console.error(e);
        document.getElementById('boot-error').textContent = 'Elemental failed to start: ' + e.message;
    });
} else {
    document.getElementById('title').classList.add('on');
}
