// ============================================================
// RENDERER — scene, light, sky and the quality tier
// ============================================================
//
// One directional sun with a tight shadow frustum that follows the hero, a
// hemisphere fill, and fog that doubles as atmosphere and as a draw-distance
// limit. Quality is chosen once at boot from the device (pixel ratio and
// shadow size); adaptive quality comes later, after profiling on phones.
// ============================================================

let renderer, scene, camera, sun, sunTarget;
export const quality = { tier: 'high', pixelRatio: 1, shadowSize: 1024 };

export function init(canvas) {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 1100);
    quality.tier = mobile ? 'mobile' : 'high';
    quality.pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 2);
    quality.shadowSize = mobile ? 1024 : 2048;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    scene = new THREE.Scene();
    const SKY_LOW = 0xd9c7a8, SKY_HIGH = 0x6f8fb0;
    scene.background = _skyTexture(SKY_HIGH, SKY_LOW);
    scene.fog = new THREE.Fog(new THREE.Color(SKY_LOW).convertSRGBToLinear(), 28, 95);

    camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);

    scene.add(new THREE.HemisphereLight(_lin(0xcfe0ff), _lin(0x5a4a38), 0.75));
    sun = new THREE.DirectionalLight(_lin(0xffe2b8), 1.9);
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

const _lin = hex => new THREE.Color(hex).convertSRGBToLinear();

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
    t.encoding = THREE.sRGBEncoding;
    return t;
}

export function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
}

/** Keep the sun's shadow box centred on what matters. */
export function followSun(p) {
    sun.position.set(p.x + 14, p.y + 26, p.z + 10);
    sunTarget.position.copy(p);
}

export function render() { renderer.render(scene, camera); }
export function info() { return renderer.info.render; }
export function get() { return { renderer, scene, camera }; }
