// ============================================================
// PROLOGUE — the Veyra fire, played twice: carefully and recklessly.
//
//   title → the character creator → Veyra, morning → the forge, a choice →
//   the square → the stone → dusk → the flock → the stone cracks and the
//   elements answer → the fire → Cael → the aftermath (what burned, who is
//   blamed, Bram's barn) → a choice → the prophecy → Lesson I, with what
//   happened remembered.
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/prologue.js
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
    const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const pass = [], fail = [];
    const check = (ok, msg) => (ok ? pass : fail).push(msg);
    const wait = ms => page.waitForTimeout(ms);
    const ev = (fn, a) => page.evaluate(fn, a);
    const until = (fn, ms, a) => page.waitForFunction(fn, a, { timeout: ms }).then(() => true).catch(() => false);
    const shot = n => page.screenshot({ path: path.join(SHOTS, n + '.png') });
    const skip = () => ev(() => { clearInterval(window.__skip); window.__skip = setInterval(() => { if (window.__EL?.story?.talking) __EL.hud.skipLine = true; }, 120); });
    const at = (x, z) => ev(([x, z]) => __EL.player.body.position.set(x, 0.45, z), [x, z]);

    // Morning to the awakening: the same both times.
    async function toTheFire(name) {
        await page.goto(BASE, { waitUntil: 'domcontentloaded' });
        await ev(() => localStorage.clear());
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.click('#title-menu button');                       // New game
        await page.fill('#creator-name', name);
        await page.click('.swatches[aria-label="Hair"] button >> nth=4');
        await page.click('#title-menu button.primary');               // Begin
        await page.waitForFunction(() => window.__EL?.story?.step === 'morning', null, { timeout: 30000 });
        await skip();
        await wait(600);
        await at(-11, 11);
        const met = await until(() => __EL.story.step === 'bram' && !!__EL.story.choosing, 15000);
        await ev(() => __EL.story.choose(0));
        await at(0, 3);
        await until(() => __EL.story.step === 'stone', 10000);
        await at(0, 0.6);
        const dusk = await until(() => ['dusk', 'attack', 'awaken'].includes(__EL.story.step), 15000);
        // The headless browser runs the game at about half speed: move the story's clock on through the waits.
        await ev(() => { if (__EL.story.step === 'dusk') __EL.story.t = 9; });
        await until(() => __EL.story.step === 'attack', 10000);
        await wait(3000);                                             // the flock is out
        await ev(() => { if (__EL.story.step === 'attack') __EL.story.t = 11; });
        const woke = await until(() => __EL.story.step === 'awaken', 10000);
        await ev(() => { __EL.vitals.invulnerable = true; });
        return { met, dusk, woke };
    }

    // ---- 1. Carefully ---------------------------------------------------------------------------------
    const a = await toTheFire('Rowan');
    const opening = await ev(() => ({ name: __EL.session.work.custom.name, hair: __EL.session.work.custom.look.hair, tone: __EL.prog.flags['veyra.tone'] }));
    check(opening.name === 'Rowan' && opening.hair && opening.tone === 'earnest', `New game: a name and a look, then Veyra; the forge choice is remembered (${JSON.stringify(opening)})`);
    check(a.met && a.dusk && a.woke, `the morning leads to dusk, the flock, and the awakening (${JSON.stringify(a)})`);
    const woke = await ev(() => ({ fire: __EL.prog.state('fire'), earth: __EL.prog.state('earth'), water: __EL.prog.state('water'), cracked: __EL.world.signal('StandingStone', 'cracked'), flock: __EL.creatures.all.length }));
    check(woke.fire === 'wild' && woke.earth === 'wild' && woke.water === 'wild' && woke.cracked && woke.flock > 0, `the stone cracks and three elements answer, all wild (${JSON.stringify(woke)})`);
    await shot('P1-awaken');
    // Fight the fire: drive the birds off with water, put out every fire with the stream.
    await ev(async () => {
        for (const c of __EL.creatures.all) c.react('water', 1, 'player');
        for (let i = 0; i < 20; i++) {
            for (const f of __EL.fire.flammables.values()) if (f.burning) __EL.fire.douse(f.thing, 'player');
            await new Promise(r => setTimeout(r, 400));
        }
    });
    const caelCame = await until(() => ['cael', 'damage', 'barn', 'blame', 'choice'].includes(__EL.story.step), 60000);
    await shot('P2-cael');
    const chose = await until(() => __EL.story.step === 'choice' && !!__EL.story.choosing, 30000);
    const after = await ev(() => ({ fire: __EL.prog.flags['veyra.fire'], barn: __EL.prog.flags['bram.barn'], blame: __EL.prog.flags['veyra.blame'], care: __EL.ledger.get('care'), harm: __EL.ledger.get('harm'), mood: __EL.EventBus.recent().length >= 0 }));
    check(caelCame && chose, 'Cael arrives when the fire is out and the birds are gone');
    check(after.fire !== 'ruin' && after.barn === 'saved' && after.blame !== 'you' && after.care > after.harm,
        `the careful night: little burned, Bram's barn saved, nobody blames you (${JSON.stringify(after)})`);
    await ev(() => __EL.story.choose(0));                              // help clear the ashes
    const lesson = await until(() => __EL.mode === 'lesson1' && __EL.story?.step, 60000);
    const carried = await ev(() => ({ mode: __EL.mode, fire: __EL.prog.state('fire'), earth: __EL.prog.state('earth'), water: __EL.prog.state('water'), after: __EL.prog.flags['veyra.after'], prologue: __EL.prog.flags.prologue, saved: JSON.parse(localStorage.getItem('elemental.save.1')).meta.scene, name: __EL.session.work.custom.name }));
    check(lesson && carried.fire === 'wild' && carried.earth === 'trained' && carried.water === 'locked' && carried.after === 'help' && carried.prologue === 'done' && carried.saved === 'lesson1' && carried.name === 'Rowan',
        `on to Lesson I: Fire stays wild, Earth is Cael's to teach, Water is gone again; the night is remembered and saved (${JSON.stringify(carried)})`);

    // ---- 2. Recklessly ----------------------------------------------------------------------------------
    await toTheFire('Wren');
    await ev(async () => {
        // Set every house and barn alight yourself, and let it burn.
        for (const t of __EL.interactables.things) if (/^Veyra_(House|Barn)_.*_R0$/.test(t.id)) __EL.fire.ignite(t, 'player', { direct: true });
    });
    await shot('P3-reckless');
    await until(() => [...__EL.world.objects.keys()].filter(id => /^Veyra_(House|Barn)/.test(id) && __EL.world.signal(id, 'burned')).length >= 3, 150000);
    await ev(() => { if (__EL.story.step === 'awaken') __EL.story.t = 150; });   // the fire's time is up: Cael comes
    const ruin = await until(() => __EL.story.step === 'choice', 60000);
    const after2 = await ev(() => ({ fire: __EL.prog.flags['veyra.fire'], blame: __EL.prog.flags['veyra.blame'], harm: __EL.ledger.get('harm'), standing: __EL.ledger.standingWord(), burned: [...__EL.world.objects.keys()].filter(id => /^Veyra_(House|Barn)/.test(id) && __EL.world.signal(id, 'burned')).length }));
    check(ruin && after2.blame === 'you' && after2.burned >= 3 && ['ruin', 'some'].includes(after2.fire),
        `the reckless night: houses burn, the village blames you, the kingdom's view of you drops (${JSON.stringify(after2)})`);
    await shot('P4-ruin');
    // The world remembers: come back to Veyra and it is still burned.
    await ev(() => __EL.story.choose(2));
    await until(() => __EL.mode === 'lesson1', 60000);
    await ev(() => __EL.travel('veyra', 'start'));
    await until(() => __EL.mode === 'veyra', 30000);
    await wait(800);
    const back = await ev(() => ({ burned: [...__EL.world.objects.keys()].filter(id => /^Veyra_(House|Barn)/.test(id) && __EL.world.signal(id, 'burned')).length, cracked: __EL.world.signal('StandingStone', 'cracked') }));
    check(back.burned === after2.burned && back.cracked, `back in Veyra, the burned houses are still burned and the stone still cracked (${JSON.stringify(back)})`);
    await shot('P5-remembered');

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('PROLOGUE FAIL'); process.exit(1); }
    console.log('PROLOGUE PASS');
})();
