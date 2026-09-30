// ============================================================
// PROLOGUE — the Veyra fire, played twice: carefully and recklessly.
//
//   title → the character creator → Veyra, morning (no powers yet) → the forge,
//   a choice → the square → the stone → dusk, home → the flock goes for you →
//   the stone cracks, every element answers wild, and your own roof catches →
//   the fire → Cael → the aftermath (what burned, who is blamed, Bram's barn) →
//   Cael's charm, worn or refused → a choice → the prophecy → Lesson I, with
//   what happened remembered. Refused, the power surges on its own; the charm
//   can still be put on later.
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
        const powerless = await ev(() => ['earth', 'fire', 'water', 'air'].every(el => !__EL.prog.has(el)));
        const home = await until(() => __EL.story.step === 'home', 15000);
        await ev(() => { window.__fires = []; __EL.EventBus.on('FireStarted', e => __fires.push(e.cause)); });
        await at(6.5, 8);
        await until(() => __EL.story.step === 'attack', 10000);
        await until(() => __EL.vitals.health < 100, 20000);             // they come for you
        const beforeCrack = await ev(() => ({ fires: __fires.length, hp: Math.round(__EL.vitals.health), any: ['earth', 'fire', 'water', 'air'].some(el => __EL.prog.has(el)) }));
        // The headless browser runs the game at about half speed: move the story's clock on through the waits.
        await ev(() => { if (__EL.story.step === 'attack') __EL.story.t = 8; });
        const woke = await until(() => __EL.story.step === 'awaken', 10000);
        await ev(() => { __EL.vitals.invulnerable = true; __EL.surges.enabled = false; });
        return { met, dusk: home, woke, powerless, beforeCrack };
    }

    // ---- 1. Carefully ---------------------------------------------------------------------------------
    const a = await toTheFire('Rowan');
    const opening = await ev(() => ({ name: __EL.session.work.custom.name, hair: __EL.session.work.custom.look.hair, tone: __EL.prog.flags['veyra.tone'] }));
    check(opening.name === 'Rowan' && opening.hair && opening.tone === 'earnest', `New game: a name and a look, then Veyra; the forge choice is remembered (${JSON.stringify(opening)})`);
    check(a.met && a.dusk && a.woke && a.powerless, `the morning (no powers yet) leads to dusk, home, the flock, and the awakening (${JSON.stringify(a)})`);
    check(a.beforeCrack.fires === 0 && a.beforeCrack.hp < 100 && !a.beforeCrack.any, `the flock goes for you, not the thatch, and you can't answer yet (${JSON.stringify(a.beforeCrack)})`);
    const woke = await ev(() => ({ states: ['earth', 'fire', 'water', 'air'].map(el => __EL.prog.state(el)).join(), cracked: __EL.world.signal('StandingStone', 'cracked'), home: __EL.world.signal('Veyra_House_Home', 'burning'), by: __fires.join(), harm: __EL.ledger.get('harm'), charm: __EL.prog.flags.charm }));
    check(woke.states === 'wild,wild,wild,wild' && woke.cracked && woke.home && woke.by === 'awakening,awakening' && woke.harm === 0 && woke.charm === 'none',
        `the stone cracks, all four answer wild, and your own roof catches: the power's doing, not a choice the ledger holds against you (${JSON.stringify(woke)})`);
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
    const offered = await until(() => __EL.story.step === 'charm' && !!__EL.story.choosing, 30000);
    await ev(() => __EL.story.choose(0));                              // put it on
    const chose = offered && await until(() => __EL.story.step === 'choice' && !!__EL.story.choosing, 30000);
    const after = await ev(() => ({ fire: __EL.prog.flags['veyra.fire'], barn: __EL.prog.flags['bram.barn'], blame: __EL.prog.flags['veyra.blame'], care: __EL.ledger.get('care'), harm: __EL.ledger.get('harm'), mood: __EL.EventBus.recent().length >= 0 }));
    check(caelCame && chose, 'Cael arrives when the fire is out and the birds are gone');
    check(after.fire !== 'ruin' && after.barn === 'saved' && after.blame !== 'you' && after.care > after.harm,
        `the careful night: little burned, Bram's barn saved, nobody blames you (${JSON.stringify(after)})`);
    await ev(() => __EL.story.choose(0));                              // help clear the ashes
    const lesson = await until(() => __EL.mode === 'lesson1' && __EL.story?.step, 60000);
    const carried = await ev(() => ({ mode: __EL.mode, fire: __EL.prog.state('fire'), earth: __EL.prog.state('earth'), water: __EL.prog.state('water'), charm: __EL.prog.flags.charm, canFire: __EL.prog.has('fire'), canEarth: __EL.prog.has('earth'), surges: __EL.surges.active, after: __EL.prog.flags['veyra.after'], prologue: __EL.prog.flags.prologue, saved: JSON.parse(localStorage.getItem('elemental.save.1')).meta.scene, name: __EL.session.work.custom.name }));
    check(lesson && carried.fire === 'wild' && carried.earth === 'trained' && carried.water === 'wild' && carried.charm === 'worn' && !carried.canFire && carried.canEarth && !carried.surges && carried.after === 'help' && carried.prologue === 'done' && carried.saved === 'lesson1' && carried.name === 'Rowan',
        `on to Lesson I wearing the charm: what's wild is still, Earth (Cael's to teach) answers, nothing surges; the night is remembered and saved (${JSON.stringify(carried)})`);

    // ---- 2. Recklessly ----------------------------------------------------------------------------------
    await toTheFire('Wren');
    await ev(async () => {
        // Set every house and barn alight yourself, and let it burn.
        for (const t of __EL.interactables.things) if (/^Veyra_(House|Barn)_.*_R0$/.test(t.id)) __EL.fire.ignite(t, 'player', { direct: true });
    });
    await shot('P3-reckless');
    await until(() => [...__EL.world.objects.keys()].filter(id => /^Veyra_(House|Barn)/.test(id) && __EL.world.signal(id, 'burned')).length >= 3, 150000);
    await ev(() => { if (__EL.story.step === 'awaken') __EL.story.t = 150; });   // the fire's time is up: Cael comes
    const refusedAt = await until(() => __EL.story.step === 'charm' && !!__EL.story.choosing, 60000);
    await ev(() => __EL.story.choose(1));                              // not yet
    const ruin = refusedAt && await until(() => __EL.story.step === 'choice', 60000);
    const after2 = await ev(() => ({ fire: __EL.prog.flags['veyra.fire'], blame: __EL.prog.flags['veyra.blame'], harm: __EL.ledger.get('harm'), standing: __EL.ledger.standingWord(), burned: [...__EL.world.objects.keys()].filter(id => /^Veyra_(House|Barn)/.test(id) && __EL.world.signal(id, 'burned')).length }));
    check(ruin && after2.blame === 'you' && after2.burned >= 3 && ['ruin', 'some'].includes(after2.fire),
        `the reckless night: houses burn, the village blames you, the kingdom's view of you drops (${JSON.stringify(after2)})`);
    await shot('P4-ruin');
    // The world remembers: come back to Veyra and it is still burned.
    await ev(() => __EL.story.choose(2));
    await until(() => __EL.mode === 'lesson1' && __EL.story?.step, 60000);
    await wait(800);
    // Refused: the power goes off on its own. Force one next to Cael and see it counted.
    const surged = await ev(() => {
        const c = __EL.world.objects.get('Cael').npc.position, h0 = __EL.ledger.get('harm');
        __EL.player.body.position.set(c.x + 1.2, 0.45, c.z);
        const s = __EL.surges.surge('air', { at: new __EL.THREE.Vector3(c.x + 1.2, 0, c.z) });
        return { active: __EL.surges.active, hurt: s.hurt, harm: __EL.ledger.get('harm') - h0, charmButton: document.getElementById('hud-charm').classList.contains('on'), canFire: __EL.prog.has('fire') };
    });
    check(surged.active && surged.hurt.includes('Cael') && surged.harm >= 1 && surged.charmButton && surged.canFire,
        `refused, the power surges on its own and hurts whoever is close; the charm waits in your pocket (${JSON.stringify(surged)})`);
    await page.click('#hud-charm');
    await wait(300);
    await page.click('#hud-choices button >> nth=0');
    await wait(300);
    const worn = await ev(() => ({ charm: __EL.prog.flags.charm, active: __EL.surges.active, canFire: __EL.prog.has('fire'), button: document.getElementById('hud-charm').classList.contains('on'), saved: JSON.parse(localStorage.getItem('elemental.save.1')).progress.flags.charm }));
    check(worn.charm === 'worn' && !worn.active && !worn.canFire && !worn.button && worn.saved === 'worn', `put on later, the charm stills the wild elements, and stays on (${JSON.stringify(worn)})`);
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
