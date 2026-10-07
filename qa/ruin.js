// ============================================================
// RUIN — Act I's end: the Watchstone and the Stonebound (scenes/verdant.json)
//
//   1. Cael waits at the ruin; the stone must be touched; he finds the chisel
//      marks and goes quiet ("I know this hand"); your answer remembered
//   2. the Stonebound come: Cael holds one off; the others keep their
//      distance, lift a stone where you can see it and throw it, and it hurts
//   3. lift a stone near them and one raises a slab
//   4. hit hard enough they yield (never die), counted as spared; Cael ends it
//   5. the judgement, remembered; Act I told
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/ruin.js
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

    // The Dry Mill done; Cael gone on to the ruin (as the story leaves it).
    await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
    await ev(() => localStorage.clear());
    await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
    await ev(() => { const f = __EL.prog.flags; Object.assign(f, { lesson1: { outcome: 'quiet' }, prologue: 'done', 'thornwick.started': 'true', 'thornwick.mill': 'quiet', 'act1.mill': 'done' }); __EL.prog.setState('earth', 'trained'); __EL.prog._save(); __EL.travel('verdant', 'from_gate'); });
    await page.waitForFunction(() => window.__EL?.mode === 'verdant' && window.__EL?.ready, null, { timeout: 90000 });
    await page.waitForTimeout(1200);
    await ev(() => {
        window.__W = ms => new Promise(r => setTimeout(r, ms));
        window.__skip = async until => { for (let i = 0; i < 160 && !until(); i++) { __EL.hud.skipLine = true; await __W(120); } };
        window.__at = (x, z) => { const B = __EL.player.body, T = __EL.world.terrain; B.position.set(x, T.height(x, z) + 0.6, z); B.velocity.set(0, 0, 0); };
        __EL.world.reveal('Cael_Ruin'); __EL.story.go('ruinroad');
    });

    const stone = await ev(async () => {
        await __W(500);
        __at(30, -92); await __W(1500);
        const watch = __EL.story.step, before = __EL.world.signal('Watchstone', 'touched');
        [...__EL.interactables.things].find(t => t.id === 'Watchstone').use(); await __W(800);
        await __skip(() => __EL.story.choosing);
        const lines = __EL.story.step;
        __EL.story.choose(0);
        return { watch, before, touched: __EL.world.signal('Watchstone', 'touched'), lines, flag: __EL.prog.flags['act1.chisel'] };
    });
    check(stone.watch === 'watch' && !stone.before && stone.touched && stone.lines === 'chisel' && stone.flag === 'asked',
        `at the ruin the stone must be touched; Cael finds the chisel marks and knows the hand; your answer remembered (${JSON.stringify(stone)})`);

    const fight = await ev(async () => {
        await __skip(() => __EL.story.step === 'fight');
        await __W(1500);
        const g = __EL.creatures.all.filter(c => c.id.startsWith('Stonebound'));
        const seen = new Set(); __EL.EventBus.on('Creature', e => seen.add(e.to));
        const hp0 = __EL.vitals.health;
        __at(34, -100);
        await __W(10000);
        return { step: __EL.story.step, n: g.length, held: g.filter(c => c.state === 'held').length, elite: g.filter(c => c.elite).length, threw: seen.has('threw'), hurt: Math.round(hp0 - __EL.vitals.health), floor: __EL.vitals.floor, dead: __EL.vitals.dead };
    });
    check(fight.step === 'fight' && fight.n === 3 && fight.held === 1 && fight.elite === 1 && fight.threw && fight.hurt > 0 && !fight.dead,
        `the Stonebound come: Cael holds one off; the others lift and throw stone, and it hurts (${JSON.stringify(fight)})`);

    // A stone thrown at you, touched in the air: caught (time slows for it), then thrown back.
    const caught = await ev(async () => {
        let f = null, slowed = false;
        const t0 = __EL.story.time;
        while (!f && __EL.story.time - t0 < 20) {
            await __W(30);
            if (__EL.creatures.incoming()) slowed = true;
            for (const c of __EL.creatures.all) for (const s of c.stones || []) {
                const p = s.entry.body.position, h = __EL.player.body.position;
                if (!s.hit && s.t < 2 && Math.hypot(p.x - h.x, p.z - h.z) < 6) f = s;
            }
        }
        if (!f) return { found: false };
        const p = f.entry.body.position, q = new __EL.THREE.Vector3(p.x, p.y, p.z).project(__EL.cam.cam);
        const hp = __EL.vitals.health;
        const took = __EL.intent.press((q.x + 1) / 2 * innerWidth, (1 - q.y) / 2 * innerHeight);
        const held = __EL.channel.held?.entry;
        const r = { found: true, slowed, took, state: __EL.intent.state, mine: held === f.entry, id: held?.id };
        await __W(600);
        r.hurt = +(hp - __EL.vitals.health).toFixed(1);
        // Send it home: at a Stonebound Cael isn't holding.
        const foe = __EL.creatures.all.find(c => c.id.startsWith('Stonebound') && c.state !== 'held' && c.state !== 'yield');
        const hits = []; const off = __EL.EventBus.on('Creature', e => { if (e.id === foe.id) hits.push(e.to); });
        const hp0 = foe.hp;
        __EL.channel.let(); __EL.intent._cancel();
        const fp = foe.body.position, b = held.body;
        b.position.set(fp.x - 3, fp.y + 0.6, fp.z); b.velocity.set(0, 0, 0);
        __EL.channel.throwEntry(held, new __EL.THREE.Vector3(1, 0.05, 0).normalize(), 18, 'earth');
        await __W(1500); off();
        return { ...r, back: +(hp0 - foe.hp).toFixed(1), caught: __EL.story.counters.caught };
    });
    check(caught.found && caught.slowed && caught.took && caught.state === 'holding' && caught.mine && caught.hurt <= 0.5 && caught.back > 0 && caught.caught >= 1,
        `a stone thrown at you slows time as it comes; touched in the air it's caught, harmless, and thrown back it hurts them (${JSON.stringify(caught)})`);

    const slab = await ev(async () => {
        const hp = __EL.player.body.position;
        const rock = __EL.world.rocks.filter(e => e.body.world).sort((a, b) => a.body.position.distanceTo(hp) - b.body.position.distanceTo(hp))[0];
        let raised = false; const off = __EL.EventBus.on('Creature', e => { if (e.to === 'shield') raised = true; });
        __EL.channel.grab(rock, 'earth');
        const held = __EL.channel.held?.element;
        for (let i = 0; i < 25 && !raised; i++) await __W(200);
        off();
        __EL.channel.let?.();
        return { near: +rock.body.position.distanceTo(hp).toFixed(1), held, up: raised, states: __EL.creatures.all.map(c => c.state) };
    });
    check(slab.up, `lift a stone near them and one raises a slab (${JSON.stringify(slab)})`);

    const yielded = await ev(async () => {
        const g = __EL.creatures.all.filter(c => c.id.startsWith('Stonebound'));
        const spared0 = __EL.ledger.get('spared');
        for (const c of g.filter(c => c.state !== 'held')) c.react('impact', 60, 'player');
        await __W(1500);
        return { states: g.map(c => c.state), alive: g.every(c => c.state !== 'dead' && !c.gone), spared: __EL.ledger.get('spared') - spared0, step: __EL.story.step, floor: __EL.vitals.floor };
    });
    check(yielded.states.every(s => s === 'yield') && yielded.alive && yielded.spared >= 2 && ['ended', 'judgement'].includes(yielded.step) && yielded.floor === 0,
        `hit hard enough they kneel and yield, never die, spared; Cael ends it (${JSON.stringify(yielded)})`);

    const told = await ev(async () => {
        await __skip(() => __EL.story.choosing);
        const at = __EL.story.step;
        __EL.story.choose(2);                                  // who told you we'd come?
        await __skip(() => ['south', 'done'].includes(__EL.story.step));
        return { at, varn: __EL.prog.flags['act1.varn'], act: __EL.prog.flags['act1.ruin'], step: __EL.story.step };
    });
    check(told.at === 'judgement' && told.varn === 'asked' && told.act === 'done' && told.step === 'south', `the judgement remembered; Act I is told, and the road south is next (${JSON.stringify(told)})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('RUIN FAIL'); process.exit(1); }
    console.log('RUIN PASS');
})();
