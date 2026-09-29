// ============================================================
// LESSON — the gate for Lesson I and progression. Headless Chromium, a
// landscape phone viewport, real touch events where the gesture matters.
//
//   1. the title screen, and ?scene=lesson starts the story
//   2. only what has been learned answers: Water and Air locked, Earth too
//      weak (Power 1) for the big rocks
//   3. the lesson beats: the story opens on Cael; three stones, two too
//      heavy (Cael says so); lift, hold steady (no heat: untrained Fire
//      can't warm it), set down on a raised plate (a drop doesn't count);
//      then the rest of the stones rise
//   4. the trial, both ways: quiet (counterweights) and loud (break it)
//   5. wild Fire: quick to catch, throws sparks, can't be taken back,
//      fireballs burst in the hand; Cael notices
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/lesson.js
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
    const browser = await chromium.launch({
        ...(exe ? { executablePath: exe } : {}),
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
    });
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const fail = [], pass = [];
    const check = (ok, msg) => (ok ? pass : fail).push(msg);
    const wait = ms => page.waitForTimeout(ms);
    const shot = name => page.screenshot({ path: path.join(SHOTS, name + '.png') });
    const waitFor = (fn, ms, arg) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
    const helpers = () => page.evaluate(() => {
        const el = document.getElementById('game');
        window.__touch = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
        window.__screen = p => { const q = p.clone().project(__EL.cam.cam); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight, on: q.z < 1 && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95 }; };
        window.__piece = (r, c) => __EL.interactables.things.find(t => t.id === `TestRoom_Barricade_01_P${r}${c}`);
        // The lesson's pieces, by name (scenes/lesson1.json; the story runs in src/story/Story.js).
        const W = __EL.world, S = __EL.story;
        window.__LS = {
            get step() { return S.step; }, get talking() { return S.talking; }, get queue() { return S.queue; },
            get outcome() { return S.outcome; }, get fireSeen() { return S.counters.fireSeen || 0; }, get heavyN() { return S.counters.tooHeavy || 0; },
            plateA: W.objects.get('Lesson1_Plate').plate,
            weights: [W.objects.get('Lesson1_WeightL').plate, W.objects.get('Lesson1_WeightR').plate],
            cael: W.objects.get('Cael').npc,
            _go: id => S.go(id),
            _reveal: () => { for (const o of W.objects.values()) if (o.hidden) W.reveal(o.id); },
        };
        // Skip Cael's lines as they come (a tester tapping through).
        window.__skip = setInterval(() => { if (__LS.talking) __EL.hud.skipLine = true; }, 120);
    });
    const open = async () => {
        await page.goto(BASE + '?scene=lesson', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 30000 });
        await helpers();
        await wait(800);
    };

    // 1. Title.
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await wait(500);
    const title = await page.evaluate(() => ({ shown: getComputedStyle(document.getElementById('title')).display !== 'none', booted: !!window.__EL }));
    check(title.shown && !title.booted, 'no scene: the title screen, nothing booted');
    await shot('L0-title');

    // 2. What answers.
    await open();
    const gates = await page.evaluate(() => ({
        water: __EL.prog.state('water'), air: __EL.prog.state('air'), fire: __EL.prog.state('fire'), earth: __EL.prog.state('earth'),
        basins: __EL.room.basins.length, maxMass: +__EL.prog.earth('maxMass').toFixed(1),
        bigLiftable: __EL.earth.canMove(__EL.room.rocks[5]), smallLiftable: __EL.earth.canMove(__EL.room.rocks[1]),
    }));
    check(gates.water === 'locked' && gates.air === 'locked' && gates.fire === 'wild' && gates.earth === 'trained' && gates.basins === 0,
        `the story starts with Earth, wild Fire, Water and Air locked (${JSON.stringify(gates)})`);
    check(!gates.bigLiftable && gates.smallLiftable, `Earth Power 1 lifts small stones, not big ones (max ${gates.maxMass})`);
    const heroTouch = await page.evaluate(() => {
        const p = __EL.player.position, s = __screen(new __EL.THREE.Vector3(p.x, p.y + 1, p.z));
        __touch('pointerdown', 70, s.x, s.y); const st = __EL.intent.state; __touch('pointerup', 70, s.x, s.y);
        return st;
    });
    check(heroTouch !== 'wind', `Air is locked: touching the hero isn't wind (${heroTouch})`);
    const opening = await page.evaluate(() => {
        const c = __LS.cael.position, s = __screen(new __EL.THREE.Vector3(c.x, 1.5, c.z));
        const inWorld = __EL.room.rocks.map((e, i) => e.body.world ? i : -1).filter(i => i >= 0);
        return { on: s.on, dx: Math.round(Math.abs(s.x - innerWidth / 2)), inWorld, plate: __LS.plateA.top };
    });
    check(opening.on && opening.dx < 844 * 0.25, `the story opens looking at Cael (${opening.dx} px off centre)`);
    check(opening.inWorld.join() === '1,2,5' && opening.plate >= 1.4, `three stones for the first test, the plate at eye level (${JSON.stringify(opening)})`);

    // 3. The lesson beats.
    const intro = await waitFor(() => __LS.step === 'lift', 30000);
    check(intro, 'Cael introduces the lesson, then: lift the marked stone');
    await shot('L1-intro');
    const heavy = await page.evaluate(async () => {
        const e = __EL.room.rocks[2], s = __screen(e.mesh.position);
        __touch('pointerdown', 76, s.x, s.y);
        await new Promise(r => setTimeout(r, 150));
        const held = !!__EL.channel.held;
        __touch('pointerup', 76, s.x, s.y);
        return { held, told: __LS.heavyN, liftable: __EL.earth.canMove(e) };
    });
    check(!heavy.held && !heavy.liftable && heavy.told > 0, `a heavy stone won't lift, and Cael says it's too heavy (${JSON.stringify(heavy)})`);
    await wait(300);
    const lifted = await page.evaluate(async () => {
        const s = __screen(__EL.room.rocks[1].mesh.position);
        window.__s71 = s;                              // lift off where it went down: no flick
        __touch('pointerdown', 71, s.x, s.y);
        await new Promise(r => setTimeout(r, 300));
        return { held: __EL.channel.held?.entry === __EL.room.rocks[1], step: __LS.step };
    });
    check(lifted.held && lifted.step === 'steady', `touching the stone lifts it, and the lesson moves on (${JSON.stringify(lifted)})`);
    const c0 = await page.evaluate(() => __EL.prog.control('earth'));
    const steadied = await waitFor(() => __LS.step === 'place', 15000);
    const c1 = await page.evaluate(() => __EL.prog.control('earth'));
    const heat = await page.evaluate(() => __EL.room.rocks[1].data.heat || 0);
    check(steadied && c1 > c0, `holding it steady for 3 s raises Earth Control (${c0.toFixed(2)} → ${c1.toFixed(2)})`);
    check(heat === 0, `holding it still doesn't heat it: untrained Fire can't warm stone (heat ${heat})`);
    await shot('L2-steady');

    // A drop onto the plate doesn't count…
    const dropped = await page.evaluate(async () => {
        const L = __LS, h = __EL.channel.held, p = L.plateA.pos;
        if (!h) return { lost: true, step: L.step, intent: __EL.intent.state, pos: __EL.room.rocks[1].body.position.toArray?.() };
        h.target.set(p.x, L.plateA.top + 2.2, p.z);   // high over the plate
        await new Promise(r => setTimeout(r, 1500));
        __touch('pointerup', 71, __s71.x, __s71.y);   // let go from up there (no flick: same spot it went down)
        await new Promise(r => setTimeout(r, 2500));
        return { step: L.step, weighted: L.plateA.weighted === __EL.room.rocks[1], gentle: L.plateA.gentle };
    });
    check(dropped.step === 'place' && !(dropped.weighted && dropped.gentle), `a stone dropped onto the plate doesn't count (${JSON.stringify(dropped)})`);
    // Wherever it bounced, bring it back beside the plate for the real try.
    await page.evaluate(() => { const b = __EL.room.rocks[1].body, p = __LS.plateA.pos; b.position.set(p.x + 1.4, 0.5, p.z + 0.6); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); });
    await wait(800);
    // …setting it down does.
    const placed = await page.evaluate(async () => {
        const L = __LS, e = __EL.room.rocks[1];
        const s = __screen(e.mesh.position);
        __touch('pointerdown', 72, s.x, s.y);
        await new Promise(r => setTimeout(r, 200));
        const p = L.plateA.pos;
        __EL.channel.held.target.set(p.x, L.plateA.top + e.data.radius + 0.1, p.z);  // lowered right onto it
        await new Promise(r => setTimeout(r, 1800));
        __touch('pointerup', 72, s.x, s.y);
        await new Promise(r => setTimeout(r, 2500));
        return { step: L.step, gentle: L.plateA.gentle };
    });
    check(['trialIntro', 'trial'].includes(placed.step) && placed.gentle, `setting it down gently on the raised plate passes (${JSON.stringify(placed)})`);
    await wait(1000);
    const risen = await page.evaluate(() => __EL.room.rocks.filter(e => e.body.world).length);
    check(risen === 10, `after the test, the rest of the stones rise (${risen} / 10 out)`);

    // 4a. The quiet way: stones on both counterweights lift the barricade.
    await waitFor(() => __LS.step === 'trial', 20000);
    const ctrlBefore = await page.evaluate(() => __EL.prog.control('earth'));
    await page.evaluate(() => {
        const L = __LS, rocks = __EL.room.rocks;
        [[3, L.weights[0].pos], [7, L.weights[1].pos]].forEach(([i, p]) => {
            const b = rocks[i].body; b.position.set(p.x, L.weights[0].top + rocks[i].data.radius + 0.2, p.z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); b.wakeUp();
        });
    });
    const raised = await waitFor(() => __EL.room.barricade.raised, 15000);
    const quiet = await waitFor(() => __LS.outcome === 'quiet', 5000);
    const ctrlAfter = await page.evaluate(() => __EL.prog.control('earth'));
    check(raised && quiet && ctrlAfter > ctrlBefore, `stones on both counterweights lift the barricade: the quiet way, more Control (${ctrlBefore.toFixed(2)} → ${ctrlAfter.toFixed(2)})`);
    await shot('L3-raised');
    const card = await waitFor(() => document.getElementById('hud-card').classList.contains('on'), 30000);
    const cardText = await page.evaluate(() => document.getElementById('hud-card').innerText);
    check(card && /without breaking/.test(cardText), `the lesson card says how it went (${cardText.replace(/\n+/g, ' | ')})`);
    await shot('L4-card');
    const saved = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('elemental.progress')).flags.lesson1; } catch (e) { return null; } });
    check(saved?.outcome === 'quiet', `the outcome is saved (${JSON.stringify(saved)})`);

    // 4b. The loud way: break it open. It passes too, and Cael remembers.
    await open();
    await page.evaluate(() => { __LS.queue.length = 0; __LS._reveal(); __LS._go('trial'); __EL.player.body.position.set(0, 0.45, -8); });
    await wait(1600);
    for (let i = 0; i < 5; i++) {
        await page.evaluate(i => {
            const e = __EL.room.rocks[i];
            e.body.position.set(-2 + i, 1.6, -10); e.body.velocity.set(0, 0, 0);
            __EL.throwRockAt(i, { x: -2.5 + i, y: 0.6 + (i % 3) * 0.9, z: -16.2 }, 30);
        }, i);
        await wait(250);
    }
    const loud = await waitFor(() => __LS.outcome === 'loud', 20000);
    const trust = await page.evaluate(() => __EL.prog.flags.caelTrust);
    check(loud && trust < 0, `breaking it open also passes, as the loud way, and costs Cael's trust (trust ${trust})`);

    // 5. Wild Fire.
    await open();
    await page.evaluate(() => { __LS.queue.length = 0; __LS._reveal(); __LS._go('trial'); __EL.player.body.position.set(-1, 0.45, -9); __EL.cam.yaw = 0.15; __EL.cam.pitch = 0.3; });
    await wait(1500);
    const quick = await page.evaluate(() => {
        const s = __screen(__piece(0, 2).pos());
        __touch('pointerdown', 73, s.x, s.y);
        return { hold: __EL.intent.verb?.hold, verb: __EL.intent.verb?.verb, s };
    });
    check(quick.verb === 'ignite' && Math.abs(quick.hold - 0.3) < 0.01, `wild Fire catches in half the time (hold ${quick.hold} s)`);
    await waitFor(() => __EL.fire.isBurning(__piece(0, 2)), 4000);
    await page.evaluate(s => __touch('pointerup', 73, s.x, s.y), quick.s);
    await wait(300);
    const sparks = await page.evaluate(() => __EL.fire.stats().ignitions);
    check(sparks >= 2, `wild Fire throws sparks: more catches than was lit (${sparks} ignitions from one)`);
    const noTakeBack = await page.evaluate(() => {
        const s = __screen(__piece(0, 2).pos());
        __touch('pointerdown', 74, s.x, s.y);
        const r = { st: __EL.intent.state, verb: __EL.intent.verb?.verb || null };
        __touch('pointerup', 74, s.x, s.y);
        return r;
    });
    check(noTakeBack.verb !== 'pull', `untrained, a fire can't be pulled back out (${JSON.stringify(noTakeBack)})`);
    const told = await waitFor(() => /Put it out/.test(document.getElementById('hud-say').innerText) || __LS.fireSeen > 0, 5000);
    check(told, 'Cael notices the fire');
    await shot('L5-wildfire');

    // A wild fireball bursts in the hand.
    await open();
    await page.evaluate(() => { __LS.queue.length = 0; __LS._reveal(); __LS._go('trial'); __EL.player.body.position.set(1.5, 0.45, 7.5); __EL.cam.yaw = 0.6; __EL.cam.pitch = 0.3; });
    await wait(1500);
    const fb = await page.evaluate(() => {
        const b = __EL.fire.sources[0], s = __screen(b.pos);
        __touch('pointerdown', 75, s.x, s.y);
        return s;
    });
    const inHand = await waitFor(() => __EL.channel.held?.element === 'fire', 4000);
    const wild = await page.evaluate(() => [...__EL.fire.fireballs][0]?.wild);
    const burst = await waitFor(() => __EL.EventBus.recent().some(e => e.type === 'WildBurst'), 15000);
    await page.evaluate(s => __touch('pointerup', 75, s.x, s.y), fb);
    check(inHand && wild && burst, `a wild fireball won't stay: it bursts in the hand (${JSON.stringify({ inHand, wild, burst })})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) console.log(fail.map(p => '  FAIL ' + p).join('\n'));
    if (fail.length) { console.log('LESSON FAIL'); process.exit(1); }
    console.log('LESSON PASS');
})();
