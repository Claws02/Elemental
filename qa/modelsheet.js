// ============================================================
// MODEL SHEET — screenshots for a human review of the models (after HBD's
// qa/modelsheet.js). Boots the sandbox and frames each model in turn.
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/modelsheet.js
// output: qa/shots/sheet-*.png
// ============================================================
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8140/index.html';
const SHOTS = path.join(__dirname, 'shots');

const VIEWS = [
    // name, focus [x,y,z], yaw, pitch, dist, hero pose
    ['hero-front', [0, 1.0, 9], 0.35 + Math.PI, 0.12, 3.4],
    ['hero-back', [0, 1.1, 9], 0.3, 0.2, 3.6],
    ['courtyard', [0, 1.5, 2], 0.1, 0.62, 16],
    ['barricade', [0, 1.4, -15], 0.25, 0.22, 6.5],
    ['sealed-door', [0, 2.2, -23], 0.05, 0.12, 5],
    ['pillars-rocks', [-6, 1.2, 1], -0.9, 0.3, 7],
];

(async () => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
    const browser = await chromium.launch({
        ...(exe ? { executablePath: exe } : {}),
        args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
    });
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
    await page.goto(BASE);
    await page.waitForFunction(() => window.__EL?.ready);
    await page.addStyleTag({ content: '#hud { display: none }' });
    for (const [name, f, yaw, pitch, dist] of VIEWS) {
        await page.evaluate(({ f, yaw, pitch, dist }) => {
            const c = __EL.cam;
            // Park the camera: a fixed focus instead of following the hero.
            c.update = function (dt) {
                const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
                this.cam.position.set(f[0], f[1], f[2]).addScaledVector(dir, dist);
                this.cam.lookAt(f[0], f[1], f[2]);
            };
        }, { f, yaw, pitch, dist });
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(SHOTS, `sheet-${name}.png`) });
    }
    const info = await page.evaluate(() => __EL.renderInfo());
    console.log(`sheet: ${VIEWS.length} views · last view ${info.calls} calls, ${(info.triangles / 1000).toFixed(1)}k tris`);
    await browser.close();
})();
