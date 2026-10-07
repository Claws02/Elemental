// ============================================================
// CISTERN — Act II's road south: Bram, and Lesson II (Water) (scenes/cistern.json)
//
//   1. Bram has caught up at the border; your answer remembered; Veyra's news
//   2. Cael leads south to the Sunken Cistern, Bram follows
//   3. a travellers' cart catches: Water answers now (trained, charm or no);
//      a stream drawn from the pool and aimed puts it out, and it's care
//   4. a stream held on the sluice wheel turns it and raises the gate
//   5. on south, through the throat: the lesson told (lesson2)
//
// usage: QA_BASE=http://127.0.0.1:8140/index.html node qa/cistern.js
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
    // Act I told, the charm worn (Water wild and stilled), arriving from the Reach.
    await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE}?scene=gate`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EL?.ready, null, { timeout: 90000 });
    await page.evaluate(() => { const f = __EL.prog.flags; Object.assign(f, { lesson1: { outcome: 'quiet' }, prologue: 'done', 'act1.mill': 'done', 'act1.yard': 'done', 'act1.ruin': 'done', charm: 'worn', 'veyra.fire': 'some' }); __EL.prog.setState('earth', 'trained'); __EL.prog.setState('water', 'wild'); __EL.prog._save(); __EL.travel('cistern', 'from_verdant'); });
    await page.waitForFunction(() => window.__EL?.mode === 'cistern' && window.__EL?.ready, null, { timeout: 90000 });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(async () => {
  const W = ms => new Promise(r => setTimeout(r, ms)), E = __EL, out = {};
  const skip = async until => { for (let i = 0; i < 200 && !until(); i++) { E.hud.skipLine = true; await W(120); } };
  const at = (x, z) => { const B = E.player.body, T = E.world.terrain; B.position.set(x, T.height(x, z) + 0.6, z); B.velocity.set(0, 0, 0); };
  const scr = v => { const q = v.clone().project(E.cam.cam); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight }; };
  out.start = { step: E.story?.step, bram: E.world.objects.has('Bram'), cael: E.world.objects.has('Cael'), canWater: E.prog.has('water') };
  await skip(() => E.story.choosing); E.story.choose(1);
  await skip(() => E.story.step === 'road'); out.road = { cael: E.world.objects.get('Cael').npc.role, bram: E.world.objects.get('Bram').npc.role };
  at(0, -12); await W(1500);
  out.smoke = { step: E.story.step, burning: [...E.fire.flammables.values()].filter(f => f.burning).length, canWater: E.prog.has('water'), water: E.prog.state('water') };
  // Draw a stream and play it on the fires.
  const pool = [...E.interactables.things].find(t => t.id === 'Cistern_Pool');
  // The stream rises where the finger touches the water, not at the near edge.
  at(0, -7);
  const lvl = E.water.sources.find(s => s.thing === pool).surface.y, far = new E.THREE.Vector3(1.5, lvl, 4.5);
  let seen = null;
  for (const yaw of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) { E.cam.yaw = yaw; await W(400); const q = far.clone().project(E.cam.cam); if (q.z < 1 && Math.abs(q.x) < 0.9 && Math.abs(q.y) < 0.9) { seen = scr(far); break; } }
  const near = E.water.sources.find(s => s.thing === pool).surfaceFor(E.player.position);
  out.press = seen ? (E.water.beginStream(pool, seen.x, seen.y), { from: +E.water.stream.source.surface.distanceTo(far).toFixed(2), nearEdge: +near.distanceTo(far).toFixed(2) }) : 'unseen';
  E.water.collapse();
  at(-8, -1); E.cam.yaw = Math.PI / 2 + 0.2; await W(800);
  const outs = []; E.EventBus.on('FireOut', e => outs.push((e.doused ? 'D:' : e.burnedOut ? 'B:' : 'O:') + e.id));
  out.began = E.water.beginStream(pool);
  for (let k = 0; k < 40 && E.story.step === 'smoke'; k++) {
    const f = [...E.fire.flammables.values()].filter(f => f.burning).sort((a, b) => a.thing.pos().distanceTo(E.player.position) - b.thing.pos().distanceTo(E.player.position))[0];
    if (!f) break;
    const s = scr(f.thing.pos()); E.water.aimStream(s.x, s.y); await W(500);
  }
  E.water.endStream?.();
  await skip(() => E.story.step === 'sluice');
  out.outs = outs; out.dist = [...E.fire.flammables.values()].filter(f => /Camp/.test(f.thing.id)).slice(0,3).map(f => +f.thing.pos().distanceTo(E.player.position).toFixed(1));
  out.camp = { flag: E.prog.flags['lesson2.camp'], care: E.ledger.get('care'), step: E.story.step };
  // The wheel.
  at(3.5, 9); E.cam.yaw = Math.PI - 0.6; await W(800);
  E.water.beginStream(pool);
  const w = E.world.objects.get('Sluice_Wheel').item;
  for (let k = 0; k < 24 && !E.world.signal('Sluice_Wheel', 'spun'); k++) { const s = scr(new E.THREE.Vector3(w.x, w.y, w.z)); E.water.aimStream(s.x, s.y); await W(500); }
  out.wheel = { spun: E.world.signal('Sluice_Wheel', 'spun'), turning: E.world.signal('Sluice_Wheel', 'turning') };
  E.water.endStream?.();
  await skip(() => E.story.step === 'onward'); await W(2000);
  out.gate = { open: E.world.signal('Sluice_Gate', 'open'), step: E.story.step, lesson2: E.prog.flags.lesson2 };
  at(0, 44); await W(1500);
  out.end = E.story.step;
  return out;
});

    check(r.start.step === 'bram' && r.start.bram && r.start.cael && !r.start.canWater, `arriving: Bram has caught up at the border; Water still stilled by the charm (${JSON.stringify(r.start)})`);
    check(r.press.from < 0.6 && r.press.nearEdge > 4, `pressed on the far side of the pool, the stream rises there, not at the edge nearest you (${JSON.stringify(r.press)})`);
    check(r.road.cael === 'lead' && r.road.bram === 'follow', `Cael leads south to the cistern, Bram follows (${JSON.stringify(r.road)})`);
    check(r.smoke.step === 'smoke' && r.smoke.burning >= 1 && r.smoke.canWater && r.smoke.water === 'trained', `at the cistern the cart catches; Water answers now, trained (${JSON.stringify(r.smoke)})`);
    check(r.began && r.outs.some(o => o.startsWith('D:Camp_')) && r.camp.flag === 'saved' && r.camp.care > 0, `a stream drawn from the pool and aimed puts the fire out: the camp saved, and it's care (${JSON.stringify({ outs: r.outs, camp: r.camp })})`);
    check(r.wheel.spun && r.gate.open, `a stream held on the wheel turns it, and the sluice gate rises (${JSON.stringify({ wheel: r.wheel, gate: r.gate })})`);
    check(r.gate.lesson2 === 'done' && r.end === 'done', `on south through the throat: Lesson II told (${JSON.stringify({ gate: r.gate, end: r.end })})`);
    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
    console.log(pass.map(p => '  ok   ' + p).join('\n'));
    if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('CISTERN FAIL'); process.exit(1); }
    console.log('CISTERN PASS');
})();
