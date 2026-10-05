// ============================================================
// THORNWICK — Act I, The Dry Mill (scenes/verdant.json, docs/STORY.md)
//
//   1. arriving from the Gate: the river dammed (high above the throat, low
//      below it), the mill's wheel still, Cael leading you into town
//   2. the Lord-Warden asks; up the river, Doran the Stonebound warden and
//      the man in grey; your answers remembered
//   3. the quiet way: lift the rocks off the timber and the river carries
//      the jam away; the water comes back, the wheel turns, the Reach
//      remembers it as care; Maren, then Cael goes on north
//   4. come back: the river and the wheel as you left them, Cael gone on,
//      and Thornwick's people talk about what you did
//   5. the loud way: break the jam and the river comes all at once; the
//      dock and the mill's wheel go with it, on your account
//   6. without the lesson done (the Reach opened directly), no story runs
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/thornwick.js
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
    const helpers = () => ev(() => {
        window.__W = ms => new Promise(r => setTimeout(r, ms));
        window.__skip = async until => { for (let i = 0; i < 160 && !until(); i++) { __EL.hud.skipLine = true; await __W(120); } };
        window.__at = (x, z) => { const B = __EL.player.body, T = __EL.world.terrain; B.position.set(x, T.height(x, z) + 0.6, z); B.velocity.set(0, 0, 0); };
        window.__level = id => +__EL.world.waters.bodies.find(b => b.id === id).level.toFixed(2);
        window.__wheel = () => ['turning', 'stopped', 'wrecked'].find(s => __EL.world.signal('Thornwick_Mill_Wheel', s));
    });
    // A new game, through the Gate's lesson, arriving in the Reach as the story has it.
    const arrive = async () => {
        await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
        await ev(() => localStorage.clear());
        await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
        await ev(() => { __EL.prog.flags.lesson1 = { outcome: 'quiet' }; __EL.prog.flags.prologue = 'done'; __EL.prog.setState('earth', 'trained'); __EL.prog._save(); __EL.travel('verdant', 'from_gate'); });
        await page.waitForFunction(() => window.__EL?.mode === 'verdant' && window.__EL?.ready, null, { timeout: 90000 });
        await page.waitForTimeout(1500);
        await helpers();
    };
    // From the start of the story to the slide, answering Maren and Doran.
    const toSlide = () => ev(async () => {
        __at(10, 4); await __W(1500);
        const plaza = __EL.story.step;
        __at(18, -8); await __W(1500);
        await __skip(() => __EL.story.choosing);
        __EL.story.choose(2);                                  // why can't your Wielders do it?
        await __skip(() => __EL.story.step === 'north');
        __at(-9, -30); await __W(1500);
        await __skip(() => __EL.story.choosing);
        const doran = __EL.story.step;
        __EL.story.choose(1);                                  // who paid you?
        await __skip(() => __EL.story.step === 'slide');
        return { plaza, doran, ask: __EL.prog.flags['thornwick.ask'], paid: __EL.prog.flags['thornwick.doran'], step: __EL.story.step };
    });

    // ---- 1. arriving ---------------------------------------------------------------------------------------------
    await arrive();
    const start = await ev(async () => {
        const c = __EL.world.objects.get('Cael').npc, B = __EL.player.body;
        const s = { step: __EL.story.step, up: __level('River_2'), down: __level('River_4'), wheel: __wheel(), role: c.role };
        await __W(5000);                                       // standing still: he goes ahead and waits
        return { ...s, ahead: +(c.position.x - B.position.x).toFixed(1), waiting: !!c.waiting };
    });
    check(start.step === 'arrive' && start.up > 5 && start.down < 3 && start.wheel === 'stopped' && start.role === 'lead' && start.ahead > 4 && start.waiting,
        `arriving: the river dammed (high above the throat, low below), the wheel still, Cael leading you in and waiting (${JSON.stringify(start)})`);

    // ---- 2. Maren, Doran ---------------------------------------------------------------------------------------
    const road = await toSlide();
    check(road.plaza === 'hall' && road.doran === 'doran' && road.ask === 'asked' && road.paid === 'asked' && road.step === 'slide',
        `the Lord-Warden asks; up the river Doran tells of the man in grey; your answers remembered (${JSON.stringify(road)})`);

    // ---- 3. the quiet way ----------------------------------------------------------------------------------------
    const quiet = await ev(async () => {
        const T = __EL.world.terrain;
        for (let i = 1; i <= 6; i++) { const e = __EL.world.objects.get('Slide_Rock_' + i).entries[0]; e.body.position.set(-12 + i * 0.6, T.height(-12 + i * 0.6, -36) + 1, -36); e.body.velocity.set(0, 0, 0); e.body.wakeUp(); }
        await __W(2500);
        const r = { flag: __EL.prog.flags['thornwick.mill'], sunk: __EL.world.signal('Slide_Jam', 'sunk'), care: __EL.ledger.get('care'), harm: __EL.ledger.get('harm') };
        await __W(14000);
        Object.assign(r, { up: __level('River_2'), down: __level('River_4'), wheel: __wheel() });
        await __skip(() => __EL.story.step === 'back');
        __at(18, -8); await __W(1500);
        await __skip(() => ['yard', 'gone', 'ruinroad', 'done'].includes(__EL.story.step));
        await __W(2000);
        return { ...r, end: __EL.story.step, act: __EL.prog.flags['act1.mill'] };
    });
    check(quiet.flag === 'quiet' && quiet.sunk && quiet.care >= 3 && quiet.harm === 0 && quiet.up < 5.1 && quiet.down > 3.2 && quiet.wheel === 'turning' && quiet.act === 'done',
        `the quiet way: rocks lifted, the jam carried off, the water coming back, the wheel turning, counted as care; Maren; Cael goes on north (${JSON.stringify(quiet)})`);

    // ---- 4. coming back ------------------------------------------------------------------------------------------
    await ev(() => { __EL.session.commit?.(); __EL.travel('gate', 'from_verdant'); });
    await page.waitForFunction(() => window.__EL?.mode === 'gate' && window.__EL?.ready, null, { timeout: 90000 });
    await ev(() => __EL.travel('verdant', 'from_gate'));
    await page.waitForFunction(() => window.__EL?.mode === 'verdant' && window.__EL?.ready, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    await helpers();
    const back = await ev(async () => {
        const r = { up: __level('River_2'), down: __level('River_4'), wheel: __wheel(), sunk: __EL.world.signal('Slide_Jam', 'sunk'), cael: __EL.world.objects.has('Cael'), story: __EL.story?.step ?? null };
        // Hobb, at his mill: tap him.
        const n = __EL.world.objects.get('Thornwick_Miller').npc;
        __at(n.position.x + 3, n.position.z); await __W(800);
        __EL.talk.talkTo(n); await __W(300);
        r.hobb = document.querySelector('#hud-say .line')?.textContent;
        return r;
    });
    check(back.up === 4.6 && back.down === 4.6 && back.wheel === 'turning' && back.sunk && back.cael && ['yard', 'ruinroad', 'done', null].includes(back.story) && /wheel|loaf/i.test(back.hobb || ''),
        `back in the Reach: the river and the wheel as you left them, Cael waiting at the yard, and Hobb glad of it (${JSON.stringify(back)})`);

    // ---- 5. the loud way -------------------------------------------------------------------------------------------
    await arrive();
    await toSlide();
    const loud = await ev(async () => {
        const d = __EL.world.objects.get('Slide_Jam').destructible;
        for (let r = 0; r < 3; r++) for (let c = 2; c < 9; c++) d.hit(r, c, 500, 'player', new __EL.THREE.Vector3(0, 0, 4));
        let peak = 0;
        for (let i = 0; i < 40; i++) { await __W(220); peak = Math.max(peak, __level('River_4')); }     // the surge's highest
        return { flag: __EL.prog.flags['thornwick.mill'], peak, wheel: __wheel(), dock: __EL.world.signal('Thornwick_Dock', 'collapsed'), harm: __EL.ledger.get('harm'), excess: __EL.ledger.get('excess') };
    });
    check(loud.flag === 'loud' && loud.peak > 4.8 && loud.wheel === 'wrecked' && loud.dock && loud.harm >= 1 && loud.excess >= 1,
        `the loud way: the jam broken, the river all at once; the dock and the mill's wheel go with it, on your account (${JSON.stringify(loud)})`);

    // ---- 6. no lesson, no story --------------------------------------------------------------------------------
    await page.goto(`${BASE}?scene=verdant`, { waitUntil: 'domcontentloaded' });
    await ev(() => localStorage.clear());
    await page.goto(`${BASE}?scene=verdant`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
    await page.waitForTimeout(1200);
    await helpers();
    const plain = await ev(() => ({ story: !!__EL.story, down: __level('River_4'), cael: __EL.world.objects.has('Cael') }));
    check(!plain.story && plain.down === 4.6 && !plain.cael, `the Reach opened directly (no lesson yet): no story, the river as it is (${JSON.stringify(plain)})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('THORNWICK FAIL'); process.exit(1); }
    console.log('THORNWICK PASS');
})();
