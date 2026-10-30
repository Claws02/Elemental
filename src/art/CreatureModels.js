// ============================================================
// CREATURE MODELS — Aerath's wildlife, built in code (placeholders until Phase 6)
// ============================================================
//
// Each builder returns { root, parts } where the parts are the joints the
// animator moves: legs swing, wings beat, the head turns. Each part is one Kit
// (a few draw calls per creature). Every creature faces +Z.
// ============================================================

import { THREE } from '../engine/lib.js';
import { Kit, at } from '../engine/Kit.js';

const part = (fn, own = false) => { const k = new Kit(); fn(k); return k.build({ own }); };
const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

export function emberwing(look) {
    const root = new THREE.Group();
    const body = part(k => {
        k.geo('body', new THREE.IcosahedronGeometry(0.24, 0), at(0, 0, 0, 0, 0, 0, 0.8, 0.75, 1.35), look.body, { flat: true });
        k.geo('body', new THREE.IcosahedronGeometry(0.14, 0), at(0, 0.07, 0.3), look.body, { flat: true });
        k.cyl('body', 0, 0.05, 0.16, 4, at(0, 0.04, 0.46, Math.PI / 2, 0, 0), 0x2a1a10, { flat: true });        // a hooked beak
        k.cyl('body', 0, 0.04, 0.14, 4, at(0, 0.17, 0.24, -0.6, 0, 0), look.wing, { flat: true });              // a crest
        k.box('glow', 0.03, 0.03, 0.02, at(0.07, 0.11, 0.37), 0xffd07a);
        k.box('glow', 0.03, 0.03, 0.02, at(-0.07, 0.11, 0.37), 0xffd07a);
        // An ember tail: three long plumes, fanned, burning at the tips.
        for (let i = 0; i < 3; i++) {
            const a = (i - 1) * 0.3;
            k.box('body', 0.07, 0.02, 0.34, at(Math.sin(a) * 0.16, -0.02, -0.38, 0.15, a, 0), look.wing);
            k.box('glow', 0.06, 0.02, 0.12, at(Math.sin(a) * 0.3, -0.05, -0.6, 0.15, a, 0), look.glow);
        }
    }, true);
    root.add(body);
    // Wings: a broad inner arm, a swept outer hand and three primaries fanned at the tip; the trailing edge smoulders.
    const wings = [-1, 1].map(s => {
        const j = joint(root, s * 0.15, 0.05, 0);
        j.add(part(k => {
            k.box('body', 0.34, 0.03, 0.32, at(s * 0.17, 0, 0.02), look.wing);
            k.box('body', 0.32, 0.03, 0.22, at(s * 0.48, 0, -0.04, 0, s * 0.25, 0), look.wing);
            for (let i = 0; i < 3; i++) {
                const a = s * (0.25 + i * 0.28);
                k.box('body', 0.3, 0.02, 0.06, at(s * 0.72 + Math.cos(a) * 0.08, 0, -0.12 - i * 0.07, 0, a, 0), look.wing);
                k.box('glow', 0.1, 0.022, 0.05, at(s * 0.86 + Math.cos(a) * 0.1, 0.002, -0.16 - i * 0.09, 0, a, 0), look.glow);
            }
            k.box('glow', 0.5, 0.022, 0.03, at(s * 0.4, 0.002, -0.17, 0, s * 0.12, 0), look.glow);
        }));
        return j;
    });
    return { root, parts: { body, wings }, ownMaterials: body.userData.ownMaterials };
}

export function bristleback(look) {
    const root = new THREE.Group();
    const body = part(k => {
        // A charger: the weight up front, a shoulder hump over the forelegs, the back falling away to the hips.
        k.box('body', 0.88, 0.72, 1.3, at(0, 0.86, -0.05, 0.08, 0, 0), look.body, { ch: 0.2 });
        k.box('body', 0.98, 0.62, 0.66, at(0, 1.08, 0.36), look.body, { ch: 0.22 });                   // shoulder hump
        k.box('body', 0.78, 0.55, 0.5, at(0, 0.86, -0.64), look.body, { ch: 0.16 });                   // hips
        // The bristles: a crest of spikes raked back, tallest over the shoulders.
        for (let i = 0; i < 9; i++) {
            const t = i / 8, z = 0.62 - t * 1.3, y = 1.44 - t * 0.36 - t * t * 0.1;
            k.cyl('body', 0, 0.07 - t * 0.02, 0.42 - t * 0.18, 4, at(0, y, z, -0.55, 0, 0), look.bristle, { flat: true });
            if (i % 2 === 0) for (const s of [-1, 1]) k.cyl('body', 0, 0.05, 0.26 - t * 0.1, 4, at(s * 0.18, y - 0.1, z, -0.55, 0, s * 0.35), look.bristle, { flat: true });
        }
        // The head, low and wedge-shaped: brow, long snout, a flat dark nose.
        k.box('body', 0.6, 0.5, 0.5, at(0, 0.86, 0.86, 0.3, 0, 0), look.body, { ch: 0.14 });
        k.box('body', 0.36, 0.28, 0.42, at(0, 0.66, 1.18, 0.2, 0, 0), look.body, { ch: 0.08 });
        k.box('body', 0.32, 0.22, 0.05, at(0, 0.6, 1.4, 0.2, 0, 0), 0x2a1c16, { ch: 0.03 });
        for (const s of [-1, 1]) {
            k.cyl('body', 0, 0.07, 0.2, 4, at(s * 0.22, 1.12, 0.78, -0.3, 0, s * 0.5), look.bristle, { flat: true });   // ears
            // Tusks: out from the jaw, then up.
            k.cyl('body', 0.035, 0.055, 0.22, 5, at(s * 0.19, 0.56, 1.28, -1.25, 0, s * 0.35), look.tusk, { flat: true });
            k.cyl('body', 0.01, 0.035, 0.2, 5, at(s * 0.27, 0.7, 1.38, -0.35, 0, s * 0.5), look.tusk, { flat: true });
            k.box('glow', 0.06, 0.05, 0.02, at(s * 0.2, 0.98, 1.06), 0xffb070);
        }
        k.box('body', 0.06, 0.06, 0.32, at(0, 0.98, -0.95, 0.9, 0, 0), look.bristle);                   // tail
    }, true);
    root.add(body);
    // Forelegs heavier than hind; each tapers to a dark hoof.
    const legs = [[-0.32, 0.45, 0.13], [0.32, 0.45, 0.13], [-0.3, -0.58, 0.11], [0.3, -0.58, 0.11]].map(([x, z, r]) => {
        const j = joint(root, x, 0.62, z);
        j.add(part(k => {
            k.cyl('body', r * 0.75, r, 0.5, 6, at(0, -0.25, 0), look.bristle, { flat: true });
            k.box('body', r * 1.6, 0.1, r * 1.8, at(0, -0.56, 0.02), 0x2a1c16, { ch: 0.02 });
        }));
        return j;
    });
    return { root, parts: { body, legs }, ownMaterials: body.userData.ownMaterials };
}

export function thornhound(look) {
    const root = new THREE.Group();
    const body = part(k => {
        k.box('body', 0.5, 0.45, 1.1, at(0, 0.72, 0), look.body, { ch: 0.12 });
        k.box('body', 0.38, 0.36, 0.46, at(0, 0.9, 0.66, -0.2, 0, 0), look.body, { ch: 0.1 });       // head
        k.box('body', 0.22, 0.18, 0.3, at(0, 0.82, 0.96), look.thorn, { ch: 0.05 });                // muzzle
        for (let i = 0; i < 6; i++) k.cyl('body', 0, 0.06, 0.26, 4, at((i % 2 ? 0.12 : -0.12), 1.0, -0.4 + i * 0.16, -0.4, 0, 0), look.thorn, { flat: true });
        k.box('body', 0.1, 0.1, 0.5, at(0, 0.82, -0.72, 0.5, 0, 0), look.thorn);                   // tail
        for (const s of [-1, 1]) {
            k.box('glow', 0.05, 0.04, 0.02, at(s * 0.1, 0.98, 0.9), look.eye);
            k.cyl('body', 0, 0.06, 0.2, 4, at(s * 0.12, 1.14, 0.58), look.thorn, { flat: true });   // ears
        }
    }, true);
    root.add(body);
    const legs = [[-0.18, 0.35], [0.18, 0.35], [-0.18, -0.35], [0.18, -0.35]].map(([x, z]) => {
        const j = joint(root, x, 0.52, z);
        j.add(part(k => k.box('body', 0.12, 0.52, 0.14, at(0, -0.26, 0), look.thorn, { ch: 0.03 })));
        return j;
    });
    return { root, parts: { body, legs }, ownMaterials: body.userData.ownMaterials };
}

// ---- the rest of the bestiary (phase 5) ----------------------------------------------------------------------
const legs4 = (root, look, col, pts, len, w) => pts.map(([x, z]) => {
    const j = joint(root, x, len, z);
    j.add(part(k => k.box('body', w, len, w * 1.1, at(0, -len / 2, 0), col, { ch: w * 0.2 })));
    return j;
});

export function shellback(look) {
    const root = new THREE.Group();
    const body = part(k => {
        // A domed shell of plates, a heavy beaked head.
        k.geo('body', new THREE.SphereGeometry(0.95, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), at(0, 0.55, 0, 0, 0, 0, 1, 0.75, 1.2), look.shell, { flat: true });
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.box('body', 0.4, 0.12, 0.4, at(Math.cos(a) * 0.5, 1.15, Math.sin(a) * 0.6, 0.3 * Math.sin(a), a, 0.3 * Math.cos(a)), look.plate, { ch: 0.05 }); }
        k.box('body', 0.45, 0.6, 0.15, at(0, 1.3, 0), look.plate, { ch: 0.05 });
        k.box('body', 1.9, 0.18, 2.3, at(0, 0.5, 0), look.plate);                 // the shell's rim
        k.box('body', 0.42, 0.36, 0.5, at(0, 0.55, 1.35), look.skin, { ch: 0.1 });
        k.box('body', 0.2, 0.12, 0.2, at(0, 0.48, 1.65, 0.3, 0, 0), 0x3a3a2a);    // beak
        for (const s of [-1, 1]) k.box('glow', 0.05, 0.05, 0.02, at(s * 0.14, 0.66, 1.6), look.eye);
    }, true);
    root.add(body);
    const legs = legs4(root, look, look.skin, [[-0.75, 0.75], [0.75, 0.75], [-0.75, -0.75], [0.75, -0.75]], 0.45, 0.3);
    return { root, parts: { body, legs }, ownMaterials: body.userData.ownMaterials };
}

export function cindermite(look) {
    const root = new THREE.Group();
    const body = part(k => {
        k.geo('body', new THREE.IcosahedronGeometry(0.2, 0), at(0, 0.2, 0, 0, 0, 0, 1, 0.6, 1.4), look.body, { flat: true });
        for (let i = 0; i < 4; i++) k.box('glow', 0.08, 0.03, 0.08, at(0, 0.3, -0.15 + i * 0.1, 0, i, 0), look.glow);     // glowing back plates
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) k.box('body', 0.18, 0.03, 0.03, at(s * 0.18, 0.12, -0.1 + i * 0.1, 0, 0, s * 0.5), look.body);
        k.box('glow', 0.12, 0.04, 0.04, at(0, 0.2, 0.28), look.glow);           // its mouth
    }, true);
    root.add(body);
    return { root, parts: { body }, ownMaterials: body.userData.ownMaterials };
}

export function mudling(look) {
    const root = new THREE.Group();
    const body = part(k => {
        // A walking heap of silt: lumps on lumps, two dim eyes.
        k.geo('body', new THREE.IcosahedronGeometry(0.6, 0), at(0, 0.75, 0, 0, 0, 0, 1, 1.15, 0.9), look.body, { flat: true });
        k.geo('body', new THREE.IcosahedronGeometry(0.4, 0), at(0, 1.45, 0.1), look.body, { flat: true });
        for (let i = 0; i < 5; i++) k.geo('body', new THREE.IcosahedronGeometry(0.18, 0), at(Math.cos(i * 1.3) * 0.5, 0.6 + i * 0.15, Math.sin(i * 1.3) * 0.45), look.dark, { flat: true });
        for (const s of [-1, 1]) k.box('glow', 0.08, 0.05, 0.02, at(s * 0.14, 1.5, 0.45), look.eye);
    }, true);
    root.add(body);
    const legs = [-1, 1].map(s => {
        const j = joint(root, s * 0.65, 1.1, 0.1);
        j.add(part(k => k.geo('body', new THREE.IcosahedronGeometry(0.22, 0), at(0, -0.4, 0.1, 0, 0, 0, 1, 2.2, 1), look.dark, { flat: true })));
        return j;
    });
    return { root, parts: { body, legs }, ownMaterials: body.userData.ownMaterials };
}

export function brinecoil(look) {
    const root = new THREE.Group();
    const body = part(k => {
        for (let i = 0; i < 5; i++) k.cyl('body', 0.22 - i * 0.02, 0.24 - i * 0.02, 0.5, 7, at(Math.sin(i * 0.9) * 0.15, 0, 0.6 - i * 0.45, Math.PI / 2, 0, 0), i % 2 ? look.belly : look.body, { flat: true });
        k.box('body', 0.36, 0.26, 0.42, at(0, 0.02, 0.95), look.body, { ch: 0.08 });
        for (const s of [-1, 1]) k.box('glow', 0.05, 0.05, 0.02, at(s * 0.12, 0.1, 1.15), look.glow);
        for (let i = 0; i < 6; i++) k.box('glow', 0.04, 0.12, 0.04, at(0, 0.24, 0.8 - i * 0.35), look.glow);     // the charge along its spine
    }, true);
    root.add(body);
    const tail = joint(root, 0, 0, -1.5);
    tail.add(part(k => k.box('body', 0.05, 0.3, 0.7, at(0, 0, -0.35), look.body)));
    return { root, parts: { body, tail }, ownMaterials: body.userData.ownMaterials };
}

export function galekite(look) {
    const root = new THREE.Group();
    const body = part(k => {
        // A ray with a long tail: flat, wide, made for the wind.
        k.geo('body', new THREE.IcosahedronGeometry(0.4, 0), at(0, 0, 0, 0, 0, 0, 1.2, 0.35, 1.4), look.body, { flat: true });
        k.box('body', 0.05, 0.05, 1.4, at(0, 0, -1.2), look.body);
        k.box('body', 0.3, 0.02, 0.2, at(0, 0, -1.85), look.wing);
        for (const s of [-1, 1]) k.box('glow', 0.05, 0.05, 0.02, at(s * 0.16, 0.12, 0.5), look.eye);
    }, true);
    root.add(body);
    const wings = [-1, 1].map(s => {
        const j = joint(root, s * 0.35, 0, 0);
        j.add(part(k => {
            k.box('body', 1.2, 0.04, 0.8, at(s * 0.6, 0, -0.05, 0, s * 0.25, 0), look.wing);
            k.box('body', 1.0, 0.02, 0.6, at(s * 0.55, -0.03, -0.05, 0, s * 0.25, 0), look.under);
        }));
        return j;
    });
    return { root, parts: { body, wings }, ownMaterials: body.userData.ownMaterials };
}

export function frostmaw(look) {
    const root = new THREE.Group();
    const body = part(k => {
        k.box('body', 0.75, 0.55, 1.6, at(0, 0.62, 0), look.body, { ch: 0.15 });
        k.box('body', 0.55, 0.4, 0.7, at(0, 0.7, 1.1), look.body, { ch: 0.1 });
        k.box('body', 0.4, 0.15, 0.35, at(0, 0.55, 1.5), look.scale, { ch: 0.05 });       // jaw
        k.box('body', 0.18, 0.18, 1.2, at(0, 0.55, -1.3, -0.15, 0, 0), look.scale, { ch: 0.05 });   // tail
        for (let i = 0; i < 6; i++) k.geo('body', new THREE.ConeGeometry(0.12, 0.4, 4), at(0, 1.0, 0.7 - i * 0.3, -0.3, 0, 0), look.frost, { flat: true });   // ice spines
        for (const s of [-1, 1]) k.box('glow', 0.06, 0.05, 0.02, at(s * 0.18, 0.82, 1.45), look.eye);
    }, true);
    root.add(body);
    const legs = legs4(root, look, look.scale, [[-0.42, 0.55], [0.42, 0.55], [-0.42, -0.5], [0.42, -0.5]], 0.42, 0.18);
    return { root, parts: { body, legs }, ownMaterials: body.userData.ownMaterials };
}

export function glasswight(look) {
    const root = new THREE.Group();
    const body = part(k => {
        // A guard of fused glass: a cracked torso of facets, a helm, a blade arm.
        k.geo('body', new THREE.OctahedronGeometry(0.55, 0), at(0, 1.5, 0, 0, 0.4, 0, 1, 1.4, 0.7), look.body, { flat: true });
        k.geo('body', new THREE.OctahedronGeometry(0.28, 0), at(0, 2.35, 0), look.edge, { flat: true });
        k.geo('glow', new THREE.OctahedronGeometry(0.12, 0), at(0, 1.55, 0.3), look.glow, { flat: true });
        k.box('body', 0.12, 1.3, 0.06, at(0.75, 1.3, 0.25, 0.2, 0, -0.2), look.edge);          // the blade
        k.box('body', 0.18, 0.8, 0.18, at(-0.6, 1.4, 0, 0, 0, 0.3), look.body);
    }, true);
    root.add(body);
    const legs = [-1, 1].map(s => { const j = joint(root, s * 0.25, 0.9, 0); j.add(part(k => k.geo('body', new THREE.ConeGeometry(0.16, 0.9, 4), at(0, -0.45, 0, Math.PI, 0, 0), look.body, { flat: true }))); return j; });
    return { root, parts: { body, legs }, ownMaterials: body.userData.ownMaterials };
}

export function sentinel(look) {
    const root = new THREE.Group();
    const body = part(k => {
        // An iron warden of the Lantern Office: a hooded figure in plate whose head is a lantern, the Office's sign.
        k.cyl('body', 0.62, 0.86, 1.1, 6, at(0, 0.55, 0), look.dark, { flat: true });                    // a long plated skirt
        k.box('body', 1.2, 1.15, 0.86, at(0, 1.62, 0), look.body, { ch: 0.14 });                          // the breastplate
        k.box('body', 1.32, 0.12, 0.96, at(0, 1.08, 0), look.trim, { ch: 0.03 });                         // a brass belt
        for (const s of [-1, 1]) {
            k.box('body', 0.5, 0.32, 0.72, at(s * 0.72, 2.18, 0, 0, 0, s * -0.25), look.trim, { ch: 0.08 });   // pauldrons
            k.box('body', 0.3, 1.0, 0.32, at(s * 0.82, 1.5, 0.04), look.body, { ch: 0.06 });               // arms
            k.box('body', 0.34, 0.26, 0.36, at(s * 0.82, 0.92, 0.08), look.dark, { ch: 0.06 });             // gauntlets
        }
        k.box('body', 1.0, 0.85, 0.12, at(0, 2.1, -0.46, -0.15, 0, 0), look.dark, { ch: 0.04 });          // the hood, falling behind
        // The lantern head: a base, four posts, a peaked cap with a ring, and the flame inside.
        k.box('body', 0.66, 0.1, 0.66, at(0, 2.32, 0), look.trim, { ch: 0.02 });
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box('body', 0.07, 0.58, 0.07, at(x * 0.27, 2.66, z * 0.27), look.trim);
        k.box('body', 0.7, 0.08, 0.7, at(0, 2.98, 0), look.trim, { ch: 0.02 });
        k.cyl('body', 0, 0.46, 0.36, 4, at(0, 3.2, 0, 0, Math.PI / 4, 0), look.body, { flat: true });
        k.geo('body', new THREE.TorusGeometry(0.1, 0.025, 4, 8), at(0, 3.46, 0), look.trim, { flat: true });
        k.geo('glow', new THREE.OctahedronGeometry(0.17, 0), at(0, 2.66, 0, 0, 0, 0, 1, 1.5, 1), look.lamp, { flat: true });
    }, true);
    root.add(body);
    // Three rune lamps: each goes dark when a careful stream puts it out.
    const lamps = [-0.4, 0, 0.4].map(x => {
        const m = part(k => { k.box('glow', 0.22, 0.22, 0.06, at(0, 0, 0, 0, 0, Math.PI / 4), look.lamp); k.box('body', 0.3, 0.3, 0.04, at(0, 0, -0.03, 0, 0, Math.PI / 4), look.trim); });
        m.position.set(x, 1.75, 0.47);
        root.add(m);
        return m;
    });
    return { root, parts: { body, lamps }, ownMaterials: body.userData.ownMaterials };
}

export function wellspawn() {
    const root = new THREE.Group();
    // Pure element held in an Oruun cage, out of the Glass scar: a bright core (its colour is its element,
    // creatures/Behaviours.js) inside three worn stone rings that turn round it, studded where they were pinned.
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), new THREE.MeshPhongMaterial({ color: 0xff6a1a, emissive: 0xff6a1a, emissiveIntensity: 1.2, flatShading: true, shininess: 20 }));
    core.position.y = 1.05;
    root.add(core);
    const body = part(k => {
        for (const [rx, rz, r] of [[Math.PI / 2, 0, 0.72], [0.5, 0.9, 0.8], [-0.6, -0.8, 0.88]]) {
            k.geo('body', new THREE.TorusGeometry(r, 0.06, 4, 18), at(0, 0, 0, rx, 0, rz), 0x5e5850, { flat: true });
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2, p = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0).applyEuler(new THREE.Euler(rx, 0, rz));
                k.box('body', 0.13, 0.13, 0.13, at(p.x, p.y, p.z, rx, a, rz), 0x3a3631, { ch: 0.03 });
            }
        }
    }, true);
    body.position.y = 1.05;
    root.add(body);
    return { root, parts: { body, core }, ownMaterials: body.userData.ownMaterials };
}

export const CREATURE_MODELS = { emberwing, bristleback, thornhound, shellback, cindermite, mudling, brinecoil, galekite, frostmaw, glasswight, sentinel, wellspawn };
