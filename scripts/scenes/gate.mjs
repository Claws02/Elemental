// ============================================================
// Builds scenes/gate.json: the Oruun Gate, the pass between Veyra and the
// Verdant Reach, where Lesson I happens on the road (docs/STORY.md, Act I).
// Run from the repo root:   node scripts/scenes/gate.mjs
//
// The ruin and the lesson are Lesson I's own (scenes/lesson1.json): its
// pieces turned so its passage faces east down the road, its script with a
// walk up the pass before it and the road on after it. A valley comes up
// from Veyra, widens into the ruin's court, and pinches into a gorge the
// ruin's passage fills: the barricade is the way through. Cael walks it with
// you. Over the walls is another way; Cael notices.
// ============================================================
import fs from 'fs';
import { Land, Dresser, fbm, ridge, smooth, exits, grow, scene } from './lib/region.mjs';

const SEED = 23, FLOOR = 4;
const L = new Land(240, 2, SEED);
L.shape((x, z) => {
    const az = Math.abs(z);
    // How wide the floor is: the valley (12), the ruin's court (20), the gorge its passage fills (3.6), the valley.
    const court = smooth(-44, -30, x) * (1 - smooth(18.6, 19.4, x));
    const gorge = smooth(18.6, 21, x) * (1 - smooth(27, 31, x));
    const hw = 12 + 8 * court - 8.4 * gorge;
    const cliff = smooth(hw, hw + 4, az);
    const floor = FLOOR + x * 0.012 + fbm(x, z, 30, SEED) * 0.8 * (1 - court) * (1 - cliff);
    return floor + cliff * (22 + ridge(x, z, 40, SEED) * 12) + smooth(hw + 4, 70, az) * 22;
});
// The court: dead flat under the ruin.
L.flatten(0, 0, 24, FLOOR, 0.85);
const S = new Dresser(L, SEED);
const o = S.objects;

// ---- the ruin: Lesson I's pieces, turned so lesson north (-z) runs east (+x) down the road ----
const L1 = JSON.parse(fs.readFileSync('scenes/lesson1.json', 'utf8'));
const turn = it => ({ ...it, x: +(-(it.z || 0)).toFixed(2), z: +(it.x || 0).toFixed(2), rotY: +((it.rotY || 0) - Math.PI / 2).toFixed(3) });
const DROP = new Set(['Spawn', 'Exit_verdant', 'TestRoom_Wall_12', 'TestRoom_SealedDoor']);
for (const it of L1.objects) if (!DROP.has(it.id)) o.push(turn(it));
// The west side opens onto the road: an archway where the low middle wall stood, short walls either side.
S.add('Gate_Arch_West', 'archway', -18, 0, -Math.PI / 2, { width: 5, height: 4.2 });
for (const s of [-1, 1]) S.add(`Gate_Wall_West_${s < 0 ? 'S' : 'N'}`, 'ruin_wall', -18, s * 4.3, Math.PI / 2, { length: 3.6, height: 3, seed: 70 + s, runes: true });
// The passage's far end opens into the gorge: an archway where the sealed door stood.
S.add('Gate_Arch_East', 'archway', 26.5, 0, -Math.PI / 2, { width: 5, height: 4.2 });
// Cael waits nowhere: he walks up with you, and once the lesson is done he isn't here when you come back.
const cael = o.find(it => it.id === 'Cael');
Object.assign(cael, { x: -96, z: 3, rotY: Math.PI / 2, showWhen: '!lesson1' });

// ---- where the story listens ----
S.add('Zone_Court', 'trigger', -12, 0, 0, { width: 10, depth: 30, height: 4 });
S.add('Zone_Beyond', 'trigger', 34, 0, 0, { width: 6, depth: 14, height: 6 });
S.add('Zone_East', 'trigger', 60, 0, 0, { width: 6, depth: 20, height: 6 });
S.add('Spawn', 'spawn', -100, 0, Math.PI / 2, { name: 'start' });

// ---- the road: Veyra in the west, the Reach in the east ----
const ends = exits('gate', L, S, { banner: 'green', surface: 'dirt' });
const west = ends.find(e => e.to === 'veyra'), east = ends.find(e => e.to === 'verdant');
L.road([[west.x, west.z], [-60, 2], [-24, 0]], 4, 'dirt');
L.road([[32, 0], [70, -2], [east.x, east.z]], 4, 'dirt');
grow(S, 'Pass', 'meadow', { x0: -115, z0: -60, x1: 115, z1: 60 }, { trees: 40, plants: 60, boulders: 30, ok: (x, z, h, sl) => (x < -30 || x > 34) && sl < 0.6 && !L.busy(x, z, 2) });
L.paint((x, z, h, sl, cur) => cur !== 0 ? null : sl > 0.6 ? 'rock' : h > 30 ? 'snow' : null);
L.paintCircle(0, 0, 17, 'flagstone');

// ---- the story: up the pass, Lesson I in the ruin, on into the Reach ----
const s = JSON.parse(JSON.stringify(L1.script));
const onward = ['The Reach is on the other side. Walk with me.'];
for (const st of s.steps) for (const e of st.ends || []) if (e.say) e.say = e.say.map(l => l.startsWith('Rest. Tomorrow') ? onward[0] : l);
const trial = s.steps.find(st => st.id === 'trial');
// Over the walls instead of through the passage: it counts, and Cael says so.
trial.ends.push({ when: { signal: { obj: 'Zone_Beyond', name: 'entered' } }, outcome: 'over', next: 'close',
    do: [{ saveFlag: 'lesson1' }, { do: { obj: 'Lesson1_WeightL', action: 'hintOff' } }, { do: { obj: 'Lesson1_WeightR', action: 'hintOff' } }],
    say: ['Over the wall. That’s one way through.', 'Not the one I’d have picked. But you’re through.'] });
s.id = 'Gate';
s.steps = [
    { id: 'road', do: [{ npc: { id: 'Cael', role: 'follow' } }], objective: 'Walk up the pass with Cael', mark: 'Zone_Court',
      say: ['The road climbs for an hour, then drops into the Reach.', 'There’s an Oruun ruin across the pass. Older than Veyra. Older than the Empire.', 'Nobody’s opened its passage in a long time. You will.'],
      until: { signal: { obj: 'Zone_Court', name: 'entered' } },
      then: { do: [{ npc: { id: 'Cael', role: 'walk', target: { x: -2.6, z: -0.4 } } }] } },
    ...s.steps.filter(st => st.id !== 'close'),
    { id: 'close', until: { talking: false }, then: { do: [{ npc: { id: 'Cael', role: 'follow' } }], next: 'onward' } },
    { id: 'onward', objective: 'Walk on into the Verdant Reach', mark: 'Exit_verdant', until: { signal: { obj: 'Zone_East', name: 'entered' } } },
];
s.card = null;

const out = { ...scene('gate', 'The Oruun Gate', L, S, { region: 'verdant', mood: 'day', far: 150 }), script: s, wires: L1.wires };
fs.writeFileSync('scenes/gate.json', JSON.stringify(out, null, 1) + '\n');
console.log(`gate: ${o.length} objects`);
