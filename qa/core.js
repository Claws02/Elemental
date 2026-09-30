// ============================================================
// CORE — the loop around the scenes, in the browser: the title and save
// slots, health, dying and checkpoints, what the world remembers, travel.
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/core.js
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
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const pass = [], fail = [];
    const check = (ok, msg) => (ok ? pass : fail).push(msg);
    const wait = ms => page.waitForTimeout(ms);
    const ev = (fn, a) => page.evaluate(fn, a);
    const ready = () => page.waitForFunction(() => window.__EL?.ready, null, { timeout: 30000 });
    const shot = n => page.screenshot({ path: path.join(SHOTS, n + '.png') });

    // 1. A new game from the title writes slot 1.
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await ev(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(400);
    const menu = await ev(() => [...document.querySelectorAll('#title-menu button')].map(b => b.firstChild.textContent));
    check(menu.join() === 'New game', `a first launch offers only New game (${menu.join(', ')})`);
    await shot('C0-title');
    await page.click('#title-menu button');
    await ready();
    await wait(800);
    const slot = await ev(() => { const s = JSON.parse(localStorage.getItem('elemental.save.1')); return { scene: s?.meta.scene, cp: s?.checkpoint?.scene }; });
    check(slot.scene === 'lesson1' && slot.cp === 'lesson1', `New game starts the story and checkpoints on arrival (${JSON.stringify(slot)})`);

    // 2. Health: fire hurts, and it heals (waiting on the game's own clock, not the wall's).
    const hurt = await ev(async () => {
        const L = __EL, piece = L.interactables.things.find(t => t.id === 'TestRoom_Barricade_01_P02');
        L.fire.ignite(piece, 'environment');
        const p = piece.pos();
        L.player.body.position.set(p.x, 0.45, p.z + 0.6);
        await new Promise(r => setTimeout(r, 1500));
        const h = L.vitals.health;
        L.player.body.position.set(0, 0.45, 6);
        L.fire.douse(piece, 'environment');
        return { h: Math.round(h), edge: +getComputedStyle(document.getElementById('hud-vignette')).opacity };
    });
    const healed = await page.waitForFunction(() => __EL.vitals.health >= 100, null, { timeout: 20000 }).then(() => true).catch(() => false);
    check(hurt.h < 90 && healed, `standing in fire hurts; out of it, you heal back to full (${JSON.stringify(hurt)})`);

    // 3. A checkpoint, then something changes, then death: back to the checkpoint, the change undone.
    await ev(() => { const S = __EL.story; S.queue.length = 0; S.go('place'); __EL.player.body.position.set(1, 0.45, 2); });
    await wait(400);
    const cp = await ev(() => __EL.checkpoint());
    await ev(() => { for (const o of __EL.world.objects.values()) if (o.hidden) __EL.world.reveal(o.id); __EL.player.body.position.set(-4, 0.45, 8); });
    await wait(1600);
    const out = await ev(() => __EL.world.rocks.filter(e => e.body.world).length);
    await ev(() => __EL.vitals.hurt(999, 'fall'));
    await wait(400);
    const dark = await ev(() => document.getElementById('hud-died').classList.contains('on'));
    await page.waitForFunction(() => window.__EL && __EL.vitals.health === 100 && __EL.world.rocks.filter(e => e.body.world).length === 3, null, { timeout: 15000 }).catch(() => {});
    await wait(600);
    const back = await ev(() => ({ step: __EL.story.step, x: +__EL.player.body.position.x.toFixed(1), z: +__EL.player.body.position.z.toFixed(1), rocks: __EL.world.rocks.filter(e => e.body.world).length, health: __EL.vitals.health }));
    check(out === 10 && dark, `the stones rose, then the hero died and the screen went dark (${out} out)`);
    check(back.step === 'place' && Math.abs(back.x - cp.spawn.x) < 0.3 && Math.abs(back.z - cp.spawn.z) < 0.3 && back.rocks === 3 && back.health === 100,
        `death returns to the checkpoint: same step, same place, and what happened since is undone (${JSON.stringify(back)})`);

    // 4. What the world remembers: finish the trial the loud way (it saves itself), quit, continue.
    await ev(() => { const S = __EL.story; S.queue.length = 0; for (const o of __EL.world.objects.values()) if (o.hidden) __EL.world.reveal(o.id); S.go('trial'); });
    await wait(1600);
    await ev(() => { for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) __EL.room.barricade.hit(r, c, 500, 'player'); });
    const ended = await page.waitForFunction(() => __EL.story.outcome === 'loud', null, { timeout: 15000 }).then(() => true).catch(() => false);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await wait(500);
    const menu2 = await ev(() => [...document.querySelectorAll('#title-menu button')].map(b => b.firstChild.textContent));
    await page.click('#title-menu button.primary');
    await ready();
    await wait(1000);
    const kept = await ev(() => ({ state: __EL.world.barricade.state, standing: __EL.world.barricade.pieces.filter(p => p.entry.body.world).length, rocks: __EL.world.rocks.filter(e => e.body.world).length, outcome: __EL.prog.flags.lesson1?.outcome, step: __EL.story.step }));
    check(ended && menu2[0] === 'Continue' && ['Collapsed', 'Burned'].includes(kept.state) && kept.standing === 0 && kept.rocks === 10 && kept.outcome === 'loud' && kept.step !== 'intro',
        `Continue brings back a barricade that stays broken, the stones out, the outcome, and no replayed lesson (${JSON.stringify({ menu: menu2, kept })})`);

    // 5. Travel: into the village, a checkpoint on arrival.
    await ev(() => __EL.travel('village', 'start'));
    await page.waitForFunction(() => window.__EL?.mode === 'village', null, { timeout: 15000 }).catch(() => {});
    await wait(800);
    const there = await ev(() => ({ mode: __EL.mode, scene: JSON.parse(localStorage.getItem('elemental.save.1')).meta.scene, earth: __EL.prog.control('earth') }));
    check(there.mode === 'village' && there.scene === 'village', `travelling loads the next scene and saves there (${JSON.stringify(there)})`);
    await shot('C1-village');

    // 6. An exit object: walk into it.
    await ev(() => {
        const V = __EL.THREE;
        __EL.world.onExit('courtyard', 'start');
    });
    await page.waitForFunction(() => window.__EL?.mode === 'courtyard', null, { timeout: 15000 }).catch(() => {});
    check(await ev(() => __EL.mode) === 'courtyard', 'an exit takes you to its scene');

    // 7. The ledger counts harm to what people own.
    const led = await ev(async () => {
        const crate = __EL.world.objects.get('TestRoom_Crate_01');
        crate.item.owner = 'civilian';
        __EL.fire.ignite(crate.prop.thing, 'player', { direct: true });
        await new Promise(r => setTimeout(r, 300));
        return { harm: __EL.ledger.get('harm'), word: __EL.ledger.standingWord() };
    });
    check(led.harm > 0, `setting fire to someone's crate goes in the ledger (${JSON.stringify(led)})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('CORE FAIL'); process.exit(1); }
    console.log('CORE PASS');
})();
