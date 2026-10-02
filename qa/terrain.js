// ============================================================
// TERRAIN — phase 5: the ground as a height field, water bodies, culling
// (scenes/testlands.json, built by scripts/scenes/testlands.mjs).
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/terrain.js
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
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const pass = [], fail = [];
    const check = (ok, msg) => (ok ? pass : fail).push(msg);
    const wait = ms => page.waitForTimeout(ms);
    const ev = (fn, a) => page.evaluate(fn, a);
    const shot = n => page.screenshot({ path: path.join(SHOTS, n + '.png') });

    await page.goto(`${BASE}?scene=testlands`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 30000 });
    await wait(1200);
    await ev(() => {
        const el = document.getElementById('game');
        window.__touch = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
        window.__screen = p => { const q = p.clone().project(__EL.cam.cam); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight, on: q.z < 1 && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95 }; };
        window.__G = () => __EL.world.terrain;
    });

    // 1. Standing on it: the hero, objects, the physics and the drawn ground agree.
    const stand = await ev(() => {
        const T = __G(), b = __EL.player.body.position;
        const rock = __EL.world.objects.get('Hill_Rock'), house = __EL.world.objects.get('Plateau_House');
        const rp = rock.mesh ? rock.mesh.position : __EL.world.rocks[0].mesh.position;
        return {
            chunks: T.chunks.size, hero: +(b.y - T.height(b.x, b.z)).toFixed(2),
            rock: +(rp.y - T.height(rp.x, rp.z)).toFixed(2),
            house: +(house.building.group.position.y - 8).toFixed(2),
        };
    });
    check(stand.chunks >= 4 && Math.abs(stand.hero - 0.45) < 0.2 && stand.rock > -0.2 && stand.rock < 0.8 && Math.abs(stand.house) < 0.3,
        `the hero, a rock and a house stand on the terrain, not at y = 0 (${JSON.stringify(stand)})`);
    await shot('T1-terrain');

    // 2. Walking uphill: the body follows the ground.
    const climb = await ev(async () => {
        const T = __G(), b = __EL.player.body;
        b.position.set(-40, T.height(-40, -12) + 0.6, -12); b.velocity.set(0, 0, 0);
        __EL.cam.yaw = 0;                                         // facing -z: up the ridge to the north
        await new Promise(r => setTimeout(r, 400));
        const y0 = b.position.y, z0 = b.position.z;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        let worst = 0;
        const t0 = performance.now();
        while (performance.now() - t0 < 3000) { worst = Math.max(worst, Math.abs(b.position.y - T.height(b.position.x, b.position.z) - 0.45)); await new Promise(r => setTimeout(r, 50)); }
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        return { moved: +(z0 - b.position.z).toFixed(1), rose: +(b.position.y - y0).toFixed(2), ground: +(T.height(b.position.x, b.position.z) - T.height(-40, -12)).toFixed(2), worst: +worst.toFixed(2) };
    });
    check(climb.moved > 3 && climb.rose > 1 && Math.abs(climb.rose - climb.ground) < 0.4 && climb.worst < 0.35, `walking uphill, the hero follows the slope (${JSON.stringify(climb)})`);

    // 3. A touch on the ground finds the ground; stone rises from the hillside, not from y = 0.
    const raise = await ev(() => {
        const T = __G(), h = __EL.player.position;
        const p = new __EL.THREE.Vector3(h.x + 4, 0, h.z - 4); p.y = T.height(p.x, p.z);
        const s = __screen(p.clone());
        const g = __EL.works.groundAt(s.x, s.y);
        const c = __EL.works.raise(g || p);
        return { found: !!g, err: g ? +g.distanceTo(p).toFixed(2) : null, base: +(c.base - T.height(c.body.position.x, c.body.position.z)).toFixed(2) };
    });
    check(raise.found && raise.err < 0.6 && Math.abs(raise.base) < 0.05, `a touch on a hillside lands on it, and stone rises from the slope (${JSON.stringify(raise)})`);

    // 4. The lake: a source; shallow water slows; deep water is swum (qa/swim.js); a frozen stream leaves a floe to stand on.
    const lake = await ev(async () => {
        const T = __G(), W = __EL.world.waters, b = __EL.player.body, lake = W.bodies[0];
        // Shallow edge, then try for the middle.
        let wade = 0;
        for (let x = -12; x > -40; x -= 0.5) { const z = 25; if (W.depth(x, z) > 0.45 && W.depth(x, z) < 1) { b.position.set(x, T.height(x, z) + 0.5, z); break; } }
        await new Promise(r => setTimeout(r, 300));
        wade = __EL.player.wading;
        b.position.set(-25, T.height(-25, 25) + 0.5, 25);           // the deep middle
        await new Promise(r => setTimeout(r, 1200));
        const kept = !!__EL.player.swimming && Math.abs(lake.level - (b.position.y - __EL.player.radius) - 1.2) < 0.4;     // swimming, afloat
        // Back on the shore; draw a stream from the lake and freeze it onto open water.
        b.position.set(-10, T.height(-10, 25) + 0.5, 25); b.velocity.set(0, 0, 0);
        __EL.cam.yaw = Math.PI / 2;                               // facing -x: the lake
        await new Promise(r => setTimeout(r, 600));
        const thing = __EL.interactables.things.find(t => t.id === 'Lake');
        const ok = __EL.water.beginStream(thing);
        const S = __EL.water.stream.source.surface.clone();
        const aim = new __EL.THREE.Vector3(-22, 1.2, 25), sa = __screen(aim);
        __EL.water.aimStream(sa.x, sa.y);
        await new Promise(r => setTimeout(r, 900));
        const E = __EL.water.stream.cur.clone();
        __EL.ice.freeze(__EL.water.freeze().S, E, 'player');
        const floe = __EL.ice.arches[0]?.floe;
        // Stand on it.
        const f = floe?.mid;
        if (f) { b.position.set(f.x, f.y + 0.7, f.z); b.velocity.set(0, 0, 0); }
        await new Promise(r => setTimeout(r, 800));
        return { depthAt: +(lake.level - T.height(-25, 25)).toFixed(2), wade: +(wade || 0).toFixed(2), kept, source: ok && Math.abs(S.y - lake.level) < 0.01, floe: !!floe,
            onFloe: f ? +(b.position.y - f.y).toFixed(2) : null, wadingOnFloe: __EL.player.wading };
    });
    check(lake.depthAt > 1.3 && lake.wade > 0.3 && lake.kept, `shallow water slows you; in the deep middle of the lake you swim, afloat (${JSON.stringify(lake)})`);
    check(lake.source && lake.floe && lake.onFloe > 0.2 && lake.onFloe < 0.8 && !lake.wadingOnFloe, `a stream draws from the lake; frozen onto open water it leaves a floe you can stand on (${JSON.stringify(lake)})`);
    await shot('T2-lake-floe');

    // 5. Far things aren't drawn (this scene's view is 60 m).
    const cull = await ev(async () => {
        const b = __EL.player.body, T = __G();
        b.position.set(-40, T.height(-40, -40) + 0.5, -40);
        await new Promise(r => setTimeout(r, 1200));
        // The far tree is batched into its cell's scenery mesh: that is what is culled.
        const cell = () => __EL.world.batches.find(bt => Math.abs(bt.x - 55) <= 20 && Math.abs(bt.z - 55) <= 20);
        const far = cell().mesh.visible;
        b.position.set(45, T.height(45, 45) + 0.5, 45);
        await new Promise(r => setTimeout(r, 1200));
        return { farHidden: !far, nearShown: cell().mesh.visible, batched: __EL.world.objects.get('Far_Tree').batched, batches: __EL.world.batches.length };
    });
    check(cull.farHidden && cull.nearShown, `what's beyond the fog isn't drawn, and comes back as you approach (${JSON.stringify(cull)})`);
    const budget = await ev(() => __EL.renderInfo());
    check(budget.calls < 400, `draw calls within budget on terrain (${budget.calls} calls, ${(budget.triangles / 1000).toFixed(1)}k tris)`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('TERRAIN FAIL'); process.exit(1); }
    console.log('TERRAIN PASS');
})();
