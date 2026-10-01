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
