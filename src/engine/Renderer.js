// ============================================================
// RENDERER — scene, light, sky and the quality tier
// ============================================================
//
// One directional sun with a tight shadow frustum that follows the hero, a
// hemisphere fill, and fog that doubles as atmosphere and as a draw-distance
// limit. Quality is chosen at boot from the device (pixel ratio and shadow
// size), then the resolution ADAPTS (adapt()): when frames run long (a big
// fire, a crowded town) it renders fewer pixels, a step at a time, and goes
// back up when things are calm. Sharpness is what a busy moment can spare.
// ============================================================

import { THREE } from './lib.js';

let renderer, scene, camera, sun, sunTarget, hemi;
let mood = null;              // { from, to, t, dur } while a change of light is under way
export const quality = { tier: 'high', pixelRatio: 1, shadowSize: 1024, maxRatio: 1, minRatio: 1, adaptive: true };
// Adaptive resolution: frame time held over SLOW for `down` s → a step down; under FAST for `up` s → a step back up.
export const ADAPT = { slow: 1 / 34, fast: 1 / 52, down: 0.6, up: 3, stepDown: 0.15, stepUp: 0.1 };
const _adapt = { ema: 1 / 60, over: 0, under: 0 };

export function init(canvas) {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 1100);
    quality.tier = mobile ? 'mobile' : 'high';
    quality.pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 2);
    quality.shadowSize = mobile ? 1024 : 2048;
    quality.maxRatio = quality.pixelRatio;
    quality.minRatio = Math.max(0.6, quality.maxRatio * 0.5);
    Object.assign(_adapt, { ema: 1 / 60, over: 0, under: 0 });

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;    // r180+ removed PCFSoft; PCF is now the soft one
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    scene = new THREE.Scene();
    const m = MOODS.day;
    scene.background = _skyTexture(m.skyHigh, m.skyLow);
    scene.fog = new THREE.Fog(m.skyLow, m.fogNear, m.fogFar);

    camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);

    // Physically based light units (r155+): the r128 intensities times π.
    hemi = new THREE.HemisphereLight(0xcfe0ff, 0x5a4a38, 0.75 * Math.PI);
    scene.add(hemi);
    mood = null;
    setMood.current = 'day';
    view.k = 1;
    sun = new THREE.DirectionalLight(0xffe2b8, 1.9 * Math.PI);
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    const S = 18;
    Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 80 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    sunTarget = new THREE.Object3D();
    scene.add(sun, sunTarget);
    sun.target = sunTarget;

    addEventListener('resize', resize);
    return { renderer, scene, camera };
}

// A vertical gradient: warm haze at the horizon, cool sky above.
function _skyTexture(top, bottom) {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#' + new THREE.Color(top).getHexString());
    grad.addColorStop(0.62, '#' + new THREE.Color(bottom).getHexString());
    grad.addColorStop(1, '#' + new THREE.Color(bottom).getHexString());
    g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
}

// ---- the time of day ---------------------------------------------------------------
//
// A scene sets its light (settings.mood), and the story can change it
// (the prologue's morning turning to dusk, then night after the fire).

export const MOODS = {
    day:   { skyHigh: 0x6f8fb0, skyLow: 0xd9c7a8, fogNear: 28, fogFar: 95, sun: 0xffe2b8, sunI: 1.9, hemiSky: 0xcfe0ff, hemiGround: 0x5a4a38, hemiI: 0.75, exposure: 1.05 },
    dusk:  { skyHigh: 0x4a4a78, skyLow: 0xe0905a, fogNear: 24, fogFar: 80, sun: 0xff9a5a, sunI: 1.25, hemiSky: 0x8a86b8, hemiGround: 0x4a3428, hemiI: 0.6, exposure: 1.0 },
    // Each kingdom's own light (the region scenes open in these).
    ember: { skyHigh: 0x7a5a58, skyLow: 0xe0a070, fogNear: 30, fogFar: 100, sun: 0xffc890, sunI: 2.0, hemiSky: 0xe0c0a8, hemiGround: 0x6a4a3a, hemiI: 0.9, exposure: 1.15 },
    sea:   { skyHigh: 0x6f98b8, skyLow: 0xd8e2e4, fogNear: 30, fogFar: 105, sun: 0xfff0d8, sunI: 1.8, hemiSky: 0xd8ecff, hemiGround: 0x6a7a7a, hemiI: 0.85, exposure: 1.05 },
    peaks: { skyHigh: 0x5f88c0, skyLow: 0xe4ecf2, fogNear: 34, fogFar: 115, sun: 0xfff6e8, sunI: 2.1, hemiSky: 0xe0eeff, hemiGround: 0x7a8088, hemiI: 0.85, exposure: 1.0 },
    glare: { skyHigh: 0x7aa8d0, skyLow: 0xf0e0c4, fogNear: 34, fogFar: 115, sun: 0xfff2d8, sunI: 2.3, hemiSky: 0xf4ecdc, hemiGround: 0x9a8a70, hemiI: 0.9, exposure: 0.98 },
    night: { skyHigh: 0x0e1426, skyLow: 0x2a2c44, fogNear: 18, fogFar: 64, sun: 0x8aa0d0, sunI: 0.35, hemiSky: 0x4a5a88, hemiGround: 0x1c1814, hemiI: 0.42, exposure: 1.1 },
};

const _c = new THREE.Color(), _c2 = new THREE.Color();
function _applyMood(a, b, k) {
    const mix = (x, y) => _c.setHex(x).lerp(_c2.setHex(y), k);
    sun.color.copy(mix(a.sun, b.sun));
    sun.intensity = (a.sunI + (b.sunI - a.sunI) * k) * Math.PI;
    hemi.color.copy(mix(a.hemiSky, b.hemiSky));
    hemi.groundColor.copy(mix(a.hemiGround, b.hemiGround));
    hemi.intensity = (a.hemiI + (b.hemiI - a.hemiI) * k) * Math.PI;
    scene.fog.color.copy(mix(a.skyLow, b.skyLow));
    scene.fog.near = (a.fogNear + (b.fogNear - a.fogNear) * k) * view.k;
    scene.fog.far = (a.fogFar + (b.fogFar - a.fogFar) * k) * view.k;
    renderer.toneMappingExposure = a.exposure + (b.exposure - a.exposure) * k;
    // The sky texture is rebuilt at the ends and every quarter of the way, not every frame.
    const q = Math.round(k * 4);
    if (q !== _applyMood.q || k === 1) {
        _applyMood.q = q;
        const hi = _c.setHex(a.skyHigh).lerp(_c2.setHex(b.skyHigh), q / 4).getHex();
        const lo = _c.setHex(a.skyLow).lerp(_c2.setHex(b.skyLow), q / 4).getHex();
        scene.background?.dispose?.();
        scene.background = _skyTexture(hi, lo);
    }
}

// How far the scene can be seen: the moods' fog is for a courtyard; a region on terrain sees further.
const view = { k: 1 };
/** Set how far the world is visible (metres to the far fog at day; 95 is the courtyard). */
export function setView(far = 95) {
    view.k = Math.max(0.5, far / MOODS.day.fogFar);
    camera.far = Math.max(200, far * 1.6);
    camera.updateProjectionMatrix();
    _applyMood.q = -1;
    const m = MOODS[setMood.current] || MOODS.day;
    _applyMood(m, m, 1);
}

/** Change the light to `name` over `dur` seconds (0: at once). */
export function setMood(name, dur = 0) {
    const to = MOODS[name] || MOODS.day;
    const from = mood?.to || MOODS[setMood.current] || MOODS.day;
    setMood.current = name;
    if (!dur) { _applyMood.q = -1; _applyMood(to, to, 1); mood = null; return; }
    mood = { from, to, t: 0, dur };
}

export function updateMood(dt) {
    if (!mood) return;
    mood.t = Math.min(mood.dur, mood.t + dt);
    _applyMood(mood.from, mood.to, mood.t / mood.dur);
    if (mood.t >= mood.dur) mood = null;
}

/** Keep the sun's shadow box centred on what matters. */
export function followSun(p) {
    sun.position.set(p.x + 14, p.y + 26, p.z + 10);
    sunTarget.position.copy(p);
}

/** Let the GPU go (the editor's Play mode starts and stops the game). */
export function dispose() {
    removeEventListener('resize', resize);
    scene?.traverse(o => { o.geometry?.dispose(); });
    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer = scene = camera = null;
}

export function render() { renderer.render(scene, camera); }

/** Hold the frame rate by trading sharpness: call once a frame with the real (unclamped) frame time. */
export function adapt(frameSecs) {
    if (!quality.adaptive || !renderer) return;
    const a = _adapt, t = Math.min(0.5, Math.max(0, frameSecs));
    a.ema += (t - a.ema) * 0.1;
    a.over = a.ema > ADAPT.slow ? a.over + t : 0;
    a.under = a.ema < ADAPT.fast ? a.under + t : 0;
    let r = quality.pixelRatio;
    if (a.over > ADAPT.down && r > quality.minRatio) { r = Math.max(quality.minRatio, r - ADAPT.stepDown); a.over = 0; }
    else if (a.under > ADAPT.up && r < quality.maxRatio) { r = Math.min(quality.maxRatio, r + ADAPT.stepUp); a.under = 0; }
    if (r !== quality.pixelRatio) { quality.pixelRatio = +r.toFixed(2); renderer.setPixelRatio(quality.pixelRatio); renderer.setSize(innerWidth, innerHeight); }
}
export function info() { return renderer.info.render; }
export function get() { return { renderer, scene, camera }; }
