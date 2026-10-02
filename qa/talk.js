// ============================================================
// TALK — tap anyone and they talk to you (story/Talk.js, data/talk.js)
//
//   1. a Thornwick villager: a tap stops them, they turn to you and say a
//      line under a name; the next tap, the next line
//   2. what they say follows how the kingdom sees you
//   3. their house: burned by you, saved by you, both — they remember, and
//      it's kept in the save
//   4. a named character (the Lord-Warden) has their own lines
//   5. Veyra: Wynn before the festival; nobody talks over the story
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/talk.js
// ============================================================
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:8140/index.html').replace(/\?.*$/, '');

(async () => {
    const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
    const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 900, height: 560 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const pass = [], fail = [];
    const check = (ok, msg) => { (ok ? pass : fail).push(msg); if (process.env.QA_LOUD) console.log((ok ? '  ok   ' : '  FAIL ') + msg); };
    const ev = (fn, a) => page.evaluate(fn, a);

    const open = async scene => {
        await page.goto(`${BASE}?scene=${scene}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
        await page.waitForTimeout(1200);
        await ev(() => {
            window.__W = ms => new Promise(r => setTimeout(r, ms));
            const el = document.getElementById('game');
            window.__touch = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
            // Stand 3 m in front of `id`, the camera looking at them, and tap them. What's said, and by whom.
            window.__talk = async (id, { wait = 700, place = true } = {}) => {
                const n = __EL.world.objects.get(id).npc, b = __EL.player.body, T = __EL.world.terrain;
                if (place) {
                    const p = n.position, x = p.x, z = p.z + 3;
                    b.position.set(x, (T ? T.height(x, z) : 0) + 0.5, z); b.velocity.set(0, 0, 0);
                    __EL.cam.yaw = 0;
                    await __W(900);
                }
                __EL.hud.say(null);
                const q = n.position.clone().setY(n.position.y + 1.3).project(__EL.cam.cam), x = (q.x + 1) / 2 * innerWidth, y = (1 - q.y) / 2 * innerHeight;
                __touch('pointerdown', x, y); await __W(60); __touch('pointerup', x, y);
                await __W(wait);
                const s = document.getElementById('hud-say');
                return { who: s.classList.contains('on') ? s.querySelector('.who').textContent : null, line: s.querySelector('.line').textContent, held: +(n.held || 0).toFixed(1) };
            };
            // Let what's being said run out.
            window.__hush = async () => { for (let i = 0; i < 100 && __EL.talk.busy; i++) { __EL.hud.skipLine = true; await __W(80); } __EL.hud.say(null); };
        });
    };

    // ---- 1–4. Thornwick ------------------------------------------------------------------------------------------
    await open('verdant');
    await ev(() => localStorage.clear());
    const first = await ev(() => __talk('Thornwick_Folk_4'));
    await ev(() => __hush());
    const second = await ev(() => __talk('Thornwick_Folk_4', { place: false }));
    check(first.who === 'Reach villager' && first.line && first.held > 0 && second.line && second.line !== first.line,
        `tap a Thornwick villager: they stop and say a line under a name; the next tap, the next line (${JSON.stringify({ first, second })})`);

    const feared = await ev(async () => {
        await __hush();
        __EL.ledger.add('harm', 20);
        const r = await __talk('Thornwick_Folk_5');
        await __hush();
        __EL.ledger.add('care', 40);
        const g = await __talk('Thornwick_Folk_6');
        return { low: r.line, high: g.line, standing: __EL.ledger.standing() };
    });
    check(feared.low && feared.high && feared.low !== feared.high, `what they say follows how the Reach sees you: feared, then thanked (${JSON.stringify(feared)})`);

    const home = await ev(async () => {
        await __hush();
        const n = __EL.world.objects.get('Thornwick_Folk_3').npc, h = __EL.talk.homeOf(n);
        // Their house: saved by you (a fire on it put out), then burned by you.
        const piece = [...__EL.world.objects.keys()].find(k => k.startsWith(h + '_')) || h + '_x';
        __EL.EventBus.emit('FireOut', { id: piece, cause: 'player', doused: true });
        const saved = await __talk('Thornwick_Folk_3');
        await __hush();
        __EL.EventBus.emit('StructureStateChanged', { id: h, from: 'Damaged', to: 'Burned', cause: 'player' });
        const both = await __talk('Thornwick_Folk_3', { place: false });
        return { home: h, saved: saved.line, both: both.line, kept: __EL.session.state(h + '@by') };
    });
    check(home.home && /haven|standing|supper|roof/i.test(home.saved) && /put out the fire/i.test(home.both) && home.kept === 'you',
        `their house remembered: saved by you, then burned by you, and kept in the save (${JSON.stringify(home)})`);

    const maren = await ev(async () => { await __hush(); return __talk('Maren'); });
    check(maren.who === 'Lord-Warden Aldric Maren' && maren.line.length > 10, `the Lord-Warden has lines of their own (${JSON.stringify(maren)})`);

    // ---- 5. Veyra, festival morning --------------------------------------------------------------------------------
    await open('veyra');
    await ev(() => localStorage.clear());
    await open('veyra');
    const bram = await ev(async () => {
        await __W(1500);
        // Wynn, at the stone (the forge's zone would start Bram's own scene in the story).
        const r = await __talk('Wynn');
        await __hush();
        // While the story speaks, a tap on someone does nothing.
        __EL.story.say(['@Wynn A line from the story.', '@Wynn And another, long enough to still be going when the tap lands.']);
        await __W(300);
        const t = await __talk('Mira', { wait: 300 });
        return { wynn: r, busy: { held: t.held, talking: __EL.talk.sayT > 0 || __EL.talk.queue.length > 0 } };
    });
    check(bram.wynn.who === 'Elder Wynn' && /stone|Lanterns/i.test(bram.wynn.line) && bram.busy.held === 0 && !bram.busy.talking,
        `Veyra: Wynn talks about the festival and the stone; while the story speaks, nobody talks over it (${JSON.stringify(bram)})`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('TALK FAIL'); process.exit(1); }
    console.log('TALK PASS');
})();
