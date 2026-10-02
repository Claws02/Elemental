// ============================================================
// SWIM — deep water is never a trap (world/WaterBodies.js, PlayerController)
//
//   1. off the Thornwick bridge into the river: the hero floats, head out,
//      can move at once, and the first time says how to get out; a long
//      fall into water does no harm
//   2. swimming to either bank of the river, the hero walks out onto dry land
//   3. swimming into the end of the dock, the hero climbs onto it
//   4. Halcyra's lake: out at the shore, and out onto the island
//   5. a bank too steep to walk up is scrambled up when within reach; one
//      that rises too high first is not
//   6. in deep water fire won't come, stone won't rise, throws are weaker
//
// The game runs at about half speed headless: waits are long in real time.
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/swim.js
// ============================================================
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:8140/index.html').replace(/\?.*$/, '');

(async () => {
    const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
    const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 800, height: 520 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const pass = [], fail = [];
    const check = (ok, msg) => { (ok ? pass : fail).push(msg); if (process.env.QA_LOUD) console.log((ok ? '  ok   ' : '  FAIL ') + msg); };
    const ev = (fn, a) => page.evaluate(fn, a);

    const open = async scene => {
        await page.goto(`${BASE}?scene=${scene}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
        await page.waitForTimeout(1200);
        await ev(() => {
            window.__W = ms => new Promise(r => setTimeout(r, ms));
            // Drop the hero at (x, z), y above the ground at least; let them settle.
            window.__drop = async (x, y, z) => {
                const b = __EL.player.body;
                b.position.set(x, Math.max(y, __EL.world.terrain.height(x, z) + 0.6), z); b.velocity.set(0, 0, 0);
                await __W(1500);
            };
            // Swim (or walk) toward (tx, tz) until on dry land: the ground under the hero above the water's level.
            window.__out = async (tx, tz, ms) => {
                const P = __EL.player, b = P.body, level = P.swimming?.level ?? P.water?.level ?? 0;
                let climbed = false, out = null;
                dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
                const t0 = performance.now();
                while (performance.now() - t0 < ms) {
                    __EL.cam.yaw = Math.atan2(-(tx - b.position.x), -(tz - b.position.z));
                    climbed ||= P.climbing;
                    await __W(40);
                    if (!P.swimming && !P.climbing && P.grounded && __EL.world.terrain.height(b.position.x, b.position.z) > level + 0.3) { out = Math.round(performance.now() - t0); break; }
                }
                dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
                return { out, climbed, at: [+b.position.x.toFixed(1), +b.position.z.toFixed(1)], y: +b.position.y.toFixed(2) };
            };
        });
    };

    // ---- 1–3. the Verdant Reach's river ------------------------------------------------------------------------
    await open('verdant');
    const fell = await ev(async () => {
        const P = __EL.player, b = P.body;
        await __drop(-31, 6, 9);                                  // off the side of the bridge, into the river below
        const level = P.swimming?.level, feet = b.position.y - P.radius, swim = !!P.swimming;
        const tip = document.getElementById('hud-tip')?.textContent || '';
        // Can move at once: 2 s (real time) of swimming east, still in the river.
        const x0 = b.position.x, t0 = performance.now();
        dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        while (performance.now() - t0 < 2000) { __EL.cam.yaw = -Math.PI / 2; await __W(40); }
        dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        return { swim, still: !!P.swimming, under: +(level - feet).toFixed(2), moved: +(b.position.x - x0).toFixed(2), tip: /Swimming/.test(tip) };
    });
    check(fell.swim && fell.still && fell.under > 0.8 && fell.under < 1.6 && fell.moved > 0.8 && fell.tip,
        `off the bridge into the river: swimming, floating with the feet ${fell.under} m under the surface, moving at once (${fell.moved} m in 2 s), and the hint says how to get out (${JSON.stringify(fell)})`);
    const dive = await ev(async () => { const v = __EL.vitals, h0 = v.health; await __drop(-33, 24, 12); await __W(3500); return { hp0: Math.round(h0), hp: Math.round(v.health), swim: !!__EL.player.swimming }; });
    check(dive.swim && dive.hp === dive.hp0, `a 20 m fall into the river does no harm: water breaks the fall (${JSON.stringify(dive)})`);
    const east = await ev(async () => { await __drop(-31, 4, 4); return __out(-10, 4, 60000); });
    check(east.out !== null, `swimming east out of the river: on dry land at Thornwick's bank (${JSON.stringify(east)})`);
    const west = await ev(async () => { await __drop(-31, 4, 4); return __out(-55, 4, 60000); });
    check(west.out !== null, `swimming west out of the river: on dry land at the far bank (${JSON.stringify(west)})`);
    const dock = await ev(async () => { await __drop(-35, 4, 22); return __out(-25, 22, 60000); });
    check(dock.out !== null && dock.climbed, `swimming into the end of the dock: the hero climbs onto it and walks off (${JSON.stringify(dock)})`);

    // ---- 4. Halcyra's lake ---------------------------------------------------------------------------------------
    await open('halcyra');
    const shore = await ev(async () => { await __drop(-10, 7, -45); return __out(-14, -90, 60000); });
    check(shore.out !== null, `Halcyra: out of the lake onto the shore (${JSON.stringify(shore)})`);
    const isle = await ev(async () => { await __drop(35, 7, 0); return __out(0, 0, 60000); });
    check(isle.out !== null, `Halcyra: out of the lake onto the palace island (${JSON.stringify(isle)})`);

    // ---- 5. a steep bank (made up, on Halcyra's terrain) ------------------------------------------------------------
    const bank = await ev(() => {
        const P = __EL.player, b = P.body, T = __EL.world.terrain, real = T.height.bind(T);
        // A made-up shore east of the hero, out in the open lake: water at level 1, the bed at -1.5, a bank rising at 2:1 to a flat top.
        const X0 = 40;
        const water = { level: 1 };
        const tryBank = top => {
            T.height = (x, z) => (x -= X0) < 1 ? -1.5 : x < 1 + (top + 1.5) / 2 ? -1.5 + (x - 1) * 2 : top;
            b.position.set(X0, water.level - 1.2 + P.radius, 10);
            P.water = P.swimming = water;
            const r = P._bank(1, 0);
            T.height = real;
            P.water = P.swimming = null;
            return r && { top: +r.top.toFixed(2), x: +(r.stand.x - X0).toFixed(2) };
        };
        return { low: tryBank(2.4), high: tryBank(4.5) };
    });
    check(bank.low && bank.low.top === 2.4 && !bank.high, `a bank too steep to walk: scrambled up onto its flat top when within reach, not when it rises too high (${JSON.stringify(bank)})`);

    // ---- 6. the elements in deep water (the sandbox village: everything known) ------------------------------------
    await open('village');
    const weak = await ev(() => {
        const P = __EL.player, I = __EL.intent;
        const hay = [...__EL.interactables.things].find(t => t.mat?.change?.element === 'fire');
        const was = { fire: !!(hay && I._changeVerb(hay, false)?.element === 'fire') };
        P.swimming = { level: 0 };
        const now = { fire: !!(hay && I._changeVerb(hay, false)), raise: !!(I.works && I.prog.can('raise') && !P.swimming) };
        // A throw: its speed swimming against standing.
        const rock = __EL.world.rocks[0], dir = new __EL.THREE.Vector3(0, 0.16, -1).normalize();
        const speed = () => { let s = 0; const off = __EL.EventBus.on('ObjectThrown', e => { s = e.speed; }); __EL.channel.grab?.(rock, 'earth'); __EL.channel.release({ flick: true, vx: 0, vy: -3400 }); off?.(); return s; };
        const swimThrow = speed();
        P.swimming = null;
        const standThrow = speed();
        return { hay: hay?.id, was, now, swimThrow, standThrow };
    });
    check(weak.was.fire && !weak.now.fire && !weak.now.raise, `in deep water fire won't come and stone won't rise (${JSON.stringify(weak)})`);
    check(weak.standThrow > 0 && weak.swimThrow > 0 && weak.swimThrow < weak.standThrow * 0.75, `a throw from the water is weaker (${weak.swimThrow} against ${weak.standThrow})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('SWIM FAIL'); process.exit(1); }
    console.log('SWIM PASS');
})();
