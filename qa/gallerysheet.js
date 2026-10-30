// ============================================================
// GALLERY SHEET — every phase 5 model framed alone, for a before/after review
// (docs/ART_AND_MODELS.md §4 rule 6). Boots ?scene=gallery, stills the
// creatures where they stand, and frames each creature, prefab building and
// person from its front.
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/gallerysheet.js [filter]
// output: qa/shots/gallery-<kind>-<name>.png (filter: only names containing it)
// ============================================================
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:8140/index.html') + '?scene=gallery';
const SHOTS = path.join(__dirname, 'shots');
const only = process.argv[2] || '';

(async () => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE);
    await page.waitForFunction(() => window.__EL?.ready && window.__EL.creatures?.all.length, null, { timeout: 120000 });
    await page.addStyleTag({ content: '#hud { display: none }' });
    // Still the creatures: each stands where it was placed, facing +Z (the gallery's camera row).
    await page.evaluate(() => {
        for (const c of __EL.creatures.all) {
            const it = c.group.item;
            c.body.position.set(it.x, c.body.position.y, it.z); c.body.velocity.set(0, 0, 0);
            const y = c.body.position.y;
            c.update = dt => { c.body.position.set(it.x, y, it.z); c.body.velocity.set(0, 0, 0); c.facing = 0; c._pose(dt); };
        }
        __EL.player.body.position.set(0, 2, 120);
    });
    await page.waitForTimeout(600);
    // What to frame: [kind, name, focus x/y/z, distance, height of the focus].
    const targets = await page.evaluate(async () => {
        const { PREFABS } = await import('./src/data/prefabs.js');
        const out = [];
        for (const c of __EL.creatures.all) {
            const it = c.group.item, b = new __EL.THREE.Box3().setFromObject(c.model.root), s = b.getSize(new __EL.THREE.Vector3()), m = b.getCenter(new __EL.THREE.Vector3());
            out.push(['creature', it.species, m.x, m.y, m.z, Math.max(2.4, Math.max(s.x, s.y, s.z) * 2.2)]);
        }
        for (const o of __EL.world.data.objects) {
            if (o.type === 'prefab') { const big = PREFABS[o.prefab]?.landmark; out.push(['building', o.prefab, o.x, big ? 6 : 3, o.z, big ? 34 : 17]); }
            if (o.type === 'npc') out.push(['person', o.look, o.x, 0.95, o.z, 2.8]);
        }
        return out;
    });
    let n = 0;
    for (const [kind, name, x, y, z, dist] of targets) {
        if (only && !name.includes(only)) continue;
        await page.evaluate(({ x, y, z, dist }) => {
            const c = __EL.cam, yaw = 0.55, pitch = 0.22;
            c.update = function () {
                this.cam.position.set(x + Math.sin(yaw) * Math.cos(pitch) * dist, y + Math.sin(pitch) * dist, z + Math.cos(yaw) * Math.cos(pitch) * dist);
                this.cam.lookAt(x, y, z);
            };
        }, { x, y, z, dist });
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SHOTS, `gallery-${kind}-${name}.png`) });
        n++;
    }
    console.log(`gallery sheet: ${n} models${errors.length ? ' · page errors: ' + errors.slice(0, 2).join(' | ') : ''}`);
    await browser.close();
    process.exit(errors.length ? 1 : 0);
})();
