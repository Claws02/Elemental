// ============================================================
// JUICE — impacts feel like impacts; the hero moves like a bender
//
//   1. a rock thrown hard lands: an IMPACT, a flare, a ring of dust, the
//      camera shakes and settles; nothing drawn once it's all faded
//   2. raising earth leaves cracked ground (a decal) and a shockwave
//   3. hurt: the hero flinches, the screen's edges flash red
//   4. stances: holding a stone the hero sinks low and braces; drawing water
//      the arms flow (they move over time); the throw follows through
//   5. the quality ladder sheds decals, then rings, before frames
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/juice.js
// ============================================================
const fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:8140/index.html').replace(/\?.*$/, '');
const SHOTS = process.env.QA_SHOTS || path.join(__dirname, 'shots');

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
    fs.mkdirSync(SHOTS, { recursive: true });

    await page.goto(`${BASE}?scene=sandbox`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    // Software GL crawls, so the quality ladder would shed effects; hold it at full (the ladder is tested on its own below).
    await ev(async () => { const R = await import('/src/engine/Renderer.js'); R.quality.adaptive = false; R.quality.level = 0; R.quality.fx = 1; });
    await ev(() => { window.__W = ms => new Promise(r => setTimeout(r, ms)); window.__gt = async s => { const t0 = __EL.juice.t; while (__EL.juice.t - t0 < s) await __W(40); }; });

    // 1. A hard throw.
    const hit = await ev(async () => {
        const seen = []; let atHit = null; const off = __EL.EventBus.on('Impact', e => { seen.push(e); atHit = __EL.juice.stats(); });
        const r = __EL.room.rocks[0], h = __EL.player.body.position;
        __EL.cam.yaw = Math.PI; await __W(300);
        r.body.position.set(h.x, h.y + 4, h.z + 5); r.body.velocity.set(0, 0, 0);
        __EL.channel.throwEntry(r, new __EL.THREE.Vector3(0, -1, 0.25).normalize(), 16, 'earth');
        const t0 = __EL.juice.t; let peak = null, cam = 0;
        while (__EL.juice.t - t0 < 1.5 && !seen.length) await __W(20);
        await __W(60);
        peak = __EL.juice.stats();
        const visible = [__EL.juice.flares.mesh.visible, __EL.juice.rings.mesh.visible];
        await __gt(2.5);
        off();
        return { impacts: seen.length, speed: seen[0] && +seen[0].speed.toFixed(1), atHit, peak, visible, after: __EL.juice.stats(), hidden: !__EL.juice.flares.mesh.visible && !__EL.juice.rings.mesh.visible };
    });
    check(hit.impacts === 1 && hit.peak.flares >= 1 && hit.peak.rings >= 1 && hit.atHit.trauma > 0.05 && hit.visible.every(Boolean) && hit.after.trauma === 0 && hit.hidden,
        `a hard landing: one impact, a flare and a dust ring, the camera shakes and settles; nothing drawn after (${JSON.stringify(hit)})`);

    // A look at it: a fireball's blast, a raised column, a splash.
    const raised = await ev(async () => {
        const h = __EL.player.body.position, d0 = __EL.juice.stats().decals;
        __EL.works.raise(new __EL.THREE.Vector3(h.x + 2, 0, h.z + 4), 'player');
        __EL.EventBus.emit('Explosion', { id: 'qa', cause: 'player', pos: { x: h.x - 2.5, y: h.y, z: h.z + 5 } });
        __EL.water.splash(new __EL.THREE.Vector3(h.x, h.y - 0.6, h.z + 3), 1);
        await __W(120);
        return { decals: __EL.juice.stats().decals - d0, rings: __EL.juice.stats().rings };
    });
    await page.screenshot({ path: path.join(SHOTS, 'juice-impacts.png') });
    await ev(() => __gt(1.2));
    await page.screenshot({ path: path.join(SHOTS, 'juice-marks.png') });
    check(raised.decals >= 3 && raised.rings >= 3, `raising earth, a blast and a splash leave cracked, scorched and wet ground, with shockwaves (${JSON.stringify(raised)})`);

    // 3. Hurt.
    const hurt = await ev(async () => {
        const r = __EL.player.rig, x0 = r.spine.rotation.x;
        __EL.vitals.hurt(12, 'qa', 'qa');
        await __W(30);
        const flash = +getComputedStyle(document.getElementById('fx-flash')).opacity;
        let low = 0; const t0 = __EL.juice.t;
        while (__EL.juice.t - t0 < 0.3) { low = Math.min(low, r.spine.rotation.x - x0); await __W(16); }
        return { flash: +flash.toFixed(2), spine: +low.toFixed(2) };
    });
    check(hurt.flash > 0.1 && hurt.spine < -0.08, `hurt: the hero flinches back and the screen's edges flash (${JSON.stringify(hurt)})`);

    // 4. Stances.
    const stance = await ev(async () => {
        await __gt(0.8);
        const A = __EL.player.anim, r = __EL.player.rig;
        const idle = r.hips.position.y;
        const rock = __EL.room.rocks[1];
        __EL.channel.grab(rock, 'earth');
        await __gt(0.6);
        const holdHips = r.hips.position.y, holdMode = A.mode;
        __EL.channel.let();
        // Water: drawn from the sandbox's basin, the arms flow.
        const src = __EL.water.sources[0];
        let flow = null;
        if (src) {
            __EL.water.beginStream(src.thing);
            __EL.intent.state = 'stream';
            __EL.channel.aimAt(__EL.water.stream.cur, 'water');
            await __gt(0.3);
            const a = r.shoulder[1].rotation.x; await __gt(0.35); const b = r.shoulder[1].rotation.x;
            flow = { mode: A.mode, moved: +Math.abs(a - b).toFixed(2) };
            __EL.water.collapse(); __EL.intent._cancel(); __EL.channel.aimAt(null);
        }
        // The throw: the arm whips through and follows on across the body.
        await __gt(0.5);
        A.throw();
        let lowest = 0; const t0 = __EL.juice.t;
        while (__EL.juice.t - t0 < 0.45) { lowest = Math.min(lowest, r.shoulder[1].rotation.x); await __W(16); }
        return { idle: +idle.toFixed(3), holdHips: +holdHips.toFixed(3), holdMode, flow, whip: +lowest.toFixed(2) };
    });
    check(stance.holdMode === 'holding:earth' && stance.holdHips < stance.idle - 0.04 && stance.flow?.mode === 'stream:water' && stance.flow.moved > 0.03 && stance.whip < -1.4,
        `stances: a stone held low and braced; water's arms flow; the throw whips through (${JSON.stringify(stance)})`);

    // 5. The ladder.
    const ladder = await ev(async () => {
        const R = await import('/src/engine/Renderer.js');
        const fx0 = R.quality.fx, h = __EL.player.body.position, s0 = __EL.juice.stats();
        R.quality.fx = 0.5; __EL.juice.decal(h, 'crack'); __EL.juice.ring(h, 'dust');
        const at50 = __EL.juice.stats();
        R.quality.fx = 0.25; __EL.juice.ring(h, 'dust');
        const at25 = __EL.juice.stats();
        R.quality.fx = fx0;
        return { decalsShed: at50.decals === s0.decals, ringAt50: at50.rings > s0.rings, ringsShed: at25.rings === at50.rings };
    });
    check(ladder.decalsShed && ladder.ringAt50 && ladder.ringsShed, `the quality ladder sheds decals first, then rings (${JSON.stringify(ladder)})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('JUICE FAIL'); process.exit(1); }
    console.log('JUICE PASS');
})();
