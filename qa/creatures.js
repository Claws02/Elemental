// ============================================================
// CREATURES — the arena (scenes/arena.json): each species' behaviour, and
// each element's effect on it. The weaknesses follow from physics, so the
// tests do what a player would: throw a rock, splash water, stand by fire.
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/creatures.js
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
    const open = async () => {
        await page.goto(BASE + '?scene=arena', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 30000 });
        await ev(() => { window.__c = id => __EL.creatures.all.find(c => c.id === id); window.__events = t => __EL.EventBus.recent().filter(e => e.type === t); });
    };

    // 1. A pack circles and bites.
    await open();
    const bitten = await until(() => __EL.vitals.health < 100 && __events('Hurt').some(e => e.cause === 'Thornhound'), 25000);
    const circled = await ev(() => __EL.creatures.all.filter(c => c.id.startsWith('Hounds')).map(c => c.state));
    check(bitten, `thornhounds close in, circle and bite (${circled.join(', ')})`);
    await page.screenshot({ path: path.join(SHOTS, 'K1-pack.png') });

    // 2. Fire frightens a hound: it backs off.
    const scared = await ev(async () => {
        __EL.vitals.invulnerable = true;
        const h = __c('Hounds_1'), hay = __EL.interactables.things.find(t => t.id === 'Hay_1');
        __EL.fire.ignite(hay, 'environment');
        const p = hay.pos();
        h.body.position.set(p.x + 1.5, 0.45, p.z);
        await new Promise(r => setTimeout(r, 700));
        return { scared: h.scared > 0, hp: h.hp };
    });
    check(scared.scared, `a hound near fire is frightened (${JSON.stringify(scared)})`);

    // 3. A thrown rock: damage from speed × mass, the kill is the player's, and the ledger counts it.
    const killed = await ev(async () => {
        const h = __c('Hounds_2');
        h.speedK = 0;                                  // hold it still: the test is the rock, not the aim
        const e = __EL.world.rocks.find(r => r.data.radius > 0.5);
        const hits = [];
        for (let i = 0; i < 4 && h.state !== 'dead'; i++) {
            h.body.velocity.set(0, 0, 0);
            e.body.position.set(h.pos.x, h.pos.y + 1.6, h.pos.z);
            e.body.velocity.set(0, -16, 0);            // dropped hard on it, as if thrown
            e.body.wakeUp();
            Object.assign(e.data, { thrownBy: 'player', thrownAt: performance.now() });
            await new Promise(r => setTimeout(r, 700));
            hits.push(Math.round(h.hp));
        }
        await new Promise(r => setTimeout(r, 300));
        const ev = __events('Creature').find(x => x.id === 'Hounds_2');
        return { hits, event: ev?.to, cause: ev?.cause, killed: __EL.ledger.get('killed') };
    });
    check(killed.event === 'dead' && killed.cause === 'player' && killed.killed >= 1, `a thrown rock kills a hound, and it's counted as the player's (${JSON.stringify(killed)})`);

    // 4. The last of a pack runs, and running away is sparing it.
    const alone = await ev(async () => {
        __c('Hounds_1').react('impact', 999, 'player');
        await new Promise(r => setTimeout(r, 600));
        return __c('Hounds_3').state;
    });
    const gone = await until(() => __EL.world.objects.get('Hounds').signal('gone'), 20000);
    const fled = await until(() => __events('Creature').some(e => e.to === 'fled'), 25000);        // spared when it has actually gone
    const spared = await ev(() => __events('Creature').filter(e => e.to === 'fled').length);
    const why = fled ? '' : await ev(() => JSON.stringify(__EL.creatures.all.map(c => c.id + ':' + c.state + ':' + c.t.toFixed(1)).concat(__events('Creature').map(e => e.id + '>' + e.to))));
    check(alone === 'flee' && gone && spared >= 1, `the last hound flees; the pack is "gone" to wires and the story (${JSON.stringify({ alone, gone, spared, why })})`);

    // 5. A charge that ends in a wall stuns the boar.
    const stun = await ev(async () => {
        const b = __c('Boar_1');
        __EL.player.body.position.set(10, 0.45, 2);
        b.body.position.set(10, 0.8, -8);
        b.body.velocity.set(0, 0, 0);
        b.engaged = true;
        b.facing = 0;
        b.chargeDir = new __EL.THREE.Vector3(0, 0, 1);
        b._to('charging');
        const seen = [];
        for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 100)); seen.push(b.state); if (b.state === 'stunned') break; }
        return { state: b.state, z: +b.pos.z.toFixed(1) };
    });
    check(stun.state === 'stunned', `a bristleback charging into a pillar is stunned (${JSON.stringify(stun)})`);

    // 6. Water grounds an Emberwing, and it gives up and leaves. (A splash throws it up first; then it falls.)
    const bird = await ev(async () => {
        const w = __EL.creatures.all.filter(c => c.id.startsWith('Flock') && c.state !== 'dead' && c.state !== 'flee').sort((a, b) => b.pos.y - a.pos.y)[0];
        const h0 = __EL.player.position;
        w.body.position.set(h0.x + 3, 5, h0.z + 3);        // near the hero: a frightened creature far away just leaves
        w.body.velocity.set(0, 0, 0);
        await new Promise(r => setTimeout(r, 200));
        const y0 = w.pos.y;
        let low = y0;
        __EL.water.splash(new __EL.THREE.Vector3(w.pos.x, w.pos.y, w.pos.z), 1);
        for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 100)); low = Math.min(low, w.pos.y); if (low < 0.8) break; }
        const h = __EL.player.position; return { id: w.id, y0: +y0.toFixed(1), low: +low.toFixed(1), state: w.state, gone: w.gone, why: w.fleeWhy, hero: [h.x, h.y, h.z].map(v => +v.toFixed(1)), at: [w.pos.x, w.pos.z].map(v => +v.toFixed(1)), el: window.__EL === __EL };
    });
    check(bird.low < bird.y0 - 2 && bird.state === 'flee', `a splash of water grounds an Emberwing, and it gives up (${JSON.stringify(bird)})`);

    // 7. Emberwings set fires: that's the prologue.
    const embers = await until(() => __events('FireStarted').some(e => e.cause === 'creature'), 25000);
    check(embers, 'Emberwings dive and set what\'s below alight');
    await page.screenshot({ path: path.join(SHOTS, 'K2-flock.png') });

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('CREATURES FAIL'); process.exit(1); }
    console.log('CREATURES PASS');
})();
