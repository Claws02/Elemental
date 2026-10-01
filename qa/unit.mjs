// ============================================================
// UNIT — the core systems that need no browser: saves, the ledger, the
// scene conditions. Fast; runs in node.
//
// usage: node qa/unit.mjs
// ============================================================

// A localStorage for node.
const mem = new Map();
globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };

const { Session, readSlot, writeSlot, listSlots, blankSave, migrate, SAVE_VERSION } = await import('../src/core/SaveGame.js');
const { Ledger } = await import('../src/core/Ledger.js');
const { EventBus, EV } = await import('../src/core/EventBus.js');
const { whenHolds, parseWhen } = await import('../src/scene/when.js');
const { Progression } = await import('../src/core/Progression.js');

const pass = [], fail = [];
const check = (ok, msg) => (ok ? pass : fail).push(msg);

// ---- saves ---------------------------------------------------------------------------
{
    const s = new Session(1, null);
    s.work.progress.flags.met = true;
    s.setState('Barn', 'burned');
    s.checkpoint({ scene: 'veyra', spawn: { x: 1, z: 2, facing: 0 }, step: 'fire' });
    const r = readSlot(1);
    check(r && r.save.world.Barn === 'burned' && r.save.progress.flags.met === true && r.save.checkpoint.step === 'fire', 'a checkpoint writes flags, world state and where to return to the slot');

    s.setState('Barn', 'rebuilt');
    s.work.progress.flags.met = false;
    const cp = s.restore();
    check(s.state('Barn') === 'burned' && s.work.progress.flags.met === true && cp.scene === 'veyra', 'dying goes back to the checkpoint: what happened since is forgotten');

    // A damaged save falls back to its backup.
    s.checkpoint();                                     // a second write: the first becomes .bak
    localStorage.setItem('elemental.save.1', '{not json');
    const rec = readSlot(1);
    check(rec?.recovered === true && rec.save.world.Barn === 'burned', 'a corrupted save recovers from its backup');
    localStorage.setItem('elemental.save.1.bak', '{"version":2}');
    check(readSlot(1) === null, 'a save and backup both damaged: treated as empty (a new game), not a crash');
}
{
    mem.clear();
    localStorage.setItem('elemental.progress', JSON.stringify({ version: 1, els: { earth: { state: 'trained', power: 0.3, control: 0.6 } }, flags: { lesson1: { outcome: 'quiet' } } }));
    const r = readSlot(1);
    check(r?.migrated && r.save.version === SAVE_VERSION && r.save.progress.flags.lesson1.outcome === 'quiet' && r.save.progress.els.earth.control === 0.6, 'the old single save migrates into slot 1');
    check(migrate({ version: 99 }) === null && migrate('x') === null, 'an unknown save version is refused, not guessed');
    const slots = listSlots();
    check(slots.length === 3 && !slots[0].empty && slots[1].empty, `three slots listed (${slots.map(x => (x.empty ? '-' : x.slot)).join(' ')})`);
}
{
    mem.clear();
    const s = new Session(2, null, { persist: false });
    s.checkpoint();
    check(readSlot(2) === null, 'a non-persistent session (sandbox, QA) never writes');
}

// ---- progression lives in the session ---------------------------------------------------------
{
    mem.clear();
    EventBus.reset();
    const s = new Session(1, null);
    const p = new Progression('story', { session: s });
    p.grant('earth', 'control', 0.25, 'test');
    p.flags.caelTrust = 2;
    s.checkpoint();
    const s2 = new Session(1, readSlot(1).save);
    const p2 = new Progression('story', { session: s2 });
    check(p2.control('earth') === 0.25 && p2.flags.caelTrust === 2 && p2.state('water') === 'locked', 'Power, Control and flags survive a save and load');
    const sb = new Progression('sandbox', { session: s2 });
    sb.grant('earth', 'control', -1);
    const p3 = new Progression('story', { session: s2 });
    check(sb.state('water') === 'trained' && sb.power('earth') === 1 && p3.control('earth') === 0.25 && p3.state('water') === 'locked', 'the sandbox neither reads nor writes the story save');
}

// ---- the ledger ---------------------------------------------------------------------------------------
{
    EventBus.reset();
    const s = new Session(0, null, { persist: false });
    const owners = { Barn: 'civilian', Dummy: 'none' };
    const L = new Ledger(s, 'verdant', id => owners[id] || 'none');
    EventBus.emit(EV.FIRE_STARTED, { id: 'Barn', cause: 'player' });
    EventBus.emit(EV.FIRE_STARTED, { id: 'Dummy', cause: 'player' });
    EventBus.emit(EV.FIRE_STARTED, { id: 'Barn', cause: 'environment' });
    check(L.get('harm') === 0.5, `only the player's harm to things someone owns counts (harm ${L.get('harm')})`);
    EventBus.emit(EV.FIRE_OUT, { id: 'Barn', cause: 'player', doused: true });
    check(L.get('care') === 0.5, 'putting it out counts as care');
    for (let i = 0; i < 6; i++) EventBus.emit(EV.PIECE_BROKEN, { id: 'Barn_P0' + i, cause: 'player' });
    check(L.get('harm') === 6.5 && L.get('excess') === 1, `many pieces smashed at once is excess (harm ${L.get('harm')}, excess ${L.get('excess')})`);
    check(L.standingWord() === 'the cause of all this' || L.standingWord() === 'dangerous', `a kingdom you've harmed sees you as ${L.standingWord()}`);
    L.add('care', 20);
    check(L.standingWord() === 'saviour', `…and care can win it back (${L.standingWord()})`);
    check(L.get('harm', 'saltmere') === 0 && L.standing('saltmere') === 2, 'each kingdom keeps its own book; a stranger is "unpredictable"');
    check(L.chaos() > 7, `chaos adds up harm and excess everywhere (${L.chaos()})`);
    EventBus.emit(EV.CREATURE, { cause: 'player', to: 'fled' });
    check(L.get('spared') === 1, 'a creature driven off is counted as spared');
}

// ---- scene conditions -------------------------------------------------------------------------------------
{
    const flags = { 'seal.earth': true, act: 2 }, states = { Barn: 'burned' };
    const ctx = { flag: n => flags[n], state: id => states[id] };
    check(whenHolds('', ctx) && whenHolds('seal.earth', ctx) && !whenHolds('!seal.earth', ctx), 'showWhen: a flag, and its opposite');
    check(whenHolds('act=2, state:Barn=burned', ctx) && !whenHolds('act=3', ctx) && !whenHolds('state:Barn=rebuilt', ctx), 'showWhen: values and remembered world states, all must hold');
    check(parseWhen('good, ba d').some(c => c.bad), 'showWhen: nonsense is reported, not guessed');
}

// ---- Cael's charm -------------------------------------------------------------------------------------
{
    EventBus.reset();
    const s = new Session(3, null, { persist: false });
    const p = new Progression('story', { session: s });
    for (const el of ['fire', 'water', 'air']) p.setState(el, 'wild');
    p.setState('earth', 'trained');
    check(p.has('fire') && p.has('water') && p.has('earth'), 'without the charm, wild elements answer');
    p.flags.charm = 'worn';
    check(!p.has('fire') && !p.has('water') && !p.has('air') && p.has('earth') && p.live('fire') === 'locked' && p.state('fire') === 'wild',
        'the charm stills what is wild; what Cael has trained still answers');
    p.setState('fire', 'trained');
    check(p.has('fire'), 'an element trained under the charm comes back');
    // A surge is the player's: the ledger counts it (the awakening's doesn't).
    const L = new Ledger(s, 'verdant', () => 'civilian');
    EventBus.emit(EV.SURGE, { el: 'earth', cause: 'surge', hurt: ['Mira', 'Tam'] });
    EventBus.emit(EV.FIRE_STARTED, { id: 'Veyra_House_Tam_R0', cause: 'surge' });
    EventBus.emit(EV.FIRE_STARTED, { id: 'Veyra_House_Home_R0', cause: 'awakening' });
    check(L.get('harm') === 2.5, `a surge that hurts people and lights a roof is harm; the awakening's fire isn't (${L.get('harm')})`);
    L.dispose();
    // Abilities: their elements usable, and learned in the story.
    p.flags.charm = 'refused';
    const before = p.can('raise');
    p.flags['learned.raise'] = true;
    check(!before && p.can('raise') && !p.can('lava'), 'in the story an ability needs learning; a combination needs both its elements usable too');
    const sb = new Progression('sandbox');
    check(['raise', 'freeze', 'lava', 'firestorm', 'mud', 'glide'].every(a => sb.can(a)), 'the sandbox knows every ability');
}

// ---- the building list in the schema matches the prefabs -----------------------------------------------
{
    const { PREFABS } = await import('../src/data/prefabs.js');
    const { TYPES } = await import('../src/scene/schema.js');
    const listed = TYPES.prefab.props.prefab.options || TYPES.prefab.props.prefab.values || [];
    const names = Object.keys(PREFABS);
    check(names.every(n => listed.includes(n)) && listed.every(n => names.includes(n)), `every prefab building is in the schema's list, and only those (${names.length})`);
    const bad = names.flatMap(n => PREFABS[n].pieces.filter(p => !TYPES[p.type]).map(p => `${n}:${p.type}`));
    check(bad.length === 0, `every prefab piece is a known type${bad.length ? ': ' + bad.join(', ') : ''}`);
}

// ---- creature tiers: the world fills in as the hero grows -------------------------------------------
{
    const { SPECIES, TIERS, tierFor } = await import('../src/data/creatures.js');
    const story = new Progression('story', { session: null });
    const sandbox = new Progression('sandbox', { session: null });
    const fresh = story.might(), full = sandbox.might();
    story.els.earth.power = 0.6; story.els.earth.control = 0.5; story.els.water.state = 'trained'; story.els.water.power = 0.4;
    const grown = story.might();
    story.flags.charm = 'worn';
    const charmed = story.might();
    const allTiered = Object.entries(SPECIES).every(([, s]) => s.tier >= 1 && s.tier <= 4 && typeof s.young === 'boolean');
    check(tierFor(fresh) === 1 && tierFor(grown) === 2 && tierFor(full) === 4 && charmed === grown && allTiered && TIERS[1] === 0,
        `creature tiers: a new hero faces tier 1, a grown one more, the sandbox everything; the charm doesn't lower it (${JSON.stringify({ fresh: +fresh.toFixed(2), grown: +grown.toFixed(2), full, tiers: [tierFor(fresh), tierFor(grown), tierFor(full)] })})`);
}

console.log(pass.map(p => '  ok   ' + p).join('\n'));
if (fail.length) { console.log(fail.map(p => '  FAIL ' + p).join('\n')); console.log('UNIT FAIL'); process.exit(1); }
console.log('UNIT PASS');
