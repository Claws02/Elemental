// ============================================================
// ABILITIES — phase 4: the elements beyond their basics, and combinations
// (docs/ABILITIES.md). Runs in the sandbox (everything known).
//
//   Earth raises stone: touch open ground, hold still, a column rises and
//   keeps rising while held; stand on the spot and it lifts you; it sinks back.
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/abilities.js
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
    const wait = ms => page.waitForTimeout(ms);
    const ev = (fn, a) => page.evaluate(fn, a);
    const until = (fn, ms, a) => page.waitForFunction(fn, a, { timeout: ms }).then(() => true).catch(() => false);
    const shot = n => page.screenshot({ path: path.join(SHOTS, n + '.png') });

    async function open(scene) {
        await page.goto(`${BASE}?scene=${scene}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 30000 });
        await wait(600);
        await ev(() => {
            const el = document.getElementById('game');
            window.__touch = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
            window.__screen = p => { const q = p.clone().project(__EL.cam.cam); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight, on: q.z < 1 && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95 }; };
            // Open ground a few metres in front of the hero, on screen and clear.
            window.__openGround = () => {
                const h = __EL.player.position, f = __EL.player.facing;
                for (const d of [5, 6, 7, 4.5, 8]) for (const a of [0, 0.3, -0.3, 0.6, -0.6]) {
                    const p = new __EL.THREE.Vector3(h.x + Math.sin(f + a) * d, 0, h.z + Math.cos(f + a) * d);
                    const s = __screen(p);
                    if (s.on && s.x > innerWidth * 0.3 && !__EL.air.onHero(s.x, s.y) && !__EL.interactables.pick(s.x, s.y, __EL.cam.cam, () => true) && __EL.works.clear(p) && __EL.works.groundAt(s.x, s.y)) return { p, s };
                }
                return null;
            };
        });
    }

    // ---- Earth: raise stone ---------------------------------------------------------------------------
    await open('sandbox');
    const g = await ev(() => { const o = __openGround(); return o && { x: o.s.x, y: o.s.y }; });
    check(!!g, 'the sandbox has open ground in front of the hero to raise stone on');
    // A drag across the ground is still the camera.
    const orbit = await ev(async ([x, y]) => {
        const yaw = __EL.cam.yaw;
        __touch('pointerdown', 1, x, y);
        for (let i = 1; i <= 6; i++) { __touch('pointermove', 1, x + i * 12, y); await new Promise(r => setTimeout(r, 30)); }
        __touch('pointerup', 1, x + 72, y);
        return { turned: Math.abs(__EL.cam.yaw - yaw) > 0.01, columns: __EL.works.columns.length };
    }, [g.x, g.y]);
    check(orbit.turned && orbit.columns === 0, `a drag across open ground turns the camera and raises nothing (${JSON.stringify(orbit)})`);
    // Hold still: it rises, and keeps rising while held.
    await ev(([x, y]) => __touch('pointerdown', 2, x, y), [g.x, g.y]);
    const rose = await until(() => __EL.works.columns.length === 1 && __EL.works.columns[0].top > 0.5, 15000);
    const h1 = await ev(() => __EL.works.columns[0]?.top || 0);
    await until(h => __EL.works.columns[0]?.top > h + 0.6, 15000, h1);
    const h2 = await ev(() => __EL.works.columns[0]?.top || 0);
    await ev(([x, y]) => __touch('pointerup', 2, x, y), [g.x, g.y]);
    await wait(800);
    const h3 = await ev(() => ({ top: __EL.works.columns[0]?.top || 0, state: __EL.works.columns[0]?.state, intent: __EL.intent.state }));
    check(rose && h2 > h1 + 0.5 && Math.abs(h3.top - h2) < 0.5 && h3.intent === 'idle',
        `hold still on open ground: stone rises, keeps rising while held, stops when let go (${h1.toFixed(2)} → ${h2.toFixed(2)} → ${h3.top.toFixed(2)}, ${h3.state})`);
    await shot('A1-column');
    // Not through a wall, or on another column.
    const blocked = await ev(() => {
        const c = __EL.works.columns[0].body.position;
        const wall = [...__EL.world.objects.values()].find(o => /wall/i.test(o.type) && o.item);
        return { onColumn: __EL.works.clear(new __EL.THREE.Vector3(c.x, 0, c.z)), onWall: wall ? __EL.works.clear(new __EL.THREE.Vector3(wall.item.x, 0, wall.item.z)) : 'no wall' };
    });
    check(blocked.onColumn === false && blocked.onWall === false, `stone won't rise through a wall or another column (${JSON.stringify(blocked)})`);
    // A lift: raised under the hero, it carries them up.
    const lift = await ev(async () => {
        const W = __EL.works, b = __EL.player.body;
        const y0 = b.position.y;
        const c = W.raise(new __EL.THREE.Vector3(b.position.x, 0, b.position.z));
        for (let i = 0; i < 90; i++) { W.grow(c, 1 / 30, 1); await new Promise(r => setTimeout(r, 33)); }
        await new Promise(r => setTimeout(r, 1200));
        return { y0: +y0.toFixed(2), y: +b.position.y.toFixed(2), top: +c.top.toFixed(2) };
    });
    check(lift.y > lift.y0 + 1.2 && Math.abs(lift.y - (lift.top + 0.45)) < 0.3, `stand on the spot and the stone lifts you with it (${JSON.stringify(lift)})`);
    await shot('A2-lift');
    // Three at most; then they sink back on their own.
    const most = await ev(() => { const W = __EL.works, h = __EL.player.position; for (let i = 0; i < 3; i++) W.raise(new __EL.THREE.Vector3(h.x + 6 + i * 2, 0, h.z + 6)); return W.columns.filter(c => c.state !== 'sinking').length; });
    await ev(() => { for (const c of __EL.works.columns) c.age = 99; });
    const sank = await until(() => __EL.works.columns.length === 0, 30000);
    check(most === 3 && sank, `at most three stand at once, and they sink back after a while (${most} standing; sank: ${sank})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('ABILITIES FAIL'); process.exit(1); }
    console.log('ABILITIES PASS');
})();
