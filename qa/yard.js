// ============================================================
// YARD — throwing practice before the Stonebound, and the compass
//
//   1. after the Dry Mill, Cael takes you to the Lord-Warden's training yard:
//      a pile of four stones and four straw men
//   2. the compass strip: facing north, N is in the middle; the objective's
//      diamond sits at its bearing, with how far it is
//   3. a stone from the pile thrown hard knocks a straw man down; it counts,
//      and Cael counts with you; three down and he goes ahead to the ruin
//   4. a knocked-down straw man stands back up; a thrown stone crumbles and
//      the pile restocks: nothing to tidy, never runs out
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/yard.js
// ============================================================
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:8140/index.html').replace(/\?.*$/, '');

(async () => {
    const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
    const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const pass = [], fail = [];
    const check = (ok, msg) => { (ok ? pass : fail).push(msg); if (process.env.QA_LOUD) console.log((ok ? '  ok   ' : '  FAIL ') + msg); };
    const ev = (fn, a) => page.evaluate(fn, a);

    await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
    await ev(() => localStorage.clear());
    await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
    await ev(() => { const f = __EL.prog.flags; Object.assign(f, { lesson1: { outcome: 'quiet' }, prologue: 'done', 'thornwick.started': 'true', 'thornwick.mill': 'quiet', 'act1.mill': 'done' }); __EL.prog.setState('earth', 'trained'); __EL.prog._save(); __EL.travel('verdant', 'from_gate'); });
    await page.waitForFunction(() => window.__EL?.mode === 'verdant' && window.__EL?.ready, null, { timeout: 90000 });
    await page.waitForTimeout(1200);
    await ev(() => {
        window.__W = ms => new Promise(r => setTimeout(r, ms));
        window.__at = (x, z) => { const B = __EL.player.body, T = __EL.world.terrain; B.position.set(x, T.height(x, z) + 0.6, z); B.velocity.set(0, 0, 0); };
        window.__pile = () => __EL.world.rocks.filter(e => e.data.pile === 'Yard_Pile' && e.body.world);
        __EL.story.go('yard');
    });

    const yard = await ev(async () => {
        __at(18, -38); await __W(1500);
        const c = __EL.world.objects.get('Cael').npc.position;
        return { step: __EL.story.step, stones: __pile().length, dummies: [1, 2, 3, 4].filter(i => __EL.world.objects.has('Yard_Dummy_' + i)).length, caelNear: Math.hypot(c.x - 23, c.z + 34) < 3, objective: document.querySelector('#hud-objective .text')?.textContent };
    });
    check(yard.step === 'yard' && yard.stones === 4 && yard.dummies === 4 && yard.caelNear && /straw men/.test(yard.objective || ''),
        `the training yard: a pile of four stones, four straw men, Cael beside it (${JSON.stringify(yard)})`);

    const compass = await ev(async () => {
        __EL.cam.yaw = 0; await __W(400);                       // looking north
        const cs = document.getElementById('hud-compass'), letter = l => [...cs.querySelectorAll('.ticks b')].find(b => b.textContent === l);
        const north = { N: parseFloat(letter('N').style.left), E: parseFloat(letter('E').style.left), Wshown: letter('W').style.display !== 'none', mark: parseFloat(cs.querySelector('.mark').style.left), dist: cs.querySelector('.mark span').textContent };
        __EL.cam.yaw = Math.PI / 2; await __W(400);            // looking west: the pile (east of you) is behind
        const west = { W: parseFloat(letter('W').style.left), behind: cs.querySelector('.mark').classList.contains('behind') };
        return { north, west };
    });
    check(Math.abs(compass.north.N - 50) < 1 && Math.abs(compass.north.E - 100) < 1 && /\d+ m/.test(compass.north.dist) && Math.abs(compass.west.W - 50) < 1 && compass.west.behind,
        `the compass: facing north, N in the middle and E at the right; the objective's diamond at its bearing with its distance; turned away, it's pinned to the edge (${JSON.stringify(compass)})`);

    const throws = await ev(async () => {
        const out = [];
        for (let i = 1; i <= 3; i++) {
            const s = __pile()[0], d = __EL.world.objects.get('Yard_Dummy_' + i).prop.entry.body.position;
            s.body.position.set(d.x - 4, d.y + 0.3, d.z); s.body.velocity.set(0, 0, 0);
            __EL.channel.throwEntry(s, new __EL.THREE.Vector3(1, 0.05, 0).normalize(), 18, 'earth');
            await __W(2500);
            out.push(__EL.world.signal('Yard_Dummy_' + i, 'hit'));
        }
        const said = document.querySelector('#hud-say .line')?.textContent;
        return { hits: out, count: __EL.story.counters.yardHits, step: __EL.story.step, flag: __EL.prog.flags['act1.yard'], said };
    });
    check(throws.hits.every(Boolean) && throws.count === 3 && throws.step === 'gone' && throws.flag === 'done',
        `a stone from the pile thrown hard knocks a straw man down, and it counts; three down, and Cael goes ahead to the ruin (${JSON.stringify(throws)})`);

    const reset = await ev(async () => {
        await __W(9000);
        return { stones: __pile().length, up: [1, 2, 3].every(i => !__EL.world.signal('Yard_Dummy_' + i, 'down')), stillCounted: __EL.world.signal('Yard_Dummy_1', 'hit') };
    });
    check(reset.stones === 4 && reset.up && reset.stillCounted, `the straw men stand back up; thrown stones crumble and the pile restocks (${JSON.stringify(reset)})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('YARD FAIL'); process.exit(1); }
    console.log('YARD PASS');
})();
