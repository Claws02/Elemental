// ============================================================
// ELEMENTAL — bootstrap
// ============================================================
//
// Wires the independent systems together and runs the loop. Each system owns
// its own state; this file only decides the ORDER things happen in a frame:
//
//   intent (what the finger means) → channel (forces on what is held)
//     → earth (sensing) → player (velocity) → physics step
//     → fire (contacts recorded in the step, burning, spread) → water (stream, orbs) → air (wind)
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
import { WaterSystem } from './elements/WaterSystem.js';
import { AirSystem } from './elements/AirSystem.js';
import { FireFx } from './art/FireFx.js';
import { Intent } from './input/Intent.js';
import { Gestures } from './input/Gestures.js';
import { Hud } from './ui/Hud.js';
import { Progression } from './core/Progression.js';
import { Lesson1 } from './story/Lesson1.js';

// ?scene=lesson   Cael's first lesson (story progression: Earth, wild Fire)
// ?scene=sandbox  every element, fully trained, the test obstacles
// neither          the title screen
function boot(mode) {
    const { renderer, scene, camera } = Renderer.init(document.getElementById('game'));
    Physics.init();

    const lessonMode = mode === 'lesson';
    const prog = new Progression(lessonMode ? 'story' : 'sandbox');
    if (lessonMode) prog.reset();                 // Lesson I is where the story starts
    const room = buildTestRoom(scene, { layout: lessonMode ? 'lesson' : 'sandbox' });
    const player = new PlayerController(scene, room.spawn);
    const cam = new CameraRig(camera);
    cam.solids = room.solids;
    cam.yaw = player.facing + Math.PI;
    cam.focus.set(room.spawn.x, 1.6, room.spawn.z);

    const interactables = new Interactables();
    const channel = new Channel({ camera, hero: player, prog });
    scene.add(channel.tether);
    const earth = new EarthSystem({ hero: player, rocks: room.rocks, channel, prog });
    const fx = new FireFx(scene, Renderer.quality.tier === 'mobile' ? { flames: 320, smoke: 120 } : { flames: 480, smoke: 160 });
    const fire = new FireSystem({ scene, fx, interactables, channel, hero: player, prog });
    const water = new WaterSystem({ scene, camera, interactables, channel, hero: player, fire, fx, solids: room.solids });
    const air = new AirSystem({ scene, camera, interactables, channel, hero: player, fire, solids: room.solids });
    wireTestRoom(room, { interactables, fire, water });
    const intent = new Intent({ camera, hero: player, channel, interactables, fire, earth, water, air, prog });
    const hud = new Hud(document.getElementById('hud'));
    const lesson = lessonMode ? new Lesson1({ scene, room, prog, channel, fire, hud, player }) : null;
    if (lesson) {
        hud.story();
        // The story opens looking at Cael.
        const c = lesson.cael.position, p = player.body.position;   // the mesh has not synced yet
        player.facing = Math.atan2(c.x - p.x, c.z - p.z);
        player.rig.root.rotation.y = player.facing;
        cam.yaw = player.facing + Math.PI;
        cam.pitch = 0.22;
        cam.dist = 5.5;
        cam.focus.set(p.x, 1.6, p.z);
    }

    const input = new Gestures(document.getElementById('game'), {
        press: (x, y) => intent.press(x, y),
        claims: (x, y) => prog.has('air') && air.onHero(x, y),
        drag: (x, y, t) => intent.drag(x, y, t),
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
        water.update(dt);
        air.update(dt);
        room.barricade.update(dt);
        room.propReset.update(dt);
        lesson?.update(dt);
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
        THREE, Physics, EventBus, room, player, channel, earth, fire, water, air, fx, intent, interactables, cam, input, prog, lesson, mode, hud,
        renderInfo: () => ({ ...Renderer.info() }),
        throwRockAt(i, target, speed = 30) {
            const e = room.rocks[i];
            const dir = new THREE.Vector3(target.x, target.y, target.z).sub(e.mesh.position).normalize();
            channel.throwEntry(e, dir, speed);
        },
    };
    document.body.classList.add('ready');
}

const mode = new URLSearchParams(location.search).get('scene');
try {
    if (mode === 'lesson' || mode === 'sandbox') boot(mode);
    else document.getElementById('title').classList.add('on');
}
catch (e) {
    console.error(e);
    document.getElementById('boot-error').textContent = 'Elemental failed to start: ' + e.message;
}
