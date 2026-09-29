// ============================================================
// ELEMENTAL — bootstrap (Phase 1 technical prototype)
// ============================================================
//
// Wires the independent systems together and runs the loop. Each system owns
// its own state; this file only decides the ORDER things happen in a frame:
//
//   input → earth (forces) → player (velocity) → physics step
//         → structures (apply hits recorded during the step) → camera → render
//
// There is deliberately no GameManager here. When save, scenes and world
// state arrive they are their own modules, and this file just calls them.
// ============================================================

import { THREE } from './engine/lib.js';
import * as Renderer from './engine/Renderer.js';
import * as Physics from './engine/Physics.js';
import { EventBus } from './core/EventBus.js';
import { buildTestRoom } from './world/TestRoom.js';
import { PlayerController } from './player/PlayerController.js';
import { CameraRig } from './player/CameraRig.js';
import { EarthSystem } from './elements/EarthSystem.js';
import { Gestures } from './input/Gestures.js';
import { Hud } from './ui/Hud.js';

function boot() {
    const { scene, camera } = Renderer.init(document.getElementById('game'));
    Physics.init();

    const room = buildTestRoom(scene);
    const player = new PlayerController(scene, room.spawn);
    const cam = new CameraRig(camera);
    cam.solids = room.solids;
    cam.yaw = player.facing + Math.PI;
    cam.focus.set(room.spawn.x, 1.6, room.spawn.z);

    const earth = new EarthSystem({ camera, hero: player, rocks: room.rocks });
    scene.add(earth.tether);
    const hud = new Hud(document.getElementById('hud'));

    const input = new Gestures(document.getElementById('game'), {
        pickAt: (x, y) => earth.pickAt(x, y),
        grab: t => earth.grab(t),
        drag: (t, x, y) => earth.drag(t, x, y),
        release: (t, r) => earth.release(t, r),
        orbit: (dx, dy) => cam.orbit(dx, dy),
        zoom: f => cam.zoom(f),
        stick: s => hud.stick(s),
    });

    let last = performance.now();
    function frame(now) {
        // Capped at 0.1 s: Physics sub-steps cover that without slow motion, and
        // a longer hitch is treated as a pause rather than a teleport.
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        EventBus.tick(dt);

        earth.update(dt);
        player.update(dt, input.moveVector(), cam.moveYaw, earth.channelPose());
        Physics.step(dt);
        room.barricade.update();
        cam.update(dt, player.position, earth.held ? earth.held.entry.mesh.position : null);
        Renderer.followSun(player.position);
        Renderer.render();

        const ri = Renderer.info();
        hud.update(dt, { calls: ri.calls, tris: ri.triangles, physics: Physics.stats(), barricade: room.barricade.summary() });
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // QA handle: the smoke test drives the prototype through this, never
    // through private state.
    window.__EL = {
        ready: true,
        THREE, Physics, EventBus, room, player, earth, cam, input,
        renderInfo: () => ({ ...Renderer.info() }),
        throwRockAt(i, target, speed = 30) {
            const e = room.rocks[i];
            const dir = new THREE.Vector3(target.x, target.y, target.z).sub(e.mesh.position).normalize();
            earth.throwEntry(e, dir, speed);
        },
    };
    document.body.classList.add('ready');
}

try { boot(); }
catch (e) {
    console.error(e);
    document.getElementById('boot-error').textContent = 'Elemental failed to start: ' + e.message;
}
