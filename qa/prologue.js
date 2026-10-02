// ============================================================
// PROLOGUE — the Veyra fire, played twice: carefully and recklessly.
//
//   title → the character creator → Veyra, morning (no powers yet) → the forge,
//   a choice → the square → the stone (touched; it answers; Wynn) → dusk, home → the flock goes for you →
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
    const check = (ok, msg) => { (ok ? pass : fail).push(msg); if (process.env.QA_LOUD) console.log((ok ? "  ok   " : "  FAIL ") + msg); };
    const wait = ms => page.waitForTimeout(ms);
    const ev = (fn, a) => page.evaluate(fn, a);
    const until = (fn, ms, a) => page.waitForFunction(fn, a, { timeout: ms }).then(() => true).catch(() => false);
    const shot = n => page.screenshot({ path: path.join(SHOTS, n + '.png') });
    const skip = () => ev(() => { clearInterval(window.__skip); window.__skip = setInterval(() => { if (window.__EL?.story?.talking) __EL.hud.skipLine = true; }, 120); });
    const at = (x, z) => ev(([x, z]) => __EL.player.body.position.set(x, 0.45, z), [x, z]);

    let door = null;
    // Home's door: shut, it stops you; tapped, it swings in and you can walk inside.
    async function doorCheck() {
        const walk = async secs => { await ev(() => { __EL.cam.yaw = -Math.PI / 2; }); await page.keyboard.down('KeyW'); await wait(secs * 1000); await page.keyboard.up('KeyW'); return ev(() => +__EL.player.body.position.x.toFixed(2)); };
        await at(6.4, 8);
        await wait(400);
        const shutX = await walk(1.5);
        await at(6.4, 8);
        await wait(300);
        const tapped = await ev(async () => {
            const b = __EL.world.objects.get('Veyra_House_Home').building, c = b.door.entry.body.position, s = __screen(new __EL.THREE.Vector3(c.x, 1.6, c.z));     // its upper half: the lower-left of the screen is the move stick
            __touch('pointerdown', 9, s.x, s.y); await new Promise(r => setTimeout(r, 60)); __touch('pointerup', 9, s.x, s.y);
            await new Promise(r => setTimeout(r, 1200));
            return { open: b.door.open, angle: +b.door.angle.toFixed(2), signal: __EL.world.signal('Veyra_House_Home', 'open') };
        });
        const inX = await walk(2.5);
        return { shutX, ...tapped, inX };
    }

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
        await ev(() => {
            const el = document.getElementById('game');
            window.__touch = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
            window.__screen = p => { const q = p.clone().project(__EL.cam.cam); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight, on: q.z < 1 && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95 }; };
        });
        await wait(600);
        if (name === 'Rowan') door = await doorCheck();
        await at(-11, 11);
        const met = await until(() => __EL.story.step === 'bram' && !!__EL.story.choosing, 15000);
        await ev(() => __EL.story.choose(0));
        await at(0, 3);
        await until(() => __EL.story.step === 'stone', 10000);
        await at(0, 0.6);
        const powerless = await ev(() => ['earth', 'fire', 'water', 'air'].every(el => !__EL.prog.has(el)));
        // The stone: you must touch it (a tap on it, no powers needed). It answers, and Wynn talks it over with you.
        await until(() => __EL.story.step === 'touch', 15000);
        const stone = await ev(async () => {
            __EL.cam.yaw = 0;                                              // looking along -z: the stone ahead
            await new Promise(r => setTimeout(r, 600));
            const p = __EL.world.objects.get('StandingStone').mesh.position, s = __screen(new __EL.THREE.Vector3(p.x, 2.4, p.z));
            const was = __EL.world.signal('StandingStone', 'touched');
            __touch('pointerdown', 9, s.x, s.y); await new Promise(r => setTimeout(r, 60)); __touch('pointerup', 9, s.x, s.y);
            await new Promise(r => setTimeout(r, 900));
            const motes = __EL.world.objects.get('StandingStone').mesh.children.filter(m => m.isMesh && m.visible && m.material.opacity > 0.05).length;
            return { was, touched: __EL.world.signal('StandingStone', 'touched'), motes, on: s.on };
        });
        stone.talk = await until(() => __EL.story.step === 'wynn' && !!__EL.story.choosing, 20000);
        await ev(() => __EL.story.choose(0));
        stone.flag = await ev(() => __EL.prog.flags['veyra.stone']);
        const home = await until(() => ['home', 'attack', 'awaken'].includes(__EL.story.step), 15000);
        await ev(() => { window.__fires = []; __EL.EventBus.on('FireStarted', e => __fires.push(e.cause)); });
        await at(6.5, 8);
        await until(() => __EL.story.step === 'attack', 10000);
        await until(() => __EL.vitals.health < 100, 40000);             // they come for you (a slow headless frame rate makes this real-time wait long)
        await wait(4000);                                               // let them keep at it: they hurt, but can't kill before you have powers
        const beforeCrack = await ev(() => ({ fires: __fires.length, hp: Math.round(__EL.vitals.health), floor: __EL.vitals.floor, dead: __EL.vitals.dead, any: ['earth', 'fire', 'water', 'air'].some(el => __EL.prog.has(el)) }));
        // The headless browser runs the game at about half speed: move the story's clock on through the waits.
        await ev(() => { if (__EL.story.step === 'attack') __EL.story.t = 8; });
        const woke = await until(() => __EL.story.step === 'awaken', 10000);
        await ev(() => { __EL.surges.enabled = false; });
        // Turn Fire on a bird: touch it and hold. One hit and it falls; and the wild jet spills onto your roof.
        const fought = await ev(async () => {
            const hp0 = __EL.vitals.health;
            const t0 = performance.now();
            let bird = null;
            while (!bird && performance.now() - t0 < 8000) {
                bird = __EL.creatures.all.find(c => { if (c.state === 'dead' || c.gone) return false; const q = __screen(new __EL.THREE.Vector3(c.pos.x, c.pos.y, c.pos.z)); return q.on && !__EL.input.inMoveZone(q.x, q.y) && Math.hypot(c.pos.x - __EL.player.position.x, c.pos.z - __EL.player.position.z) < 10; });     // not under the move stick (bottom-left)
                if (!bird) await new Promise(r => setTimeout(r, 100));
            }
            if (!bird) return { err: 'no bird on screen' };
            const s = __screen(new __EL.THREE.Vector3(bird.pos.x, bird.pos.y, bird.pos.z));
            __touch('pointerdown', 5, s.x, s.y);
            const state = __EL.intent.state;
            const t1 = performance.now();
            while (bird.state !== 'dead' && performance.now() - t1 < 3000) await new Promise(r => setTimeout(r, 30));
            const secs = +((performance.now() - t1) / 1000).toFixed(2);
            await new Promise(r => setTimeout(r, 300));
            __touch('pointerup', 5, s.x, s.y);
            return { state, dead: bird.state === 'dead', secs, used: +__EL.jet.used.toFixed(2), home: __EL.world.signal('Veyra_House_Home', 'burning'), spilled: !__EL.jet.spill };
        });
        await ev(() => { __EL.vitals.invulnerable = true; });
        return { met, stone, dusk: home, woke, powerless, beforeCrack, fought };
    }

    // ---- 1. Carefully ---------------------------------------------------------------------------------
    const a = await toTheFire('Rowan');
    const opening = await ev(() => ({ name: __EL.session.work.custom.name, hair: __EL.session.work.custom.look.hair, tone: __EL.prog.flags['veyra.tone'] }));
    check(opening.name === 'Rowan' && opening.hair && opening.tone === 'earnest', `New game: a name and a look, then Veyra; the forge choice is remembered (${JSON.stringify(opening)})`);
    check(!a.stone.was && a.stone.touched && a.stone.motes >= 3 && a.stone.talk && a.stone.flag === 'asked',
        `the stone must be touched: a tap and it answers (its four lights rise), and Wynn talks it over, your answer remembered (${JSON.stringify(a.stone)})`);
    check(a.met && a.dusk && a.woke && a.powerless, `the morning (no powers yet) leads to dusk, home, the flock, and the awakening (${JSON.stringify(a)})`);
    check(a.beforeCrack.fires === 0 && a.beforeCrack.hp < 100 && a.beforeCrack.hp >= 35 && !a.beforeCrack.dead && !a.beforeCrack.any,
        `the flock goes for you, not the thatch; you can't answer yet, and they can hurt you but not kill you (${JSON.stringify(a.beforeCrack)})`);
    check(door && door.shutX < 7.9 && door.open && door.angle > 1.5 && door.signal && door.inX > 8.6,
        `home's door: shut, it stops you; a tap swings it in and you walk inside (${JSON.stringify(door)})`);
    check(a.fought.state === 'jet' && a.fought.dead && a.fought.used > 0 && a.fought.home && a.fought.spilled,
        `touch a bird and hold: flame from your hands, one bird down at once, and the wild jet spills onto your own roof (${JSON.stringify(a.fought)})`);
    const woke = await ev(() => ({ states: ['earth', 'fire', 'water', 'air'].map(el => __EL.prog.state(el)).join(), cracked: __EL.world.signal('StandingStone', 'cracked'), roof: __fires.filter(c => c === 'awakening').length, harm: __EL.ledger.get('harm'), charm: __EL.prog.flags.charm }));
    check(woke.states === 'wild,wild,wild,wild' && woke.cracked && woke.roof === 2 && woke.harm === 0 && woke.charm === 'none',
        `the stone cracks, all four answer wild; the roof's fire is the power's doing, not something the ledger holds against you (${JSON.stringify(woke)})`);
    await shot('P1-awaken');
    // Fight the fire: drive the birds off with water, put out every fire with the stream.
    await ev(async () => {
        for (const c of __EL.creatures.all) c.react('water', 1, 'player');
        for (let i = 0; i < 20; i++) {
            for (const f of __EL.fire.flammables.values()) if (f.burning) __EL.fire.douse(f.thing, 'player');
            await new Promise(r => setTimeout(r, 400));
        }
    });
    const caelCame = await until(() => ['cael', 'damage', 'barn', 'blame', 'charm', 'choice'].includes(__EL.story.step), 60000);      // he may already be offering the charm
    await shot('P2-cael');
    const offered = await until(() => __EL.story.step === 'charm' && !!__EL.story.choosing, 30000);
    await ev(() => __EL.story.choose(0));                              // put it on
    const chose = offered && await until(() => __EL.story.step === 'choice' && !!__EL.story.choosing, 30000);
    const after = await ev(() => ({ fire: __EL.prog.flags['veyra.fire'], barn: __EL.prog.flags['bram.barn'], blame: __EL.prog.flags['veyra.blame'], care: __EL.ledger.get('care'), harm: __EL.ledger.get('harm'), mood: __EL.EventBus.recent().length >= 0 }));
    if (!(caelCame && chose) && process.env.QA_LOUD) console.log('  debug', JSON.stringify({ caelCame, offered, chose }), JSON.stringify(await ev(() => ({ fps: __EL.renderInfo?.().fps, step: __EL.story.step, t: __EL.story.t, choosing: !!__EL.story.choosing, burning: [...__EL.fire.flammables.values()].filter(f => f.burning).map(f => f.thing.id).slice(0, 6), birds: __EL.creatures.all.filter(c => !c.dead).length, talking: __EL.story.talking }))));
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
    const back = await ev(() => ({ burned: [...__EL.world.objects.keys()].filter(id => /^Veyra_(House|Barn)/.test(id) && __EL.world.signal(id, 'burned')).length, cracked: __EL.world.signal('StandingStone', 'cracked'),
        step: __EL.story?.step, charm: __EL.prog.flags.charm, prologue: __EL.prog.flags.prologue, earth: __EL.prog.state('earth'), road: __EL.world.objects.has('Exit_verdant') }));
    check(back.burned === after2.burned && back.cracked, `back in Veyra, the burned houses are still burned and the stone still cracked (${JSON.stringify(back)})`);
    check(back.step === 'done' && back.charm === 'worn' && back.prologue === 'done' && back.earth === 'trained' && back.road,
        `and the night isn't told again: nothing is reset, and the road east to the Reach is open (${JSON.stringify(back)})`);
    await shot('P5-remembered');

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('PROLOGUE FAIL'); process.exit(1); }
    console.log('PROLOGUE PASS');
})();
