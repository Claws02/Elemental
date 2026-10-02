// ============================================================
// BUILDINGS — houses, halls, bridges that burn and break true to what they
// are made of (world/Structure.js), and stay cheap to draw while they do
// (world/Skin.js).
//
//   1. the village's buildings are structures; timber burns, stone doesn't
//   2. a thatched cottage burns down, and the draw calls hold steady
//   3. a stone house with a plaster storey and a slate roof is gutted: the
//      timber burns, the roof loses its support and falls, the stone stands
//   4. stone breaks only under heavy blows
//   5. a landmark brought down weighs on the kingdom (ledger, a flag)
//   6. Thornwick's wooden bridge burns stretch by stretch; the ford below can
//      be waded; a burned cottage is still burned when the scene comes back
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/buildings.js
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
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const pass = [], fail = [];
    const check = (ok, msg) => { (ok ? pass : fail).push(msg); if (process.env.QA_LOUD) console.log((ok ? '  ok   ' : '  FAIL ') + msg); };
    const wait = ms => page.waitForTimeout(ms);
    const ev = (fn, a) => page.evaluate(fn, a);
    const open = async id => {
        await page.goto(`${BASE}?scene=${id}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 60000 });
        await wait(1200);
        await ev(() => {
            window.__W = ms => new Promise(r => setTimeout(r, ms));
            window.__S = id => __EL.world.objects.get(id).structure;
            // Set a structure's pieces of a material alight (the first `n`).
            window.__light = (id, mat, n = 2, cause = 'environment') => { const s = __S(id); for (const p of s.pieces.filter(q => q.mat === mat).slice(0, n)) __EL.fire.ignite(s.things.get(p), cause, { direct: true }); };
            // Wait (game time runs behind the wall clock headless) until `fn()` or `ms`; the most draw calls seen meanwhile.
            window.__until = async (fn, ms) => { const t0 = performance.now(); let calls = 0; while (performance.now() - t0 < ms && !fn()) { await __W(250); calls = Math.max(calls, __EL.renderInfo().calls); } return { ok: !!fn(), calls, secs: Math.round((performance.now() - t0) / 1000) }; };
        });
    };

    // ---- 1. what the village is made of -----------------------------------------------------------
    await open('village');
    const made = await ev(() => {
        const out = {};
        for (const [id, o] of __EL.world.objects) if (o.structure) {
            const m = {}; for (const p of o.structure.pieces) m[p.mat] = (m[p.mat] || 0) + 1;
            out[id] = m;
        }
        return { s: out, calls: __EL.renderInfo().calls, masonryThings: __S('House_01').pieces.filter(p => p.mat === 'masonry' && __S('House_01').things.has(p)).length };
    });
    const ms = made.s;
    check(ms.Cottage_01 && !ms.Cottage_01.masonry && ms.Cottage_01.thatch > 0 && ms.House_01?.masonry > 10 && ms.House_01.wood > 10 && ms.Smithy?.masonry > 0 && made.masonryThings === 0 && Object.keys(ms).length >= 6,
        `the village's buildings are structures, true to material: timber, plaster and thatch burn; stone and slate don't (${JSON.stringify(made)})`);

    // ---- 2. a cottage burns down ---------------------------------------------------------------------------
    const quiet = made.calls;
    const cottage = await ev(async () => {
        __light('Cottage_01', 'thatch', 2);
        const r = await __until(() => __S('Cottage_01').state === 'Burned', 150000);
        return { ...r, ...__S('Cottage_01').summary() };
    });
    await page.screenshot({ path: path.join(SHOTS, 'B1-cottage-burned.png') });
    check(cottage.ok && cottage.burned >= cottage.burnable * 0.5 && cottage.calls < quiet + 90,
        `a thatched cottage burns down, and the draw calls hold (${quiet} quiet, ${cottage.calls} at most while burning; ${JSON.stringify(cottage)})`);

    // ---- 3. the stone house is gutted ------------------------------------------------------------------------
    const gutted = await ev(async () => {
        const s = __S('House_01');
        // All its timber alight, so the test doesn't wait on where the fire happens to wander.
        __light('House_01', 'wood', 999);
        const r = await __until(() => s.pieces.filter(p => p.mat === 'wood').every(p => p.broken), 180000);
        await __W(1500);
        const masonry = s.pieces.filter(p => p.mat === 'masonry'), walls = masonry.filter(p => p.kind === 'b_wall'), roof = masonry.filter(p => p.kind === 'b_roof');
        return { ...r, state: s.state, wallsStanding: walls.filter(p => !p.broken).length, walls: walls.length, roofDown: roof.filter(p => p.broken).length, roof: roof.length };
    });
    await page.screenshot({ path: path.join(SHOTS, 'B2-house-gutted.png') });
    check(gutted.ok && gutted.state === 'Burned' && gutted.roofDown === gutted.roof && gutted.wallsStanding >= gutted.walls * 0.4,
        `a stone house with a plaster storey is gutted: the timber burns, the slate roof loses its support and falls, the stone walls stand (${JSON.stringify(gutted)})`);

    // ---- 4. stone breaks under blows only ---------------------------------------------------------------------
    const blows = await ev(async () => {
        const s = __S('Smithy'), p = s.pieces.find(q => q.mat === 'masonry' && q.kind === 'b_wall' && !q.broken);
        s.hit(p, 150, 'player'); await __W(400); const after1 = p.broken;
        s.hit(p, 150, 'player'); await __W(400); const after2 = p.broken;
        s.hit(p, 150, 'player'); await __W(400);
        return { after1, after2, after3: p.broken, hp0: p.hp0 };
    });
    check(!blows.after1 && blows.after3, `a stone wall takes heavy blows to break: one doesn't, three do (${JSON.stringify(blows)})`);

    // ---- 4b. a fireball thrown at a wall sets that piece alight (the building is one body; the piece hit is found) ----
    const thrown = await ev(async () => {
        const E = __EL, b = E.player.body, s = __S('Shed_01');
        b.position.set(7, 0.6, -6); b.velocity.set(0, 0, 0);
        await __W(300);
        const br = [...E.interactables.things].find(t => t.id === 'Brazier_01');
        E.fire.pullFrom(br, 'player');
        await __W(300);
        const f = E.fire.fireballs.values().next().value;
        if (!f) return { err: 'no fireball' };
        // An east wall piece, thrown at from 3 m east: a clear line (the cottage burned down earlier lies to the west).
        const p = s.pieces.filter(q => q.kind === 'b_wall' && !q.broken && q.box.min.y > 0.5).sort((a, b) => s.things.get(b).pos().x - s.things.get(a).pos().x)[0];
        const tp = s.things.get(p).pos();
        f.entry.body.position.set(tp.x + 3, tp.y, tp.z); f.entry.body.velocity.set(0, 0, 0);
        const hits = [];
        f.entry.body.addEventListener('collide', ev => { const sh = E.Physics.otherShape(ev); hits.push({ id: E.interactables.forEntry(ev.body.userData, sh)?.id || ev.body.userData?.id, idx: ev.body.shapes.indexOf(sh), n: ev.body.shapes.length, mapped: !!s.shapePiece.get(sh), bi: ev.contact.bi === ev.body, siIsShape: ev.contact.si === sh }); });
        const i0 = E.fire.ignitions;
        E.channel.throwEntry(f.entry, new E.THREE.Vector3(-1, 0, 0), 22, 'fire');     // west, at the wall
        // Struck and caught: any of the shed's pieces alight now, or burned already (a shed burns fast).
        const r = await __until(() => s.pieces.some(q => E.fire.isBurning(s.things.get(q)) || q.burned), 20000);
        return { ...r, hits: hits.slice(0, 4), ignitions: E.fire.ignitions - i0, lit: s.pieces.filter(q => E.fire.isBurning(s.things.get(q))).length };
    });
    check(thrown.ok, `a fireball thrown at a shed's wall sets the piece it hits alight (${JSON.stringify(thrown)})`);

    // ---- 5. a landmark brought down -------------------------------------------------------------------------------
    const landmark = await ev(async () => {
        const s = __S('Cottage_02');
        s.it.landmark = true;                         // stand-in: a ruler's hall (the halls are landmarks by their prefab)
        const h0 = __EL.ledger.get('harm'), x0 = __EL.ledger.get('excess');
        let heard = null; const off = __EL.EventBus.on(__EL.EventBus.EV?.LANDMARK || 'Landmark', e => { heard = e; });
        __light('Cottage_02', 'thatch', 3, 'player');
        const r = await __until(() => s.state === 'Burned', 150000);
        off?.();
        return { ...r, harm: __EL.ledger.get('harm') - h0, excess: __EL.ledger.get('excess') - x0, flag: __EL.prog.flags['destroyed.Cottage_02'] || __EL.session.work.progress.flags?.['destroyed.Cottage_02'], heard: !!heard };
    });
    check(landmark.ok && landmark.harm >= 12 && landmark.excess >= 1 && landmark.flag === 'burned',
        `a landmark burned by the player weighs on the kingdom (harm, excess) and is remembered (a flag) (${JSON.stringify(landmark)})`);
    check(errors.length === 0, 'the village: no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));

    // ---- 6. Thornwick: the wooden bridge, the ford, memory ----------------------------------------------------------------
    errors = [];
    await open('verdant');
    const bridge = await ev(async () => {
        const s = __S('Thornwick_Bridge');
        const stretches = s.pieces.length;
        __light('Thornwick_Bridge', 'wood', 1);
        const r = await __until(() => s.pieces.filter(p => p.broken).length >= 2, 150000);
        return { ...r, stretches, broken: s.pieces.filter(p => p.broken).length, mat: s.pieces[0].mat };
    });
    check(bridge.ok && bridge.mat === 'wood' && bridge.stretches >= 8, `Thornwick's bridge is timber: it catches and burns stretch by stretch (${JSON.stringify(bridge)})`);
    const ford = await ev(async () => {
        // From the west bank across the ford (it runs along (30, 22) through (-43, 28)).
        const T = __EL.world.terrain, b = __EL.player.body, ux = 30 / Math.hypot(30, 22), uz = 22 / Math.hypot(30, 22);
        const sx = -43 - ux * 13, sz = 28 - uz * 13;
        b.position.set(sx, T.height(sx, sz) + 0.6, sz); b.velocity.set(0, 0, 0);
        const yaw = Math.atan2(-ux, -uz);
        __EL.cam.yaw = yaw;
        await __W(300);
        let waded = false;
        dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        const t0 = performance.now();
        let along = -13;
        while (performance.now() - t0 < 30000 && along < 12) { await __W(80); __EL.cam.yaw = yaw; waded ||= !!__EL.player.wading; along = (b.position.x + 43) * ux + (b.position.z - 28) * uz; }
        dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        return { waded, along: +along.toFixed(1), stand: +(b.position.y - T.height(b.position.x, b.position.z)).toFixed(2) };
    });
    check(ford.waded && ford.along >= 12, `the ford below the bridge can be waded, bank to bank (${JSON.stringify(ford)})`);
    const before = await ev(async () => {
        const s = __S('Thornwick_03_cottage');
        __light('Thornwick_03_cottage', 'thatch', 3);
        const r = await __until(() => s.state === 'Burned', 150000);
        __EL.checkpoint();
        return { ...r, state: s.state };
    });
    await ev(() => __EL.restart());
    await page.waitForFunction(() => window.__EL?.ready && window.__EL.world?.objects.get('Thornwick_03_cottage'), null, { timeout: 60000 });
    await wait(1500);
    const after = await ev(() => { const s = __EL.world.objects.get('Thornwick_03_cottage').structure; return { state: s.state, standing: s.pieces.filter(p => !p.broken && p.mat !== 'masonry').length }; });
    check(before.ok && after.state === 'Burned' && after.standing === 0, `a burned cottage is still burned when the scene comes back (${JSON.stringify({ before, after })})`);
    check(errors.length === 0, 'Thornwick: no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));

    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('BUILDINGS FAIL'); process.exit(1); }
    console.log('BUILDINGS PASS');
})();
