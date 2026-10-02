// ============================================================
// BENCH — runs index.html?bench headless and prints the result card.
// Headless Chromium draws in software, so its fps says little about a phone;
// the CPU split (update, physics, render submit), draw calls and triangles
// compare run to run. On a phone, open index.html?bench and copy the card.
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/bench.js
// ============================================================
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:8140/index.html').replace(/\?.*$/, '');

(async () => {
    const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
    const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });     // an iPhone 15 Pro's screen, landscape
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}?bench`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__BENCH, null, { timeout: 600000 });
    const r = await page.evaluate(() => window.__BENCH);
    console.log(JSON.stringify(r));
    if (errors.length) console.log('errors:', errors.slice(0, 3).join(' | '));
    await browser.close();
    process.exit(errors.length ? 1 : 0);
})();
