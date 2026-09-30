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
        k.geo('body', new THREE.IcosahedronGeometry(0.22, 0), at(0, 0, 0, 0, 0, 0, 0.8, 0.75, 1.3), look.body, { flat: true });
        k.geo('body', new THREE.IcosahedronGeometry(0.13, 0), at(0, 0.06, 0.28), look.body, { flat: true });
        k.box('body', 0.05, 0.05, 0.12, at(0, 0.04, 0.42), 0x2a1a10);                         // beak
        k.box('glow', 0.03, 0.03, 0.02, at(0.07, 0.1, 0.35), 0xffd07a);
        k.box('glow', 0.03, 0.03, 0.02, at(-0.07, 0.1, 0.35), 0xffd07a);
        for (let i = 0; i < 3; i++) k.box('glow', 0.06 - i * 0.01, 0.02, 0.3, at((i - 1) * 0.06, -0.02, -0.34, 0.2, (i - 1) * 0.25, 0), look.glow);   // an ember tail
    }, true);
    root.add(body);
    const wings = [-1, 1].map(s => {
        const j = joint(root, s * 0.14, 0.04, 0);
        j.add(part(k => {
            k.box('body', 0.55, 0.03, 0.26, at(s * 0.28, 0, 0), look.wing);
            k.box('glow', 0.2, 0.02, 0.1, at(s * 0.5, 0.01, -0.06), look.glow);
        }));
        return j;
    });
    return { root, parts: { body, wings }, ownMaterials: body.userData.ownMaterials };
}

export function bristleback(look) {
    const root = new THREE.Group();
    const body = part(k => {
        k.box('body', 0.9, 0.8, 1.5, at(0, 0.85, 0), look.body, { ch: 0.2 });
        k.box('body', 0.95, 0.35, 1.3, at(0, 1.25, -0.05), look.bristle, { ch: 0.12 });            // the ridge of bristles
        for (let i = 0; i < 7; i++) k.box('body', 0.08, 0.28, 0.08, at(0, 1.45, -0.55 + i * 0.18, -0.3, 0, 0), look.bristle);
        k.box('body', 0.62, 0.55, 0.55, at(0, 0.82, 0.92), look.body, { ch: 0.14 });                // head
        k.box('body', 0.34, 0.26, 0.2, at(0, 0.7, 1.24), 0x3a2820, { ch: 0.06 });                   // snout
        for (const s of [-1, 1]) {
            k.cyl('body', 0.02, 0.05, 0.36, 5, at(s * 0.22, 0.72, 1.28, -1.1, 0, s * 0.4), look.tusk, { flat: true });
            k.box('glow', 0.05, 0.05, 0.02, at(s * 0.2, 0.95, 1.2), 0xffb070);
        }
    }, true);
    root.add(body);
    const legs = [[-0.32, 0.45], [0.32, 0.45], [-0.32, -0.5], [0.32, -0.5]].map(([x, z]) => {
        const j = joint(root, x, 0.6, z);
        j.add(part(k => k.box('body', 0.2, 0.6, 0.22, at(0, -0.3, 0), look.bristle, { ch: 0.05 })));
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

export const CREATURE_MODELS = { emberwing, bristleback, thornhound };
