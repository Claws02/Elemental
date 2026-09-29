// ============================================================
// SMOKE — the Phase 1 gate. Boots the sandbox in headless Chromium on a
// landscape phone viewport and checks the prototype's promises end to end:
//
//   1. boots with no page errors, ten rocks, an intact barricade
//   2. WASD moves the hero, camera-relative
//   3. a real pointer press on a rock grabs it and lifts it
//   4. a fast release throws it (a flick), a slow one drops it
//   5. thrown rocks break the barricade, and the world records it as the
//      player's doing
//   6. the debris budget holds, and a rock thrown out of the world comes back
//
// Screenshots land in qa/shots/ for a human to look at.
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/smoke.js
// ============================================================
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8140/index.html';
const SHOTS = path.join(__dirname, 'shots');

(async () => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
    const browser = await chromium.launch({
        ...(exe ? { executablePath: exe } : {}),
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
    });
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    const fail = [], pass = [];
    const check = (ok, msg) => (ok ? pass : fail).push(msg);
    const shot = name => page.screenshot({ path: path.join(SHOTS, name + '.png') });
    const wait = ms => page.waitForTimeout(ms);

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 30000 });
    await wait(1500);

    // 1. Boot.
    const boot = await page.evaluate(() => ({
        rocks: __EL.room.rocks.length,
        barricade: __EL.room.barricade.summary(),
        calls: __EL.renderInfo().calls, tris: __EL.renderInfo().triangles,
    }));
    check(boot.rocks === 10, `ten rocks (${boot.rocks})`);
    check(boot.barricade.state === 'Intact', `barricade starts intact (${boot.barricade.state})`);
    await shot('01-boot');

    // 2. Movement: W walks away from the camera (the hero spawns facing the arch, -Z).
    const z0 = await page.evaluate(() => __EL.player.body.position.z);
    await page.keyboard.down('KeyW'); await wait(2000); await page.keyboard.up('KeyW');
    await wait(400);
    const z1 = await page.evaluate(() => __EL.player.body.position.z);
    check(z1 < z0 - 2, `W moves the hero forward (z ${z0.toFixed(2)} → ${z1.toFixed(2)})`);
    await shot('02-moved');

    // 3. Grab with a real pointer: press on the nearest rock's screen position.
    const target = await page.evaluate(() => {
        const cam = __EL.cam.cam, hp = __EL.player.body.position;
        let best = null;
        __EL.room.rocks.forEach((e, i) => {
            const d = e.body.position.distanceTo(hp);
            const p = e.mesh.position.clone().project(cam);
            if (p.z < 1 && Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.9 && (!best || d < best.d))
                best = { i, d, x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, y0: e.body.position.y };
        });
        return best;
    });
    check(!!target, 'a rock is on screen and in range');
    if (target) {
        await page.mouse.move(target.x, target.y);
        await page.mouse.down();
        await wait(700);
        const held = await page.evaluate(i => ({ held: __EL.earth.held?.entry === __EL.room.rocks[i], y: __EL.room.rocks[i].body.position.y }), target.i);
        check(held.held, 'pressing a rock grabs it');
        check(held.y > target.y0 + 0.6, `a grabbed rock lifts (y ${target.y0.toFixed(2)} → ${held.y.toFixed(2)})`);
        // Drag it slowly to one side, then look.
        for (let k = 1; k <= 10; k++) { await page.mouse.move(target.x + k * 8, target.y - k * 4); await wait(30); }
        await wait(400);
        await shot('03-holding');

        // 4. Flick: a fast upward swipe, released while still moving. Sent as
        // in-page pointer events 10 ms apart: under software GL a frame takes
        // ~150 ms, and Playwright's mouse waits for each one, so its events
        // can never be fast. The gesture code measures event timestamps, so
        // this is the same input a phone produces.
        await page.evaluate(({ x, y }) => {
            const el = document.getElementById('game');
            const ev = (type, px, py) => el.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'mouse', clientX: px, clientY: py, bubbles: true, isPrimary: true }));
            const spin = ms => { const t = performance.now(); while (performance.now() - t < ms); };
            for (let k = 1; k <= 5; k++) { ev('pointermove', x, y - k * 30); spin(10); }
            ev('pointerup', x, y - 150);
        }, { x: target.x + 80, y: target.y - 40 });
        await page.mouse.up();   // Playwright's own button state
        await wait(60);
        const thrown = await page.evaluate(i => {
            const v = __EL.room.rocks[i].body.velocity;
            return { throws: __EL.earth.throws, held: !!__EL.earth.held, speed: Math.hypot(v.x, v.y, v.z) };
        }, target.i);
        check(thrown.throws === 1 && !thrown.held, `a flick throws (throws=${thrown.throws})`);
        check(thrown.speed > 10, `the throw is fast (${thrown.speed.toFixed(1)} m/s)`);
        await wait(250);
        await shot('04-thrown');
    }

    // A slow release drops instead of throwing.
    await page.waitForTimeout(800);
    const t2 = await page.evaluate(() => {
        const cam = __EL.cam.cam, hp = __EL.player.body.position;
        const e = __EL.room.rocks.map((e, i) => ({ e, i })).filter(({ e }) => e.body.position.distanceTo(hp) < 12)
            .map(({ e, i }) => { const p = e.mesh.position.clone().project(cam); return { i, p }; })
            .find(({ p }) => p.z < 1 && Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.9);
        return e ? { i: e.i, x: (e.p.x + 1) / 2 * innerWidth, y: (1 - e.p.y) / 2 * innerHeight } : null;
    });
    if (t2) {
        await page.mouse.move(t2.x, t2.y); await page.mouse.down(); await wait(500);
        await page.mouse.move(t2.x + 4, t2.y - 2); await wait(300); await page.mouse.up();
        const r = await page.evaluate(() => ({ throws: __EL.earth.throws, held: !!__EL.earth.held }));
        check(r.throws <= 1 && !r.held, `a slow release drops without throwing (throws=${r.throws})`);
    }

    // 5. Break the barricade: throw rocks at it from where they lie.
    await page.evaluate(() => { __EL.player.body.position.set(0, 0.5, -6); });
    await wait(300);
    for (let i = 0; i < 6; i++) {
        await page.evaluate(i => {
            const e = __EL.room.rocks[i];
            e.body.position.set(-2 + i * 0.8, 1.6, -9);
            e.body.velocity.set(0, 0, 0);
            __EL.throwRockAt(i, { x: -2.5 + i, y: 0.6 + (i % 3) * 0.9, z: -16.2 }, 28);
        }, i);
        await wait(250);
        if (i === 1) await shot('05-impact');
    }
    await wait(2000);
    const after = await page.evaluate(() => ({
        s: __EL.room.barricade.summary(),
        states: __EL.EventBus.recent().filter(e => e.type === 'StructureStateChanged'),
        stats: __EL.Physics.stats(),
    }));
    check(after.s.state !== 'Intact' && after.s.broken > 0, `thrown rocks break the barricade (${after.s.state}, ${after.s.broken}/${after.s.total})`);
    check(after.states.length > 0 && after.states.every(e => e.cause === 'player'), `the world blames the player (${after.states.map(e => e.to + ':' + e.cause).join(', ')})`);
    await page.evaluate(() => { const c = __EL.cam; c.yaw = 0.35; c.pitch = 0.32; c.dist = 9; });
    await wait(600);
    await shot('06-barricade');

    // 6. Budget and out-of-world recovery.
    await page.evaluate(() => { for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) __EL.room.barricade.hit(r, c, 500, 'player'); });
    await wait(500);
    const budget = await page.evaluate(() => ({ s: __EL.room.barricade.summary(), st: __EL.Physics.stats() }));
    check(budget.s.state === 'Collapsed', `enough damage collapses it (${budget.s.state})`);
    check(budget.st.debris <= 40, `debris stays within budget (${budget.st.debris} simulated)`);
    const back = await page.evaluate(async () => {
        const e = __EL.room.rocks[9];
        e.body.position.set(0, -40, 0);
        await new Promise(r => setTimeout(r, 200));
        return { y: e.body.position.y, n: e.data.respawned || 0 };
    });
    check(back.n === 1 && back.y > 0, `a rock that leaves the world comes back (y=${back.y.toFixed(2)})`);

    const perf = await page.evaluate(() => __EL.renderInfo());
    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));

    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) console.log(fail.map(p => '  FAIL ' + p).join('\n'));
    console.log(`  boot view: ${boot.calls} draw calls, ${(boot.tris / 1000).toFixed(1)}k triangles · end: ${perf.calls} calls`);
    if (fail.length) { console.log('SMOKE FAIL'); process.exit(1); }
    console.log('SMOKE PASS');
})();
