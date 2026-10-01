// ============================================================
// WORLD — phase 5: the regions and the roads between them
// (scenes built by scripts/scenes/<region>.mjs; the map is LINKS in
// scripts/scenes/lib/region.mjs).
//
//   1. On paper: every exit leads to a scene that has the arrival point it
//      names, and every road runs both ways.
//   2. In the game: each region loads without errors, the hero stands on its
//      ground, it draws within budget, and walking into each exit arrives at
//      the other end of the road.
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/world.js
// ============================================================
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:8140/index.html').replace(/\?.*$/, '');
const SHOTS = path.join(__dirname, 'shots');
const ROOT = path.join(__dirname, '..');
const REGIONS = ['veyra', 'verdant', 'emberwall', 'saltmere', 'skyreach', 'glass', 'halcyra'];
const BUDGET = { calls: 400, triangles: 600000 };          // at the start point, looking along the start's facing

(async () => {
    const pass = [], fail = [];
    const check = (ok, msg) => { (ok ? pass : fail).push(msg); if (process.env.QA_LOUD) console.log((ok ? '  ok   ' : '  FAIL ') + msg); };
    const { LINKS } = await import(path.join(ROOT, 'scripts/scenes/lib/region.mjs'));

    // ---- 1. on paper ------------------------------------------------------------------------------
    const scenes = Object.fromEntries(REGIONS.map(id => [id, JSON.parse(fs.readFileSync(path.join(ROOT, 'scenes', id + '.json'), 'utf8'))]));
    const exitsOf = id => scenes[id].objects.filter(o => o.type === 'exit');
    const spawnNames = id => new Set(scenes[id].objects.filter(o => o.type === 'spawn').map(o => o.name));
    const broken = [];
    for (const id of REGIONS) {
        const S = scenes[id];
        if (!S.settings.terrain) broken.push(`${id}: not on terrain`);
        if (!spawnNames(id).has('start')) broken.push(`${id}: no start`);
        const want = (LINKS[id] || []).map(l => l[2]).sort().join(','), have = exitsOf(id).map(e => e.to).sort().join(',');
        if (want !== have) broken.push(`${id}: exits ${have} ≠ map ${want}`);
        for (const e of exitsOf(id)) {
            if (!scenes[e.to]) { broken.push(`${id} → ${e.to}: no such region`); continue; }
            if (!spawnNames(e.to).has(e.at)) broken.push(`${id} → ${e.to}: no arrival "${e.at}"`);
            if (!exitsOf(e.to).some(b => b.to === id)) broken.push(`${id} → ${e.to}: no road back`);
            const half = S.settings.terrain.size / 2;
            if (Math.abs(e.x) > half || Math.abs(e.z) > half) broken.push(`${id} → ${e.to}: off the map`);
        }
    }
    // Bridges: each end of the deck meets the ground, so you walk straight on and off.
    const { Terrain, decodeTerrain } = await import(path.join(ROOT, 'src/world/Terrain.js'));
    const gaps = [];
    let nBridges = 0;
    for (const id of REGIONS) {
        const T = new Terrain(decodeTerrain(scenes[id].settings.terrain));
        for (const b of scenes[id].objects.filter(o => o.type === 'bridge')) {
            nBridges++;
            const c = Math.cos(b.rotY || 0), sn = -Math.sin(b.rotY || 0), base = T.height(b.x, b.z) + (b.y || 0);
            for (const s of [-1, 1]) {
                const ex = b.x + s * c * b.length / 2, ez = b.z + s * sn * b.length / 2, top = base + s * (b.drop || 0) / 2 + 0.25;
                const off = top - T.height(ex, ez);
                if (Math.abs(off) > 0.4) gaps.push(`${id}/${b.id} ${s < 0 ? 'near' : 'far'} end ${off.toFixed(2)} m`);
            }
        }
    }
    check(nBridges >= 9 && gaps.length === 0, `every bridge (${nBridges}) meets the ground at both ends${gaps.length ? ': ' + gaps.join('; ') : ''}`);
    const roads = REGIONS.reduce((n, id) => n + exitsOf(id).length, 0);
    check(broken.length === 0, `the map: ${REGIONS.length} regions, ${roads} exits, each with its arrival and a road back${broken.length ? ' — ' + broken.join('; ') : ''}`);

    // ---- 2. in the game -------------------------------------------------------------------------------
    fs.mkdirSync(SHOTS, { recursive: true });
    const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
    const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const wait = ms => page.waitForTimeout(ms);
    const ev = (fn, a) => page.evaluate(fn, a);
    const open = async id => {
        await page.goto(`${BASE}?scene=${id}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 60000 });
        await wait(1500);
    };
    const until = async (fn, a, ms = 30000) => { try { await page.waitForFunction(fn, a, { timeout: ms }); return true; } catch (e) { return false; } };

    // Walk over a bridge: from the ground before one end to the ground past the other, never in the water.
    const walkOver = async (sceneId, bridgeId) => {
        errors = [];
        await open(sceneId);
        const b = scenes[sceneId].objects.find(o => o.id === bridgeId);
        return ev(async b => {
            const T = __EL.world.terrain, body = __EL.player.body;
            const dx = Math.cos(b.rotY || 0), dz = -Math.sin(b.rotY || 0), half = b.length / 2;
            const sx = b.x - dx * (half + 3), sz = b.z - dz * (half + 3);
            body.position.set(sx, T.height(sx, sz) + 0.6, sz); body.velocity.set(0, 0, 0);
            __EL.cam.yaw = Math.atan2(-dx, -dz);
            await new Promise(r => setTimeout(r, 300));
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
            let lowest = 99, along = 0;
            const t0 = performance.now();
            while (performance.now() - t0 < 25000) {
                await new Promise(r => setTimeout(r, 100));
                __EL.cam.yaw = Math.atan2(-dx, -dz);
                const p = body.position;
                along = (p.x - b.x) * dx + (p.z - b.z) * dz;
                if (Math.abs(along) < half - 2) lowest = Math.min(lowest, p.y - (T.height(b.x, b.z) + (b.y || 0)));      // over the middle: height above the deck's base
                if (along > half + 2) break;
            }
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
            return { along: +along.toFixed(1), half, lowest: +lowest.toFixed(2), wading: !!__EL.player.wading };
        }, b);
    };
    for (const [sc, id] of [['verdant', 'Thornwick_Bridge'], ['saltmere', 'Bridge_Council_East']]) {
        const w = await walkOver(sc, id);
        check(w.along > w.half + 2 && w.lowest > -0.3 && !w.wading && errors.length === 0, `${sc}: walk across ${id}, bank to bank, on the deck the whole way (${JSON.stringify(w)})`);
    }

    // Creature tiers: a new hero meets young animals and the gentle kinds; grown, the adults come.
    {
        errors = [];
        await open('verdant');
        const census = () => ev(() => {
            const g = {};
            for (const c of __EL.creatures.all) { const k = c.group.item.species; (g[k] ||= { n: 0, young: 0, hp: 0 }); g[k].n++; g[k].young += c.young ? 1 : 0; g[k].hp = Math.max(g[k].hp, c.maxHp); }
            return { might: +__EL.prog.might().toFixed(2), tier: __EL.creatures.tier, g };
        });
        const early = await census();
        await ev(() => { for (const e of Object.values(__EL.prog.els)) { e.state = 'trained'; e.power = 0.8; e.control = 0.8; } __EL.checkpoint(); __EL.restart(); });
        await page.waitForFunction(() => window.__EL?.ready && window.__EL.creatures?.all.length, null, { timeout: 60000 });
        await wait(1200);
        const late = await census();
        const eg = early.g, lg = late.g;
        check(early.tier === 1 && eg.thornhound?.young === 2 && eg.thornhound.n === 2 && eg.bristleback?.young === 1 && eg.emberwing?.young === 0 && eg.emberwing.n === 3
            && late.tier === 4 && lg.thornhound?.n === 3 && lg.thornhound.young === 0 && lg.bristleback.hp > eg.bristleback.hp && errors.length === 0,
            `a new hero in the Reach meets young boars and thornhound pups (fewer, weaker); grown, the full packs come (${JSON.stringify({ early, late: { might: late.might, tier: late.tier, thornhound: lg.thornhound } })})`);
    }

    const stats = [];
    for (const id of REGIONS) {
        errors = [];
        await open(id);
        const s = await ev(() => {
            const T = __EL.world.terrain, b = __EL.player.body.position, ri = __EL.renderInfo();
            return { stand: +(b.y - T.height(b.x, b.z)).toFixed(2), calls: ri.calls, triangles: ri.triangles, objects: __EL.world.objects.size };
        });
        stats.push(`${id} ${s.calls}/${(s.triangles / 1000).toFixed(0)}k`);
        await page.screenshot({ path: path.join(SHOTS, `W-${id}.png`) });
        check(errors.length === 0 && Math.abs(s.stand - 0.45) < 0.3 && s.calls <= BUDGET.calls && s.triangles <= BUDGET.triangles,
            `${id} loads clean, the hero on its ground, within budget (${JSON.stringify(s)})${errors.length ? ' errors: ' + errors.slice(0, 2).join(' | ') : ''}`);

        // Every road out: walk into the exit, arrive at the other end.
        for (const e of exitsOf(id)) {
            if (e.showWhen) continue;                                // Veyra's road opens after the prologue (qa/prologue.js)
            errors = [];
            await open(id);
            await ev(e => {
                const T = __EL.world.terrain, b = __EL.player.body;
                b.position.set(e.x, T.height(e.x, e.z) + 0.6, e.z); b.velocity.set(0, 0, 0);
            }, e);
            const went = await until(to => window.__EL?.mode === to && window.__EL?.ready, e.to, 60000);
            await wait(800);
            const at = scenes[e.to].objects.find(o => o.type === 'spawn' && o.name === e.at);
            const where = went ? await ev(() => { const b = __EL.player.body.position, T = __EL.world.terrain; return { x: +b.x.toFixed(1), z: +b.z.toFixed(1), stand: +(b.y - T.height(b.x, b.z)).toFixed(2), mode: __EL.mode }; }) : null;
            const near = where && Math.hypot(where.x - at.x, where.z - at.z) < 3;
            check(went && near && Math.abs(where.stand - 0.45) < 0.3 && errors.length === 0,
                `${id} → ${e.to}: through the exit, arriving at ${e.at} (${JSON.stringify(where)})${errors.length ? ' errors: ' + errors.slice(0, 2).join(' | ') : ''}`);
        }
    }
    console.log('  draw calls / triangles at each start: ' + stats.join(', '));

    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('WORLD FAIL'); process.exit(1); }
    console.log('WORLD PASS');
})();
