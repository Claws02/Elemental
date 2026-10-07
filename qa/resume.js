// ============================================================
// RESUME — a saved game picks up at its checkpoint's step
//
//   A story step that saves a checkpoint (most do, as they begin) is where
//   Continue resumes. Resuming runs that step's opening again, checkpoint and
//   all, from inside the story's construction: it must not fail ("cannot
//   access 'story' before initialization", reported on a phone).
//
//   1. a new game from the title; the story taken on to Thornwick's yard
//      (a checkpointed step), saved
//   2. reloaded: Continue resumes in the Reach at the yard, no boot error
//   3. dying there comes back to the same checkpoint
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/resume.js
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
    const bootError = () => ev(() => document.getElementById('boot-error')?.textContent || '');

    // A new game from the title.
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await ev(() => localStorage.clear());
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.click('button:has-text("New game")');
    await page.waitForTimeout(300);
    const begin = page.locator('button:has-text("Begin"), button:has-text("Start")').first();
    if (await begin.count()) await begin.click(); else await page.click('button.primary');
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });

    // On to Thornwick's yard: a step that checkpoints as it begins.
    await ev(() => { const f = __EL.prog.flags; Object.assign(f, { lesson1: { outcome: 'quiet' }, prologue: 'done', 'thornwick.started': 'true', 'thornwick.mill': 'quiet', 'act1.mill': 'done' }); __EL.prog.setState('earth', 'trained'); __EL.prog._save(); __EL.travel('verdant', 'from_gate'); });
    await page.waitForFunction(() => window.__EL?.mode === 'verdant' && window.__EL?.ready, null, { timeout: 90000 });
    await page.waitForTimeout(1000);
    const saved = await ev(async () => { __EL.story.go('yard'); await new Promise(r => setTimeout(r, 800)); return __EL.story.step; });
    check(saved === 'yard', `the story taken on to the yard, which checkpoints (${saved})`);

    // Reload: Continue.
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("Continue")', { timeout: 30000 });
    await page.click('button:has-text("Continue")');
    const up = await Promise.race([
        page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 }).then(() => 'ready'),
        page.waitForFunction(() => document.getElementById('boot-error')?.textContent, null, { timeout: 90000 }).then(() => 'error'),
    ]).catch(() => 'timeout');
    const back = up === 'ready' ? await ev(() => ({ mode: __EL.mode, step: __EL.story?.step })) : null;
    check(up === 'ready' && back?.mode === 'verdant' && back?.step === 'yard', `Continue resumes in the Reach at the yard, without a boot error (${up} ${JSON.stringify(back)} ${await bootError()})`);

    // Dying there comes back to the same checkpoint.
    if (up === 'ready') {
        await ev(() => __EL.restart());
        const again = await Promise.race([
            page.waitForFunction(() => window.__EL?.ready && window.__EL?.story?.step, null, { timeout: 90000 }).then(() => 'ready'),
            page.waitForFunction(() => document.getElementById('boot-error')?.textContent, null, { timeout: 90000 }).then(() => 'error'),
        ]).catch(() => 'timeout');
        const st = again === 'ready' ? await ev(() => __EL.story.step) : null;
        check(again === 'ready' && st === 'yard', `back to the checkpoint after dying, at the yard (${again} ${st} ${await bootError()})`);
    }

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('RESUME FAIL'); process.exit(1); }
    console.log('RESUME PASS');
})();
