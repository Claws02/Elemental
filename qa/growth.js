// ============================================================
// GROWTH — every level does something, and you can see it (docs/GROWTH_AND_COMBAT.md)
//
//   1. each element's numbers follow its Power or Control (data/growth.js): level 1 is
//      the old tuning, the top level reaches further and hits harder, in the systems
//      that use them (a fireball's size, the stream's reach, a gust's push, a glide)
//   2. fighting grows the element that did it: a hit, more for a kill
//   3. a level gained: the banner names it and says what it does, the world slows a
//      beat, the rings show it
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/growth.js
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
    await ev(() => { window.__W = ms => new Promise(r => setTimeout(r, ms)); window.__set = (el, p, c) => Object.assign(__EL.prog.els[el], { state: 'trained', power: p, control: c }); });

    // 1. The numbers, at the bottom and the top, read where the systems read them.
    const at = await ev(() => {
        const read = () => {
            const fb = __EL.fire._makeFireball(new __EL.THREE.Vector3(0, 30, 0), 'player'); const r = fb.mesh.children[0].geometry.parameters.radius / 0.7; __EL.fire._dissipate(fb);
            return { ball: +r.toFixed(3), hit: +__EL.prog.stat('fire', 'ballHit').toFixed(1), jet: __EL.prog.stat('fire', 'jetRange'), reach: __EL.water._s('reach'), douse: +__EL.fire.douseLump.toFixed(2),
                gust: __EL.air._s('gustPush'), cone: +__EL.air._s('gustAngle').toFixed(2), glide: +__EL.prog.stat('air', 'glideFall').toFixed(2), mass: __EL.prog.earth('maxMass') };
        };
        for (const el of ['earth', 'fire', 'water', 'air']) __set(el, 0, 0);
        const low = read();
        for (const el of ['earth', 'fire', 'water', 'air']) __set(el, 1, 1);
        return { low, high: read() };
    });
    const L = at.low, H = at.high;
    check(L.ball === 0.34 && L.hit === 22 && L.jet === 12 && L.reach === 8 && L.douse === 0.8 && L.gust === 6 && L.cone === 0.6 && L.glide === 1.6 && L.mass === 4,
        `level 1 is the old tuning (${JSON.stringify(L)})`);
    check(H.ball > L.ball * 1.5 && H.hit > L.hit * 2 && H.jet === 20 && H.reach === 16 && H.douse < L.douse && H.gust === 12 && H.cone < L.cone && H.glide < L.glide && H.mass === 25,
        `the top level reaches further, hits harder, aims tighter and glides further (${JSON.stringify(H)})`);

    // 2. A fight grows the element that did it.
    const fight = await ev(async () => {
        for (const el of ['earth', 'fire', 'water', 'air']) __set(el, 0.2, 0.2);
        const [a, b] = __EL.creatures.all.filter(c => c.state !== 'dead');
        const f0 = __EL.prog.power('fire'), e0 = __EL.prog.power('earth');
        a.react('fire', 50, 'player');
        const f1 = __EL.prog.power('fire');
        b.react('impact', 9999, 'player');
        await __W(50);
        return { fireHit: +(f1 - f0).toFixed(4), earthKill: +(__EL.prog.power('earth') - e0).toFixed(4), dead: b.state, wind: (a.react('wind', 1, 'environment'), +(__EL.prog.power('air') - 0.2).toFixed(4)) };
    });
    check(fight.fireHit > 0.005 && fight.earthKill >= 0.015 && fight.dead === 'dead' && fight.wind === 0,
        `fighting grows the element that did it: a burn grows Fire, a kill by a thrown stone grows Earth (the hit and the kill); the world's own wind grows nothing (${JSON.stringify(fight)})`);

    // 3. A level gained: the banner, the slowed beat, the rings.
    const up = await ev(async () => {
        __set('earth', 0.199, 0.35); __set('air', 0, 0); __EL.prog.els.air.state = 'locked';
        await __W(300);
        const t0 = __EL.juice.t, w0 = performance.now();
        __EL.prog.grant('earth', 'power', 0.01, 'test');
        await __W(350);
        const slowed = (__EL.juice.t - t0) / ((performance.now() - w0) / 1000);
        const b = document.querySelector('#hud-levelup');
        await __W(200);
        const rings = [...document.querySelectorAll('#hud-rings .ring')].map(r => r.querySelector('span').textContent);
        return { on: b.classList.contains('on'), title: b.querySelector('b').textContent, what: b.querySelector('span').textContent, slowed: +slowed.toFixed(2), rings };
    });
    await page.screenshot({ path: path.join(SHOTS, 'growth-levelup.png') });
    check(up.on && up.title === 'Earth · Power 3' && /Heavier stones/.test(up.what), `a level gained: the banner names it and says what it does (${JSON.stringify({ title: up.title, what: up.what })})`);
    check(up.slowed < 0.8, `the world slows for a beat (game time ran at ${up.slowed}× for the first 0.35 s)`);
    check(up.rings.length === 3 && up.rings[0] === '3', `the rings: one per element the hero has (air locked: none for it), Earth's showing level 3 (${JSON.stringify(up.rings)})`);

    check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
    console.log(fail.length ? 'GROWTH FAIL' : 'GROWTH PASS');
    await browser.close();
    process.exit(fail.length ? 1 : 0);
})();
