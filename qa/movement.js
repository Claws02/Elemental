// ============================================================
// MOVEMENT — jump, the move stick, climbing, and walking at full speed on
// raised stone and past people (scenes/village.json, flat, the sandbox).
//
//   1. Space, the jump button and a flick up on the stick each jump
//   2. the stick lives in the bottom-left corner only (1/3 × 2/5); a touch
//      just outside it is free for the elements
//   3. walk into a raised column and the hero climbs onto it; a taller one
//      takes a jump first; a person is never a ledge
//   4. on top of the stone and against a person the hero keeps its speed
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/movement.js
// ============================================================
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:8140/index.html').replace(/\?.*$/, '');
const SHOTS = path.join(__dirname, 'shots');

(async () => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
    const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const pass = [], fail = [];
    const check = (ok, msg) => { (ok ? pass : fail).push(msg); if (process.env.QA_LOUD) console.log((ok ? '  ok   ' : '  FAIL ') + msg); };
    const wait = ms => page.waitForTimeout(ms);
    const ev = (fn, a) => page.evaluate(fn, a);

    await page.goto(`${BASE}?scene=village`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 60000 });
    await wait(1200);
    await ev(() => {
        const el = document.getElementById('game');
        window.__touch = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
        window.__W = ms => new Promise(r => setTimeout(r, ms));
        // Put the hero at (x, z) facing along (fx, fz), the camera behind.
        window.__place = (x, z, fx = 0, fz = -1) => { const b = __EL.player.body; b.position.set(x, 0.6, z); b.velocity.set(0, 0, 0); __EL.cam.yaw = Math.atan2(-fx, -fz); };
        // Rise of a jump: the highest the feet get above where they started, over `ms`.
        window.__rise = async (go, ms = 900) => {
            // On the ground and settled first (headless frames are slow: a hop takes longer than it looks).
            for (let i = 0; i < 100 && !(__EL.player.grounded && Math.abs(__EL.player.body.velocity.y) < 0.2); i++) await __W(50);
            await __W(150);
            const b = __EL.player.body, y0 = b.position.y; let top = y0;
            go();
            const t0 = performance.now();
            while (performance.now() - t0 < ms) { await __W(30); top = Math.max(top, b.position.y); }
            return +(top - y0).toFixed(2);
        };
        // Walk forward (W held) until `until()` or `ms`; the camera kept behind.
        window.__walk = async (ms, until = () => false, yaw = __EL.cam.yaw) => {
            dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
            const t0 = performance.now();
            while (performance.now() - t0 < ms && !until()) { __EL.cam.yaw = yaw; await __W(40); }
            dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        };
        // A row of columns raised to `h`, west to east at z.
        window.__wall = async (x0, z, h, n = 3) => {
            const cs = [];
            for (let i = 0; i < n; i++) { const c = __EL.works.raise(new __EL.THREE.Vector3(x0 + i * 1.4, 0, z)); c.want = h; cs.push(c); }
            const t0 = performance.now();
            while (performance.now() - t0 < 6000 && cs.some(c => Math.abs(c.top - h) > 0.02)) await __W(50);
            return cs;
        };
    });

    // ---- 1. jumping ------------------------------------------------------------------------------------
    await ev(() => __place(-14, 14));
    await wait(500);
    const space = await ev(() => __rise(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))));
    await ev(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })));
    await wait(400);
    const box = await page.locator('#hud-jump').boundingBox();
    const button = await ev(async b => __rise(() => {
        const el = document.getElementById('hud-jump');
        el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: b.x + b.width / 2, clientY: b.y + b.height / 2, bubbles: true }));
        el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: b.x + b.width / 2, clientY: b.y + b.height / 2, bubbles: true }));
    }), box);
    await wait(400);
    const flick = await ev(async () => __rise(() => {
        const x = innerWidth * 0.15, y = innerHeight * 0.85;
        __touch('pointerdown', 1, x, y); __touch('pointermove', 1, x, y - 30); __touch('pointermove', 1, x, y - 70); __touch('pointerup', 1, x, y - 70);
    }));
    await wait(400);
    // Holding the stick up (running) is not a jump.
    const held = await ev(async () => __rise(async () => {
        const x = innerWidth * 0.15, y = innerHeight * 0.85;
        __touch('pointerdown', 1, x, y); __touch('pointermove', 1, x, y - 70);
        await __W(500); __touch('pointerup', 1, x, y - 70);
    }));
    const where = { right: +(1000 - (box.x + box.width)).toFixed(0), bottom: +(640 - (box.y + box.height)).toFixed(0), size: Math.round(box.width) };
    check(space > 0.8 && button > 0.8 && flick > 0.8 && held < 0.2 && where.right < 40 && where.bottom < 40,
        `jump: Space, the bottom-right button and a flick up on the stick all hop about a metre; pushing the stick to run doesn't (${JSON.stringify({ space, button, flick, held, where })})`);

    // ---- 2. the stick's corner ------------------------------------------------------------------------------
    const zone = await ev(() => {
        const g = __EL.input, t = (x, y) => g.inMoveZone(x * innerWidth, y * innerHeight);
        return { corner: t(0.15, 0.85), edge: t(0.3, 0.65), right: t(0.4, 0.85), above: t(0.15, 0.5) };
    });
    check(zone.corner && zone.edge && !zone.right && !zone.above, `the move stick lives in the bottom-left corner (a third across, two fifths up); beyond it is free for the elements (${JSON.stringify(zone)})`);

    // ---- 3. climbing ------------------------------------------------------------------------------------------
    await ev(() => __place(8, 18, 0, -1));
    const low = await ev(async () => {
        const cs = await __wall(6.6, 14, 1.5);
        __place(8, 18, 0, -1);
        await __W(300);
        let climbed = false;
        await __walk(5000, () => (climbed ||= __EL.player.climbing) && !__EL.player.climbing && __EL.player.body.position.z < 14.6);
        const b = __EL.player.body.position, top = cs[1].base + cs[1].top;
        return { climbed, feet: +(b.y - __EL.player.radius - top).toFixed(2), z: +b.z.toFixed(1) };
    });
    check(low.climbed && Math.abs(low.feet) < 0.2 && low.z < 14.7, `walk into raised stone (1.5 m) and the hero climbs up onto it (${JSON.stringify(low)})`);
    await page.screenshot({ path: path.join(SHOTS, 'M1-climbed.png') });

    // Full speed across the top: a wider platform (two rows).
    const across = await ev(async () => {
        const b = __EL.player.body;
        __EL.cam.yaw = Math.atan2(-1, 0);          // facing +x along the row
        dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        const sp = [];
        const t0 = performance.now();
        while (performance.now() - t0 < 700) { await __W(30); __EL.cam.yaw = Math.atan2(-1, 0); if (performance.now() - t0 > 250) sp.push(Math.hypot(b.velocity.x, b.velocity.z)); }
        dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        return +(sp.reduce((a, c) => a + c, 0) / sp.length).toFixed(2);
    });
    await wait(1500);
    const ground = await ev(async () => {
        __place(-14, 6, 1, 0);
        await __W(300);
        const b = __EL.player.body, sp = [];
        dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        const t0 = performance.now();
        while (performance.now() - t0 < 700) { await __W(30); __EL.cam.yaw = Math.atan2(-1, 0); if (performance.now() - t0 > 250) sp.push(Math.hypot(b.velocity.x, b.velocity.z)); }
        dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        return +(sp.reduce((a, c) => a + c, 0) / sp.length).toFixed(2);
    });
    check(across > ground * 0.85, `on top of raised stone the hero walks as fast as on the ground (${across} vs ${ground} m/s)`);

    // A tall column: too high to climb from the ground; jump, then climb.
    const tall = await ev(async () => {
        __EL.works.dispose?.();
        const cs = await __wall(-16.4, 10, 3.0);
        __place(-15, 14, 0, -1);
        await __W(300);
        let climbedWalking = false;
        await __walk(1500, () => (climbedWalking ||= __EL.player.climbing));
        __place(-15, 12.4, 0, -1);
        await __W(300);
        let climbed = false;
        dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        await __W(60);
        dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
        const t0 = performance.now();
        while (performance.now() - t0 < 5000) { __EL.cam.yaw = 0; await __W(40); climbed ||= __EL.player.climbing; if (climbed && !__EL.player.climbing) break; }
        dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
        dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        const b = __EL.player.body.position, top = cs[1].base + cs[1].top;
        return { climbedWalking, climbed, feet: +(b.y - __EL.player.radius - top).toFixed(2) };
    });
    check(!tall.climbedWalking && tall.climbed && Math.abs(tall.feet) < 0.2, `a 3 m column is out of reach from the ground, but jump and the hero catches the edge and climbs (${JSON.stringify(tall)})`);

    // ---- 4. people ---------------------------------------------------------------------------------------------
    const person = await ev(async () => {
        const q = __EL.world.objects.get('Villager_01').npc.position;
        __place(q.x + 0.25, q.z + 3, 0, -1);
        await __W(300);
        const b = __EL.player.body, sp = [];
        let climbed = false;
        dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        const t0 = performance.now();
        // Until clear of them (headless frames are slow; the game's clock runs behind the wall clock).
        while (performance.now() - t0 < 6000 && b.position.z > q.z - 2) { await __W(30); __EL.cam.yaw = 0; climbed ||= __EL.player.climbing; if (performance.now() - t0 > 250) sp.push(Math.hypot(b.velocity.x, b.velocity.z)); }
        dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        return { climbed, v: +(sp.reduce((a, c) => a + c, 0) / sp.length).toFixed(2), past: +(q.z - b.position.z).toFixed(1) };
    });
    check(!person.climbed && person.past > 1 && person.v > ground * 0.6, `walking into a person: never climbed, the hero slides past and keeps going (${JSON.stringify(person)}, ground ${ground})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('MOVEMENT FAIL'); process.exit(1); }
    console.log('MOVEMENT PASS');
})();
