// ============================================================
// LAVA — Earth and Fire at once: stone heated past glowing, until it runs
// ============================================================
//
// Hold a stone still in the grip and Fire heats it (FireSystem.heat). With
// lava learned it doesn't stop at hot: it goes MOLTEN (heat past 1, bright
// orange, dripping sparks). Thrown, a molten stone bursts where it hits into a
// pool of lava:
//
//   for LAVA.last seconds  everything that burns within it catches; creatures
//                          and the hero standing in it burn; timber in it
//                          wears through
//   then                   it crusts over, and the scorch stays
//   water                  a stream on it quenches it to crust in a hiss of steam
//
// The stone itself is spent: it cools to a black lump.
//
// The brief (§10): "one of the first abilities that makes the player realize:
// maybe I shouldn't be doing this everywhere." Every pool the player makes is
// excess in the ledger, on top of whatever it burns.
// ============================================================

import { THREE } from '../engine/lib.js';
import { EventBus, EV } from '../core/EventBus.js';
import { LAVA } from '../data/elements.js';
import { Ground } from '../world/Ground.js';

export class Lava {
    constructor({ scene, fire, fx, water, creatures, vitals, player }) {
        Object.assign(this, { scene, fire, fx, water, creatures, vitals, player });
        this.pools = [];
        this.scorches = [];
        this.n = 0;
        this.hot = new THREE.MeshPhongMaterial({ color: 0x3a1206, emissive: 0xff5a14, emissiveIntensity: 1.6, flatShading: true, shininess: 10 });
        this.crust = new THREE.MeshPhongMaterial({ color: 0x1a1512, flatShading: true, shininess: 4 });
        fire.onMolten = (thing, cause) => this.pool(thing.mesh.position.clone(), cause, thing);
    }

    /** A pool of lava at p (a molten stone burst there). */
    pool(p, cause = 'player', stone = null) {
        const r = LAVA.radius;
        const geo = new THREE.CircleGeometry(r, 14);
        const pos = geo.attributes.position;
        for (let i = 1; i < pos.count; i++) { const k = 0.8 + Math.random() * 0.3; pos.setXY(i, pos.getX(i) * k, pos.getY(i) * k); }
        geo.rotateX(-Math.PI / 2);
        drape(geo, p.x, p.z, 0.04);
        const mesh = new THREE.Mesh(geo, this.hot.clone());
        mesh.position.set(p.x, 0, p.z);
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        const pool = { id: `Lava_${++this.n}`, p: new THREE.Vector3(p.x, Ground.height(p.x, p.z), p.z), r, age: 0, mesh, cause };
        this.pools.push(pool);
        this.fx?.burst({ x: p.x, y: 0.4, z: p.z }, 60, 0.6, 6);
        if (stone) {
            // The stone is spent: black, cold.
            const d = stone.entry.data;
            d.heat = 0; d.molten = false;
            const m = stone.mesh.userData.ownMaterials?.body;
            if (m) { m.color.setScalar(0.25); m.emissiveIntensity = 0; }
        }
        EventBus.emit(EV.LAVA, { id: pool.id, x: p.x, z: p.z, cause });
        return pool;
    }

    update(dt) {
        for (const pool of this.pools.slice()) {
            pool.age += dt;
            // A stream on it: quenched.
            const s = this.water?.stream;
            if (s && Math.hypot(s.cur.x - pool.p.x, s.cur.z - pool.p.z) < pool.r + 0.5) {
                pool.age += dt * LAVA.quench;
                if (Math.random() < 0.4) this.fx?.steam(s.cur, 3);
            }
            if (pool.age >= LAVA.last) { this._crust(pool); continue; }
            const k = 1 - pool.age / LAVA.last;
            pool.mesh.material.emissiveIntensity = 0.5 + 1.2 * k + Math.sin(pool.age * 7) * 0.1;
            this._burn(pool, dt);
            if (Math.random() < dt * 14) {
                const a = Math.random() * Math.PI * 2, d = Math.random() * pool.r * 0.8;
                this.fx?.burn({ x: pool.p.x + Math.cos(a) * d, y: pool.p.y + 0.05, z: pool.p.z + Math.sin(a) * d }, dt * 4, { rate: 10, w: 0.3, h: 0.1, size: 0.35, smoke: 0.3 });
            }
        }
    }

    _burn(pool, dt) {
        const near = q => Math.hypot(q.x - pool.p.x, q.z - pool.p.z) < pool.r;
        for (const f of this.fire.flammables.values()) {
            const q = f.thing.pos();
            if (!near(q) || Ground.above(q) > 2.5) continue;
            if (!f.burning && !f.burned) this.fire.ignite(f.thing, pool.cause);
            const piece = f.thing.entry?.data.piece, owner = f.thing.entry?.data.owner;
            if (piece && owner?.wear && !piece.broken) owner.wear(piece, LAVA.wear * dt, pool.cause);
        }
        for (const c of this.creatures?.all || []) if (near(c.pos) && Ground.above(c.pos) < 1.5) c.react('fire', LAVA.burn * dt, pool.cause);
        const h = this.player.position;
        if (near(h) && Ground.above(h) < 1) this.vitals?.hurt(LAVA.playerBurn * dt, 'lava');
    }

    _crust(pool) {
        pool.mesh.material.dispose();
        pool.mesh.material = this.crust;
        this.pools.splice(this.pools.indexOf(pool), 1);
        this.scorches.push(pool.mesh);
        while (this.scorches.length > LAVA.scorches) this.scene.remove(this.scorches.shift());
        EventBus.emit(EV.LAVA_COOLED, { id: pool.id });
    }

    dispose() {
        for (const p of this.pools) { this.scene.remove(p.mesh); p.mesh.material.dispose(); }
        for (const m of this.scorches) this.scene.remove(m);
        this.hot.dispose(); this.crust.dispose();
    }
}

/** Lay a flat disc (already turned to lie flat, centred on 0) over the ground at (x, z), `lift` above it. */
export function drape(geo, x, z, lift = 0.03) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, Ground.height(x + pos.getX(i), z + pos.getZ(i)) + lift);
    pos.needsUpdate = true;
    geo.computeVertexNormals();
}
