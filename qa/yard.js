// ============================================================
// YARD — throwing practice before the Stonebound, and the compass
//
//   1. after the Dry Mill, Cael takes you to the Lord-Warden's training yard:
//      a pile of four stones and four straw men
//   2. the compass strip: facing north, N is in the middle; the objective's
//      diamond sits at its bearing, with how far it is
//   3. a stone from the pile thrown hard knocks a straw man down; it counts,
//      and Cael counts with you; three down and he goes ahead to the ruin
//   4. hold still on open ground: a stone tears up into your hand; throw it
//   5. hold still longer: the stone sinks back and a column of earth rises;
//      then Cael goes ahead to the ruin
//   6. a knocked-down straw man stands back up; a thrown stone crumbles and
//      the pile restocks: nothing to tidy, never runs out
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/yard.js
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

    await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
    await ev(() => localStorage.clear());
    await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
    await ev(() => { const f = __EL.prog.flags; Object.assign(f, { lesson1: { outcome: 'quiet' }, prologue: 'done', 'thornwick.started': 'true', 'thornwick.mill': 'quiet', 'act1.mill': 'done' }); __EL.prog.setState('earth', 'trained'); __EL.prog._save(); __EL.travel('verdant', 'from_gate'); });
    await page.waitForFunction(() => window.__EL?.mode === 'verdant' && window.__EL?.ready, null, { timeout: 90000 });
    await page.waitForTimeout(1200);
    await ev(() => {
        window.__W = ms => new Promise(r => setTimeout(r, ms));
        window.__at = (x, z) => { const B = __EL.player.body, T = __EL.world.terrain; B.position.set(x, T.height(x, z) + 0.6, z); B.velocity.set(0, 0, 0); };
        window.__skip = async until => { for (let i = 0; i < 160 && !until(); i++) { __EL.hud.skipLine = true; await __W(120); } };
        window.__pile = () => __EL.world.rocks.filter(e => e.data.pile === 'Yard_Pile' && e.body.world);
        __EL.story.go('yard');
    });

    const yard = await ev(async () => {
        __at(18, -38); await __W(1500);
        const c = __EL.world.objects.get('Cael').npc.position;
        return { step: __EL.story.step, stones: __pile().length, dummies: [1, 2, 3, 4].filter(i => __EL.world.objects.has('Yard_Dummy_' + i)).length, caelNear: Math.hypot(c.x - 23, c.z + 34) < 3, objective: document.querySelector('#hud-objective .text')?.textContent };
    });
    check(yard.step === 'yard' && yard.stones === 4 && yard.dummies === 4 && yard.caelNear && /straw men/.test(yard.objective || ''),
        `the training yard: a pile of four stones, four straw men, Cael beside it (${JSON.stringify(yard)})`);

    const compass = await ev(async () => {
        __EL.cam.yaw = 0; await __W(400);                       // looking north
        const cs = document.getElementById('hud-compass'), letter = l => [...cs.querySelectorAll('.ticks b')].find(b => b.textContent === l);
        const north = { N: parseFloat(letter('N').style.left), E: parseFloat(letter('E').style.left), Wshown: letter('W').style.display !== 'none', mark: parseFloat(cs.querySelector('.mark').style.left), dist: cs.querySelector('.mark span').textContent };
        __EL.cam.yaw = Math.PI / 2; await __W(400);            // looking west: the pile (east of you) is behind
        const west = { W: parseFloat(letter('W').style.left), behind: cs.querySelector('.mark').classList.contains('behind') };
        return { north, west };
    });
    check(Math.abs(compass.north.N - 50) < 1 && Math.abs(compass.north.E - 100) < 1 && /\d+ m/.test(compass.north.dist) && Math.abs(compass.west.W - 50) < 1 && compass.west.behind,
        `the compass: facing north, N in the middle and E at the right; the objective's diamond at its bearing with its distance; turned away, it's pinned to the edge (${JSON.stringify(compass)})`);

    const throws = await ev(async () => {
        const out = [];
        for (let i = 1; i <= 3; i++) {
            const s = __pile()[0], d = __EL.world.objects.get('Yard_Dummy_' + i).prop.entry.body.position;
            s.body.position.set(d.x - 4, d.y + 0.3, d.z); s.body.velocity.set(0, 0, 0);
            __EL.channel.throwEntry(s, new __EL.THREE.Vector3(1, 0.05, 0).normalize(), 18, 'earth');
            await __W(2500);
            out.push(__EL.world.signal('Yard_Dummy_' + i, 'hit'));
        }
        const said = document.querySelector('#hud-say .line')?.textContent;
        return { hits: out, count: __EL.story.counters.yardHits, step: __EL.story.step, flag: __EL.prog.flags['act1.yard'], said };
    });
    check(throws.hits.every(Boolean) && throws.count === 3 && throws.step === 'drill' && !throws.flag,
        `a stone from the pile thrown hard knocks a straw man down, and it counts; three down, and Cael moves on to the drill (${JSON.stringify(throws)})`);

    // The drill: a stone set softly on a plate is Earth Control; a drop isn't. Pull waits on Control 3.
    const drill = await ev(async () => {
        await __skip(() => !__EL.story.talking);
        const plate = __EL.world.objects.get('Yard_Plate_1').plate, p = plate.pos, ch = __EL.channel;
        const set = async gentle => {
            const s = __pile()[0];
            s.body.position.set(p.x + 1.2, p.y + 0.8, p.z); s.body.velocity.set(0, 0, 0);
            ch.grab(s, 'earth');
            ch.holdAt(new __EL.THREE.Vector3(p.x, plate.top + s.data.radius + (gentle ? 0.1 : 2.2), p.z));
            await __W(1800);
            ch.release({});
            await __W(2200);
            const g = plate.gentle;
            s.body.position.set(p.x + 3, p.y + 0.5, p.z); s.body.velocity.set(0, 0, 0);          // off the plate again
            await __W(600);
            return g;
        };
        __at(p.x + 2.5, p.z); await __W(400);
        const c0 = __EL.prog.control('earth'), canPull0 = __EL.prog.can('pull');
        const dropped = await set(false), c1 = __EL.prog.control('earth');
        const soft = await set(true), c2 = __EL.prog.control('earth');
        const objective = document.querySelector('#hud-objective .text')?.textContent, bar = document.querySelector('#hud-objective .bar i')?.style.width;
        __EL.prog.els.earth.control = 0.2;                 // the rest of the drill (level 3)
        await __W(800);
        return { c0, dropped, c1, soft, c2: +c2.toFixed(3), canPull0, objective, bar, step: __EL.story.step };
    });
    check(!drill.dropped && drill.c1 === drill.c0 && drill.soft && Math.abs(drill.c2 - drill.c0 - 0.03) < 0.001 && !drill.canPull0 && /Earth Control \d+ of 3/.test(drill.objective || '') && drill.step === 'ground',
        `the drill: a drop on the plate teaches nothing, a soft set-down is Earth Control (+0.03); the objective counts the level; at Control 3 the pull unlocks (${JSON.stringify(drill)})`);

    // Pull a stone up out of the ground (hold still on open ground), and throw it.
    const pull = await ev(async () => {
        const I = __EL.intent, h = __EL.player.body.position, T = __EL.world.terrain;
        await __skip(() => !__EL.story.talking);
        __at(24, -40); __EL.cam.yaw = Math.PI / 2; await __W(600);
        // A patch of open ground a few metres off, on screen.
        let pt = null;
        for (const [dx, dz] of [[-4, 0], [-4, 2], [-4, -2], [-5, 1], [-3, -3]]) {
            const x = h.x + dx, z = h.z + dz, q = new __EL.THREE.Vector3(x, T.height(x, z), z).project(__EL.cam.cam);
            if (q.z < 1 && Math.abs(q.x) < 0.9 && Math.abs(q.y) < 0.9) { const sx = (q.x + 1) / 2 * innerWidth, sy = (1 - q.y) / 2 * innerHeight; if (__EL.works.groundAt(sx, sy)) { pt = [sx, sy]; break; } }
        }
        if (!pt) return { pt };
        const took = I.press(pt[0], pt[1]);
        const t0 = __EL.story.time; while (I.state === 'ground' && __EL.story.time - t0 < 3) await __W(50);
        const held = __EL.channel.held?.entry, id = held?.id;
        const r = { took, state: I.state, id, mass: held && +held.body.mass.toFixed(2) };
        // Flick it at a straw man.
        const d = __EL.world.objects.get('Yard_Dummy_4').prop.entry.body.position;
        __EL.channel.let(); I._cancel();
        held.body.position.set(d.x - 4, d.y + 0.3, d.z); held.body.velocity.set(0, 0, 0);
        __EL.channel.throwEntry(held, new __EL.THREE.Vector3(1, 0.05, 0).normalize(), 18, 'earth');
        await __W(1500);
        return { ...r, step: __EL.story.step, pulled: __EL.story.counters.pulled, flag: __EL.prog.flags['learned.pull'] };
    });
    check(pull.took && pull.state === 'holding' && /^Pulled_/.test(pull.id || '') && pull.pulled === 1 && pull.flag === 'yes' && pull.step === 'cover',
        `hold still on open ground: a stone tears up into your hand; thrown, the lesson moves on to cover (${JSON.stringify(pull)})`);

    // Hold on past the stone: it sinks back and the ground rises as a column (Control 4).
    const cover = await ev(async () => {
        const I = __EL.intent, h = __EL.player.body.position, T = __EL.world.terrain;
        await __skip(() => !__EL.story.talking);
        const unsure = __EL.prog.can('raise');
        __EL.prog.els.earth.control = 0.3;
        const x = h.x - 4, z = h.z + 1, q = new __EL.THREE.Vector3(x, T.height(x, z), z).project(__EL.cam.cam);
        // Bare ground: nothing loose lying where the hand goes (a stone there would be grabbed instead).
        for (const e of __EL.world.rocks) { const b = e.body.position; if (Math.hypot(b.x - x, b.z - z) < 3) { b.set(x + 8, b.y + 1, z + 8); e.body.velocity.set(0, 0, 0); } }
        await __W(200);
        const sx = (q.x + 1) / 2 * innerWidth, sy = (1 - q.y) / 2 * innerHeight;
        const stones0 = __EL.works.stones.length;
        I.press(sx, sy);
        const seen = new Set(); const t0 = __EL.story.time;
        while (I.state !== 'raising' && __EL.story.time - t0 < 4) { seen.add(I.state); await __W(50); }
        const t1 = __EL.story.time; while (__EL.story.time - t1 < 1) await __W(100);
        for (let i = 0; i < 20 && __EL.works.stones.length !== stones0; i++) await __W(100);       // the stone sinks back over a moment
        const col = __EL.works.columns[__EL.works.columns.length - 1];
        const out = { seen: [...seen], state: I.state, columns: __EL.works.columns.length, top: col && +col.top.toFixed(2), stonesBack: __EL.works.stones.length === stones0 };
        I.release?.({ vx: 0, vy: 0, speed: 0 }); I._cancel();
        await __skip(() => __EL.story.step === 'ready');
        return { ...out, unsure, step: __EL.story.step, raise: __EL.prog.flags['learned.raise'], catch: __EL.prog.flags['learned.catch'], canCatch: __EL.prog.can('catch') };
    });
    check(!cover.unsure && cover.seen.includes('holding') && cover.state === 'raising' && cover.columns >= 1 && cover.top > 0.5 && cover.stonesBack && cover.step === 'ready' && cover.raise === 'yes' && cover.catch === 'yes' && !cover.canCatch,
        `raising waits on Control 4; held still past the stone, it sinks back and a column rises; catching is taught, but needs Control 5 (${JSON.stringify(cover)})`);

    // The soft gate: walk out of the yard before Control 5 and you go anyway; Cael says so, and it's remembered.
    const gate = await ev(async () => {
        await __skip(() => !__EL.story.talking);
        __at(30, -70); await __W(1500);
        await __skip(() => __EL.story.step === 'gone');
        return { step: __EL.story.step, unready: __EL.prog.flags['act1.unready'], flag: __EL.prog.flags['act1.yard'] };
    });
    check(gate.step === 'gone' && gate.unready === true && gate.flag === 'done', `walk out of the yard before you're ready (Control 4 of 5): you go anyway, remembered (${JSON.stringify(gate)})`);
    const ready = await ev(async () => {
        __EL.prog.flags['act1.unready'] = undefined; __EL.story.go('ready'); __at(30, -38); await __W(600);
        __EL.prog.els.earth.control = 0.4; await __W(800);
        await __skip(() => __EL.story.step === 'gone');
        return { step: __EL.story.step, unready: __EL.prog.flags['act1.unready'] ?? null, canCatch: __EL.prog.can('catch') };
    });
    check(ready.step === 'gone' && ready.unready === null && ready.canCatch, `at Control 5 Cael calls you ready, and a thrown stone can be caught (${JSON.stringify(ready)})`);

    // The hunt: the boar in the north fields. Killed, it's remembered, the Reach cares, and Brask says so.
    const hunt = await ev(async () => {
        const boar = __EL.creatures.all.find(c => c.group.item.id === 'Fields_Boar');
        if (!boar) return { boar: false };
        const care0 = __EL.ledger.get('care', 'verdant'), p0 = __EL.prog.power('earth');
        boar.react('impact', 9999, 'player');
        await __W(400);
        return { boar: true, flag: __EL.prog.flags['hunt.boar'], care: +(__EL.ledger.get('care', 'verdant') - care0).toFixed(2), power: +(__EL.prog.power('earth') - p0).toFixed(3) };
    });
    check(hunt.boar && hunt.flag === 'done' && hunt.care >= 1 && hunt.power >= 0.015, `the hunt: the boar in the north fields killed is remembered, the Reach cares, and the kill grows Earth (${JSON.stringify(hunt)})`);

    const reset = await ev(async () => {
        await __W(9000);
        return { stones: __pile().length, up: [1, 2, 3].every(i => !__EL.world.signal('Yard_Dummy_' + i, 'down')), stillCounted: __EL.world.signal('Yard_Dummy_1', 'hit') };
    });
    check(reset.stones === 4 && reset.up && reset.stillCounted, `the straw men stand back up; thrown stones crumble and the pile restocks (${JSON.stringify(reset)})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('YARD FAIL'); process.exit(1); }
    console.log('YARD PASS');
})();
