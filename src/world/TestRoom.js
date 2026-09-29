// ============================================================
// TEST ROOM — the Phase 1 sandbox (§57)
// ============================================================
//
// "Can manipulating the world actually feel fun?" One room to answer it:
//
//   - a ruined courtyard of an elemental civilisation, walled on four sides
//   - ten boulders of different sizes (§57 asks for 10 rocks)
//   - one timber barricade blocking the archway: the destructible wall
//   - pillars, two of them broken, for cover and for rocks to bounce off
//   - two braziers (fire sources): one by the spawn, one near the barricade
//   - behind the barricade, a sealed door carrying all four elements' runes,
//     only Earth's lit. The first piece of environmental storytelling.
//
// Layout (plan view, north up, units):
//
//        z=-26   ┌──[ sealed door ]──┐
//                │     passage       │
//        z=-18 ──┴──┤  ARCH  ├───────┴──   ← north wall
//        z=-16      [barricade]
//              P                     P     ← pillars at x=±9
//              P       rocks         P
//              P        hero         P
//        z=+18 ─────────────────────────   ← south wall
//            x=-18                  x=+18
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { Kit, at, seeded } from '../engine/Kit.js';
import { ELEMENT, WORLD } from '../art/Palette.js';
import { rock, flagstoneFloor, ruinWall, pillar, fallenDrum, archway, plankPanel, timberPost, brazier } from '../art/PropModels.js';
import { Destructible } from './Destructible.js';

export const ROOM = { half: 18, spawn: { x: 0, z: 9, facing: Math.PI } };

export function buildTestRoom(scene) {
    const solids = [];      // meshes the camera must not pass through
    const rocks = [];

    // ---- floor ------------------------------------------------------------
    scene.add(flagstoneFloor(28));
    const ground = new CANNON.Body({ mass: 0, material: Physics.material('ground') });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    Physics.add({ body: ground, tier: TIER.STATIC, id: 'Ground' });

    // A static box collider, and the mesh it belongs to counted as solid.
    const box = (x, y, z, w, h, d, rotY = 0, mesh = null, mat = 'stone') => {
        const b = new CANNON.Body({ mass: 0, material: Physics.material(mat) });
        b.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
        b.position.set(x, y, z);
        b.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
        Physics.add({ body: b, mesh: null, tier: TIER.STATIC });
        if (mesh) solids.push(mesh);
    };

    // ---- perimeter walls ---------------------------------------------------
    const H = ROOM.half;
    const wall = (seed, cx, cz, len, height, rotY = 0) => {
        const w = ruinWall(seed, len, height);
        w.group.position.set(cx, 0, cz);
        w.group.rotation.y = rotY;
        scene.add(w.group);
        const horiz = Math.abs(Math.sin(rotY)) < 0.5;
        box(cx, w.height / 2, cz, horiz ? len : w.depth, w.height, horiz ? w.depth : len, 0, w.group);
    };
    // South (inner face toward -Z), in three runs of differing height.
    wall(11, -12, H, 12, 3.0, Math.PI);
    wall(12, 0, H, 12, 2.4, Math.PI);
    wall(13, 12, H, 12, 3.3, Math.PI);
    // West and east.
    wall(21, -H, -9, 18, 3.3, Math.PI / 2);
    wall(22, -H, 9, 18, 2.8, Math.PI / 2);
    wall(31, H, -9, 18, 2.9, -Math.PI / 2);
    wall(32, H, 9, 18, 3.3, -Math.PI / 2);
    // North, either side of the arch.
    const ARCH_W = 5, archHalf = ARCH_W / 2 + 1.1;
    const nLen = H - archHalf;
    wall(41, -(archHalf + nLen / 2), -H, nLen, 3.6);
    wall(42, archHalf + nLen / 2, -H, nLen, 3.6);

    // ---- the arch and the passage behind it ---------------------------------
    const arch = archway(ARCH_W, 4.2);
    arch.group.position.set(0, 0, -H);
    scene.add(arch.group);
    for (const sx of [-1, 1]) box(sx * (ARCH_W / 2 + arch.pierW / 2), 2.1, -H, arch.pierW, 4.2, arch.depth, 0, arch.group);
    box(0, 4.6, -H, ARCH_W + arch.pierW * 2 + 0.3, 0.8, arch.depth);
    const PASS_END = -26;
    for (const sx of [-1, 1]) {
        const len = -H - PASS_END;
        wall(50 + sx, sx * (ARCH_W / 2 + 0.6), (-H + PASS_END) / 2 - 0.5, len, 4.0, sx < 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    const door = _sealedDoor(ARCH_W + 1.4, 4.6);
    door.position.set(0, 0, PASS_END);
    scene.add(door);
    box(0, 2.3, PASS_END - 0.3, ARCH_W + 1.4, 4.6, 0.8, 0, door);

    // ---- pillars -------------------------------------------------------------
    const pillars = [
        [-9, -8, false], [-9, 0, true], [-9, 8, false],
        [9, -8, false], [9, 0, false], [9, 8, true],
    ];
    pillars.forEach(([x, z, broken], i) => {
        const p = pillar(60 + i, 5.2, { broken });
        p.group.position.set(x, 0, z);
        scene.add(p.group);
        box(x, p.height / 2, z, p.radius * 2, p.height, p.radius * 2, 0, p.group);
    });
    const drum = fallenDrum(7);
    drum.position.set(-7.4, 0.45, 1.6);
    drum.rotation.y = 0.5;
    scene.add(drum);
    box(-7.4, 0.45, 1.6, 0.85, 0.9, 0.9, 0.5, drum);

    // ---- ten rocks -------------------------------------------------------------
    const ROCKS = [
        [-3.5, 3.0, 0.55], [2.5, 4.5, 0.45], [4.8, 0.5, 0.7], [-5.6, -2.5, 0.4], [0.8, -1.5, 0.6],
        [-2.2, -5.5, 0.85], [6.2, -4.8, 0.5], [-6.8, 6.5, 0.35], [3.4, 9.5, 0.4], [-1.2, 12.2, 0.65],
    ];
    ROCKS.forEach(([x, z, r], i) => {
        const m = rock(100 + i * 13, r);
        m.group.position.set(x, m.radius, z);
        scene.add(m.group);
        const mass = 40 * r * r * r;
        const b = new CANNON.Body({
            mass, material: Physics.material('rock'), linearDamping: 0.02, angularDamping: 0.25,
            allowSleep: true, sleepSpeedLimit: 0.2, sleepTimeLimit: 0.5,
        });
        b.addShape(new CANNON.Sphere(m.radius));
        b.position.set(x, m.radius, z);
        b.quaternion.setFromEuler(0, seeded(i) * 6, 0);
        m.group.quaternion.copy(b.quaternion);
        rocks.push(Physics.add({ body: b, mesh: m.group, tier: TIER.INTERACTIVE, id: `TestRoom_Rock_${String(i + 1).padStart(2, '0')}`, data: { radius: m.radius } }));
    });

    // ---- the barricade -----------------------------------------------------------
    const BZ = -16.2, COLS = 6, PW = 1.0, PH = 0.95;
    const barricade = new Destructible({
        id: 'TestRoom_Barricade_01', scene,
        cols: COLS, rows: 3, pw: PW, ph: PH, pd: 0.16,
        origin: new THREE.Vector3(0, 0, BZ), rotY: 0, pieceMass: 5,
        regenAfter: 60,       // testing aid: rebuilds a minute after the last damage
        build: plankPanel,
    });
    for (const sx of [-1, 1]) {
        const post = timberPost(3.1);
        post.position.set(sx * (COLS * PW / 2 + 0.15), 0, BZ);
        scene.add(post);
        box(sx * (COLS * PW / 2 + 0.15), 1.55, BZ, 0.3, 3.1, 0.3, 0, null, 'wood');
    }

    // ---- two braziers: fire sources ------------------------------------------
    // One by the spawn, where the player finds it; one a few steps from the
    // barricade, where the temptation is.
    const braziers = [[3.6, 5.2], [-4.2, -11.8]].map(([x, z], i) => {
        const b = brazier(i + 1);
        b.group.position.set(x, 0, z);
        scene.add(b.group);
        box(x, b.height / 2, z, b.radius * 1.6, b.height, b.radius * 1.6, 0, b.group);
        return { id: `TestRoom_Brazier_${String(i + 1).padStart(2, '0')}`, mesh: b.group, flame: new THREE.Vector3(x, b.flameY, z) };
    });

    return { solids, rocks, barricade, braziers, spawn: ROOM.spawn };
}

// The sealed door: a stone slab with the four elements' runes. Only Earth is
// lit. The player can't open it in Phase 1; it is a promise.
function _sealedDoor(w, h) {
    const k = new Kit();
    k.box('body', w, h, 0.6, at(0, h / 2, 0), WORLD.stoneDark, { ch: 0.12 });
    k.box('body', w - 0.8, h - 0.8, 0.2, at(0, h / 2 - 0.1, 0.35), WORLD.stone[2], { ch: 0.06 });
    k.cyl('body', 0.9, 0.9, 0.12, 16, at(0, h / 2, 0.5, Math.PI / 2, 0, 0), WORLD.stone[3]);
    const runes = [
        [ELEMENT.earth.rune, 1.0, 0, 0.55],
        [ELEMENT.water.deep, 0.25, 0.55, 0],
        [ELEMENT.fire.deep, 0.25, 0, -0.55],
        [ELEMENT.air.deep, 0.25, -0.55, 0],
    ];
    for (const [col, lit, dx, dy] of runes) {
        const c = new THREE.Color(col).multiplyScalar(lit);
        k.box(lit > 0.5 ? 'glow' : 'body', 0.26, 0.26, 0.04, at(dx, h / 2 + dy, 0.58, 0, 0, Math.PI / 4), c);
    }
    return k.build();
}

/**
 * Tell the element systems what the room is made of: rocks are stone the
 * player can move and heat, barricade panels are timber that burns, the
 * braziers' coals are a fire source.
 */
export function wireTestRoom(room, { interactables, fire }) {
    for (const e of room.rocks) fire.addHeatable(interactables.add({ id: e.id, mesh: e.mesh, entry: e, material: 'stone' }));
    const byPiece = new Map();
    for (const piece of room.barricade.pieces) {
        const thing = interactables.add({ id: piece.id, mesh: piece.mesh, entry: piece.entry, material: 'wood' });
        fire.addFlammable(thing, { onBurn: (amount, cause) => room.barricade.burn(piece, amount, cause) });
        byPiece.set(piece, thing);
    }
    room.barricade.isBurning = piece => fire.isBurning(byPiece.get(piece));
    room.barricade.onRebuild = () => { for (const t of byPiece.values()) fire.reset(t); };
    for (const b of room.braziers) fire.addSource(interactables.add({ id: b.id, mesh: b.mesh, material: 'coals' }), b.flame);
}
