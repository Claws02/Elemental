// ============================================================
// EARTHWORKS — stone raised out of the ground (Earth)
// ============================================================
//
// Touch open ground within reach and hold still: a column of stone rises
// there, and keeps rising while the finger stays down, up to what Earth's
// Power allows (data/elements.js EARTH.raise). Let go and it stops.
//
// What it is for:
//   cover     a creature's charge or bite stops against it
//   barrier   a wall across a lane (raise several)
//   platform  stand on the spot as it rises and it lifts you; or raise it
//             beside you and walk into it to climb on (PlayerController
//             CLIMB), jumping first for a tall one
//
// It is temporary: after `last` seconds it sinks back. At most `most` stand at
// once; raising another sinks the oldest.
//
// A column is a kinematic body: cannon carries whatever stands on it (the hero,
// a rock, a creature) up with it.
// ============================================================

import { THREE, CANNON } from '../engine/lib.js';
import * as Physics from '../engine/Physics.js';
import { TIER } from '../engine/Physics.js';
import { Kit, at, seeded } from '../engine/Kit.js';
import { EventBus, EV } from '../core/EventBus.js';
import { EARTH } from '../data/elements.js';
import { WORLD } from '../art/Palette.js';
import { Ground } from '../world/Ground.js';

const R = () => EARTH.raise;
const _ray = new THREE.Raycaster(), _v2 = new THREE.Vector2(), _hit = new THREE.Vector3();

/** The column's model: stacked, jittered blocks, earth still on top. Full height, top at y = 0. */
export function columnModel(seed, size, height) {
    const k = new Kit();
    const n = Math.max(2, Math.round(height / 0.7));
    const h = height / n;
    for (let i = 0; i < n; i++) {
        const j = seeded(seed * 7 + i);
        const w = size * (0.9 + j * 0.12);
        k.box('body', w, h * 1.02, size * (0.9 + seeded(seed * 3 + i) * 0.12), at((j - 0.5) * 0.08, -h * (i + 0.5), (seeded(seed + i * 5) - 0.5) * 0.08, 0, j * 0.3, 0),
            WORLD.rock[(seed + i) % WORLD.rock.length], { ch: 0.06 });
    }
    k.box('body', size * 0.96, 0.08, size * 0.96, at(0, 0.02, 0), WORLD.soil);
    return k.build();
}

export class Earthworks {
    constructor({ scene, hero, camera }) {
        Object.assign(this, { scene, hero, camera });
        this.columns = [];
        this.n = 0;
    }

    /** Where on open ground a touch at (x, y) lands, if it is in reach; else null. */
    groundAt(x, y) {
        _v2.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
        _ray.setFromCamera(_v2, this.camera);
        const g = Ground.raycast(_ray.ray);
        if (!g) return null;
        _hit.copy(g);
        const h = this.hero.position;
        if (Math.hypot(_hit.x - h.x, _hit.z - h.z) > R().reach) return null;
        return this.clear(_hit) ? _hit.clone() : null;
    }

    /** Nothing fixed stands there: a wall, a house, another column. Loose things are lifted. */
    clear(p) {
        const s = R().size / 2 + 0.1;
        for (const e of Physics.all()) {
            const b = e.body;
            if (b.type === CANNON.Body.DYNAMIC || e.tier === TIER.PLAYER || !b.shapes.length || e.data.ground) continue;
            if (b.shapes[0] instanceof CANNON.Plane) continue;
            b.updateAABB();
            const a = b.aabb;
            if (a.upperBound.y < Ground.height(p.x, p.z) + 0.05) continue;     // flat things on the ground: patches, plates
            if (p.x + s > a.lowerBound.x && p.x - s < a.upperBound.x && p.z + s > a.lowerBound.z && p.z - s < a.upperBound.z) return false;
        }
        return true;
    }

    /** Start a column at p. Returns it; grow() raises it while the finger holds. */
    raise(p, cause = 'player') {
        const r = R();
        while (this.columns.filter(c => c.state !== 'sinking').length >= r.most) this._sink(this.columns.find(c => c.state !== 'sinking'));
        const H = r.maxHeight[1] + 0.2;                       // the body is always full height; only how far it is out of the ground changes
        const seed = ++this.n;
        const mesh = columnModel(seed, r.size, H);
        const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
        body.addShape(new CANNON.Box(new CANNON.Vec3(r.size / 2, H / 2, r.size / 2)));
        const base = Ground.height(p.x, p.z);
        body.position.set(p.x, base - H / 2, p.z);
        const entry = Physics.add({ body, mesh, tier: TIER.STATIC, id: `Column_${seed}`, data: { column: true } });
        this.scene.add(mesh);
        const c = { id: entry.id, entry, body, mesh, H, base, top: 0, want: r.minHeight, state: 'rising', age: 0, cause };
        this.columns.push(c);
        EventBus.emit(EV.EARTH_RAISED, { id: c.id, x: p.x, z: p.z, cause });
        return c;
    }

    /** Keep raising `c` (the finger is still down): up to what Earth's Power allows. */
    grow(c, dt, power = 0) {
        const r = R();
        if (!c || c.state === 'sinking') return;
        const most = r.maxHeight[0] + (r.maxHeight[1] - r.maxHeight[0]) * power;
        c.want = Math.min(most, Math.max(c.want, c.top + r.speed * dt * 1.2));
        c.state = 'rising';
    }

    _sink(c) { if (c) { c.state = 'sinking'; c.want = 0; } }

    update(dt) {
        const r = R();
        for (const c of this.columns.slice()) {
            c.age += dt;
            if (c.state !== 'sinking' && c.age > r.last) this._sink(c);
            const d = c.want - c.top;
            const v = Math.abs(d) < 0.01 ? 0 : Math.sign(d) * Math.min(Math.abs(d) / Math.max(dt, 1e-3), c.state === 'sinking' ? r.sinkSpeed : r.speed);
            c.body.velocity.set(0, v, 0);
            c.top += v * dt;
            c.body.position.y = c.base + c.top - c.H / 2;             // kept exact; the velocity is what carries riders
            c.body.aabbNeedsUpdate = true;
            c.mesh.position.set(c.body.position.x, c.base + c.top, c.body.position.z);
            if (v === 0 && c.state === 'rising') c.state = 'standing';
            if (c.state === 'sinking' && c.top <= 0.001) {
                Physics.remove(c.entry);
                this.scene.remove(c.mesh);
                this.columns.splice(this.columns.indexOf(c), 1);
            }
        }
    }

    /** The world's solids the camera avoids (standing columns). */
    get solids() { return this.columns.map(c => c.mesh); }

    dispose() { for (const c of this.columns) { Physics.remove(c.entry); this.scene.remove(c.mesh); } this.columns = []; }
}
