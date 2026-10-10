// ============================================================
// FORGE — Act II: the Cold Forge, Lesson III "Fire, held" (scenes/forge.json)
//
//   1. after Saltmere the compass points the way (the journey): from Saltmere,
//      at the exit toward the cistern; the objective names where you're bound
//   2. up from the Reach, Cael leads to the forge, Bram follows
//   3. Fire held on the forge's heart heats it; a gauge shows its band; held
//      too long, the heart-stone cracks and the heat drops away
//   4. fed in pulses, held in the band six seconds: the forge is lit, the
//      door across the pass opens; the crack is remembered
//   5. the night at the forge: Cael's question, your answer remembered; the
//      stones; on north, the journey now Emberwall
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/forge.js
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
        window.__gt = async s => { const P = __EL.particles; const t0 = P.t; while (P.t - t0 < s) await __W(20); };
        window.__skip = async until => { for (let i = 0; i < 200 && !until(); i++) { __EL.hud.skipLine = true; await __W(120); } };
        window.__at = (x, z) => { const B = __EL.player.body, T = __EL.world.terrain; B.position.set(x, T.height(x, z) + 0.6, z); B.velocity.set(0, 0, 0); };
    });
    const go = async (scene, at) => {
        await ev(([scene, at]) => { __EL.prog._save(); __EL.travel(scene, at); }, [scene, at]);
        await page.waitForFunction(s => window.__EL?.mode === s && window.__EL?.ready, scene, { timeout: 90000 });
        await page.waitForTimeout(1200);
        await helpers();
    };

    // Saltmere told: the journey north begins.
    await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
    await ev(() => localStorage.clear());
    await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
    await ev(() => { const f = __EL.prog.flags; Object.assign(f, { lesson1: { outcome: 'quiet' }, prologue: 'done', 'act1.mill': 'done', 'act1.yard': 'done', 'act1.ruin': 'done', 'bram.joined': 'welcome', lesson2: 'done', 'act2.saltmere': 'done', 'saltmere.wall': 'held', journey: 'forge' });
        __EL.prog.setState('earth', 'trained'); __EL.prog.setState('water', 'trained'); __EL.prog.setState('fire', 'wild'); });
    await go('saltmere', 'from_cistern');
    const journey = await ev(async () => {
        await __W(600);
        const mark = document.querySelector('#hud-compass .mark'), ex = __EL.world.objects.get('Exit_cistern').item, p = __EL.player.position;
        return { text: document.querySelector('#hud-objective .text')?.textContent, on: document.getElementById('hud-objective').classList.contains('on'),
                 mark: mark && getComputedStyle(mark).display !== 'none', dist: mark?.querySelector('span')?.textContent, exitDist: Math.round(Math.hypot(ex.x - p.x, ex.z - p.z)) };
    });
    check(journey.on && /Cold Forge/.test(journey.text || '') && /Sunken Cistern/.test(journey.text || '') && journey.mark && /\d+ m/.test(journey.dist || ''),
        `after Saltmere, the journey: the objective names the Cold Forge, by way of the cistern, and the compass points at that exit (${JSON.stringify(journey)})`);

    // Up from the Reach.
    await go('forge', 'from_verdant');
    const road = await ev(async () => {
        await __W(500);
        const o = __EL.world.objects;
        return { step: __EL.story.step, cael: o.get('Cael')?.npc.role, bram: o.get('Bram')?.npc.role, journey: __EL.prog.flags.journey, gateOpen: __EL.world.signal('Pass_Gate', 'open') };
    });
    check(road.step === 'road' && road.cael === 'lead' && road.bram === 'follow' && !road.journey && !road.gateOpen, `up the pass: Cael leads, Bram follows; the journey's here; the door is shut (${JSON.stringify(road)})`);

    // At the forge: overfeed it.
    const over = await ev(async () => {
        __at(0, 8); __EL.cam.yaw = 0; __EL.cam.pitch = 0.2; await __gt(1);
        await __skip(() => __EL.story.step === 'forge' && !__EL.story.talking);
        const F = __EL.world.objects.get('Oruun_Forge'), I = __EL.intent;
        const heart = [...__EL.interactables.things].find(t => t.id === 'Oruun_Forge').pos();
        const q = heart.clone().project(__EL.cam.cam), sx = (q.x + 1) / 2 * innerWidth, sy = (1 - q.y) / 2 * innerHeight;
        window.__press = () => I.press(sx, sy);
        const took = __press();
        const st = I.state;
        let gauge = false, peak = 0;
        const t0 = __EL.particles.t;
        while (!F.signal('cracked') && __EL.particles.t - t0 < 10) { await __W(40); gauge ||= document.getElementById('hud-gauge').classList.contains('on'); }
        I._cancel();
        return { took, st, fire: __EL.prog.live('fire'), gauge, cracked: F.signal('cracked'), lit: F.signal('lit'), secs: +(__EL.particles.t - t0).toFixed(1) };
    });
    check(over.took && over.st === 'pending' && over.fire === 'trained' && over.gauge && over.cracked && !over.lit,
        `Fire held on the forge's heart heats it, a gauge showing its band; held too long, the heart-stone cracks (${JSON.stringify(over)})`);

    // Steady: pulses that keep it in the band.
    const steady = await ev(async () => {
        const F = __EL.world.objects.get('Oruun_Forge'), I = __EL.intent;
        const heat = () => +(document.querySelector('#hud-gauge .needle').style.left || '0').replace('%', '') / 100;
        let feeding = false, overs = 0;
        const t0 = __EL.particles.t;
        while (!F.signal('lit') && __EL.particles.t - t0 < 40) {
            const h = heat();
            if (!feeding && h < 0.62) { __press(); feeding = true; }
            else if (feeding && h > 0.72) { I._cancel(); feeding = false; }
            if (h > 0.82) overs++;
            await __W(30);
        }
        I._cancel();
        await __W(300);
        return { lit: F.signal('lit'), secs: +(__EL.particles.t - t0).toFixed(1), gaugeOff: !document.getElementById('hud-gauge').classList.contains('on'), step: __EL.story.step };
    });
    check(steady.lit && steady.gaugeOff, `fed in pulses and held in the band, the forge is lit for good; the gauge goes (${JSON.stringify(steady)})`);

    const night = await ev(async () => {
        await __skip(() => __EL.story.step === 'camp');
        const mark = __EL.prog.flags['lesson3.forge'];
        await __skip(() => __EL.story.choosing);
        const at = __EL.story.step;
        __EL.story.choose(0);
        await __skip(() => __EL.story.step === 'onward');
        await __W(500);
        const o = { gate: __EL.world.signal('Pass_Gate', 'open'), mark, at, camp: __EL.prog.flags['act2.camp'], lesson3: __EL.prog.flags.lesson3, journey: __EL.prog.flags.journey, objective: document.querySelector('#hud-objective .text')?.textContent };
        __at(0, -42); await __gt(1.5);
        o.end = __EL.story.step;
        return o;
    });
    check(night.gate && night.mark === 'cracked' && night.at === 'camp' && night.camp === 'hero' && night.lesson3 === 'done' && night.journey === 'emberwall' && /Emberwall/.test(night.objective || '') && night.end === 'done',
        `the door opens; the crack remembered; the night at the forge, your answer remembered; on north, bound for Emberwall (${JSON.stringify(night)})`);

    // Coming back: the forge stays lit, the door open.
    await go('forge', 'from_emberwall');
    const back = await ev(() => ({ lit: __EL.world.signal('Oruun_Forge', 'lit'), cracked: __EL.world.signal('Oruun_Forge', 'cracked'), open: __EL.world.signal('Pass_Gate', 'open'), story: __EL.story?.step ?? null }));
    check(back.lit && back.cracked && back.open && (!back.story || back.story === 'done'), `coming back: the forge still burns (cracked), the door stays open (${JSON.stringify(back)})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('FORGE FAIL'); process.exit(1); }
    console.log('FORGE PASS');
})();
