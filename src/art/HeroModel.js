// ============================================================
// HERO — the protagonist, modelled and rigged in code
// ============================================================
//
// Hundred Block Dash's figures are armless toys: one flat group that a rig
// re-parents into hips / neck / two floating mitts. Elemental's hero has to
// reach for a boulder, hurl it and brace against the recoil, so it is built
// jointed from the start:
//
//   root                world placement and facing (rotation.y)
//    ├ shadow           contact disc, stays on the ground
//    └ hips             bob and lean
//       ├ pelvis + tunic skirt
//       ├ thigh[L/R] → knee[L/R] → shin + boot
//       └ spine         twist and lean
//          ├ chest, belt, element stone
//          ├ cloak      pivots at the shoulders, flares with speed
//          ├ neck → head
//          └ shoulder[L/R] → elbow[L/R] → forearm + hand
//
// Every part is one Kit (body / sheen / glow) so detail stays cheap: the whole
// hero is about fifteen draw calls. Rotations: a limb hangs along -Y from its
// joint, and the hero faces +Z, so a NEGATIVE rotation.x swings a limb forward.
//
// Proportions are stylized-heroic (a head about 1/6.5 of the height), so the
// silhouette reads at phone distance without looking like a toy.
// Height: 1.8 units. The hips sit at 0.95.
// ============================================================

import { Kit, at } from '../engine/Kit.js';
import { HERO, ELEMENT } from './Palette.js';

const HIP_Y = 0.95;

function _part(fn) {
    const k = new Kit();
    fn(k);
    return k.build();
}

function _joint(parent, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
}

export function buildHero(look = HERO) {
    const C = { ...HERO, ...look };
    const root = new THREE.Group();
    root.name = 'hero';

    // Contact shadow: cheap, always readable, even with shadows off.
    const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.42, 20),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    root.add(shadow);

    const hips = _joint(root, 0, HIP_Y, 0);
    hips.add(_part(k => {
        k.box('body', 0.34, 0.16, 0.22, at(0, 0, 0), C.trouser, { ch: 0.04 });
        // Tunic skirt: a flared box, front and back panels standing proud.
        k.box('body', 0.4, 0.2, 0.27, at(0, -0.04, 0), C.tunic, { ch: 0.05 });
        k.box('body', 0.18, 0.26, 0.04, at(0, -0.08, 0.14, -0.08), C.tunic, { ch: 0.015 });
        k.box('body', 0.2, 0.02, 0.045, at(0, -0.21, 0.15, -0.08), C.trim);
    }));

    // Legs.
    const thigh = [], knee = [];
    for (const side of [-1, 1]) {
        const t = _joint(hips, side * 0.1, -0.05, 0);
        t.add(_part(k => {
            k.cyl('body', 0.075, 0.065, 0.42, 8, at(0, -0.21, 0), C.trouser);
        }));
        const kn = _joint(t, 0, -0.43, 0);
        kn.add(_part(k => {
            k.cyl('body', 0.062, 0.05, 0.3, 8, at(0, -0.15, 0), C.trouser);
            // Boot: shaft with a folded cuff, and a foot that points forward.
            k.box('body', 0.13, 0.2, 0.14, at(0, -0.36, 0.005), C.boot, { ch: 0.03 });
            k.box('body', 0.15, 0.05, 0.16, at(0, -0.25, 0.005), C.bracer, { ch: 0.015 });
            k.box('body', 0.12, 0.08, 0.14, at(0, -0.43, 0.09), C.boot, { ch: 0.03 });
        }));
        thigh.push(t); knee.push(kn);
    }

    const spine = _joint(hips, 0, 0.06, 0);
    spine.add(_part(k => {
        // Chest tapers to the waist; the collar and a crossed strap stand proud.
        k.box('body', 0.36, 0.2, 0.22, at(0, 0.1, 0), C.tunic, { ch: 0.05 });
        k.box('body', 0.44, 0.26, 0.25, at(0, 0.32, 0), C.tunic, { ch: 0.07 });
        k.box('body', 0.4, 0.035, 0.27, at(0, 0.02, 0), C.belt, { ch: 0.01 });
        k.box('body', 0.07, 0.07, 0.03, at(0, 0.02, 0.145), C.trim, { ch: 0.01 });  // buckle
        k.box('body', 0.07, 0.42, 0.03, at(0.02, 0.26, 0.13, 0, 0, 0.55), C.belt, { ch: 0.01 });
        k.box('body', 0.26, 0.06, 0.26, at(0, 0.46, -0.01), C.trim, { ch: 0.02 });  // collar
        // Leather pauldron on the lead shoulder only: asymmetry reads as "adventurer".
        k.box('body', 0.16, 0.08, 0.2, at(0.25, 0.44, 0, 0, 0, -0.35), C.bracer, { ch: 0.03 });
        // A pouch on the belt, and the other hip.
        k.box('body', 0.09, 0.1, 0.06, at(-0.16, -0.02, 0.1), C.bracer, { ch: 0.02 });
    }));

    // The element stone on the buckle: its own material so it takes the
    // colour of the selected element.
    const stoneMat = new THREE.MeshBasicMaterial({ color: ELEMENT.earth.rune });
    const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), stoneMat);
    stone.position.set(0, 0.02, 0.165);
    spine.add(stone);

    // Cloak: pivots at the shoulders so it can flare back when running.
    const cloak = _joint(spine, 0, 0.44, -0.13);
    cloak.add(_part(k => {
        k.box('body', 0.46, 0.9, 0.035, at(0, -0.45, -0.02), C.cloak, { ch: 0.012 });
        k.box('body', 0.42, 0.86, 0.02, at(0, -0.44, 0.005), C.cloakIn);
        k.box('body', 0.5, 0.08, 0.1, at(0, -0.01, 0.02), C.cloak, { ch: 0.03 });   // hood roll
        k.box('body', 0.47, 0.03, 0.045, at(0, -0.9, -0.02), C.trim);               // hem
    }));

    const neck = _joint(spine, 0, 0.5, 0);
    neck.add(_part(k => {
        k.cyl('body', 0.05, 0.06, 0.08, 8, at(0, 0.03, 0), C.skin);
        // Head.
        k.box('body', 0.22, 0.25, 0.24, at(0, 0.19, 0.01), C.skin, { ch: 0.06 });
        k.box('body', 0.16, 0.06, 0.05, at(0, 0.09, 0.1), C.skin, { ch: 0.02 });          // jaw
        k.box('body', 0.04, 0.06, 0.05, at(0, 0.17, 0.14), C.skin, { ch: 0.012 });        // nose
        for (const s of [-1, 1]) {
            k.box('body', 0.045, 0.028, 0.02, at(s * 0.05, 0.215, 0.128), 0x1e1812);   // eye
            k.box('body', 0.06, 0.014, 0.02, at(s * 0.05, 0.25, 0.132, 0, 0, s * 0.12), C.hair); // brow
            k.box('body', 0.03, 0.06, 0.05, at(s * 0.115, 0.19, 0), C.skin, { ch: 0.01 }); // ear
        }
        // Hair: a cap, a swept fringe and a short tail at the back.
        k.box('body', 0.25, 0.1, 0.27, at(0, 0.31, -0.005), C.hair, { ch: 0.04 });
        k.box('body', 0.2, 0.06, 0.06, at(-0.02, 0.28, 0.11, 0.2, 0, 0.18), C.hair, { ch: 0.02 });
        k.box('body', 0.24, 0.16, 0.06, at(0, 0.2, -0.11), C.hair, { ch: 0.02 });
        k.box('body', 0.07, 0.14, 0.05, at(0, 0.1, -0.15, 0.3), C.hair, { ch: 0.02 });
    }));

    // Arms.
    const shoulder = [], elbow = [];
    for (const side of [-1, 1]) {
        const sh = _joint(spine, side * 0.27, 0.4, 0);
        sh.add(_part(k => {
            k.geo('body', new THREE.SphereGeometry(0.07, 8, 6), at(0, 0, 0), C.tunic);
            k.cyl('body', 0.06, 0.052, 0.28, 8, at(0, -0.14, 0), C.tunic);
        }));
        const el = _joint(sh, 0, -0.29, 0);
        el.add(_part(k => {
            k.cyl('body', 0.048, 0.042, 0.24, 8, at(0, -0.12, 0), C.skin);
            k.cyl('body', 0.056, 0.05, 0.14, 8, at(0, -0.14, 0), C.bracer);               // bracer
            k.box('body', 0.055, 0.1, 0.085, at(0, -0.3, 0.005), C.skin, { ch: 0.02 });   // hand
            k.box('body', 0.03, 0.05, 0.03, at(-side * 0.035, -0.28, 0.04), C.skin, { ch: 0.008 }); // thumb
        }));
        shoulder.push(sh); elbow.push(el);
    }

    return {
        root, shadow, hips, spine, neck, cloak, thigh, knee, shoulder, elbow,
        stone, stoneMat, height: 1.8,
        /** Recolour the element stone (and anything else that follows the element). */
        setElement(key) { stoneMat.color.setHex(ELEMENT[key].rune); },
    };
}

// ============================================================
// THE ANIMATOR — procedural, like HBD's CharacterAnimator
// ============================================================
//
// No clips, no skeleton, no loader. Each frame writes a target pose from the
// hero's state (speed, channelling, throwing) and damps the joints toward it,
// so every change of state blends on its own.
//
// Legs are driven by DISTANCE travelled, not time, so the feet never skate
// whatever speed the stick asks for.
// ============================================================

const DAMP = 14;
const _lerp = (a, b, k) => a + (b - a) * k;

export class HeroAnimator {
    constructor(rig) {
        this.rig = rig;
        this.phase = 0;
        this.clock = 0;
        this.speed = 0;          // current horizontal speed, units/s
        this.channel = null;     // { pitch, yaw } toward a held object, local to the hero, or null
        this.throwT = -1;        // seconds since a throw began, -1 when not throwing
        this.p = {};             // current joint angles
    }

    throw() { this.throwT = 0; }

    update(dt, { speed = 0, channel = null } = {}) {
        this.clock += dt;
        this.speed = speed;
        this.channel = channel;
        const r = this.rig;
        const run = Math.min(1, speed / 6.5);           // 0 idle … 1 flat-out run
        const stride = 1.35 + run * 0.5;                // metres per full cycle
        this.phase += (speed * dt / stride) * Math.PI * 2;
        const s = Math.sin(this.phase), c = Math.cos(this.phase);
        const moving = Math.min(1, speed / 0.6);
        const breath = Math.sin(this.clock * 2.1);

        const T = {
            hipsY: 0.95 + Math.abs(c) * 0.045 * moving - run * 0.03 + breath * 0.004,
            hipsRy: s * 0.1 * moving,
            spineX: 0.04 + run * 0.22 + breath * 0.01,
            spineY: -s * 0.14 * moving,
            neckX: -run * 0.15,
            cloakX: 0.08 + run * 0.75 + moving * 0.12 + Math.sin(this.clock * 3 + this.phase) * 0.04 * (0.3 + moving),
            thighX: [s * 0.55 * moving * (0.7 + run * 0.4), -s * 0.55 * moving * (0.7 + run * 0.4)],
            kneeX: [Math.max(0, -c) * (0.4 + run * 0.9) * moving + 0.05, Math.max(0, c) * (0.4 + run * 0.9) * moving + 0.05],
            shX: [s * 0.5 * moving * (0.6 + run * 0.6), -s * 0.5 * moving * (0.6 + run * 0.6)],   // arms swing opposite the legs
            shZ: [-0.12 - run * 0.1, 0.12 + run * 0.1],
            elX: [-0.25 - run * 0.9, -0.25 - run * 0.9],
        };
        // Legs: thighX is applied with the forward = negative convention.
        T.thighX = T.thighX.map(v => -v);

        // Channelling: the lead arm reaches toward the held object, the other
        // braces. Pitch 0 is level; positive pitch is up.
        if (channel) {
            const reach = -(Math.PI / 2) - channel.pitch;
            T.shX[1] = reach;
            T.shZ[1] = 0.1;
            T.elX[1] = -0.15;
            T.shX[0] = -0.9;
            T.shZ[0] = -0.35;
            T.elX[0] = -1.1;
            T.spineY += channel.yaw * 0.35;
            T.spineX -= 0.08;
            T.neckX = -channel.pitch * 0.5;
        }

        // Throwing: wind back, then whip the lead arm through and follow on.
        if (this.throwT >= 0) {
            this.throwT += dt;
            const t = this.throwT;
            if (t < 0.08) {
                T.shX[1] = 0.6; T.elX[1] = -1.2; T.spineY = 0.45;
            } else if (t < 0.32) {
                const k = (t - 0.08) / 0.24;
                T.shX[1] = _lerp(-2.4, -1.0, k); T.elX[1] = -0.1; T.spineY = _lerp(-0.4, -0.2, k); T.spineX = 0.25;
            } else {
                this.throwT = -1;
            }
        }

        const k = 1 - Math.exp(-DAMP * dt);
        const P = this.p;
        const d = (key, v) => { P[key] = P[key] === undefined ? v : _lerp(P[key], v, k); return P[key]; };
        r.hips.position.y = d('hipsY', T.hipsY);
        r.hips.rotation.y = d('hipsRy', T.hipsRy);
        r.spine.rotation.x = d('spineX', T.spineX);
        r.spine.rotation.y = d('spineY', T.spineY);
        r.neck.rotation.x = d('neckX', T.neckX);
        r.cloak.rotation.x = d('cloakX', T.cloakX);
        for (let i = 0; i < 2; i++) {
            r.thigh[i].rotation.x = d('thX' + i, T.thighX[i]);
            r.knee[i].rotation.x = d('knX' + i, T.kneeX[i]);
            r.shoulder[i].rotation.x = d('shX' + i, T.shX[i]);
            r.shoulder[i].rotation.z = d('shZ' + i, T.shZ[i]);
            r.elbow[i].rotation.x = d('elX' + i, T.elX[i]);
        }
        // The element stone pulses gently, faster while channelling.
        const pulse = 1 + Math.sin(this.clock * (channel ? 12 : 3)) * (channel ? 0.25 : 0.1);
        r.stone.scale.setScalar(pulse);
        r.stone.rotation.y += dt * 1.5;
    }
}
