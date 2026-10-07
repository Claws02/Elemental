// ============================================================
// SALTMERE — Act II: the sea wall at spring tide (scenes/saltmere.json)
//
//   1. arriving from the cistern: Cael leads down to Lowtown, Bram follows;
//      the Tide-Regent is at her wall, not her council house
//   2. Oriel and the Tidekeepers: the wall's stone split; your answer remembered
//   3. the spring tide: the sea rises, and Lowtown (below it) fills through the
//      gap; the wall keeps the sea out everywhere else
//   4. a stone set on each of the three sockets: the wall closes itself, the
//      flood drains, and it's care (late: Lowtown wet, remembered)
//   5. the Tidestone: cracked on purpose, the same hand; who told Nerys
//   6. the tide turns; the Regent home; the wall stays closed on the next visit
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/saltmere.js
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

    // Lesson II told; arriving from the cistern.
    await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
    await ev(() => localStorage.clear());
    await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
    await ev(() => { const f = __EL.prog.flags; Object.assign(f, { lesson1: { outcome: 'quiet' }, prologue: 'done', 'act1.mill': 'done', 'act1.yard': 'done', 'act1.ruin': 'done', 'bram.joined': 'welcome', lesson2: 'done' }); __EL.prog.setState('earth', 'trained'); __EL.prog.setState('water', 'trained'); __EL.prog._save(); __EL.travel('saltmere', 'from_cistern'); });
    await page.waitForFunction(() => window.__EL?.mode === 'saltmere' && window.__EL?.ready, null, { timeout: 90000 });
    await page.waitForTimeout(1200);
    await ev(() => {
        window.__W = ms => new Promise(r => setTimeout(r, ms));
        window.__skip = async until => { for (let i = 0; i < 200 && !until(); i++) { __EL.hud.skipLine = true; await __W(120); } };
        window.__at = (x, z) => { const B = __EL.player.body, T = __EL.world.terrain; B.position.set(x, T.height(x, z) + 0.6, z); B.velocity.set(0, 0, 0); };
        window.__lvl = id => __EL.world.objects.get(id).water.level;
    });

    const arrive = await ev(async () => {
        await __W(500);
        const o = __EL.world.objects;
        return { step: __EL.story.step, cael: o.get('Cael')?.npc.role, bram: o.get('Bram')?.npc.role, regentHome: o.has('Oriel') && __EL.world.signal('Oriel', 'visible'), regentWall: o.has('Oriel_Wall'), objective: document.querySelector('#hud-objective .text')?.textContent };
    });
    check(arrive.step === 'shore' && arrive.cael === 'lead' && arrive.bram === 'follow' && !arrive.regentHome && arrive.regentWall && /Lowtown/.test(arrive.objective || ''),
        `arriving: Cael leads down to Lowtown, Bram follows; the Regent is at her wall (${JSON.stringify(arrive)})`);

    const wall = await ev(async () => {
        __at(-56, -3); await __W(1500);
        const at = __EL.story.step;
        await __skip(() => __EL.story.choosing);
        __EL.story.choose(1);
        await __skip(() => __EL.story.step === 'tide');
        return { at, offer: __EL.prog.flags['saltmere.offer'], step: __EL.story.step, sea: __lvl('Sea'), low: __lvl('Lowtown_Flood'), dryFloor: __EL.world.waters.depth(-66, -2) };
    });
    check(wall.at === 'wall' && wall.offer === 'doubt' && wall.step === 'tide' && wall.dryFloor === 0,
        `at the wall: Oriel and the Tidekeepers; your answer remembered; Lowtown dry before the tide (${JSON.stringify(wall)})`);

    // Wait out the tide a while (in game time): the sea rises everywhere; Lowtown fills through the gap.
    const tide = await ev(async () => {
        __at(-48, 0); for (let i = 0; i < 600 && __EL.story.t < 62; i++) await __W(500);
        const T = __EL.world.terrain;
        return { sea: +__lvl('Sea').toFixed(2), west: +__lvl('Sea_West').toFixed(2), low: +__lvl('Lowtown_Flood').toFixed(2), floor: +T.height(-66, -2).toFixed(2), berm: +T.height(-70, 14).toFixed(2), gap: +T.height(-58, 14).toFixed(2), wet: +__EL.world.waters.depth(-66, -2).toFixed(2), said: document.querySelector('#hud-say .line')?.textContent };
    });
    check(tide.sea > 1.6 && tide.west === tide.sea && tide.low > tide.floor && tide.berm > tide.sea + 0.8 && tide.gap < tide.sea && tide.wet > 0,
        `the spring tide: the sea rises; Lowtown fills through the gap, and the berm stands above it (${JSON.stringify(tide)})`);

    const seal = await ev(async () => {
        const plates = [1, 2, 3].map(i => __EL.world.objects.get('Breach_Socket_' + i).plate);
        const stones = __EL.world.rocks.filter(e => /^Breach_Stone_/.test(e.id || ''));
        const ids = stones.map(s => s.id);
        plates.forEach((p, i) => { const b = stones[i].body; b.position.set(p.pos.x, p.top + 0.5, p.pos.z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); });
        await __W(2500);
        const weighted = plates.map(p => !!p.weighted);
        await __skip(() => __EL.story.step === 'stone');
        const t0 = __EL.story.time; for (let i = 0; i < 400 && __EL.story.time - t0 < 27; i++) await __W(500);
        return { ids, weighted, flag: __EL.prog.flags['saltmere.wall'], seal: __EL.world.signal('Breach_Seal', 'visible'), low: +__lvl('Lowtown_Flood').toFixed(2), wet: __EL.world.waters.depth(-66, -2), care: __EL.ledger.get('care'), step: __EL.story.step };
    });
    check(seal.weighted.every(Boolean) && seal.flag === 'wet' && seal.seal && seal.wet === 0 && seal.care > 0 && seal.step === 'stone',
        `a stone set on each socket: the wall closes itself and the flood drains; late, so Lowtown got wet, and it's remembered (${JSON.stringify(seal)})`);

    const marks = await ev(async () => {
        __at(-62, 9); await __W(800);
        [...__EL.interactables.things].find(t => t.id === 'Tidestone').use(); await __W(800);
        await __skip(() => __EL.story.choosing);
        const at = __EL.story.step;
        __EL.story.choose(2);
        await __skip(() => __EL.story.step === 'done' || __EL.prog.flags['act2.saltmere'] === 'done');
        return { at, told: __EL.prog.flags['saltmere.told'], act: __EL.prog.flags['act2.saltmere'], away: __EL.prog.flags['saltmere.away'] };
    });
    check(marks.at === 'marks' && marks.told === 'asked' && marks.act === 'done' && !marks.away,
        `the Tidestone was cut on purpose, the same hand; Nerys says who told her; the tide turns and Saltmere's chapter is told (${JSON.stringify(marks)})`);

    // Come back: the wall stays closed, the Regent is home, the story doesn't run again.
    await ev(() => { __EL.prog._save(); __EL.travel('saltmere', 'from_cistern'); });
    await page.waitForFunction(() => window.__EL?.mode === 'saltmere' && window.__EL?.ready, null, { timeout: 90000 });
    await page.waitForTimeout(2500);
    const back = await ev(() => ({ seal: __EL.world.signal('Breach_Seal', 'visible'), home: __EL.world.objects.has('Oriel'), wallRegent: __EL.world.objects.has('Oriel_Wall'), story: __EL.story?.step ?? null, low: __EL.world.objects.get('Lowtown_Flood').water.level }));
    check(back.seal && back.home && !back.wallRegent && (!back.story || back.story === 'done') && back.low < 1,
        `the next visit: the wall stays closed, the Regent is home, Lowtown dry (${JSON.stringify(back)})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('SALTMERE FAIL'); process.exit(1); }
    console.log('SALTMERE PASS');
})();
