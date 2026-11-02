// ============================================================
// CONTROLS — holding, carrying and throwing (docs/CONTROLS_WORKSHOP.md)
//
//   1. a held stone comes with you: walk, and it keeps its place beside you;
//      light in the hand, you walk at most of your pace
//   2. aim assist, the same flick 10° off a hound: Off misses, Assist hits;
//      30° off: Assist leaves it alone (a miss), Lock finds it; the lock wears
//      a ring while you hold something
//   3. the setting is saved on the device; the HUD button cycles it
//   4. the first fight on a road comes after the yard: Thornhounds on the
//      way north to the Watchstone
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/controls.js
// ============================================================
const fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:8140/index.html').replace(/\?.*$/, '');
const SHOTS = process.env.QA_SHOTS || path.join(__dirname, 'shots');

(async () => {
    const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
    const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const pass = [], fail = [];
    const check = (ok, msg) => { (ok ? pass : fail).push(msg); console.log((ok ? '  ok   ' : '  FAIL ') + msg); };
    const ev = (fn, a) => page.evaluate(fn, a);
    fs.mkdirSync(SHOTS, { recursive: true });

    await page.goto(`${BASE}?scene=arena`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready && window.__EL.creatures?.all.length, null, { timeout: 90000 });
    await page.waitForTimeout(1200);
    await ev(() => {
        window.__W = ms => new Promise(r => setTimeout(r, ms));
        window.__at = (x, z) => { const B = __EL.player.body; B.position.set(x, 0.6, z); B.velocity.set(0, 0, 0); };
        // Everything but one hound out of the way; that one stands still where we put it.
        const hound = __EL.creatures.all.find(c => c.group.item.species === 'thornhound');
        for (const c of __EL.creatures.all) if (c !== hound) { c.body.position.set(80, -50, 80); c.update = () => {}; }
        window.__hound = hound;
        window.__pin = (x, z) => { hound.hp = 9999; hound.update = dt => { hound.body.position.set(x, 0.55, z); hound.body.velocity.set(0, 0, 0); hound._pose(dt); }; };
        window.__rock = () => __EL.room.rocks.find(r => r.body.world && (r.data.radius || 0.5) < 0.5) || __EL.room.rocks[0];
    });

    // 1. Carried.
    const carry = await ev(async () => {
        __at(0, 6); __EL.cam.yaw = Math.PI; await __W(400);          // camera behind, looking -Z
        const r = __rock();
        r.body.position.set(0.8, 1.2, 4.6); r.body.velocity.set(0, 0, 0);
        __EL.channel.grab(r, 'earth');
        const h0 = __EL.player.body.position.clone(); await __W(900);
        const gap0 = r.body.position.distanceTo(__EL.player.body.position);
        dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        const t = performance.now(); while (performance.now() - t < 2200) { __EL.cam.yaw = Math.PI; await __W(40); }
        dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        await __W(500);
        const walked = __EL.player.body.position.distanceTo(h0), gap1 = r.body.position.distanceTo(__EL.player.body.position);
        const out = { held: __EL.channel.held?.entry === r, walked: +walked.toFixed(1), gap0: +gap0.toFixed(2), gap1: +gap1.toFixed(2), carry: +__EL.channel.carry.toFixed(2) };
        __EL.channel.release({}); return out;
    });
    check(carry.held && carry.walked > 3 && Math.abs(carry.gap1 - carry.gap0) < 0.8 && carry.carry >= 0.75,
        `a held stone comes with you: walked ${carry.walked} m and it kept its place beside you; light, you walk at ${carry.carry} of your pace (${JSON.stringify(carry)})`);

    // 2. Aim assist: the same flick, off a hound by an angle, in each setting.
    const shot = (mode, offDeg) => ev(async ({ mode, offDeg }) => {
        __EL.assist.setMode(mode);
        __at(0, 6); __pin(0, -6);
        // Face the hound: whichever yaw puts it in front of the camera.
        for (const y of [Math.PI, 0]) { __EL.cam.yaw = y; await __W(250); const f = __EL.cam.cam.getWorldDirection(new __EL.THREE.Vector3()); if (f.z < 0) break; }
        await __W(300);
        const r = __rock(); r.body.position.set(0, 1.4, 4.8); r.body.velocity.set(0, 0, 0); r.body.angularVelocity.set(0, 0, 0);
        __EL.channel.grab(r, 'earth'); await __W(700);
        const lockRing = __EL.assist.ring.visible;
        // The flick: a screen vector whose world direction is `offDeg` off the line to the hound.
        const f = __EL.cam.cam.getWorldDirection(new __EL.THREE.Vector3()).setY(0).normalize(), rt = new __EL.THREE.Vector3(-f.z, 0, f.x);
        const to = new __EL.THREE.Vector3(__hound.body.position.x - r.body.position.x, 0, __hound.body.position.z - r.body.position.z).normalize();
        const a = offDeg * Math.PI / 180, d = new __EL.THREE.Vector3(to.x * Math.cos(a) - to.z * Math.sin(a), 0, to.x * Math.sin(a) + to.z * Math.cos(a));
        const vx = d.dot(rt) * 3200, vy = -d.dot(f) * 3200;
        let closest = 99;
        __EL.channel.release({ flick: true, vx, vy });
        const t = performance.now();
        while (performance.now() - t < 1600) { closest = Math.min(closest, r.body.position.distanceTo(__hound.body.position)); await __W(20); }
        return { mode, offDeg, closest: +closest.toFixed(2), lockRing };
    }, { mode, offDeg });
    const off10 = await shot('off', 10), assist10 = await shot('assist', 10), assist30 = await shot('assist', 30), lock30 = await shot('lock', 30);
    await page.screenshot({ path: path.join(SHOTS, 'controls-lock.png') });
    const hit = s => s.closest < 1.2;
    check(!hit(off10) && hit(assist10), `the same flick 10° off a hound: Off goes where it was flicked (a miss), Assist bends it on (${JSON.stringify([off10, assist10])})`);
    check(!hit(assist30) && hit(lock30) && lock30.lockRing, `30° off: Assist leaves it alone; Lock finds it, and the lock wore its ring while the stone was held (${JSON.stringify([assist30, lock30])})`);

    // 3. The settings button: it pauses; aim assist is set there and saved on the device; Resume carries on.
    const setting = await ev(async () => {
        __EL.assist.setMode('assist');
        const saved = localStorage.getItem('elemental.aim');
        document.getElementById('hud-gear').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        await __W(200);
        const menu = document.getElementById('hud-menu'), open = menu.classList.contains('on'), paused = __EL.isPaused();
        const t0 = __EL.juice.t; await __W(500); const still = __EL.juice.t === t0;
        const lock = [...menu.querySelectorAll('.seg button')].find(b => /lock/i.test(b.textContent));
        lock.click(); await __W(100);
        const chosen = menu.querySelector('.seg button.on')?.textContent, note = menu.querySelector('.note')?.textContent;
        const save = [...menu.querySelectorAll('button')].find(b => /^Save/.test(b.textContent) && !/quit/.test(b.textContent));
        save.click(); await __W(100);
        const saveSays = save.querySelector('small').textContent;
        [...menu.querySelectorAll('button')].find(b => /Resume/.test(b.textContent)).click();
        await __W(400);
        return { saved, open, paused, still, chosen, note, saveSays, now: __EL.assist.mode, stored: localStorage.getItem('elemental.aim'), resumed: !menu.classList.contains('on') && !__EL.isPaused() && __EL.juice.t > t0 };
    });
    await page.screenshot({ path: path.join(SHOTS, 'controls-menu.png') });
    check(setting.saved === 'assist' && setting.open && setting.paused && setting.still, `the settings button opens the menu and the world holds still (${JSON.stringify(setting)})`);
    check(setting.chosen === 'Lock' && setting.now === 'lock' && setting.stored === 'lock' && /ring/.test(setting.note) && /test scene/.test(setting.saveSays) && setting.resumed,
        `aim assist is set in the menu and saved on the device; Save says what it did; Resume carries on (${JSON.stringify(setting)})`);

    // 4. The first road fight after the yard: Thornhounds on the way north.
    await ev(() => { localStorage.clear(); });
    await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
    await ev(() => { const f = __EL.prog.flags; Object.assign(f, { lesson1: { outcome: 'quiet' }, prologue: 'done', 'thornwick.started': 'true', 'thornwick.mill': 'quiet', 'act1.mill': 'done', 'act1.yard': 'done' }); __EL.prog.setState('earth', 'trained'); __EL.prog._save(); __EL.travel('verdant', 'from_gate'); });
    await page.waitForFunction(() => window.__EL?.mode === 'verdant' && window.__EL?.ready, null, { timeout: 90000 });
    await page.waitForTimeout(1200);
    const road = await ev(async () => {
        const W = ms => new Promise(r => setTimeout(r, ms)), at = (x, z) => { const B = __EL.player.body, T = __EL.world.terrain; B.position.set(x, T.height(x, z) + 0.6, z); B.velocity.set(0, 0, 0); };
        __EL.world.reveal('Cael_Ruin'); __EL.story.go('ruinroad'); await W(400);
        at(32, -55); await W(500); at(32, -63); await W(1200);
        const step = __EL.story.step, hounds = __EL.creatures.all.filter(c => c.group.item.id === 'North_Hounds');
        const up = hounds.length > 0 && hounds.every(c => !c.gone);
        for (const c of hounds) c.react('impact', 9999, 'player');
        for (let i = 0; i < 40 && __EL.story.step === 'hounds'; i++) await W(150);
        return { step, hounds: hounds.length, up, after: __EL.story.step };
    });
    check(road.step === 'hounds' && road.up && road.after === 'ruinroad2', `after the yard, on the road north, Thornhounds: the first road fight; down, the road goes on to the ruin (${JSON.stringify(road)})`);

    check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
    console.log(fail.length ? 'CONTROLS FAIL' : 'CONTROLS PASS');
    await browser.close();
    process.exit(fail.length ? 1 : 0);
})();
