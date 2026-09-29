// ============================================================
// ELEMENTAL — bootstrap
// ============================================================
//
// Wires the independent systems together and runs the loop. Each system owns
// its own state; this file only decides the ORDER things happen in a frame:
//
//   intent (what the finger means) → channel (forces on what is held)
//     → earth (sensing) → player (velocity) → physics step
//     → fire (contacts recorded in the step, burning, spread)
//     → structures (apply hits and burns) → particles → camera → render
//
// There is deliberately no GameManager here. When save, scenes and world
// state arrive they are their own modules, and this file just calls them.
// ============================================================

import { THREE } from './engine/lib.js';
import * as Renderer from './engine/Renderer.js';
import * as Physics from './engine/Physics.js';
import { EventBus } from './core/EventBus.js';
import { buildTestRoom, wireTestRoom } from './world/TestRoom.js';
import { Interactables } from './world/Interactables.js';
import { PlayerController } from './player/PlayerController.js';
import { CameraRig } from './player/CameraRig.js';
import { Channel } from './elements/Channel.js';
import { EarthSystem } from './elements/EarthSystem.js';
import { FireSystem } from './elements/FireSystem.js';
import { FireFx } from './art/FireFx.js';
import { Intent } from './input/Intent.js';
import { Gestures } from './input/Gestures.js';
import { Hud } from './ui/Hud.js';

function boot() {
    const { renderer, scene, camera } = Renderer.init(document.getElementById('game'));
    Physics.init();

    const room = buildTestRoom(scene);
    const player = new PlayerController(scene, room.spawn);
    const cam = new CameraRig(camera);
    cam.solids = room.solids;
    cam.yaw = player.facing + Math.PI;
    cam.focus.set(room.spawn.x, 1.6, room.spawn.z);

    const interactables = new Interactables();
    const channel = new Channel({ camera, hero: player });
    scene.add(channel.tether);
    const earth = new EarthSystem({ hero: player, rocks: room.rocks, channel });
    const fx = new FireFx(scene, Renderer.quality.tier === 'mobile' ? { flames: 320, smoke: 120 } : { flames: 480, smoke: 160 });
    const fire = new FireSystem({ scene, fx, interactables, channel, hero: player });
    wireTestRoom(room, { interactables, fire });
    const intent = new Intent({ camera, hero: player, channel, interactables, fire, earth });
    const hud = new Hud(document.getElementById('hud'));

    const input = new Gestures(document.getElementById('game'), {
        press: (x, y) => intent.press(x, y),
        drag: (x, y) => intent.drag(x, y),
        release: r => intent.release(r),
        orbit: (dx, dy) => cam.orbit(dx, dy),
        zoom: f => cam.zoom(f),
        stick: s => hud.stick(s),
    });

    const _size = new THREE.Vector2();
    let last = performance.now();
    function frame(now) {
        // Capped at 0.1 s: Physics sub-steps cover that without slow motion, and
        // a longer hitch is treated as a pause rather than a teleport. Never
        // negative: the first rAF timestamp can predate `last`.
        const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
        last = now;
        EventBus.tick(dt);

        intent.update(dt);
        channel.update(dt);
        earth.update(dt);
        player.rig.setElement(intent.element);
        player.update(dt, input.moveVector(), cam.moveYaw, channel.pose());
        Physics.step(dt);
        fire.update(dt);
        room.barricade.update();
        fx.update(dt, renderer.getDrawingBufferSize(_size).y);
        const held = channel.held?.entry.mesh.position || channel.aim?.pos || null;
        cam.update(dt, player.position, held);
        Renderer.followSun(player.position);
        Renderer.render();

        hud.setElement(intent.element);
        hud.ring(intent.ring());
        const ri = Renderer.info();
        hud.update(dt, { calls: ri.calls, tris: ri.triangles, physics: Physics.stats(), barricade: room.barricade.summary(), fire: fire.stats(), fx: fx.stats() });
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // QA handle: the smoke test drives the prototype through this, never
    // through private state.
    window.__EL = {
        ready: true,
        THREE, Physics, EventBus, room, player, channel, earth, fire, fx, intent, interactables, cam, input,
        renderInfo: () => ({ ...Renderer.info() }),
        throwRockAt(i, target, speed = 30) {
            const e = room.rocks[i];
            const dir = new THREE.Vector3(target.x, target.y, target.z).sub(e.mesh.position).normalize();
            channel.throwEntry(e, dir, speed);
        },
    };
    document.body.classList.add('ready');
}

try { boot(); }
catch (e) {
    console.error(e);
    document.getElementById('boot-error').textContent = 'Elemental failed to start: ' + e.message;
}
