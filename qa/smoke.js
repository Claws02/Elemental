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
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8140/index.html?scene=sandbox';
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
        const held = await page.evaluate(i => ({ held: __EL.channel.held?.entry === __EL.room.rocks[i], y: __EL.room.rocks[i].body.position.y }), target.i);
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
            return { throws: __EL.channel.throws, held: !!__EL.channel.held, speed: Math.hypot(v.x, v.y, v.z) };
        }, target.i);
        check(thrown.throws === 1 && !thrown.held, `a flick throws (throws=${thrown.throws})`);
        check(thrown.speed > 10, `the throw is fast (${thrown.speed.toFixed(1)} m/s)`);
        await wait(250);
        await shot('04-thrown');
    }

    // 3b. The move zone is only the bottom-left quarter: a touch there is the
    // stick, a touch in the top left is the world (a rock there is grabbable).
    await page.waitForTimeout(600);
    const zone = await page.evaluate(() => {
        const el = document.getElementById('game');
        const ev = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 11 }));
        const g = __EL.input, W = innerWidth, H = innerHeight;
        const out = {};
        // Bottom left: the stick.
        ev('pointerdown', 11, W * 0.2, H * 0.8);
        out.stickBottomLeft = g.stick.id === 11;
        ev('pointerup', 11, W * 0.2, H * 0.8);
        // Top left, empty world: not the stick.
        ev('pointerdown', 12, W * 0.2, H * 0.2);
        out.stickTopLeft = g.stick.id === 12;
        ev('pointerup', 12, W * 0.2, H * 0.2);
        // Top left, on a rock: grabbed. Put a rock under that point, 7 m out.
        const cam = __EL.cam.cam, T = __EL.THREE;
        const p = new T.Vector3(-0.6, 0.55, 0.5).unproject(cam).sub(cam.position).normalize().multiplyScalar(7).add(cam.position);
        const e = __EL.room.rocks[3];
        e.body.position.set(p.x, p.y, p.z); e.body.velocity.set(0, 0, 0); e.mesh.position.copy(p);
        const sp = p.clone().project(cam);
        const sx = (sp.x + 1) / 2 * W, sy = (1 - sp.y) / 2 * H;
        out.rockScreen = [Math.round(sx), Math.round(sy)];
        ev('pointerdown', 13, sx, sy);
        out.grabTopLeft = __EL.channel.held?.entry === e;
        ev('pointerup', 13, sx, sy);
        out.throwsAfter = __EL.channel.throws;
        return out;
    });
    check(zone.stickBottomLeft, 'a touch in the bottom-left quarter is the move stick');
    check(!zone.stickTopLeft, 'a touch in the top left is not the move stick');
    check(zone.grabTopLeft, `a rock in the top left can be grabbed (at ${zone.rockScreen})`);

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
        const r = await page.evaluate(() => ({ throws: __EL.channel.throws, held: !!__EL.channel.held }));
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
    // The barricade rebuilds itself after a quiet spell (60 s in the room; 2 s here).
    await page.evaluate(() => { __EL.room.barricade.regenAfter = 2; });
    const rebuilt = await page.waitForFunction(() => __EL.room.barricade.state === 'Intact', null, { timeout: 30000 }).then(() => true).catch(() => false);
    const rb = await page.evaluate(() => {
        const b = __EL.room.barricade;
        const off = Math.max(...b.pieces.map(p => p.entry.body.position.distanceTo(p.home.p)));
        return { static: b.pieces.every(p => p.entry.body.type === 2 && !p.broken), off, room: b.regenAfter };
    });
    check(rebuilt && rb.static && rb.off < 0.01, `a broken barricade rebuilds whole and in place (max offset ${rb.off.toFixed(3)} m)`);

    const back = await page.evaluate(async () => {
        const e = __EL.room.rocks[9];
        e.body.position.set(0, -40, 0);
        await new Promise(r => setTimeout(r, 200));
        return { y: e.body.position.y, n: e.data.respawned || 0 };
    });
    check(back.n === 1 && back.y > 0, `a rock that leaves the world comes back (y=${back.y.toFixed(2)})`);


    // ========================================================
    // 7. FIRE, in a fresh room. Context decides the element: hold still on
    // stone you carry (heat), on timber (ignite), on coals or fire (pull).
    // ========================================================
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 30000 });
    await wait(1500);
    // In-page touch helpers, so hold timings are real event timings.
    await page.evaluate(() => {
        const el = document.getElementById('game');
        window.__touch = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
        window.__screen = p => { const q = p.clone().project(__EL.cam.cam); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight, on: q.z < 1 && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95 }; };
        window.__piece = (r, c) => __EL.interactables.things.find(t => t.id === `TestRoom_Barricade_01_P${r}${c}`);
    });
    const waitFor = (fn, ms, arg) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);

    // 7a. Hold a rock still: Earth holds it, then Fire heats it in the grip.
    const hot = await page.evaluate(() => {
        const hp = __EL.player.body.position;
        const i = __EL.room.rocks.map((e, i) => ({ e, i })).filter(({ e }) => __screen(e.mesh.position).on && !__EL.input.inMoveZone(__screen(e.mesh.position).x, __screen(e.mesh.position).y))
            .sort((a, b) => a.e.body.position.distanceTo(hp) - b.e.body.position.distanceTo(hp))[0]?.i;
        if (i === undefined) return null;
        const s = __screen(__EL.room.rocks[i].mesh.position);
        __touch('pointerdown', 31, s.x, s.y);
        return { i, s, held: __EL.channel.held?.element };
    });
    check(hot?.held === 'earth', `a rock grabs instantly with Earth (${hot?.held})`);
    if (hot) {
        const ringSeen = await waitFor(() => __EL.intent.ring()?.element === 'fire', 8000);
        check(ringSeen, 'holding it still fills a Fire ring');
        const heated = await waitFor(i => (__EL.room.rocks[i].data.heat || 0) >= 0.9, 20000, hot.i);
        check(heated, 'held still long enough, the rock heats in the grip');
        await page.evaluate(({ s }) => __touch('pointerup', 31, s.x, s.y), hot);
        await shot('07-hot-rock');
    }

    // 7a'. Holding still on a brazier's coals pulls a fireball (0.25 s: coals answer Fire fast).
    const br = await page.evaluate(() => {
        const t = __EL.interactables.things.find(t => t.id === 'TestRoom_Brazier_01');
        const s = __screen(__EL.fire.sources.find(x => x.thing === t).pos);
        __touch('pointerdown', 35, s.x, s.y);
        return s;
    });
    const fromBrazier = await waitFor(() => __EL.channel.held?.element === 'fire', 6000);
    check(br.on && fromBrazier, 'holding still on a brazier pulls a fireball');
    await page.evaluate(s => __touch('pointerup', 35, s.x, s.y), br);
    const dropped = await waitFor(() => __EL.fire.fireballs.size === 0, 8000);
    check(dropped, 'a dropped fireball dies out');

    // Walk up to the barricade (the brazier there is 4 m in front of it).
    await page.evaluate(() => { __EL.player.body.position.set(-1, 0.45, -8); __EL.player.body.velocity.set(0, 0, 0); __EL.cam.yaw = 0.15; __EL.cam.pitch = 0.3; });
    await wait(1500);

    // 7b. A drag across a plank is not a hold: nothing catches.
    const dragged = await page.evaluate(async () => {
        const s = __screen(__piece(0, 5).pos());
        __touch('pointerdown', 32, s.x, s.y);
        await new Promise(r => setTimeout(r, 80));
        __touch('pointermove', 32, s.x + 45, s.y + 5);
        await new Promise(r => setTimeout(r, 1500));
        __touch('pointerup', 32, s.x + 45, s.y + 5);
        return { burning: __EL.fire.isBurning(__piece(0, 5)), on: s.on };
    });
    check(dragged.on && !dragged.burning, 'dragging across timber does not ignite it');

    // 7c. Holding still on timber sets it alight, on the spot, and it is the player's fire.
    const lit = await page.evaluate(() => { const s = __screen(__piece(0, 5).pos()); __touch('pointerdown', 33, s.x, s.y); return s; });
    const caught = await waitFor(() => __EL.fire.isBurning(__piece(0, 5)), 6000);
    await page.evaluate(s => __touch('pointerup', 33, s.x, s.y), lit);
    const started = await page.evaluate(() => __EL.EventBus.recent().filter(e => e.type === 'FireStarted'));
    check(caught, 'holding still on timber ignites it');
    check(started.length > 0 && started[0].cause === 'player', `the fire is recorded as the player's (${started.map(e => e.cause).join(',')})`);

    // 7d. Holding still on something burning pulls the flame out: a fireball in the hand, and the plank goes out.
    const pull = await page.evaluate(() => { const s = __screen(__piece(0, 5).pos()); __touch('pointerdown', 34, s.x, s.y); return s; });
    const pulled = await waitFor(() => __EL.channel.held?.element === 'fire', 6000);
    const out = await page.evaluate(() => !__EL.fire.isBurning(__piece(0, 5)));
    check(pulled, 'holding still on fire pulls a fireball into the hand');
    check(out, 'pulling the fire out puts the plank out');
    await shot('08-fireball');

    // 7e. Let go and throw it at the middle of the wall: it catches there.
    const before = await page.evaluate(p => {
        __touch('pointerup', 34, p.x, p.y);
        const fb = __EL.fire.fireballs.values().next().value;
        if (!fb) return null;
        const dir = __piece(1, 2).pos().sub(fb.entry.mesh.position).normalize();
        __EL.channel.throwEntry(fb.entry, dir, 22, 'fire');
        return { ignitions: __EL.fire.ignitions, burning: __EL.fire.burningCount() };
    }, pull);
    const byFireball = before && before.burning === 0 && await waitFor(n => __EL.fire.ignitions > n && __EL.fire.fireballs.size === 0, 8000, before.ignitions);
    check(byFireball, `a thrown fireball sets the barricade alight (nothing was burning before: ${before?.burning === 0})`);

    // 7f. A hot rock thrown into timber sets it alight too.
    if (hot) {
        const hr = await page.evaluate(i => {
            const e = __EL.room.rocks[i];
            e.data.heat = Math.max(e.data.heat || 0, 0.95);
            e.body.position.set(3, 1.4, -10); e.body.velocity.set(0, 0, 0);
            const before = __EL.fire.ignitions;
            __EL.throwRockAt(i, __piece(2, 5).pos(), 16);
            return before;
        }, hot.i);
        const ok = await waitFor(n => __EL.fire.ignitions > n, 6000, hr);
        check(ok, 'a hot rock thrown into timber sets it alight');
    }

    // 7g. It spreads, and it burns through.
    const spread = await waitFor(() => __EL.fire.burningCount() + __EL.fire.burnedCount() >= 4, 40000);
    check(spread, `fire spreads plank to plank (${await page.evaluate(() => JSON.stringify(__EL.fire.stats()))})`);
    await shot('09-burning');
    const through = await waitFor(() => __EL.room.barricade.summary().burned >= 1, 60000);
    const fsum = await page.evaluate(() => ({ s: __EL.room.barricade.summary(), fx: __EL.fx.stats(), states: __EL.EventBus.recent().filter(e => e.type === 'StructureStateChanged').map(e => e.to + ':' + e.cause) }));
    check(through, `burning planks burn through and fall (${fsum.s.burned} burned, ${fsum.s.state}; ${fsum.states.join(', ')})`);
    check(fsum.states.filter(s => !s.endsWith(':rebuilt')).every(s => s.endsWith(':player')), 'the fire damage is blamed on the player');
    check(fsum.fx.flame <= fsum.fx.flameMax && fsum.fx.smoke <= fsum.fx.smokeMax, `particles stay within their pools (${fsum.fx.flame}/${fsum.fx.flameMax} flame, ${fsum.fx.smoke}/${fsum.fx.smokeMax} smoke)`);
    await shot('10-burned');


    // ========================================================
    // 8. WATER, in a fresh room: a stream while connected to the basin, an
    // orb once it snaps off. It puts fire out, soaks, pushes, cools, wears.
    // ========================================================
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 30000 });
    await page.evaluate(() => {
        const el = document.getElementById('game');
        window.__touch = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
        window.__screen = p => { const q = p.clone().project(__EL.cam.cam); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight, on: q.z < 1 && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95 }; };
        window.__piece = (r, c) => __EL.interactables.things.find(t => t.id === `TestRoom_Barricade_01_P${r}${c}`);
        // Drag the finger from the basin to a world point, in steps.
        // Drag the finger from the basin to a world point at a human pace (~0.5 s), so it aims rather than yanks.
        window.__streamTo = async (id, p) => { const a = __screen(__EL.room.basins[1].surface), b = __screen(p); for (let k = 1; k <= 8; k++) { __touch('pointermove', id, a.x + (b.x - a.x) * k / 8, a.y + (b.y - a.y) * k / 8); await new Promise(r => setTimeout(r, 60)); } return b; };
        __EL.player.body.position.set(1.5, 0.45, -7.5); __EL.cam.yaw = 0.35; __EL.cam.pitch = 0.3;
    });
    await wait(1800);

    // 8a. Touch the basin: the water comes, as a stream.
    const bs = await page.evaluate(() => { __EL.fire.ignite(__piece(0, 4), 'player'); const s = __screen(__EL.room.basins[1].surface); __touch('pointerdown', 41, s.x, s.y); return { s, st: __EL.intent.state, vis: __EL.water.tube.visible }; });
    check(bs.s.on && bs.st === 'stream' && bs.vis, `touching a basin draws a stream (${bs.st})`);

    // 8b. Aim it at a burning plank: the fire goes out and the plank is soaked.
    const aimed = await page.evaluate(async () => await __streamTo(41, __piece(0, 4).pos()));
    const doused = await waitFor(() => !__EL.fire.isBurning(__piece(0, 4)) && __EL.fire.isWet(__piece(0, 4)), 8000);
    const dousedBy = await page.evaluate(() => __EL.EventBus.recent().filter(e => e.type === 'FireOut' && e.doused).map(e => e.cause));
    check(doused, 'the stream puts a burning plank out and soaks it');
    // A fire fights back: a short splash of water isn't enough, a sustained one is.
    const fights = await page.evaluate(() => {
        const t = __piece(2, 3), f = __EL.fire;
        f.ignite(t, 'player');
        f.wetten(t, 0.4, 'player');
        const after04 = f.isBurning(t);
        f.wetten(t, 0.45, 'player');
        return { after04, after085: f.isBurning(t) };
    });
    check(fights.after04 && !fights.after085, `a fire takes ~0.8 s of water to go out (burning after 0.4 s: ${fights.after04}, after 0.85 s: ${fights.after085})`);
    check(dousedBy.length > 0 && dousedBy.every(c => c === 'player'), `putting it out is recorded as the player's (${dousedBy.join(',')})`);
    await wait(1500);
    await shot('11-stream');
    const worn = await page.evaluate(() => __piece(0, 4).entry.data.piece.hp);
    check(worn < 100, `water under pressure wears the plank (hp ${worn.toFixed(0)})`);

    // 8c. It pushes: a rock in the spray moves along the stream.
    const pushed = await page.evaluate(async () => {
        const e = __EL.room.rocks[4];
        e.body.position.set(2.0, 0.62, -12.9); e.body.velocity.set(0, 0, 0); e.body.wakeUp();   // clear of the oil barrels
        await new Promise(r => setTimeout(r, 300));
        const p0 = e.body.position.clone();
        await __streamTo(41, e.mesh.position);
        // Keep the stream on it as it moves, as a player would.
        for (let k = 0; k < 8; k++) { const q = __screen(e.mesh.position); __touch('pointermove', 41, q.x, q.y); await new Promise(r => setTimeout(r, 300)); }
        const w = __EL.water.stream;
        return { d: e.body.position.distanceTo(p0), st: __EL.intent.state, end: w && w.cur.toArray().map(v => +v.toFixed(2)), rock: e.body.position.toArray().map(v => +v.toFixed(2)) };
    });
    check(pushed.d > 0.5, `the stream pushes a rock (${pushed.d.toFixed(2)} m; ${JSON.stringify(pushed)})`);

    // 8d. Hot stone in the water cools, in steam.
    const cooled = await page.evaluate(async () => {
        // The heaviest rock, up against the wall, so the stream can't wash it out of its own spray.
        const e = __EL.room.rocks[5];
        e.body.position.set(2.2, 0.86, -15.1); e.body.velocity.set(0, 0, 0); e.body.wakeUp();
        await new Promise(r => setTimeout(r, 300));
        e.data.heat = 0.9;
        await __streamTo(41, e.mesh.position);
        for (let k = 0; k < 7; k++) { const q = __screen(e.mesh.position); __touch('pointermove', 41, q.x, q.y); await new Promise(r => setTimeout(r, 300)); }
        return e.data.heat;
    });
    check(cooled < 0.4, `water cools hot stone (heat 0.90 → ${cooled.toFixed(2)})`);

    // 8e. Pointed past its reach, it stays a stream and falls short.
    await page.evaluate(async () => {
        const s = __screen(__EL.room.basins[1].surface), from = { x: __EL.intent.x, y: __EL.intent.y };
        for (let k = 1; k <= 8; k++) { __touch('pointermove', 41, from.x + (s.x - 120 - from.x) * k / 8, from.y + (12 - from.y) * k / 8); await new Promise(r => setTimeout(r, 60)); }
    });
    await wait(1500);
    const short = await page.evaluate(() => {
        const w = __EL.water.stream;
        return w ? { st: __EL.intent.state, reach: +w.cur.distanceTo(w.source.surface).toFixed(2), y: +w.cur.y.toFixed(2) } : { st: __EL.intent.state };
    });
    check(short.st === 'stream' && short.reach <= 8.05 && short.y < 2, `pointed past its reach, it stays a stream and falls short (${JSON.stringify(short)})`);
    await shot('12-falls-short');

    // 8e'. A quick yank away from the basin tears the water free: an orb in the hand.
    await page.evaluate(() => {
        const b = __screen(__EL.room.basins[1].surface);
        __touch('pointermove', 41, b.x, b.y);                  // back over the basin
    });
    await wait(600);
    await page.evaluate(() => {
        const b = __screen(__EL.room.basins[1].surface);
        const spin = ms => { const t = performance.now(); while (performance.now() - t < ms); };
        for (let k = 1; k <= 6; k++) { __touch('pointermove', 41, b.x - k * 45, b.y - k * 18); spin(10); }
    });
    const torn = await waitFor(() => __EL.intent.state === 'holding' && __EL.channel.held?.element === 'water' && !__EL.water.stream, 4000);
    check(torn, 'a quick yank away from the basin tears the water free into an orb');
    await shot('12-orb');

    // 8f. Throw the orb at a burning plank: it bursts and puts it out.
    const orbHit = await page.evaluate(async () => {
        const t = __piece(2, 0);
        __EL.fire.ignite(t, 'player');
        __touch('pointerup', 41, 400, 12);                       // slow: a drop…
        const orb = [...__EL.water.orbs][0];
        if (!orb) return 'no orb';
        orb.entry.body.position.set(-1.2, 2.2, -12.5);           // …caught and thrown from close in
        orb.entry.mesh.position.set(-1.2, 2.2, -12.5);          // the mesh follows the body only at the next step
        __EL.channel.throwEntry(orb.entry, t.pos().sub(orb.entry.mesh.position).normalize(), 18, 'water');
        return 'thrown';
    });
    const orbOut = await waitFor(() => !__EL.fire.isBurning(__piece(2, 0)) && __EL.water.orbs.size === 0, 8000);
    const orbDbg = await page.evaluate(() => JSON.stringify({ burning: __EL.fire.isBurning(__piece(2, 0)), wet: __EL.fire.isWet(__piece(2, 0)), orbs: __EL.water.orbs.size, st: __EL.intent.state }));
    check(orbHit === 'thrown' && orbOut, `a thrown orb bursts and puts a fire out (${orbHit} ${orbDbg})`);

    // 8g. Soaked timber will not catch: hold still on it and nothing happens.
    const wetHold = await page.evaluate(() => { const s = __screen(__piece(0, 4).pos()); __touch('pointerdown', 42, s.x, s.y); return s; });
    await wait(2500);
    const stillOut = await page.evaluate(s => { __touch('pointerup', 42, s.x, s.y); return !__EL.fire.isBurning(__piece(0, 4)) && __EL.fire.isWet(__piece(0, 4)); }, wetHold);
    check(stillOut, 'soaked timber will not catch');

    // 8h. A flick from the stream breaks it off and throws it.
    const flung = await page.evaluate(() => {
        const s = __screen(__EL.room.basins[1].surface), n = __EL.channel.throws;
        __touch('pointerdown', 43, s.x, s.y);
        const spin = ms => { const t = performance.now(); while (performance.now() - t < ms); };
        for (let k = 1; k <= 5; k++) { __touch('pointermove', 43, s.x - k * 6, s.y - k * 40); spin(10); }
        __touch('pointerup', 43, s.x - 30, s.y - 200);
        return { threw: __EL.channel.throws - n, state: __EL.intent.state, streaming: !!__EL.water.stream };
    });
    check(flung.threw === 1 && !flung.streaming, `a flick breaks the stream off and throws it (${JSON.stringify(flung)})`);


    // ========================================================
    // 9. AIR, in a fresh room: it comes from the hero. Touch the hero and
    // drag for wind, flick for a gust. Loose light things answer to Air.
    // ========================================================
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 30000 });
    await page.evaluate(() => {
        const el = document.getElementById('game');
        window.__touch = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
        window.__screen = p => { const q = p.clone().project(__EL.cam.cam); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight, on: q.z < 1 && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95 }; };
        window.__piece = (r, c) => __EL.interactables.things.find(t => t.id === `TestRoom_Barricade_01_P${r}${c}`);
        window.__hero = () => { const p = __EL.player.position; return __screen(new __EL.THREE.Vector3(p.x, p.y + 1.0, p.z)); };
        // Touch the hero, then drag toward a world point at a human pace, and keep blowing.
        window.__windAt = async (id, p, ms) => {
            const h = __hero(); __touch('pointerdown', id, h.x, h.y);
            const b = __screen(p);
            for (let k = 1; k <= 6; k++) { __touch('pointermove', id, h.x + (b.x - h.x) * k / 6, h.y + (b.y - h.y) * k / 6); await new Promise(r => setTimeout(r, 50)); }
            const t0 = performance.now();
            while (performance.now() - t0 < ms) { const q = __screen(p); __touch('pointermove', id, q.x, q.y); await new Promise(r => setTimeout(r, 150)); }
            return b;
        };
        __EL.player.body.position.set(0, 0.45, -11); __EL.cam.yaw = 0.2; __EL.cam.pitch = 0.3;
    });
    await wait(1800);

    // 9a. Touching the hero is Air, not the stick, even at the move zone's edge.
    const hz = await page.evaluate(() => {
        const h = __hero(); __touch('pointerdown', 51, h.x, h.y);
        const r = { st: __EL.intent.state, stick: __EL.input.stick.id === 51, inZone: __EL.input.inMoveZone(h.x, h.y) };
        __touch('pointerup', 51, h.x, h.y);
        return r;
    });
    check(hz.st === 'wind' && !hz.stick, `touching the hero is Air (${JSON.stringify(hz)})`);

    // 9b. Wind pushes a light rock.
    const blown = await page.evaluate(async () => {
        const e = __EL.room.rocks[7];                       // the smallest rock
        e.body.position.set(0.3, 0.36, -14); e.body.velocity.set(0, 0, 0); e.body.wakeUp();
        await new Promise(r => setTimeout(r, 300));
        const p0 = e.body.position.clone();
        const b = await __windAt(52, new __EL.THREE.Vector3(0.3, 0.4, -14), 1500);
        const r = { d: e.body.position.distanceTo(p0), blowing: __EL.air.wind !== null };
        __touch('pointerup', 52, b.x, b.y);
        return r;
    });
    check(blown.blowing && blown.d > 0.5, `the wind pushes a light rock (${blown.d.toFixed(2)} m)`);

    // 9c. Wind blows a young flame out.
    const young = await page.evaluate(async () => {
        const t = __piece(1, 2);
        __EL.fire.ignite(t, 'player');
        const b = await __windAt(53, t.pos(), 1200);
        __touch('pointerup', 53, b.x, b.y);
        return { burning: __EL.fire.isBurning(t), blown: __EL.EventBus.recent().some(e => e.type === 'FireOut' && e.blown) };
    });
    check(!young.burning && young.blown, 'wind blows a young flame out');

    // 9d. …but it fans an established fire, which spreads downwind.
    const fanned = await page.evaluate(async () => {
        const t = __piece(0, 1);
        __EL.fire.ignite(t, 'player');
        __EL.fire.flammables.get(t).age = 6;               // established
        const b = await __windAt(54, t.pos(), 1200);
        __touch('pointerup', 54, b.x, b.y);
        return { burning: __EL.fire.isBurning(t), fanned: __EL.EventBus.recent().some(e => e.type === 'FireFanned' && e.cause === 'player') };
    });
    check(fanned.burning && fanned.fanned, 'wind fans an established fire instead of putting it out');
    await shot('13-wind');

    // 9e. A gust barely marks sound timber (weakened after the phone test)…
    const flick = (id, t) => page.evaluate(({ id, tid }) => {
        const t = __EL.interactables.things.find(x => x.id === tid);
        const h = __hero(), q = __screen(t.pos());
        __touch('pointerdown', id, h.x, h.y);
        const spin = ms => { const s = performance.now(); while (performance.now() - s < ms); };
        for (let k = 1; k <= 5; k++) { __touch('pointermove', id, h.x + (q.x - h.x) * k / 5, h.y + (q.y - h.y) * k / 5); spin(8); }
        __touch('pointerup', id, q.x, q.y);
    }, { id, tid: t });
    await flick(55, 'TestRoom_Barricade_01_P03');
    await wait(500);
    const sound = await page.evaluate(() => __piece(0, 3).entry.data.piece.hp);
    check(sound > 85, `a gust barely marks sound timber (hp 100 → ${sound.toFixed(0)})`);

    // …but finishes off a plank that was nearly broken, blamed on the player.
    await page.evaluate(() => { __piece(0, 4).entry.data.piece.hp = 4; });
    await flick(56, 'TestRoom_Barricade_01_P04');
    const loose = await waitFor(() => __piece(0, 4).entry.data.piece.broken, 4000);
    const blame = await page.evaluate(() => __EL.EventBus.recent().filter(e => e.type === 'PieceBroken' && e.piece.endsWith('_P04')).map(e => e.cause));
    check(loose && blame[0] === 'player', `a gust finishes off a nearly-broken plank, blamed on the player (${JSON.stringify({ loose, blame })})`);

    // 9f. Air carries nothing: a loose plank still answers to Fire.
    await wait(1500);
    const looseTouch = await page.evaluate(() => { const s = __screen(__piece(0, 4).pos()); __touch('pointerdown', 57, s.x, s.y); return { s, held: __EL.channel.held?.element || null, st: __EL.intent.state }; });
    const looseLit = await waitFor(() => __EL.fire.isBurning(__piece(0, 4)), 5000);
    await page.evaluate(s => __touch('pointerup', 57, s.x, s.y), looseTouch.s);
    check(!looseTouch.held && looseLit, `a loose plank isn't carried by Air, and holding still sets it alight (${JSON.stringify({ held: looseTouch.held, st: looseTouch.st, looseLit })})`);

    // ========================================================
    // 10. OBSTACLES, in a fresh room: hay, oil barrels, dummies, crates.
    // ========================================================
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 30000 });
    await page.evaluate(() => {
        const el = document.getElementById('game');
        window.__touch = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
        window.__screen = p => { const q = p.clone().project(__EL.cam.cam); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight, on: q.z < 1 && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95 }; };
        window.__thing = id => __EL.interactables.things.find(t => t.id === id);
        window.__hero = () => { const p = __EL.player.position; return __screen(new __EL.THREE.Vector3(p.x, p.y + 1.0, p.z)); };
        __EL.player.body.position.set(-9, 0.45, 2.5); __EL.cam.yaw = Math.PI * 0.25; __EL.cam.pitch = 0.45;
    });
    await wait(1800);

    // 10a. Dry hay catches almost at once and the fire runs through the field.
    const hayTouch = await page.evaluate(() => { const s = __screen(__thing('TestRoom_Hay_18').pos()); __touch('pointerdown', 61, s.x, s.y); return s; });
    const hayLit = await waitFor(() => __EL.fire.isBurning(__thing('TestRoom_Hay_18')), 3000);
    await page.evaluate(s => __touch('pointerup', 61, s.x, s.y), hayTouch);
    check(hayTouch.on && hayLit, 'holding still on dry hay sets it alight');
    const field = await waitFor(() => __EL.room.props.filter(p => p.material === 'hay' && (__EL.fire.isBurning(p.thing) || __EL.fire.isBurned(p.thing))).length >= 6, 20000);
    check(field, 'fire runs through the hay field');
    await shot('14-hay');

    // 10b. An oil barrel, once lit, bursts: it lights and damages what's near, blamed on the player.
    await page.evaluate(() => { __EL.player.body.position.set(0, 0.45, -9); __EL.cam.yaw = 0.2; __EL.cam.pitch = 0.35; __EL.fire.ignite(__thing('TestRoom_Barrel_01'), 'player'); });
    const boom = await waitFor(() => __EL.EventBus.recent().some(e => e.type === 'Explosion'), 8000);
    await wait(300);
    await shot('15-explosion');
    const blast = await page.evaluate(() => ({
        cause: __EL.EventBus.recent().find(e => e.type === 'Explosion')?.cause,
        hurt: __EL.room.barricade.pieces.filter(p => p.hp < 100).length,
        lit: __EL.fire.stats().ignitions,
    }));
    check(boom && blast.cause === 'player' && blast.hurt > 0 && blast.lit >= 2, `a lit oil barrel explodes: damages the wall, lights what's near (${JSON.stringify(blast)})`);

    // 10c. A thrown rock knocks a training dummy over.
    const toppled = await page.evaluate(async () => {
        const d = __thing('TestRoom_Dummy_01'), e = __EL.room.rocks[5];
        e.body.position.set(9, 1.4, -3); e.body.velocity.set(0, 0, 0);
        __EL.throwRockAt(5, d.pos().add(new __EL.THREE.Vector3(0, 0.5, 0)), 22);
        await new Promise(r => setTimeout(r, 3500));
        const up = new __EL.THREE.Vector3(0, 1, 0).applyQuaternion(d.mesh.quaternion);
        return +up.y.toFixed(2);
    });
    check(toppled < 0.7, `a thrown rock knocks a dummy over (upright ${toppled})`);

    // 10d. A gust shifts a crate.
    const shifted = await page.evaluate(async () => {
        __EL.player.body.position.set(11, 0.45, 3);          // close: gusts are weak on purpose (phone test), and fall off with distance
        await new Promise(r => setTimeout(r, 400));
        const c = __thing('TestRoom_Crate_06'), p0 = c.entry.body.position.clone();   // the top crate: nothing on it
        __EL.air.gust(c.pos().sub(__EL.air.origin()).normalize());
        // Watch the crate, not the clock: under a loaded machine the physics runs fewer steps a second.
        let d = 0;
        for (let t = 0; t < 4000 && d <= 0.05; t += 100) { await new Promise(r => setTimeout(r, 100)); d = c.entry.body.position.distanceTo(p0); }
        return +d.toFixed(2);
    });
    check(shifted > 0.05, `a gust shifts a crate (${shifted} m)`);

    // 10e. Left alone, the obstacles reset (60 s in the room; 2 s here once nothing burns).
    await page.evaluate(() => { __EL.room.propReset.after = 2; for (const p of __EL.room.props) if (__EL.fire.isBurning(p.thing)) __EL.fire.douse(p.thing, 'player'); });
    const reset = await waitFor(() => __EL.room.props.every(p => !__EL.fire.isBurned(p.thing) && (!p.entry || p.entry.body.position.distanceTo(p.home.p) < 0.05)), 30000);
    check(reset, 'left alone, the obstacles reset: unburned, back in place');

    const perf = await page.evaluate(() => __EL.renderInfo());
    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));

    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) console.log(fail.map(p => '  FAIL ' + p).join('\n'));
    console.log(`  boot view: ${boot.calls} draw calls, ${(boot.tris / 1000).toFixed(1)}k triangles · end: ${perf.calls} calls`);
    if (fail.length) { console.log('SMOKE FAIL'); process.exit(1); }
    console.log('SMOKE PASS');
})();
