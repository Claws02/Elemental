// ============================================================
// EVENT BUS — every meaningful action becomes a world event (§40)
// ============================================================
//
// Phase 1 only needs the bus itself: the destruction system emits events and
// the debug HUD listens. NPC memory, reputation and quests (later phases)
// subscribe to the same events, so gameplay code never needs to know they
// exist. That is the whole point of routing consequence through events.
//
// An event is { type, id?, cause, pos?, t, ...detail }. `t` is seconds of
// game time, stamped here so every emitter agrees.
// ============================================================

const _subs = new Map();   // type -> Set(fn); '*' hears everything
const _log = [];
const LOG_MAX = 200;
let _clock = 0;

export const EventBus = {
    on(type, fn) {
        if (!_subs.has(type)) _subs.set(type, new Set());
        _subs.get(type).add(fn);
        return () => _subs.get(type)?.delete(fn);
    },

    emit(type, detail = {}) {
        const ev = { type, t: _clock, ...detail };
        _log.push(ev);
        if (_log.length > LOG_MAX) _log.shift();
        for (const key of [type, '*']) {
            _subs.get(key)?.forEach(fn => {
                try { fn(ev); } catch (e) { console.error('[EventBus] listener for', type, 'threw', e); }
            });
        }
        return ev;
    },

    /** Advance game time. Called once a frame by the loop. */
    tick(dt) { _clock += dt; },

    /** Forget every listener and event (a new game in the same page: the editor's Play). */
    reset() { _subs.clear(); _log.length = 0; _clock = 0; },

    /** The most recent events, oldest first (debug and QA). */
    recent(n = LOG_MAX) { return _log.slice(-n); },
};

// The event names in use, so a typo is a reference error, not a silent miss.
export const EV = {
    OBJECT_GRABBED:     'ObjectGrabbed',
    OBJECT_THROWN:      'ObjectThrown',
    STRUCTURE_DAMAGED:  'StructureDamaged',
    STRUCTURE_STATE:    'StructureStateChanged',
    PIECE_BROKEN:       'PieceBroken',
    FIRE_STARTED:       'FireStarted',
    FIRE_OUT:           'FireOut',
    OBJECT_HEATED:      'ObjectHeated',
    OBJECT_SOAKED:      'ObjectSoaked',
    WATER_DRAWN:        'WaterDrawn',
    FIRE_FANNED:        'FireFanned',
    WIND:               'Wind',
    EXPLOSION:          'Explosion',
    GROWTH:             'Growth',
    WILD_BURST:         'WildBurst',
    SURGE:              'Surge',
    EARTH_RAISED:       'EarthRaised',
    ICE:                'Ice',
    ICE_BROKEN:         'IceBroken',
    FROZEN:             'Frozen',
    MOLTEN:             'Molten',
    LAVA:               'Lava',
    LAVA_COOLED:        'LavaCooled',
    FIRESTORM:          'Firestorm',
    MUD:                'Mud',
    GLIDE:              'Glide',
    FLAME_SPILL:        'FlameSpill',
    DOOR:               'Door',
    ALARM:              'Alarm',
    CHARM:              'Charm',
    LESSON:             'Lesson',
    PLATE:              'Plate',
    TOO_HEAVY:          'TooHeavy',
    LEDGER:             'Ledger',
    STONE_TOUCHED:      'StoneTouched',
    TALK:               'Talk',            // { id, n }: the player talked to someone (the n-th time)    // { id, cracked }: the hero laid a hand on a standing stone
    LANDMARK:           'Landmark',        // { id, name, to, region }: a ruler's hall or the palace brought down by the player
    CREATURE:           'Creature',
    HURT:               'Hurt',
    DIED:               'Died',
    CHECKPOINT:         'Checkpoint',
    WORLD_STATE:        'WorldState',
};
