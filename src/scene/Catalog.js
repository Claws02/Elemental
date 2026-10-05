// ============================================================
// CATALOG — how each scene object type is built (docs/SCENES.md)
// ============================================================
//
// For every type in schema.js, two functions:
//
//   model(it)        the look alone, in the object's own frame. Elemental-
//                    Editor draws the scene with exactly this, so what is
//                    placed is what ships.
//   spawn(ctx, it)   the look placed in the world, plus its colliders and
//                    whatever it is to the game. Returns an INSTANCE:
//
//     { mesh, entries,            the root object and its physics entries
//       wire(sys)?,               tell the element systems what it is
//       update(dt, frame)?,       per frame ({ held, hero })
//       signal(name)?,            true/false for wires and the script
//       act(name)?,               raise, open, hintOn…
//       anchor(from)?,            a point a plate's chain runs to
//       top()? }                  the height of its top (for the marker)
//
// `it` is the scene object: { id, type, x, y, z, rotY, ...props }.
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { Kit, at, seeded } from '../engine/Kit.js';
import { WORLD, ELEMENT } from '../art/Palette.js';
import { rock, ruinWall, pillar, fallenDrum, archway, plankPanel, timberPost, brazier, basin, crate, barrel, dummy, hay } from '../art/PropModels.js';
import { buildingWall, buildingFloor, buildingRoof, buildingStairs, buildingFence, buildingPost, tree, stall, gate, groundPatch } from '../art/TownModels.js';
import { Destructible, STATE } from '../world/Destructible.js';
import { Plate } from '../world/Plates.js';
import { Building, buildingModel } from '../world/Building.js';
import { Structure, kitPieces, STRUCTURAL } from '../world/Structure.js';
import { wielderHold, wielderYield } from '../creatures/Behaviours.js';
import { Npc, npcModel, parseRoute } from '../story/Npc.js';
import { buildHero } from '../art/HeroModel.js';
import { EventBus, EV } from '../core/EventBus.js';
import { waterSheet } from '../world/WaterBodies.js';
import { CREATURE_MODELS } from '../art/CreatureModels.js';
import { SPECIES } from '../data/creatures.js';
import { PREFABS, expandPrefab } from '../data/prefabs.js';
import { defaults } from './schema.js';
import { plantModel, boulderModel } from '../art/NatureModels.js';
import { towerModel, bridgeModel, dockModel, townWallModel, gatehouseModel, tentModel, chimneyModel, lampModel, bannerModel, statueModel, fountainModel } from '../art/ArchModels.js';

// ---- helpers ------------------------------------------------------------------

const _yAxis = new CANNON.Vec3(0, 1, 0);

/** The object's props over its type's defaults. */
export function withDefaults(it) { return { ...defaults(it.type), ...it }; }

function _place(obj, it) {
    obj.position.set(it.x || 0, it.y || 0, it.z || 0);
    obj.rotation.y = it.rotY || 0;
    return obj;
}

// Static colliders from boxes in the object's own frame ({ x,y,z,w,h,d,rx? }).
function _boxes(ctx, it, boxes, { mat = 'stone', solid = null } = {}) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rotY || 0);
    const base = new THREE.Vector3(it.x || 0, it.y || 0, it.z || 0);
    const entries = [];
    for (const b of boxes) {
        const body = new CANNON.Body({ mass: 0, material: Physics.material(mat) });
        body.addShape(new CANNON.Box(new CANNON.Vec3(b.w / 2, b.h / 2, b.d / 2)));
        const p = new THREE.Vector3(b.x, b.y, b.z).applyQuaternion(q).add(base);
        body.position.set(p.x, p.y, p.z);
        const bq = q.clone();
        if (b.rx) bq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), b.rx));
        if (b.rz) bq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), b.rz));
        body.quaternion.set(bq.x, bq.y, bq.z, bq.w);
        entries.push(Physics.add({ body, tier: TIER.STATIC, id: it.id }));
    }
    if (solid) ctx.world.solids.push(solid);
    return entries;
}

// A static thing: its model placed, its boxes as colliders, solid to the camera.
function _static(ctx, it, { group, boxes }, opts = {}) {
    _place(group, it);
    ctx.scene.add(group);
    const entries = _boxes(ctx, it, boxes, { solid: opts.solid === false ? null : group, mat: opts.mat });
    return { mesh: group, entries };
}

/** A patrol route as written in the scene: "x,z; x,z; …" → [{ x, z }, …] (story/Npc.js). */
export { parseRoute };

function _toWorld(it, local) {
    return local.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), it.rotY || 0).add(new THREE.Vector3(it.x || 0, it.y || 0, it.z || 0));
}

// A dynamic prop (crate, barrel, dummy): a body, reset to home by PropReset.
function _dynamic(ctx, it, mesh, body, material, mass, { hidden } = {}) {
    _place(mesh, it);
    mesh.position.y += mesh.userData.restY || 0;          // it.y is where its base sits
    ctx.scene.add(mesh);
    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
    body.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w);
    const entry = Physics.add({ body, mesh, tier: TIER.INTERACTIVE, id: it.id, data: { radius: 0.5 } });
    const prop = { id: it.id, mesh, entry, material, mass, home: { p: mesh.position.clone(), q: mesh.quaternion.clone() } };
    ctx.world.props.push(prop);
    return {
        mesh, entries: [entry], prop,
        wire(sys) { prop.thing = sys.interactables.add({ id: it.id, mesh, entry, material }); sys.fire.addFlammable(prop.thing); },
        signal(name, sys) {
            if (name === 'burning') return !!prop.thing && sys.fire.isBurning(prop.thing);
            if (name === 'burned') return !!prop.thing && sys.fire.isBurned(prop.thing);
            if (name === 'moved') return entry.body.position.distanceTo(prop.home.p) > 0.3;
            return false;
        },
    };
}
const _dynBody = (mass, shape, damp = 0.3) => {
    const b = new CANNON.Body({ mass, material: Physics.material('wood'), linearDamping: 0.05, angularDamping: damp, allowSleep: true, sleepSpeedLimit: 0.2, sleepTimeLimit: 0.5 });
    b.addShape(shape);
    return b;
};

// ---- editor-only looks ------------------------------------------------------------

function _spawnMarker() {
    const g = buildHero().root;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), new THREE.MeshBasicMaterial({ color: ELEMENT.earth.rune, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);
    return g;
}

function _zoneBox(w, h, d) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: 0x4fd6ff, transparent: true, opacity: 0.16, depthWrite: false }));
    m.position.y = h / 2;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: 0x4fd6ff }));
    e.position.y = h / 2;
    g.add(m, e);
    return g;
}

// The sealed door: a stone slab with the four elements' runes, only Earth lit.
function _sealedDoor(w, h) {
    const k = new Kit();
    k.box('body', w, h, 0.6, at(0, h / 2, 0), WORLD.stoneDark, { ch: 0.12 });
    k.box('body', w - 0.8, h - 0.8, 0.2, at(0, h / 2 - 0.1, 0.35), WORLD.stone[2], { ch: 0.06 });
    k.cyl('body', 0.9, 0.9, 0.12, 16, at(0, h / 2, 0.5, Math.PI / 2, 0, 0), WORLD.stone[3]);
    const runes = [[ELEMENT.earth.rune, 1.0, 0, 0.55], [ELEMENT.water.deep, 0.25, 0.55, 0], [ELEMENT.fire.deep, 0.25, 0, -0.55], [ELEMENT.air.deep, 0.25, -0.55, 0]];
    for (const [col, lit, dx, dy] of runes) {
        const c = new THREE.Color(col).multiplyScalar(lit);
        k.box(lit > 0.5 ? 'glow' : 'body', 0.26, 0.26, 0.04, at(dx, h / 2 + dy, 0.58, 0, 0, Math.PI / 4), c);
    }
    return k.build();
}

// A standing stone: a rough monolith with an Earth rune. Cracked, light shows through it.
// A mill's waterwheel, its axle across the stream (local x): the turning wheel, and the fixed posts and axle.
function _waterwheel(it) {
    const R = it.radius, W = it.width, wheel = new Kit(), frame = new Kit();
    const T = i => WORLD.timber[i % 3];
    for (const sx of [-1, 1]) {
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            wheel.box('body', 0.12, 0.16, 2 * R * Math.sin(Math.PI / 16) + 0.06, at(sx * W / 2, R * Math.cos(a), R * Math.sin(a), a, 0, 0), T(i));
        }
        for (let k = 0; k < 4; k++) wheel.box('body', 0.1, 2 * R, 0.12, at(sx * W / 2, 0, 0, k * Math.PI / 4, 0, 0), WORLD.timberDark);
    }
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        wheel.box('body', W, 0.62, 0.08, at(0, (R - 0.28) * Math.cos(a), (R - 0.28) * Math.sin(a), a, 0, 0), T(i + 1));
    }
    frame.cyl('body', 0.17, 0.17, W + 1.4, 10, at(0, 0, 0, 0, 0, Math.PI / 2), WORLD.timberDark);
    for (const sx of [-1, 1]) frame.box('body', 0.32, 3.4, 0.32, at(sx * (W / 2 + 0.55), -1.6, 0), WORLD.timber[0], { ch: 0.03 });
    return { wheel: wheel.build(), frame: frame.build() };
}

function _standingStone(it, cracked) {
    const k = new Kit(), H = it.height;
    k.box('body', 1.6, 0.35, 1.3, at(0, 0.17, 0), WORLD.stoneDark, { ch: 0.08 });
    const segs = 5;
    for (let i = 0; i < segs; i++) {
        const y0 = 0.35 + (H - 0.35) * i / segs, h = (H - 0.35) / segs + 0.02, w = 1.05 - i * 0.1;
        k.box('body', w, h, w * 0.62, at((seeded(it.seed + i) - 0.5) * 0.06, y0 + h / 2, 0, 0, (seeded(i * 3 + it.seed) - 0.5) * 0.12, 0), WORLD.stone[(i + it.seed) % 4], { ch: 0.06, top: WORLD.stoneTop });
    }
    k.box('body', 0.5, 0.05, 0.35, at(0.1, H - 0.05, 0.05), WORLD.moss[1]);
    const ry = H * 0.55, z = 0.62 * (1.05 - 0.2) / 2 + 0.02;
    for (const [dx, dy, w, h, rz] of [[0, 0.26, 0.36, 0.05, 0], [0, -0.26, 0.36, 0.05, 0], [0, 0, 0.05, 0.36, 0], [-0.12, 0.08, 0.26, 0.045, 0.8], [0.12, 0.08, 0.26, 0.045, -0.8]]) {
        k.box('glow', w, h, 0.02, at(dx, ry + dy, z + 0.01, 0, 0, rz), ELEMENT.earth.rune);
    }
    if (cracked) {
        // A crack running the height of it, lit from inside: gold, with a thread of the other three elements.
        let x = 0, y = 0.4;
        for (let i = 0; i < 9; i++) {
            const nx = (seeded(i * 5.3 + it.seed) - 0.5) * 0.5, ny = y + (H - 0.6) / 9;
            const len = Math.hypot(nx - x, ny - y), a = Math.atan2(ny - y, nx - x);
            k.box('glow', len + 0.03, 0.05, 0.03, at((x + nx) / 2, (y + ny) / 2, z + 0.02, 0, 0, a), [ELEMENT.earth.rune, ELEMENT.fire.rune, ELEMENT.water.rune, ELEMENT.air.rune][i % 4]);
            // Cracked on purpose: chisel bites along the crack, square and even, and a scrap of grey cloth at its foot.
            if (it.chiselled) for (const s of [-1, 1]) k.box('body', 0.07, 0.07, 0.05, at((x + nx) / 2 + s * 0.08, (y + ny) / 2, z + 0.025, 0, 0, Math.PI / 4), WORLD.stoneDark);
            x = nx; y = ny;
        }
        if (it.chiselled) k.box('body', 0.34, 0.03, 0.22, at(0.55, 0.37, z + 0.15, 0, 0.4, 0), 0x7c7f84);
    }
    return k.build();
}

// Model + colliders for the static types whose model is all they are.
const SHAPES = {
    ruin_wall: it => {
        const w = ruinWall(it.seed, it.length, it.height, { runes: it.runes });
        return { group: w.group, boxes: [{ x: 0, y: w.height / 2, z: 0, w: it.length, h: w.height, d: w.depth }] };
    },
    pillar: it => {
        const p = pillar(it.seed, it.height, { broken: it.broken });
        return { group: p.group, boxes: [{ x: 0, y: p.height / 2, z: 0, w: p.radius * 2, h: p.height, d: p.radius * 2 }] };
    },
    drum: it => {
        const g = new THREE.Group();
        const d = fallenDrum(it.seed);
        d.position.y = 0.45;
        g.add(d);
        return { group: g, boxes: [{ x: 0, y: 0.45, z: 0, w: 0.85, h: 0.9, d: 0.9 }] };
    },
    archway: it => {
        const a = archway(it.width, it.height);
        const boxes = [-1, 1].map(sx => ({ x: sx * (it.width / 2 + a.pierW / 2), y: it.height / 2, z: 0, w: a.pierW, h: it.height, d: a.depth }));
        boxes.push({ x: 0, y: it.height + 0.4, z: 0, w: it.width + a.pierW * 2 + 0.3, h: 0.8, d: a.depth });
        return { group: a.group, boxes };
    },
    sealed_door: it => ({ group: _sealedDoor(it.width, it.height), boxes: [{ x: 0, y: it.height / 2, z: -0.3, w: it.width, h: it.height, d: 0.8 }] }),
    tree: it => tree(it),
    plant: it => plantModel(it),
    boulder: it => boulderModel(it),
    tower: it => towerModel(it),
    bridge: it => bridgeModel(it),
    dock: it => dockModel(it),
    town_wall: it => townWallModel(it),
    gatehouse: it => gatehouseModel(it),
    tent: it => tentModel(it),
    chimney: it => chimneyModel(it),
    lamp: it => lampModel(it),
    banner: it => bannerModel(it),
    statue: it => statueModel(it),
    fountain: it => fountainModel(it),
    stall: it => stall(it),
    b_wall: it => buildingWall(it),
    b_floor: it => buildingFloor(it),
    b_roof: it => buildingRoof(it),
    b_stairs: it => buildingStairs(it),
    b_fence: it => buildingFence(it),
    b_post: it => buildingPost(it),
};
const WOODEN = new Set(['b_fence', 'stall', 'dock', 'tent', 'plant']);

// ---- the catalog -----------------------------------------------------------------------

const BZ_PANEL = { pw: 1.0, ph: 0.95, pd: 0.16 };
const ROCK_MOVED = 2.5;
/** The practice yard: a knocked-down dummy stands up after `standUp` s; a thrown pile stone crumbles `crumble` s after
 *  the throw (or once it lies `stray` m from its pile), and the pile restocks one every `refill` s. */
export const PRACTICE = { standUp: 3, crumble: 5, stray: 25, refill: 1.2 };
const POST_H = 3.1;

export const CATALOG = {
    rock: {
        model(it) {
            const g = new THREE.Group(), m = rock(it.seed, it.radius);
            m.group.position.y = m.radius;          // it.y is the ground it rests on
            g.add(m.group);
            return g;
        },
        spawn(ctx, it) {
            const m = rock(it.seed, it.radius);
            const mass = 40 * it.radius ** 3;
            const b = new CANNON.Body({ mass, material: Physics.material('rock'), linearDamping: 0.02, angularDamping: 0.25, allowSleep: true, sleepSpeedLimit: 0.2, sleepTimeLimit: 0.5 });
            b.addShape(new CANNON.Sphere(m.radius));
            b.position.set(it.x, (it.y || 0) + m.radius, it.z);
            b.quaternion.setFromAxisAngle(_yAxis, it.rotY || 0);
            m.group.position.copy(b.position);
            m.group.quaternion.copy(b.quaternion);
            ctx.scene.add(m.group);
            const entry = Physics.add({ body: b, mesh: m.group, tier: TIER.INTERACTIVE, id: it.id, data: { radius: m.radius } });
            ctx.world.rocks.push(entry);
            const home = b.position.clone();
            return {
                mesh: m.group, entries: [entry], rises: true,
                // Moved: carried well away from where it lay (a nudge isn't moving it).
                signal: name => name === 'moved' && entry.body.position.distanceTo(home) > ROCK_MOVED,
                wire(sys) { sys.fire.addHeatable(sys.interactables.add({ id: it.id, mesh: m.group, entry, material: 'stone' })); },
                top: () => entry.body.position.y + m.radius,
            };
        },
    },

    hay: {
        model: it => hay(it.seed),
        spawn(ctx, it) {
            const m = _place(hay(it.seed), it);
            ctx.scene.add(m);
            const prop = { id: it.id, mesh: m, entry: null, material: 'hay', home: { p: m.position.clone(), q: m.quaternion.clone() } };
            ctx.world.props.push(prop);
            return {
                mesh: m, entries: [], prop,
                wire(sys) { prop.thing = sys.interactables.add({ id: it.id, mesh: m, material: 'hay' }); sys.fire.addFlammable(prop.thing); },
                signal: (name, sys) => name === 'burning' ? !!prop.thing && sys.fire.isBurning(prop.thing) : name === 'burned' ? !!prop.thing && sys.fire.isBurned(prop.thing) : false,
            };
        },
    },

    brazier: {
        model: it => brazier(it.seed).group,
        spawn(ctx, it) {
            const b = brazier(it.seed);
            const inst = _static(ctx, it, { group: b.group, boxes: [{ x: 0, y: b.height / 2, z: 0, w: b.radius * 1.6, h: b.height, d: b.radius * 1.6 }] });
            const flame = _toWorld(it, new THREE.Vector3(0, b.flameY, 0));
            ctx.world.braziers.push({ id: it.id, mesh: b.group, flame });
            inst.wire = sys => sys.fire.addSource(sys.interactables.add({ id: it.id, mesh: b.group, material: 'coals' }), flame);
            return inst;
        },
    },

    basin: {
        model: it => basin(it.seed).group,
        spawn(ctx, it) {
            const b = basin(it.seed);
            const inst = _static(ctx, it, { group: b.group, boxes: [{ x: 0, y: b.height / 2, z: 0, w: b.radius * 1.7, h: b.height, d: b.radius * 1.7 }] });
            const surface = _toWorld(it, new THREE.Vector3(0, b.surfaceY, 0));
            ctx.world.basins.push({ id: it.id, mesh: b.group, surface });
            inst.wire = sys => sys.water.addSource(sys.interactables.add({ id: it.id, mesh: b.group, material: 'water' }), surface);
            return inst;
        },
    },

    crate: {
        model: it => { const g = new THREE.Group(); const c = crate(it.seed, it.size); c.position.y = it.size / 2; g.add(c); return g; },
        spawn(ctx, it) {
            const m = crate(it.seed, it.size);
            m.userData.restY = it.size / 2;
            const b = _dynBody(4, new CANNON.Box(new CANNON.Vec3(it.size / 2, it.size / 2, it.size / 2)), 0.2);
            return _dynamic(ctx, it, m, b, 'wood', 4);
        },
    },
    barrel: {
        model: it => { const g = new THREE.Group(); const c = barrel(it.seed); c.position.y = 0.52; g.add(c); return g; },
        spawn(ctx, it) {
            const m = barrel(it.seed);
            m.userData.restY = 0.52;
            return _dynamic(ctx, it, m, _dynBody(10, new CANNON.Cylinder(0.4, 0.4, 1.02, 10)), 'barrel', 10);
        },
    },
    dummy: {
        model: it => { const g = new THREE.Group(); const c = dummy(it.seed); c.position.y = 0.95; g.add(c); return g; },
        spawn(ctx, it) {
            const m = dummy(it.seed);
            m.userData.restY = 0.95;
            const inst = _dynamic(ctx, it, m, _dynBody(15, new CANNON.Box(new CANNON.Vec3(0.28, 0.95, 0.2))), 'wood', 15);
            if (!it.practice) return inst;
            // A practice dummy: knocked down by your throw, it counts ('hit', remembered for the scene) and stands back up.
            const { prop } = inst, b = prop.entry.body;
            let hitAt = -99, down = 0, hit = false, t = 0;
            b.addEventListener('collide', e => { const o = e.body.userData; if (o?.data?.thrownBy === 'player') hitAt = t; });
            const base = inst.signal;
            inst.signal = (name, sys) => name === 'hit' ? hit : name === 'down' ? down > 0 : base(name, sys);
            inst.update = dt => {
                t += dt;
                const up = new THREE.Vector3(0, 1, 0).applyQuaternion(b.quaternion).y;
                const fallen = up < 0.6 || b.position.distanceTo(prop.home.p) > 0.8;
                if (fallen && t - hitAt < 4 && !down) { down = t; if (!hit) { hit = true; EventBus.emit(EV.TARGET_DOWN, { id: it.id, cause: 'player' }); } }
                if (!fallen && !down) return;
                // Back on its feet a few seconds after it falls (still while nobody's hitting it).
                if (fallen && !down) down = t;
                if (t - down > PRACTICE.standUp && b.velocity.length() < 0.5) {
                    Physics.restore(prop.entry, prop.home.p, prop.home.q, TIER.INTERACTIVE, prop.mass);
                    delete prop.entry.data.thrownBy;
                    down = 0;
                }
            };
            return inst;
        },
    },

    // A pile of stones that never runs out: a few loose ones on it to lift; a thrown one crumbles once it has landed,
    // and a fresh one rises in the pile. Nothing to tidy up (a practice yard).
    rock_pile: {
        model(it) {
            const g = new THREE.Group();
            for (let i = 0; i < 7; i++) { const r = rock(it.seed + i, 0.35 + (i % 3) * 0.12).group, a = i * 2.4; r.position.set(Math.cos(a) * (i ? 0.7 : 0), 0.25, Math.sin(a) * (i ? 0.7 : 0)); g.add(r); }
            return g;
        },
        spawn(ctx, it) {
            const root = _place(this.model(it), it);
            ctx.scene.add(root);
            const entries = _boxes(ctx, it, [{ x: 0, y: 0.3, z: 0, w: 1.6, h: 0.6, d: 1.6 }], { solid: root });
            const live = [];
            let sys = null, n = 0, refill = 0;
            const make = () => {
                const r = it.radius, m = rock(it.seed + 100 + n, r), a = n * 2.1, id = `${it.id}_R${++n}`;
                const b = new CANNON.Body({ mass: 40 * r ** 3, material: Physics.material('rock'), linearDamping: 0.02, angularDamping: 0.25, allowSleep: true, sleepSpeedLimit: 0.2, sleepTimeLimit: 0.5 });
                b.addShape(new CANNON.Sphere(m.radius));
                b.position.set(it.x + Math.cos(a) * 0.45, (it.y || 0) + 0.75 + m.radius, it.z + Math.sin(a) * 0.45);
                m.group.position.copy(b.position);
                m.group.scale.setScalar(0.01);
                ctx.scene.add(m.group);
                const entry = Physics.add({ body: b, mesh: m.group, tier: TIER.INTERACTIVE, id, data: { radius: m.radius, pile: it.id } });
                ctx.world.rocks.push(entry);
                const thing = sys.interactables.add({ id, mesh: m.group, entry, material: 'stone' });
                live.push({ entry, thing, mesh: m.group, born: 0, thrown: null, gone: null });
            };
            const drop = s => {
                Physics.remove(s.entry);
                s.mesh.parent?.remove(s.mesh);
                sys.interactables.remove(s.thing);
                const i = ctx.world.rocks.indexOf(s.entry);
                if (i >= 0) ctx.world.rocks.splice(i, 1);
            };
            return {
                mesh: root, entries,
                wire(s) { sys = s; for (let i = 0; i < it.count; i++) make(); },
                update(dt) {
                    if (!sys) return;
                    for (const s of live) {
                        s.born += dt;
                        if (s.born < 0.5) { s.mesh.scale.setScalar(Math.max(0.01, s.born / 0.5)); continue; }     // rising into the pile
                        const b = s.entry.body;
                        if (s.thrown === null && s.entry.data.thrownBy === 'player' && sys.channel?.held?.entry !== s.entry) s.thrown = 0;
                        if (s.thrown !== null) s.thrown += dt;
                        const far = Math.hypot(b.position.x - it.x, b.position.z - it.z) > PRACTICE.stray && b.velocity.length() < 0.3;
                        if (s.gone === null && ((s.thrown !== null && s.thrown > PRACTICE.crumble) || far || !b.world)) s.gone = 0;
                        if (s.gone !== null) { s.gone += dt; s.mesh.scale.setScalar(Math.max(0.01, 1 - s.gone / 0.6)); }
                    }
                    for (const s of live.filter(s => s.gone !== null && s.gone >= 0.6)) { drop(s); live.splice(live.indexOf(s), 1); }
                    // Keep the pile stocked: a new stone a moment after one goes.
                    if (live.length < it.count) { refill += dt; if (refill > PRACTICE.refill) { refill = 0; make(); } } else refill = 0;
                },
                signal: name => name === 'stocked' && live.length >= it.count,
            };
        },
    },

    barricade: {
        model(it) {
            const g = new THREE.Group();
            for (let r = 0; r < it.rows; r++) for (let c = 0; c < it.cols; c++) {
                const p = plankPanel(r * 31 + c * 7 + 1, BZ_PANEL.pw, BZ_PANEL.ph, BZ_PANEL.pd);
                p.position.set((c - (it.cols - 1) / 2) * BZ_PANEL.pw, BZ_PANEL.ph / 2 + r * BZ_PANEL.ph, 0);
                g.add(p);
            }
            if (it.posts) for (const sx of [-1, 1]) { const p = timberPost(POST_H); p.position.x = sx * (it.cols * BZ_PANEL.pw / 2 + 0.15); g.add(p); }
            return g;
        },
        spawn(ctx, it) {
            const d = new Destructible({
                id: it.id, scene: ctx.scene, cols: it.cols, rows: it.rows, ...BZ_PANEL,
                origin: new THREE.Vector3(it.x, it.y || 0, it.z), rotY: it.rotY || 0, pieceMass: 5,
                regenAfter: it.regenAfter, build: plankPanel,
            });
            const mesh = new THREE.Group();
            const entries = d.pieces.map(p => p.entry);
            const posts = [];
            if (it.posts) for (const sx of [-1, 1]) {
                const post = timberPost(POST_H);
                const x = sx * (it.cols * BZ_PANEL.pw / 2 + 0.15);
                post.position.x = x;
                mesh.add(post);
                entries.push(..._boxes(ctx, it, [{ x, y: POST_H / 2, z: 0, w: 0.3, h: POST_H, d: 0.3 }], { mat: 'wood' }));
                posts.push(_toWorld(it, new THREE.Vector3(x, POST_H, 0)));
            }
            _place(mesh, it);
            ctx.scene.add(mesh);
            ctx.world.barricades.push(d);
            const byPiece = new Map();
            return {
                mesh, entries, destructible: d, pieces: d.pieces,
                wire(sys) {
                    for (const piece of d.pieces) {
                        const thing = sys.interactables.add({ id: piece.id, mesh: piece.mesh, entry: piece.entry, material: 'wood' });
                        sys.fire.addFlammable(thing, { onBurn: (amount, cause) => d.burn(piece, amount, cause) });
                        byPiece.set(piece, thing);
                    }
                    d.isBurning = piece => sys.fire.isBurning(byPiece.get(piece));
                    d.onRebuild = () => { for (const t of byPiece.values()) sys.fire.reset(t); };
                },
                update: dt => d.update(dt),
                signal(name) {
                    const s = d.summary();
                    switch (name) {
                    case 'intact': return d.state === STATE.INTACT && !d.raised;
                    case 'damaged': return s.broken > 0;
                    case 'broken': return [STATE.CRITICAL, STATE.COLLAPSED, STATE.BURNED].includes(d.state);
                    case 'collapsed': return d.state === STATE.COLLAPSED || d.state === STATE.BURNED;
                    case 'burned': return d.state === STATE.BURNED;
                    case 'raised': return !!d.raised && !d.sunk;
                    case 'sunk': return !!d.sunk;
                    }
                    return false;
                },
                act(name) { if (name === 'raise') d.raise(); if (name === 'sink') d.sink(); if (name === 'rebuild') d.rebuild(); },
                count: what => d.summary()[what] || 0,
                anchor: from => posts.slice().sort((a, b) => a.distanceTo(from) - b.distanceTo(from))[0] || _toWorld(it, new THREE.Vector3(0, POST_H, 0)),
            };
        },
    },

    gate: {
        model(it) { const g = gate(it); g.group.add(g.grille); if (it.open) g.grille.position.y = it.height - 0.3; return g.group; },
        spawn(ctx, it) {
            const g = gate(it);
            const inst = _static(ctx, it, g);
            inst.mesh.add(g.grille);
            const body = new CANNON.Body({ mass: 0, material: Physics.material('stone') });
            body.addShape(new CANNON.Box(new CANNON.Vec3(g.grilleBox.w / 2, g.grilleBox.h / 2, g.grilleBox.d / 2)));
            const base = _toWorld(it, new THREE.Vector3(0, g.grilleBox.y, 0));
            body.quaternion.setFromAxisAngle(_yAxis, it.rotY || 0);
            const lift = it.height - 0.3;
            let k = it.open ? 1 : 0, want = k;
            const set = () => { const e = k * k * (3 - 2 * k); g.grille.position.y = e * lift; body.position.set(base.x, base.y + e * lift, base.z); body.aabbNeedsUpdate = true; };
            inst.entries.push(Physics.add({ body, tier: TIER.STATIC, id: it.id + '_Grille' }));
            set();
            return Object.assign(inst, {
                update(dt) { if (k !== want) { k = want > k ? Math.min(want, k + dt / 1.6) : Math.max(want, k - dt / 1.2); set(); } },
                signal: name => name === 'open' ? k >= 1 : name === 'closed' ? k <= 0 : false,
                act(name) {
                    if (name === 'open') want = 1; if (name === 'close') want = 0; if (name === 'toggle') want = want ? 0 : 1;
                    ctx.world.onGate?.(it.id, want ? 'open' : 'closed');
                },
                openNow() { k = want = 1; set(); },
                anchor: from => g.posts.map(p => _toWorld(it, p)).sort((a, b) => a.distanceTo(from) - b.distanceTo(from))[0],
            });
        },
    },

    plate: {
        model(it) {
            // The same Plate, built into a throwaway scene, without its physics.
            const tmp = new THREE.Group();
            Plate.buildLook(tmp, { radius: it.radius, height: it.height });
            return tmp;
        },
        spawn(ctx, it) {
            const plate = new Plate(ctx.scene, { id: it.id, pos: new THREE.Vector3(it.x, it.y || 0, it.z), radius: it.radius, height: it.height, gentleHeight: it.gentleHeight });
            ctx.world.plates.push(plate);
            return {
                mesh: plate.group, extra: [plate.ring], entries: [plate.entry], plate,
                link(world) {
                    const t = it.chainTo ? world.objects.get(it.chainTo) : null;   // ('' && … would be a string, with String#anchor)
                    if (typeof t?.anchor === 'function') plate.chain(ctx.scene, t.anchor(plate.pos));
                },
                update: (dt, f) => plate.update(dt, ctx.world.rocks, f.held),
                signal: name => name === 'weighted' ? !!plate.weighted : name === 'gentle' ? !!plate.weighted && plate.gentle : name === 'empty' ? !plate.weighted : false,
                act(name) { if (name === 'hintOn') plate.hint = true; if (name === 'hintOff') plate.hint = false; },
                top: () => plate.top,
            };
        },
    },

    trigger: {
        model: it => _zoneBox(it.width, it.height, it.depth),
        editorOnly: false,
        spawn(ctx, it) {
            const mesh = new THREE.Group();
            _place(mesh, it);
            let entered = false, inside = false;
            const inv = new THREE.Matrix4();
            return {
                mesh, entries: [],
                update(dt, f) {
                    mesh.updateMatrixWorld();
                    const p = f.hero.clone().applyMatrix4(inv.copy(mesh.matrixWorld).invert());
                    inside = Math.abs(p.x) <= it.width / 2 && Math.abs(p.z) <= it.depth / 2 && p.y >= -0.5 && p.y <= it.height;
                    if (inside) entered = true;
                },
                signal: name => name === 'entered' ? entered : name === 'inside' ? inside : false,
            };
        },
    },

    spawn: {
        model: () => _spawnMarker(),
        spawn(ctx, it) {
            const s = { x: it.x, y: it.y || 0, z: it.z, facing: it.rotY || 0 };
            ctx.world.spawns[it.name || 'start'] ||= s;
            return { mesh: null, entries: [] };
        },
    },

    exit: {
        model(it) {
            const g = _zoneBox(it.width, it.height, it.depth);
            g.traverse(o => { if (o.material) o.material.color?.set(0xffb347); });
            return g;
        },
        spawn(ctx, it) {
            const mesh = new THREE.Group();
            _place(mesh, it);
            const inv = new THREE.Matrix4();
            let armed = null, gone = false;   // armed once the hero has been outside it (so arriving on one never bounces you back)
            return {
                mesh, entries: [],
                update(dt, f) {
                    if (gone) return;
                    mesh.updateMatrixWorld();
                    const p = f.hero.clone().applyMatrix4(inv.copy(mesh.matrixWorld).invert());
                    const inside = Math.abs(p.x) <= it.width / 2 && Math.abs(p.z) <= it.depth / 2 && p.y >= -0.5 && p.y <= it.height;
                    if (armed === null) armed = !inside;
                    else if (!inside) armed = true;
                    else if (armed && it.to) { gone = true; ctx.world.onExit?.(it.to, it.at || 'start', it); }
                },
            };
        },
    },

    waterwheel: {
        absolute: true,             // y is the axle's height
        model(it) { const w = _waterwheel(it), g = new THREE.Group(); g.add(w.frame, w.wheel); return g; },
        spawn(ctx, it) {
            const w = _waterwheel(it), root = _place(new THREE.Group(), it);
            root.add(w.frame, w.wheel);
            ctx.scene.add(root);
            const entries = _boxes(ctx, it, [{ x: 0, y: 0, z: 0, w: it.width, h: it.radius * 2, d: it.radius * 2 }], { mat: 'wood', solid: root });
            let state = it.turning ? 'turning' : 'stopped', speed = state === 'turning' ? 1 : 0;
            const set = s => { if (state === 'wrecked') return; state = s; ctx.world.onGate?.(it.id, s); };
            const wreckNow = () => { state = 'wrecked'; speed = 0; w.wheel.rotation.z = 0.35; w.wheel.position.y = -0.7; w.wheel.position.z = 0.6; };
            return {
                mesh: root, entries,
                // It eases up to speed and runs down: a wheel has weight.
                update(dt) {
                    const want = state === 'turning' ? 1 : 0;
                    speed += (want - speed) * Math.min(1, dt * 0.6);
                    if (state !== 'wrecked') w.wheel.rotation.x -= speed * 0.9 * dt;
                },
                signal: n => n === state,
                act(n) {
                    if (n === 'start') set('turning'); else if (n === 'stop') set('stopped');
                    else if (n === 'wreck' && state !== 'wrecked') { wreckNow(); ctx.world.onGate?.(it.id, 'wrecked'); EventBus.emit(EV.STRUCTURE_STATE, { id: it.id, from: 'Intact', to: 'Wrecked', cause: 'player', name: 'Waterwheel', owner: it.owner }); }
                },
                restoreState(s) { if (s === 'wrecked') wreckNow(); else if (s === 'turning' || s === 'stopped') { state = s; speed = s === 'turning' ? 1 : 0; } },
            };
        },
    },

    standing_stone: {
        model: it => _standingStone(it, it.cracked),
        spawn(ctx, it) {
            const root = _place(new THREE.Group(), it);
            let look = _standingStone(it, it.cracked);
            root.add(look);
            ctx.scene.add(root);
            const entries = _boxes(ctx, it, [{ x: 0, y: it.height / 2, z: 0, w: 1.1, h: it.height, d: 0.8 }], { solid: root });
            let cracked = !!it.cracked, touched = false, hum = 0;
            // Touched, it hums: its runes brighten and the four elements' lights rise round it, for a few seconds.
            const glow = () => { let m = null; look.traverse(o => { if (o.isMesh && o.material.isMeshBasicMaterial) m = o.material; }); return m; };
            let runes = glow();
            const motes = [ELEMENT.earth, ELEMENT.fire, ELEMENT.water, ELEMENT.air].map(e => {
                const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: e.rune, transparent: true, opacity: 0 }));
                m.visible = false;
                root.add(m);
                return m;
            });
            const HUM = 4;
            const crack = (quiet = false) => {
                if (cracked) return;
                cracked = true;
                root.remove(look);
                look = _standingStone(it, true);
                root.add(look);
                runes = glow();
                if (!quiet) { ctx.world.onGate?.(it.id, 'cracked'); EventBus.emit(EV.STRUCTURE_STATE, { id: it.id, from: 'Intact', to: 'Cracked', cause: 'awakening', name: 'The standing stone' }); }
            };
            return {
                mesh: root, entries,
                wire(sys) {
                    const thing = sys.interactables.add({ id: it.id, mesh: root, entry: entries[0], material: 'standing' });
                    thing.use = () => {
                        touched = true; hum = HUM;
                        EventBus.emit(EV.STONE_TOUCHED, { id: it.id, cracked });
                    };
                },
                update(dt) {
                    if (hum <= 0) return;
                    hum = Math.max(0, hum - dt);
                    const t = HUM - hum, env = Math.sin(Math.PI * t / HUM);          // swells and fades
                    if (runes) runes.color.setScalar(1 + 1.6 * env * (0.8 + 0.2 * Math.sin(t * 9)));
                    motes.forEach((m, i) => {
                        const a = t * 1.6 + i * Math.PI / 2, r = 0.95 + 0.15 * Math.sin(t * 2 + i);
                        m.visible = hum > 0;
                        m.position.set(Math.cos(a) * r, 0.6 + ((t * 0.55 + i * 0.25) % 1) * (it.height - 0.4), Math.sin(a) * r);
                        m.material.opacity = env * 0.9;
                    });
                },
                signal: n => (n === 'cracked' && cracked) || (n === 'touched' && touched),
                act: n => { if (n === 'crack') crack(); },
                restoreState: s => { if (s === 'cracked') crack(true); },
                top: () => (it.y || 0) + it.height,
            };
        },
    },

    timber_house: {
        model: it => buildingModel(it),
        spawn(ctx, it) {
            const b = new Building(ctx, it);
            return {
                mesh: b.group, entries: [...b.pieces.map(p => p.entry), ...b.entries], building: b, pieces: b.pieces,
                wire: sys => b.wire(sys), update: dt => b.update(dt), signal: n => b.signal(n),
                act: n => { if (n === 'open' || n === 'close') b.toggle(n === 'open'); },
                restoreState: s => b.restoreState(s), dispose: () => b.dispose(),
            };
        },
    },

    creature: {
        // The editor shows the group: one model per member, where they'll stand.
        model(it) {
            const g = new THREE.Group(), sp = SPECIES[it.species];
            for (let i = 0; i < Math.min(it.count, 12); i++) {
                const a = seeded(i * 7.1 + it.x) * Math.PI * 2, r = (it.spread || 2) * Math.sqrt(seeded(i * 3.3 + it.z));
                const m = CREATURE_MODELS[it.species](sp.look).root;
                m.position.set(Math.cos(a) * r, sp.behaviour === 'flyer' ? sp.cruise[0] : 0, Math.sin(a) * r);
                if (it.elite && i === 0) m.scale.setScalar(1.3);
                g.add(m);
            }
            return g;
        },
        spawn(ctx, it) {
            const mesh = _place(new THREE.Group(), it);
            const g = { item: it, members: [], spawned: false, engaged: false, inst: null };
            ctx.world.creatureGroups.push(g);
            const inst = {
                mesh, entries: [], group: g,
                signal: name => name === 'engaged' ? g.engaged : name === 'gone' ? g.spawned && g.members.every(c => c.gone || c.state === 'dead' || c.state === 'flee' || c.state === 'off')
                    : name === 'yielded' ? g.spawned && g.members.length > 0 && g.members.every(c => c.yielded || c.state === 'held' || c.gone)
                    : name === 'alarm' ? !!g.alarm : name === 'buried' ? !!g.buried : false,
                act(name) {
                    if (name === 'release') ctx.world.reveal(it.id);
                    // Wielders: the story's speaker holds one off (not the elite), or ends it.
                    const speaker = ctx.world.objects.get(it.holder || ctx.world.data.script?.speaker || 'Cael')?.npc;      // `holder`: who holds one off
                    if (name === 'hold') { const c = g.members.find(m => !m.elite && !m.yielded && m.state !== 'held'); if (c) wielderHold(c, speaker?.position || c.pos.clone()); }
                    if (name === 'yieldAll') for (const c of g.members) wielderYield(c);
                },
            };
            g.inst = inst;
            return inst;
        },
    },

    npc: {
        model: it => npcModel(it.look).root,
        spawn(ctx, it) {
            const n = new Npc(ctx.scene, { id: it.id, name: it.name, look: it.look, pos: new THREE.Vector3(it.x, it.y || 0, it.z), facing: it.rotY || 0 });
            ctx.world.npcs.push(n);
            n.route = parseRoute(it.route);
            if (it.role && it.role !== 'idle') n.setRole(it.role);
            return {
                mesh: n.rig.root, entries: [n.entry], npc: n, update: (dt, f) => n.update(dt, f.hero), top: () => (it.y || 0) + 2,
                wire: sys => { n.sys = { fire: sys.fire, fx: sys.fire.fx, world: ctx.world }; },
            };
        },
    },

    prefab: {
        model(it) {
            const g = new THREE.Group();
            for (const pc of expandPrefab({ ...it, x: 0, y: 0, z: 0, rotY: 0 })) {
                const m = modelOf(pc);
                _place(m, pc);
                g.add(m);
            }
            return g;
        },
        // One structure from its walls, floors, roofs, posts and stairs (world/Structure.js): it burns and breaks
        // true to what each is made of. Anything else in it (a brazier, a banner) the loader places on its own.
        spawn(ctx, it) {
            const local = expandPrefab({ ...it, x: 0, y: 0, z: 0, rotY: 0 }).filter(pc => STRUCTURAL.has(pc.type));
            const st = new Structure(ctx, { ...it, name: PREFABS[it.prefab]?.label, isLandmark: !!PREFABS[it.prefab]?.landmark }, kitPieces(local));
            return {
                mesh: st.frame, entries: st.entries, structure: st,
                wire: sys => st.wire(sys), update: dt => st.update(dt), signal: n => st.signal(n),
                restoreState: s => st.restoreState(s), dispose: () => st.dispose(),
            };
        },
    },

    water: {
        absolute: true,             // its level is a height, not a height above the ground
        model: it => waterSheet(it),
        spawn(ctx, it) {
            const m = waterSheet(it);
            m.position.set(it.x, it.level, it.z);
            m.rotation.y = it.rotY || 0;
            ctx.scene.add(m);
            const body = ctx.world.waters.add(it, m);
            const inst = { mesh: m, entries: [], water: body };
            // Its level can change (a river dammed, then freed): eased over `secs`, then on to `settle`, if given. Remembered.
            let to = null;
            inst.setLevel = (level, secs = 0, settle = null) => {
                to = { from: body.level, level, secs: Math.max(0.001, secs), t: 0, settle };
                ctx.world.onGate?.(it.id, `level:${(settle?.level ?? level).toFixed(2)}`);
            };
            inst.update = dt => {
                if (!to) return;
                to.t = Math.min(to.secs, to.t + dt);
                const k = to.t / to.secs, e = k * k * (3 - 2 * k);
                body.level = to.from + (to.level - to.from) * e;
                m.position.y = body.level;
                if (to.t >= to.secs) to = to.settle ? { from: body.level, level: to.settle.level, secs: Math.max(0.001, to.settle.secs || 0), t: 0 } : null;
            };
            inst.restoreState = s => { const l = /^level:(-?[\d.]+)$/.exec(s); if (l) { body.level = +l[1]; m.position.y = body.level; } };
            inst.wire = sys => {
                if (it.kind === 'lava') return;          // lava is no source: it burns (WaterBodies.burn)
                const thing = sys.interactables.add({ id: it.id, mesh: m, material: 'water' });
                sys.water.addSource(thing, ctx.world.waters.nearest(body, new THREE.Vector3(it.x, it.level, it.z)), p => ctx.world.waters.nearest(body, p));
            };
            return inst;
        },
    },
    patch: {
        model: it => groundPatch(it, it.x * 7 + it.z * 3).group,
        spawn(ctx, it) {
            const g = _place(groundPatch(it, it.x * 7 + it.z * 3).group, it);
            ctx.scene.add(g);
            return { mesh: g, entries: [] };
        },
    },
};

// Things that burn: a structure (world/Structure.js) instead of a static shape. A wooden bridge in stretches;
// a stall, a fence, a dock, a tent as one piece (a tent's canvas burns away; the rest falls as charred timber).
const BURNS = { stall: 'wood', b_fence: 'wood', dock: 'wood', tent: 'cloth', bridge: 'wood' };
const burnsNow = (type, it) => BURNS[type] && (type !== 'bridge' || it.style === 'plank' || it.style === 'rope');

/** A burnable thing as a structure: its pieces (local boxes as { x, y, z, w, h, d, rx?, rz? }). */
function _structure(ctx, it, parts, mat) {
    const q0 = new THREE.Quaternion();
    const pieces = parts.map(p => ({
        group: p.group, mat, kind: it.type,
        boxes: p.boxes.map(b => {
            const q = q0.clone();
            if (b.rx) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), b.rx));
            if (b.rz) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), b.rz));
            return { c: new THREE.Vector3(b.x, b.y, b.z), q, w: b.w, h: b.h, d: b.d };
        }),
    }));
    const st = new Structure(ctx, it, { pieces });
    return {
        mesh: st.frame, entries: st.entries, structure: st,
        wire: sys => st.wire(sys), update: dt => st.update(dt), signal: n => st.signal(n),
        act: n => { if (n === 'wreck') st.wreck('player'); },
        restoreState: s => st.restoreState(s), dispose: () => st.dispose(),
    };
}

for (const [type, shape] of Object.entries(SHAPES)) {
    CATALOG[type] = {
        model: it => shape(it).group,
        spawn: (ctx, it) => burnsNow(type, it)
            ? _structure(ctx, it, type === 'bridge' ? bridgeModel(it, { parts: true }).pieces : [shape(it)], BURNS[type])
            : _static(ctx, it, shape(it), { mat: WOODEN.has(type) ? 'wood' : 'stone', solid: type === 'b_floor' || type === 'plant' ? false : undefined }),
    };
}

/** The look of scene object `it` (defaults filled in), in its own frame. */
export function modelOf(it) {
    const c = CATALOG[it.type];
    if (!c) throw new Error(`unknown type "${it.type}"`);
    return c.model(withDefaults(it));
}

export { PREFABS, expandPrefab };
