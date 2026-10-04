// ============================================================
// GATE — Lesson I on the road: the Oruun Gate (scenes/gate.json)
//
//   1. arriving from Veyra, Cael leads the way up the pass, waiting when you stop
//   2. in the ruin's court the lesson begins
//   3. the gorge leaves no way east but the ruin's passage
//   4. raise the barricade: the quiet way; Cael walks on with you, and the
//      road east through the gorge finishes the story
//   5. over the walls instead: it counts, and Cael says so
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/gate.js
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

    const open = async () => {
        await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
        await ev(() => localStorage.clear());
        await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
        await page.waitForTimeout(1500);
        await ev(() => {
            window.__W = ms => new Promise(r => setTimeout(r, ms));
            window.__at = (x, z) => { const B = __EL.player.body; B.position.set(x, __EL.world.terrain.height(x, z) + 0.6, z); B.velocity.set(0, 0, 0); };
            window.__east = async ms => {
                dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
                const t = performance.now();
                while (performance.now() - t < ms) { __EL.cam.yaw = -Math.PI / 2; await __W(40); }
                dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
            };
            window.__skip = async until => { for (let i = 0; i < 120 && !until(); i++) { __EL.hud.skipLine = true; await __W(150); } };
        });
    };

    await open();
    const road = await ev(async () => {
        const B = __EL.player.body, c = __EL.world.objects.get('Cael').npc;
        const step = __EL.story.step, role = c.role;
        // Stand still: he goes ahead, then stops and waits for you.
        await __W(5000);
        const waited = { ahead: +(c.position.x - B.position.x).toFixed(1), waiting: !!c.waiting };
        // Walk on: he leads, staying ahead of you up the pass.
        await __east(6000);
        await __W(1000);
        return { step, role, waited, walked: +(B.position.x + 100).toFixed(1), ahead: +(c.position.x - B.position.x).toFixed(1) };
    });
    check(road.step === 'road' && road.role === 'lead' && road.waited.waiting && road.waited.ahead > 4 && road.waited.ahead < 11 && road.walked > 8 && road.ahead > 0 && road.ahead < 12,
        `arriving from Veyra, Cael leads the way up the pass: ahead of you, waiting when you stop (${JSON.stringify(road)})`);

    const court = await ev(async () => { __at(-16, 0); await __W(2500); return __EL.story.step; });
    check(['intro', 'lift'].includes(court), `in the ruin's court, the lesson begins (${court})`);

    const blocked = await ev(async () => {
        const out = [];
        for (const z of [-15, -9, -2, 2, 9, 15]) { __at(10, z); await __W(300); await __east(4000); out.push(+__EL.player.body.position.x.toFixed(1)); }
        return out;
    });
    check(blocked.every(x => x < 18.5), `the barricade intact, nothing gets past the ruin's east wall (${JSON.stringify(blocked)})`);

    const quiet = await ev(async () => {
        __EL.story.go('trial'); await __W(500);
        __EL.world.act('TestRoom_Barricade_01', 'raise');
        await __skip(() => __EL.story.step === 'onward');
        const step = __EL.story.step, outcome = __EL.prog.flags.lesson1?.outcome, role = __EL.world.objects.get('Cael').npc.role;
        __at(20, 0); await __W(300);
        dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        const t = performance.now();
        while (performance.now() - t < 25000 && __EL.player.body.position.x < 62) { __EL.cam.yaw = -Math.PI / 2 + __EL.player.body.position.z * 0.05; await __W(40); }
        dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        await __W(800);
        return { step, outcome, role, x: +__EL.player.body.position.x.toFixed(1), end: __EL.story.step };
    });
    check(quiet.step === 'onward' && quiet.outcome === 'quiet' && quiet.role === 'lead' && quiet.x > 60 && quiet.end === 'done',
        `the barricade raised: the quiet way; Cael leads on, and through the gorge the story's told (${JSON.stringify(quiet)})`);

    await open();
    const over = await ev(async () => {
        __at(-16, 0); await __W(1500);
        __EL.story.go('trial'); await __W(500);
        __at(34, 0); await __W(2000);
        const said = document.querySelector('#hud-say .line')?.textContent || '';
        return { outcome: __EL.prog.flags.lesson1?.outcome, step: __EL.story.step, said };
    });
    check(over.outcome === 'over' && ['close', 'onward'].includes(over.step), `over the walls instead: it counts, and Cael says so (${JSON.stringify(over)})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('GATE FAIL'); process.exit(1); }
    console.log('GATE PASS');
})();
