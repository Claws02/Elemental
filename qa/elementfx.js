// ============================================================
// ELEMENT FX — the elements' materials, wind ribbons, ground plates
//
//   1. the water stream is a flowing shader surface (uv along it), not a flat tube
//   2. a fireball wears a churning shell; the shell's material is SHARED, and
//      survives a fireball going out (disposing it would recompile it, a stall,
//      for the next one)
//   3. the flame jet's beam is a streaming-flame shader
//   4. a gust shows wind ribbons, which fade away after; the ladder sheds them
//   5. raising a column breaks the ground into plates that lever up and settle
//      back; pulling a stone, a smaller ring
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/elementfx.js
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
    await page.waitForTimeout(1200);
    await ev(() => { window.__W = ms => new Promise(r => setTimeout(r, ms)); window.__gt = async s => { const P = __EL.particles; const t0 = P.t; while (P.t - t0 < s) await __W(15); }; });

    const water = await ev(() => { const t = __EL.water.tube; return { mat: t.material.type, uv: !!t.geometry.attributes.uv, flows: 'uTime' in (t.material.uniforms || {}) }; });
    check(water.mat === 'ShaderMaterial' && water.uv && water.flows, `the water stream is a flowing shader surface (${JSON.stringify(water)})`);

    const fire = await ev(async () => {
        const F = __EL.fire, h = __EL.player.position;
        const mk = () => { const th = F._makeFireball(new __EL.THREE.Vector3(h.x, 1.6, h.z - 2), 'player'); return [...F.fireballs].find(f => f.thing === th); };
        const a = mk(), mat = a.shell.material;
        F._dissipate(a);
        await __gt(0.1);
        const b = mk();
        const shared = b.shell.material === mat && mat === F._shellMat;
        const R = (await import('/src/engine/Renderer.js')).get().renderer;
        const compiled = R.info.programs.length;
        await __gt(0.3);
        const after = R.info.programs.length;
        F._dissipate(b);
        return { shader: mat.type, shared, programsSteady: after === compiled };
    });
    check(fire.shader === 'ShaderMaterial' && fire.shared && fire.programsSteady, `a fireball's churning shell is one shared material that survives a fireball going out; no new shader for the next (${JSON.stringify(fire)})`);

    const jet = await ev(() => ({ mat: __EL.intent.jet?.beamMat?.type, wild: 'uWild' in (__EL.intent.jet?.beamMat?.uniforms || {}) }));
    check(jet.mat === 'ShaderMaterial' && jet.wild, `the flame jet's beam is a streaming-flame shader (${JSON.stringify(jet)})`);

    const wind = await ev(async () => {
        const R = __EL.elementFx.ribbons;
        __EL.air.gust(new __EL.THREE.Vector3(1, 0.1, 0));
        await __gt(0.15);
        const during = { vis: R.root.visible, k: +R.k.toFixed(2) };
        await __gt(1.6);
        const after = { vis: R.root.visible };
        const Rn = await import('/src/engine/Renderer.js'); const fx0 = Rn.quality.fx; Rn.quality.fx = 0.25;
        __EL.air.gust(new __EL.THREE.Vector3(1, 0.1, 0)); await __gt(0.15);
        const shed = !R.root.visible; Rn.quality.fx = fx0;
        return { during, after, shed };
    });
    check(wind.during.vis && wind.during.k > 0.3 && !wind.after.vis && wind.shed, `a gust shows wind ribbons that fade after; the ladder sheds them (${JSON.stringify(wind)})`);

    const earth = await ev(async () => {
        const P = __EL.elementFx.plates, h = __EL.player.position;
        __EL.works.raise(new __EL.THREE.Vector3(h.x + 3, 0, h.z - 3), 'player');
        await __gt(0.3);
        const rose = P.mesh.count;
        // Each plate stands proud of the ground at its peak.
        const m = new __EL.THREE.Matrix4(), q = new __EL.THREE.Quaternion(), up = new __EL.THREE.Vector3(0, 1, 0);
        P.mesh.getMatrixAt(0, m); m.decompose(new __EL.THREE.Vector3(), q, new __EL.THREE.Vector3());
        const lifted = +up.clone().applyQuaternion(q).angleTo(up).toFixed(2);      // tipped up on its outer edge
        await __gt(3.2);
        const later = P.mesh.count;
        __EL.EventBus.emit('EarthPulled', { id: 'qa', x: h.x - 2, z: h.z - 2, cause: 'player' });
        await __gt(0.05);
        const pulled = P.mesh.count;
        return { up: rose, lifted, later, pulled };
    });
    check(earth.up >= 6 && earth.lifted > 0.2 && earth.later === 0 && earth.pulled >= 3 && earth.pulled < earth.up,
        `raised earth breaks the ground into plates that lever up and settle back; a pulled stone, a smaller ring (${JSON.stringify(earth)})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('ELEMENTFX FAIL'); process.exit(1); }
    console.log('ELEMENTFX PASS');
})();
