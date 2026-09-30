// ============================================================
// Builds scenes/veyra.json, the prologue. Run from the repo root:
//   node scripts/scenes/veyra.mjs
// The scene is data like any other (the editor opens it); this script is how
// it was laid out, kept so a layout change is a code review, not a hand edit.
// ============================================================
import fs from 'fs';
const PI = Math.PI, H = PI / 2;
const o = [];
const add = (id, type, x, z, rotY = 0, p = {}) => o.push({ id, type, x, y: 0, z, rotY, ...p });
// ---- ground and square ----
add('Spawn', 'spawn', 4, 13, -H, { name: 'start' });
add('Square', 'patch', 0, 0, 0, { width: 14, depth: 12, style: 'cobble', round: false });
add('Lane_East', 'patch', 12, 5, 0, { width: 12, depth: 3, style: 'dirt', round: false });
add('Lane_North', 'patch', 0, -12, 0, { width: 3, depth: 12, style: 'dirt', round: false });
add('Road_South', 'patch', 0, 18, 0, { width: 4, depth: 14, style: 'dirt', round: false });
add('Field', 'patch', 19, -9, 0, { width: 12, depth: 12, style: 'dirt', round: false });
add('StandingStone', 'standing_stone', 0, -2, 0, { height: 3.2, cracked: false, seed: 4 });
add('Well', 'basin', 4.5, 2.5, 0, { seed: 3, owner: 'civilian' });
add('Trough', 'basin', -6, -12, 0, { seed: 5, owner: 'civilian' });
// ---- the houses and barns (they burn) ----
const house = (id, x, z, r, kind, cols, depth, seed) => add(id, 'timber_house', x, z, r, { kind, cols, depth, rows: kind === 'barn' ? 3 : 3, seed, owner: 'civilian' });
house('Veyra_House_Mira', -10.5, -4.5, H, 'house', 5, 4, 11);
house('Veyra_House_Wynn', -10.5, 5, H, 'house', 5, 4, 12);
house('Veyra_House_Home', 10, 8, -H, 'house', 5, 4, 13);
house('Veyra_House_Tam', 10, -3.5, -H, 'house', 4, 4, 14);
house('Veyra_Barn_Holloway', -3, -15.5, 0, 'barn', 7, 5, 15);
house('Veyra_Barn_North', 7.5, -15.5, 0, 'barn', 6, 5, 16);
add('Forge', 'prefab', -15, 13, H, { prefab: 'smithy', style: 'prefab', seed: 3 });
// ---- things that burn between them ----
let n = 0;
const hay = (x, z) => add(`Veyra_Hay_${String(++n).padStart(2, '0')}`, 'hay', x, z, 0, { seed: n, owner: 'civilian' });
[[-1.5, -11.5], [-0.6, -11.8], [-5.5, -10.5], [3.5, -11.8], [4.4, -11.2], [11.5, -11.5], [-7.5, 0.5], [7.5, 3.5]].forEach(([x, z]) => hay(x, z));
for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) hay(15.5 + i * 2.2, -12.5 + j * 2.6);
[[6.5, -6], [-6.5, 4], [-3, 8]].forEach(([x, z], i) => add(`Veyra_Cart_${i + 1}`, 'crate', x, z, i * 0.4, { size: 1.1, seed: 20 + i, owner: 'civilian' }));
add('Stall_Bread', 'stall', -5, -4.5, H, { width: 2.4, awning: 'ochre', seed: 1 });
add('Stall_Apples', 'stall', 5, -5, -H, { width: 2.2, awning: 'red', seed: 2 });
// ---- stones small enough for untrained hands ----
[[2.5, 5.5, 0.35], [-2.5, 6, 0.4], [-4, -8, 0.38], [6, -9, 0.42], [3.5, -3, 0.36], [-3, 1.5, 0.4]].forEach(([x, z, r], i) => add(`Veyra_Stone_${i + 1}`, 'rock', x, z, i, { radius: r, seed: 300 + i * 11 }));
// ---- trees, fences ----
[[-22, -10, 'oak'], [-20, 4, 'pine'], [-18, 20, 'oak'], [22, 12, 'oak'], [24, -2, 'pine'], [-8, 22, 'oak'], [14, 20, 'pine'], [-24, -22, 'pine'], [4, -24, 'oak']]
  .forEach(([x, z, kind], i) => add(`Tree_${i + 1}`, 'tree', x, z, i, { height: kind === 'pine' ? 6.5 : 5.2, kind, seed: i + 7 }));
add('Fence_Field_1', 'b_fence', 19, -2.5, 0, { length: 12, height: 1.1, seed: 1 });
add('Fence_Field_2', 'b_fence', 12.5, -9, H, { length: 12, height: 1.1, seed: 2 });
// ---- people ----
add('Bram', 'npc', -11.5, 10.5, H, { name: 'Bram', look: 'youth', role: 'idle' });
add('Hollis', 'npc', -13.5, 12, H, { name: 'Hollis', look: 'smith', role: 'idle' });
add('Mira', 'npc', -7.5, -4.5, H, { name: 'Mira', look: 'baker', role: 'idle' });
add('Wynn', 'npc', 1.6, -3.8, -0.6, { name: 'Elder Wynn', look: 'elder', role: 'idle' });
add('Tam', 'npc', 15, -6, -H, { name: 'Tam', look: 'villager', role: 'idle' });
add('Cael', 'npc', 0, 22, PI, { name: 'Cael', look: 'cael', role: 'idle', hidden: true });
// ---- the flock (arrives at dusk) ----
// They come for you, not the thatch: the fire is yours (embers off). A first fight: any hit kills one, and they hit softly.
add('Flock', 'creature', 15, 15, 0, { species: 'emberwing', count: 4, spread: 5, aggressive: true, elite: false, embers: false, fragile: true, damage: 0.3, hidden: true });
// ---- where the morning goes ----
add('Zone_Forge', 'trigger', -11, 11, 0, { width: 6, depth: 6, height: 3 });
add('Zone_Square', 'trigger', 0, 1, 0, { width: 9, depth: 8, height: 3 });
add('Zone_Stone', 'trigger', 0, -1, 0, { width: 4.5, depth: 4.5, height: 3 });
add('Zone_Home', 'trigger', 6.5, 8, 0, { width: 4, depth: 6, height: 3 });

const HOUSES = { many: { prefix: 'Veyra_House', signal: 'burning', max: 0 } };
const BARNS = { many: { prefix: 'Veyra_Barn', signal: 'burning', max: 0 } };
const script = {
  id: 'Prologue', speaker: 'Bram', face: 'Bram', flags: {},
  reactions: [
    { on: 'playerFire', count: 'fires', throttle: 14, lines: [['@Wynn Fire from their hands. Gods keep us.'], ['@Mira Stop! You\'re making it worse!'], ['@Bram Put it down! Whatever you\'re doing, put it down!']] },
  ],
  steps: [
    { id: 'morning', objective: 'Find Bram at the forge', mark: 'Bram',
      do: [{ mood: { name: 'day', secs: 0 } }, ...['earth', 'fire', 'water', 'air'].map(el => ({ setElement: { el, state: 'locked' } })), { hint: 'Bottom-left thumb: walk. Drag anywhere else: look around.' }],
      until: { signal: { obj: 'Zone_Forge', name: 'entered' } } },
    { id: 'bram',
      say: ['@Bram There you are. Dad\'s had me on the bellows since dawn.', '@Bram Festival tonight. Lanterns at the stone when the sun goes down.', '@Bram And then dancing. Don\'t pretend you won\'t.'],
      choices: [
        { label: 'I\'ll be there.', flag: { name: 'veyra.tone', value: 'earnest' }, say: ['@Bram Good. Save me the first bread off Mira\'s cart.'] },
        { label: 'Only if you dance first.', flag: { name: 'veyra.tone', value: 'teasing' }, say: ['@Bram Deal. You\'ll regret it.'] },
      ] },
    { id: 'village', objective: 'Walk to the square', until: { signal: { obj: 'Zone_Square', name: 'entered' } },
      then: { say: ['@Mira Oven\'s full. If anything burns tonight, let it be my bread and not my roof.'] } },
    { id: 'stone', objective: 'Go to the standing stone', mark: 'StandingStone', until: { signal: { obj: 'Zone_Stone', name: 'entered' } },
      then: { say: ['@Wynn Older than the valley, that stone.', '@Wynn My grandmother said it hums on harvest nights. Don\'t lean on it.',
                    '@Wynn Now go home and wash the forge off you. Lanterns at dark.'], do: [{ mood: { name: 'dusk', secs: 8 } }] } },
    { id: 'home', objective: 'Go home before the lanterns', mark: 'Veyra_House_Home', do: [{ checkpoint: true }],
      until: { signal: { obj: 'Zone_Home', name: 'entered' } } },
    { id: 'attack',
      // No powers yet, so no way to fight back: they can hurt, not kill (until Cael comes).
      do: [{ reveal: ['Flock'] }, { protect: 35 }, ...['Hollis', 'Tam', 'Mira', 'Wynn', 'Bram'].map(id => ({ npc: { id, role: 'cower' } }))],
      say: ['@Tam Emberwings! Get inside!'],
      objective: 'Get away from them',
      until: { time: 8 } },
    { id: 'awaken',
      // Far off, the stone cracks and everything answers at once. The first time you turn Fire on the birds near
      // home, the wild jet spills onto your own roof (flameSpill). If you never do, it catches anyway after 25 s.
      do: [{ do: { obj: 'StandingStone', action: 'crack' } }, ...['fire', 'earth', 'water', 'air'].map(el => ({ setElement: { el, state: 'wild' } })),
           { setFlag: { name: 'charm', value: 'none' } },
           { flameSpill: { target: 'Veyra_House_Home', radius: 9, after: 25 } },
           { npc: { id: 'Hollis', role: 'brigade' } }, { npc: { id: 'Tam', role: 'brigade' } }, { npc: { id: 'Bram', role: 'brigade' } },
           { hint: 'Something answers you. Touch a bird and hold: fire from your hands. Touch the well and drag: water.' }, { checkpoint: true }],
      say: ['@Tam The stone— did you hear the stone?'],
      objective: 'Drive them off. Save what you can.',
      waiting: [
        { when: { signal: { obj: 'Veyra_House_Home', name: 'burning' } }, say: ['@Tam Your roof! The fire— it came off you—', '@Hollis Buckets! To the well!'] },
        { when: { many: { prefix: 'Veyra_', type: 'timber_house', signal: 'burning', min: 2 } }, say: ['@Bram It\'s spreading! The roofs!'] },
        { when: { ledger: { tally: 'harm', min: 3 } }, say: ['@Mira It came out of you! The fire came out of you!'] },
        { when: { ledger: { tally: 'care', min: 2 } }, say: ['@Hollis Keep it coming! Whatever you are, keep it coming!'] },
        { when: { signal: { obj: 'Flock', name: 'gone' } }, say: ['@Tam The birds are gone!'] },
      ],
      ends: [
        { when: { all: [{ signal: { obj: 'Flock', name: 'gone' } }, HOUSES, BARNS, { time: 8 }] }, next: 'cael' },
        { when: { time: 150 }, next: 'cael' },
      ] },
    { id: 'cael',
      do: [{ reveal: ['Cael'] }, { protect: 0 }, { douseAll: { by: 'cael' } }, { mood: { name: 'night', secs: 6 } },
           { npc: { id: 'Hollis', role: 'idle' } }, { npc: { id: 'Tam', role: 'idle' } }, { npc: { id: 'Bram', role: 'idle' } }, { npc: { id: 'Mira', role: 'idle' } }, { npc: { id: 'Wynn', role: 'idle' } }],
      say: ['@Cael Enough.', '@Cael Stand still. Breathe. It answers you, so it stops when you do.'],
      mark: 'Cael',
      until: { talking: false } },
    { id: 'damage', ends: [
      { when: { many: { prefix: 'Veyra_', type: 'timber_house', signal: 'burned', min: 3 } }, say: ['@Wynn Half the village. In one night.', '@Mira My ovens. My house.'], do: [{ setFlag: { name: 'veyra.fire', value: 'ruin' } }] },
      { when: { many: { prefix: 'Veyra_', type: 'timber_house', signal: 'burned', min: 1 } }, say: ['@Wynn We lost some. We kept more.'], do: [{ setFlag: { name: 'veyra.fire', value: 'some' } }] },
      { when: { time: 0 }, say: ['@Wynn Not one roof lost. I don\'t know how.'], do: [{ setFlag: { name: 'veyra.fire', value: 'none' } }] } ] },
    { id: 'barn', ends: [
      { when: { signal: { obj: 'Veyra_Barn_Holloway', name: 'burned' } }, say: ['@Bram The barn\'s gone. Dad\'s forge is standing. That\'s something.'], do: [{ setFlag: { name: 'bram.barn', value: 'burned' } }] },
      { when: { time: 0 }, say: ['@Bram You kept it off our barn. I saw you.'], do: [{ setFlag: { name: 'bram.barn', value: 'saved' } }] } ] },
    { id: 'blame', ends: [
      { when: { ledger: { tally: 'harm', min: 4 } }, say: ['@Mira I saw it come out of you. I saw it.'], do: [{ setFlag: { name: 'veyra.blame', value: 'you' } }] },
      { when: { ledger: { tally: 'care', min: 2 } }, say: ['@Tam It started on your roof. I saw that.', '@Tam I saw you at the well after, too.'], do: [{ setFlag: { name: 'veyra.blame', value: 'forgiven' } }] },
      { when: { time: 0 }, say: ['@Hollis Birds. Fire. A stone that breaks. I don\'t know what I saw tonight.'], do: [{ setFlag: { name: 'veyra.blame', value: 'unsure' } }] } ] },
    { id: 'charm',
      say: ['@Cael Here.', '@Cael Old silver. Older than me. It quiets whatever in you hasn\'t learned to listen yet.',
            '@Cael Wear it, and what\'s wild in you goes still. What I teach you will still answer.', '@Cael Or don\'t. But what\'s in you won\'t wait until you\'re ready.'],
      choices: [
        { label: 'Put it on.', flag: { name: 'charm', value: 'worn' }, say: ['@Cael It isn\'t a cage. It\'s a quiet room.'] },
        { label: 'Not yet.', flag: { name: 'charm', value: 'refused' }, say: ['@Cael Then keep it close. The day you want it, put it on.'] },
      ] },
    { id: 'choice', say: ['@Cael You can\'t stay in the village tonight. Not like this.'],
      choices: [
        { label: 'Help clear the ashes first.', flag: { name: 'veyra.after', value: 'help' }, do: [{ ledger: { tally: 'care', add: 2 } }], say: ['@Cael Good. Then we go.'] },
        { label: 'Find the birds that did this.', flag: { name: 'veyra.after', value: 'hunt' }, say: ['@Cael They\'re long gone. Out there you\'d only find more fire.'] },
        { label: '(Say nothing.)', flag: { name: 'veyra.after', value: 'silent' }, say: ['@Cael Then walk with me. Silence is fine.'] },
      ] },
    { id: 'prophecy',
      say: ['@Cael My name is Cael. I read old stones for a living.', '@Cael That one cracked tonight. So did something in you.',
            '@Cael There\'s a verse on the oldest of them. Two. One who saves the world. One who changes it.',
            '@Cael I came here following the stones. I didn\'t expect to find a person.', '@Cael Fire is the loudest thing in you. I\'ll teach you something quieter first.'],
      do: [{ setElement: { el: 'earth', state: 'trained' } }, { setFlag: { name: 'prologue', value: 'done' } }],
      until: { talking: false },
      then: { do: [{ travel: { scene: 'lesson1', at: 'start' } }] } },
  ],
  card: null,
};
const veyra = {
  format: 1, id: 'veyra', name: 'Prologue · The Veyra Fire',
  settings: { ground: { half: 30, style: 'grass' }, profile: 'story', resetProgress: true, resetAfter: 0, region: 'verdant', persistent: true, mood: 'day' },
  objects: o, wires: [], script,
};
fs.writeFileSync('scenes/veyra.json', JSON.stringify(veyra, null, 1) + '\n');
// Lesson I follows the prologue now: it no longer starts the story over.
const L = JSON.parse(fs.readFileSync('scenes/lesson1.json', 'utf8'));
L.settings.resetProgress = false;
fs.writeFileSync('scenes/lesson1.json', JSON.stringify(L, null, 1) + '\n');
