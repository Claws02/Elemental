// ============================================================
// BESTIARY — the nine creatures of phase 5, each beaten the way the world
// bible says it can be (scenes/bestiary.json, scripts/scenes/bestiary.mjs).
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/bestiary.js
// ============================================================
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:8140/index.html').replace(/\?.*$/, '');
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
    const ev = (fn, a) => page.evaluate(fn, a);
    const shot = n => page.screenshot({ path: path.join(SHOTS, n + '.png') });

    await page.goto(`${BASE}?scene=bestiary`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    // Helpers: the creature of a species; the hero placed beside it; waiting game-time-ish.
    await ev(() => {
        window.__C = sp => __EL.creatures.all.find(c => c.group.item.species === sp && c.state !== 'dead' && !c.gone);
        window.__near = async (c, dx = 3, dz = 0) => { const G = __EL.world.terrain; const b = __EL.player.body; b.position.set(c.pos.x + dx, G.height(c.pos.x + dx, c.pos.z + dz) + 0.6, c.pos.z + dz); b.velocity.set(0, 0, 0); await __sleep(250); };     // a frame for the hero's mesh to follow
        window.__sleep = ms => new Promise(r => setTimeout(r, ms));
        // The hero can't die here (a death reloads the scene): damage is measured with this lifted for a moment.
        __EL.vitals.invulnerable = true;
        window.__hurtable = async (ms, fn) => { __EL.vitals.health = 100; __EL.vitals.invulnerable = false; await fn?.(); await __sleep(ms); const lost = 100 - __EL.vitals.health; __EL.vitals.invulnerable = true; __EL.vitals.health = 100; return lost; };
    });
    const species = await ev(() => [...new Set(__EL.creatures.all.map(c => c.group.item.species))].sort());
    check(species.length === 9, `nine new creatures are in the world (${species.join(', ')})`);

    // Shellback: hits glance off; stone raised under it flips it; on its back it is soft.
    const shell = await ev(async () => {
        const c = __C('shellback'), hp0 = c.hp;
        c.react('impact', 30, 'player');
        const glance = hp0 - c.hp;
        __EL.works.raise(new __EL.THREE.Vector3(c.pos.x, 0, c.pos.z), 'player');
        await __sleep(300);
        const flipped = c.flipped > 0, hp1 = c.hp;
        c.react('impact', 30, 'player');
        return { glance: +glance.toFixed(1), flipped, soft: +(hp1 - c.hp).toFixed(1) };
    });
    check(shell.glance < 5 && shell.flipped && shell.soft > 25, `Shellback: a rock glances off; stone raised under it flips it, and on its back the same rock hurts (${JSON.stringify(shell)})`);

    // Cindermite: lured by a heated stone; water kills one; block the vent and no more come.
    const mite = await ev(async () => {
        const C = __EL.creatures, g = C.world.creatureGroups.find(x => x.item.species === 'cindermite');
        const rock = __EL.world.rocks[0], thing = __EL.interactables.things.find(t => t.entry === rock);
        // Warm, not molten (the sandbox knows lava): a hot stone set down gently.
        rock.body.position.set(g.item.x + 7, __EL.world.terrain.height(g.item.x + 7, g.item.z) + 0.5, g.item.z);
        rock.body.velocity.set(0, 0, 0); rock.body.wakeUp();
        for (let i = 0; i < 18; i++) __EL.fire.heat(thing, 0.1, 'player');
        await __sleep(2500);
        const lured = g.members.filter(m => m.state !== 'dead' && !m.gone && m.lured).length;
        const one = g.members.find(m => m.state !== 'dead' && !m.gone);
        one.react('water', 2, 'player');
        const drowned = one.state === 'dead';
        // Bury the vent: a column over its mouth.
        __EL.works.raise(new __EL.THREE.Vector3(g.item.x, 0, g.item.z), 'player');
        await __sleep(1500);
        const n0 = g.members.length;
        for (const m of g.members) if (m.state !== 'dead') m.react('water', 5, 'player');
        await __sleep(4000);
        return { lured, drowned, buried: __EL.world.signal('Pen_cindermite', 'buried'), spawnedAfter: g.members.length - n0 };
    });
    check(mite.lured >= 2 && mite.drowned && mite.buried && mite.spawnedAfter === 0, `Cindermite: a heated stone lures the swarm, water drowns them, and a stone over the vent stops more coming (${JSON.stringify(mite)})`);

    // Mudling: a hard blow splits it; fire bakes it; baked, a stone shatters it.
    const mud = await ev(async () => {
        const g = __EL.creatures.world.creatureGroups.find(x => x.item.species === 'mudling');
        const c = g.members[0], hp0 = c.hp;
        c.react('impact', 6, 'player');
        const absorbed = hp0 - c.hp;
        c.react('impact', 20, 'player');
        await __sleep(200);
        const halves = g.members.filter(m => !m.gone && m.state !== 'dead');
        const h = halves[0];
        h.react('fire', 12, 'player');
        const baked = h.baked > 0, hb = h.hp;
        h.react('impact', 10, 'player');
        return { absorbed, split: halves.length, baked, shattered: h.state === 'dead' || hb - h.hp > 20 };
    });
    check(mud.absorbed === 0 && mud.split === 2 && mud.baked && mud.shattered, `Mudling: stones sink in; a hard blow splits it in two; fire bakes a half brittle and a stone shatters it (${JSON.stringify(mud)})`);

    // Brinecoil: wading near it, you're shocked; frozen, it's pinned for long.
    const coil = await ev(async () => {
        const c = __C('brinecoil'), W = __EL.world.waters;
        const inPond = !!W.at(c.pos.x, c.pos.z);
        // Wade in beside it.
        const T = __EL.world.terrain, b = __EL.player.body;
        // A wading spot at the pond's edge, and the coil brought into the water just beside it.
        let spot = null, coilAt = null;
        for (let r = 4; r < 14 && !spot; r += 0.25) for (let a = 0; a < 6.28 && !spot; a += 0.2) {
            const x = 30 + Math.cos(a) * r, z = 30 + Math.sin(a) * r, d = W.depth(x, z);
            if (d > 0.45 && d < 1.0) {
                for (let k = 1.5; k < 4 && !coilAt; k += 0.25) { const cx = 30 + Math.cos(a) * (r - k), cz = 30 + Math.sin(a) * (r - k); if (W.depth(cx, cz) > 1.0) coilAt = [cx, cz]; }
                if (coilAt) spot = [x, z];
            }
        }
        c.body.position.set(coilAt[0], c.pool.level - 0.3, coilAt[1]); c.body.velocity.set(0, 0, 0); c.home.set(coilAt[0], c.home.y, coilAt[1]);
        b.position.set(spot[0], T.height(spot[0], spot[1]) + 0.6, spot[1]); b.velocity.set(0, 0, 0);
        c.engaged = true; c.shockT = 0.1;
        const shocked = await __hurtable(4000);
        b.position.set(0, T.height(0, 0) + 0.6, 0);
        c.freeze(5, 'player');
        return { inPond, shocked: +shocked.toFixed(1), frozenFor: c.frozen };
    });
    check(coil.inPond && coil.shocked > 5 && coil.frozenFor > 7, `Brinecoil: it lives in the pond; wade near it and the water shocks you; ice pins it for long (${JSON.stringify(coil)})`);

    // Gale-kite: high up; wind brings it down to the ground for a while.
    const kite = await ev(async () => {
        const c = __C('galekite'); c.engaged = true;
        await __near(c, 6, 0);
        // It dives and climbs: its highest over a few seconds, then a gust, then its lowest.
        const above = () => c.pos.y - __EL.world.terrain.height(c.pos.x, c.pos.z);
        let high = 0, low = 99;
        for (let i = 0; i < 12; i++) { await __sleep(250); high = Math.max(high, above()); }
        c.react('wind', 3, 'player');
        for (let i = 0; i < 10; i++) { await __sleep(250); low = Math.min(low, above()); }
        return { high: +high.toFixed(1), grounded: c.grounded, low: +low.toFixed(1) };
    });
    check(kite.high > 4 && kite.grounded && kite.low < 1.5, `Gale-kite: it glides high; a gust brings it down to the ground (${JSON.stringify(kite)})`);

    // Frostmaw: it walls the way behind you with ice; fire thaws it slow and clumsy.
    const maw = await ev(async () => {
        const c = __C('frostmaw'); c.engaged = true;
        await __near(c, 6, 0);
        c.wallT = 0.2;
        let walls = 0;
        const off = __EL.EventBus.on('Creature', e => { if (e.to === 'walled') walls++; });
        await __sleep(1500);
        off?.();
        c.react('fire', 5, 'player');
        const hp = c.hp; c.react('impact', 10, 'player');
        return { walls, thawed: c.thawed > 0, clumsy: +(hp - c.hp).toFixed(1), immuneToIce: (c.freeze(5), c.frozen === 0) };
    });
    check(maw.walls >= 1 && maw.thawed && maw.clumsy >= 20 && maw.immuneToIce, `Frostmaw: it freezes the way behind you shut; fire thaws it, and thawed a blow lands double (${JSON.stringify(maw)})`);

    // Glass-wight: fire bounces back at you; only a heavy blow lands.
    const wight = await ev(async () => {
        const c = __C('glasswight');
        await __near(c, 4, 0);
        const hp0 = c.hp;
        const back = await __hurtable(50, () => c.react('fire', 20, 'player'));
        c.react('impact', 6, 'player');
        const light = hp0 - c.hp;
        c.react('impact', 15, 'player');
        return { back: +back.toFixed(1), light, heavy: +(hp0 - c.hp).toFixed(1) };
    });
    check(wight.back > 5 && wight.light === 0 && wight.heavy > 20, `Glass-wight: your fire comes back at you; a light blow bounces off; a heavy one lands (${JSON.stringify(wight)})`);

    // Lantern Sentinel: its light binds and hurts; water puts its lamps out one by one; a hard hit raises the alarm.
    const sent = await ev(async () => {
        const c = __C('sentinel'); c.engaged = true;
        await __near(c, 5, 0);
        const bound = await __hurtable(1500);
        c.react('impact', 30, 'player');
        const alarm = __EL.world.signal('Pen_sentinel', 'alarm');
        for (let i = 0; i < 3; i++) c.react('water', 1.5, 'player');
        return { bound: +bound.toFixed(1), alarm, lamps: c.lamps, off: c.state === 'off', gone: __EL.world.signal('Pen_sentinel', 'gone'), spared: __EL.ledger.get('spared') };
    });
    check(sent.bound > 2 && sent.alarm && sent.lamps === 0 && sent.off && sent.gone && sent.spared >= 1,
        `Lantern Sentinel: its light binds and wears you down; a hard hit raises the alarm; a careful stream puts its three lamps out, and it goes dark (spared) (${JSON.stringify(sent)})`);

    // Wellspawn: only the opposite of its element hurts it, and it changes.
    const well = await ev(async () => {
        const c = __C('wellspawn'); c.engaged = true;
        await __near(c, 5, 0);
        const f0 = c.form, hp0 = c.hp;
        c.react('fire', 10, 'player');
        const same = hp0 - c.hp;
        c.react('water', 3, 'player');
        const opposite = hp0 - c.hp;
        c.shiftT = 0.05;
        await __sleep(800);
        return { f0, same, opposite: +opposite.toFixed(1), f1: c.form };
    });
    check(well.f0 === 'fire' && well.same === 0 && well.opposite > 5 && well.f1 !== 'fire', `Wellspawn: fire does nothing to its fire form, water does; then it changes (${JSON.stringify(well)})`);
    await ev(() => { const b = __EL.player.body, T = __EL.world.terrain; b.position.set(-8, T.height(-8, 22) + 0.6, 22); __EL.cam.yaw = Math.PI * 0.8; __EL.cam.pitch = 0.3; __EL.cam.dist = 16; });
    await page.waitForTimeout(1500);
    await shot('B1-bestiary');

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('BESTIARY FAIL'); process.exit(1); }
    console.log('BESTIARY PASS');
})();
