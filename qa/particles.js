// ============================================================
// PARTICLES — every particle in the game on the GPU, in two draw calls
//
//   1. idle: the two particle meshes aren't drawn at all
//   2. fire burns: flames, embers and smoke live; still two meshes
//   3. an earth impact throws rock chips and dust; a blast throws sparks and
//      smoke; a splash throws drops and mist; a gust, wind streaks
//   4. a pool is a budget: full, and new particles are skipped
//   5. sparks and streaks are stretched along their motion and still drawn
//      (their quad's winding once made them invisible)
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/particles.js
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

    await page.goto(`${BASE}?scene=sandbox`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
    await ev(async () => { const R = await import('/src/engine/Renderer.js'); R.quality.adaptive = false; R.quality.level = 0; R.quality.fx = 1; });
    await page.waitForTimeout(1500);
    await ev(() => { window.__W = ms => new Promise(r => setTimeout(r, ms)); window.__gt = async s => { const P = __EL.particles; const t0 = P.t; while (P.t - t0 < s) await __W(15); }; });

    // Drawn only while something in them lives (the sandbox's braziers always burn, so test the rule, and a fresh pool's slice).
    const idle = await ev(async () => {
        await __gt(1); const P = __EL.particles;
        const rule = [P.add, P.alpha].every(b => b.mesh.visible === (P.t < b.until));
        return { rule, meshes: [P.add.mesh, P.alpha.mesh].filter(m => m.parent).length, untilAdd: +(P.add.until - P.t).toFixed(2) };
    });
    check(idle.rule && idle.meshes === 2, `two meshes carry every particle, drawn only while something in them lives (${JSON.stringify(idle)})`);

    const fire = await ev(async () => {
        const t = [...__EL.interactables.things].filter(t => /arricade/.test(t.id)).slice(0, 3);
        for (const x of t) __EL.fire.ignite(x, 'environment', { direct: true });
        await __gt(2.5);
        const s = __EL.fx.stats(), P = __EL.particles;
        return { flame: s.flame, smoke: s.smoke, embers: s.embers, drawn: [P.add.mesh.visible, P.alpha.mesh.visible] };
    });
    check(fire.flame > 20 && fire.smoke > 3 && fire.embers > 0 && fire.drawn.every(Boolean), `fire: flames, embers and smoke, in the two meshes (${JSON.stringify(fire)})`);

    const debris = await ev(async () => {
        const J = __EL.juice, W = __EL.water, A = __EL.air, h = __EL.player.position;
        const c0 = J.chips.alive, d0 = J.dust.alive, s0 = J.sparks.alive, m0 = W.mist.alive, r0 = W.drops.alive, w0 = A.streaks.alive;
        __EL.EventBus.emit('Impact', { x: h.x + 3, y: 0.3, z: h.z - 3, speed: 20, mass: 4, element: 'earth', ground: true, cause: 'player' });
        __EL.EventBus.emit('Explosion', { id: 'qa', cause: 'player', pos: { x: h.x - 3, y: 0.3, z: h.z - 3 } });
        W.splash(new __EL.THREE.Vector3(h.x, 0.2, h.z - 4), 1);
        A.gust(new __EL.THREE.Vector3(1, 0.1, 0));
        await __gt(0.1);
        return { chips: J.chips.alive - c0, dust: J.dust.alive - d0, sparks: J.sparks.alive - s0, mist: W.mist.alive - m0, drops: W.drops.alive - r0, streaks: A.streaks.alive - w0 };
    });
    check(debris.chips >= 5 && debris.dust >= 2 && debris.sparks >= 10 && debris.mist >= 4 && debris.drops >= 20 && debris.streaks >= 40,
        `impacts throw chips and dust, a blast sparks, a splash drops and mist, a gust streaks (${JSON.stringify(debris)})`);

    const budget = await ev(() => {
        const pool = __EL.particles.pool(8, 'dust');
        let ok = 0; for (let i = 0; i < 20; i++) if (pool.spawn({ x: 0, y: 1, z: 0, max: 5, s0: 0.2 })) ok++;
        return { asked: 20, got: ok, alive: pool.alive };
    });
    check(budget.got === 8 && budget.alive === 8, `a pool is a budget: full, and new particles are skipped (${JSON.stringify(budget)})`);

    // A spark flying across the view (stretched along its motion like a streak, without a streak's fade), frozen mid-flight.
    const streak = await ev(async () => {
        const P = __EL.particles, c = __EL.cam, h = __EL.player.position;
        const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
        await __gt(3);                                                     // let everything else die down
        const pool = P.pool(4, { kind: 'spark', add: false, g: 0, drag: 0, turb: 0, c0: 0xff00ff, a0: 1, c1: 0xff00ff, a1: 1 });
        const at = { x: h.x + fx * 2.5, y: 2.6, z: h.z + fz * 2.5 };
        const V = 4, born = P.t;
        pool.spawn({ ...at, vx: -fz * V, vy: 0, vz: fx * V, max: 4, s0: 0.5, s1: 0.5 });
        await __gt(0.05); P._freeze = true;
        await __W(300);
        const age = P.t - born;
        const q = new __EL.THREE.Vector3(at.x - fz * V * age, at.y, at.z + fx * V * age).project(c.cam);
        return { x: Math.round((q.x + 1) / 2 * innerWidth), y: Math.round((1 - q.y) / 2 * innerHeight) };
    });
    const px = await page.screenshot({ clip: { x: streak.x - 3, y: streak.y - 3, width: 6, height: 6 } });
    // Decode the clip in the page (no PNG library here): count magenta pixels.
    const magenta = await ev(async b64 => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, cv.width, cv.height).data; let m = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 120 && d[i + 2] > 150) m++;
        return m;
    }, px.toString('base64'));
    check(magenta > 0, `a fast spark, stretched along its motion, is drawn where it flies (${JSON.stringify({ ...streak, magenta })})`);
    await ev(() => { __EL.particles._freeze = false; });

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('PARTICLES FAIL'); process.exit(1); }
    console.log('PARTICLES PASS');
})();
