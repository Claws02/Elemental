// ============================================================
// BENCH — a fixed run through Thornwick that measures the frame rate
// ============================================================
//
// index.html?bench plays the Verdant Reach, walks the hero along a fixed
// path through Thornwick's plaza, sets two cottages alight, watches them
// burn, then looks out over the river: the heavy moments the game must hold
// 60 fps through. It records every frame and shows a result card to copy:
//
//   fps      average, and the 1% low (the frame rate of the slowest 1%)
//   ms       a frame's time, split: update (game logic), physics, render
//            (the CPU's side of drawing; the GPU's side is what is left of
//            the frame interval)
//   draws    most draw calls and triangles; the resolution the adaptive
//            quality settled at, and its lowest
//
// The same result is window.__BENCH for the tests.
// ============================================================

const PATH = [         // [seconds, x, z, yaw]: the hero's walk (yaw 0 looks toward -z)
    [0, 22, 30, 0], [8, 18, 16, 0], [14, 14, 6, 0.6], [22, 10, 2, 1.2], [30, 6, 0, 1.6], [38, -4, 4, 1.6], [46, -12, 4, 1.57],
];
const BURN = { at: 12, ids: ['Thornwick_03_cottage', 'Thornwick_05_cottage'] };
const LENGTH = 46;     // seconds

export function runBench(E, { onDone } = {}) {
    const frames = [];
    let t = 0, lit = false, done = false;
    const peak = { calls: 0, tris: 0 }, ratios = [];
    const T = E.world.terrain;
    const at = s => {
        let i = 0;
        while (i < PATH.length - 2 && PATH[i + 1][0] <= s) i++;
        const [t0, x0, z0, y0] = PATH[i], [t1, x1, z1, y1] = PATH[i + 1];
        const k = Math.min(1, Math.max(0, (s - t0) / (t1 - t0)));
        return { x: x0 + (x1 - x0) * k, z: z0 + (z1 - z0) * k, yaw: y0 + (y1 - y0) * k };
    };
    E.perf.onFrame = f => {
        if (done) return;
        frames.push(f);
        t += Math.min(0.1, f.raw / 1000);
        const p = at(t), b = E.player.body;
        b.position.set(p.x, (T ? T.height(p.x, p.z) : 0) + 0.45, p.z);
        b.velocity.set(0, 0, 0);
        E.cam.yaw = p.yaw;
        if (!lit && t >= BURN.at) {
            lit = true;
            for (const id of BURN.ids) {
                const s = E.world.objects.get(id)?.structure;
                if (s) for (const q of s.pieces.filter(q => q.mat === 'thatch').slice(0, 3)) E.fire.ignite(s.things.get(q), 'environment', { direct: true });
            }
        }
        const ri = E.renderInfo();
        peak.calls = Math.max(peak.calls, ri.calls); peak.tris = Math.max(peak.tris, ri.triangles);
        ratios.push(ri.pixelRatio);
        if (t >= LENGTH) finish();
    };
    function finish() {
        done = true;
        E.perf.onFrame = null;
        const raw = frames.slice(30).map(f => f.raw).sort((a, b) => a - b);     // the first half second is loading
        const avg = raw.reduce((a, b) => a + b, 0) / raw.length;
        const p99 = raw[Math.floor(raw.length * 0.99)] || avg;
        const mean = k => +(frames.slice(30).reduce((a, f) => a + f[k], 0) / Math.max(1, frames.length - 30)).toFixed(2);
        const r = {
            fps: +(1000 / avg).toFixed(1), low1: +(1000 / p99).toFixed(1), frames: frames.length,
            ms: { frame: +avg.toFixed(2), update: mean('update'), physics: mean('physics'), render: mean('render') },
            calls: peak.calls, tris: peak.tris, ratio: { end: ratios.at(-1), min: Math.min(...ratios) }, level: E.renderInfo().level ?? 0,
            device: navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 120), screen: `${innerWidth}×${innerHeight} @${devicePixelRatio}`,
        };
        window.__BENCH = r;
        card(r);
        onDone?.(r);
    }
}

function card(r) {
    const el = document.createElement('div');
    el.id = 'bench-card';
    Object.assign(el.style, { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(14,12,10,.92)', color: '#f0e8d8', font: '13px/1.45 ui-monospace, Menlo, monospace', padding: '16px 18px', borderRadius: '12px', zIndex: 50, maxWidth: '92vw', whiteSpace: 'pre-wrap' });
    const text = `ELEMENTAL bench
${r.fps} fps average · ${r.low1} fps 1% low · ${r.frames} frames
frame ${r.ms.frame} ms = update ${r.ms.update} + physics ${r.ms.physics} + render ${r.ms.render} (+ GPU and waiting)
peak ${r.calls} draw calls · ${(r.tris / 1000).toFixed(0)}k triangles
resolution ${r.ratio.end}× (lowest ${r.ratio.min}×) · quality level ${r.level}
${r.screen} · ${r.device}`;
    const pre = document.createElement('div');
    pre.textContent = text;
    const btn = document.createElement('button');
    btn.textContent = 'Copy';
    Object.assign(btn.style, { marginTop: '10px', padding: '8px 16px', borderRadius: '8px', border: '0', background: '#e8c060', color: '#201a10', font: 'bold 14px system-ui' });
    btn.onclick = () => { navigator.clipboard?.writeText(text).then(() => { btn.textContent = 'Copied'; }, () => { btn.textContent = 'Select the text to copy'; }); };
    el.append(pre, btn);
    document.body.append(el);
}
