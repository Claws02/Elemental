// ============================================================
// RENDERER — scene, light, sky and the quality tier
// ============================================================
//
// One directional sun with a tight shadow frustum that follows the hero, a
// hemisphere fill, and fog that doubles as atmosphere and as a draw-distance
// limit. Quality is chosen once at boot from the device (pixel ratio and
// shadow size); adaptive quality comes later, after profiling on phones.
// ============================================================

import { THREE } from './lib.js';

let renderer, scene, camera, sun, sunTarget, hemi;
let mood = null;              // { from, to, t, dur } while a change of light is under way
export const quality = { tier: 'high', pixelRatio: 1, shadowSize: 1024 };

export function init(canvas) {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 1100);
    quality.tier = mobile ? 'mobile' : 'high';
    quality.pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 2);
    quality.shadowSize = mobile ? 1024 : 2048;

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
    scene.fog.near = a.fogNear + (b.fogNear - a.fogNear) * k;
    scene.fog.far = a.fogFar + (b.fogFar - a.fogFar) * k;
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
export function info() { return renderer.info.render; }
export function get() { return { renderer, scene, camera }; }
