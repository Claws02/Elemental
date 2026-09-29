// ============================================================
// WIRES — puzzle logic between objects (docs/SCENES.md)
// ============================================================
//
// A wire watches object SIGNALS and, when they hold, runs ACTIONS:
//
//   { id: 'Gate', mode: 'all',                      all inputs, or 'any'
//     inputs: [{ obj: 'WeightL', signal: 'weighted' }, …],
//     do:     [{ obj: 'Barricade', action: 'raise' }],
//     undo:   [{ obj: 'Gate', action: 'close' }],   when it stops holding (optional)
//     once:   true }                                 fire only the first time
//
// A wire is LIVE while its inputs hold; the script can wait on that too
// ({ wire: 'Gate' }). Actions run on the edge, not every frame.
// ============================================================

export class Wires {
    constructor(world, wires) {
        this.world = world;
        this.list = wires.map(w => ({ ...w, live: false, fired: 0 }));
    }

    isLive(id) { return !!this.list.find(w => w.id === id)?.live; }

    update() {
        for (const w of this.list) {
            const ins = w.inputs || [];
            const test = i => this.world.signal(i.obj, i.signal);
            const live = ins.length > 0 && (w.mode === 'any' ? ins.some(test) : ins.every(test));
            if (live === w.live) continue;
            w.live = live;
            if (live && (!w.once || !w.fired)) { w.fired++; this._run(w.do); }
            else if (!live && w.undo && !w.once) this._run(w.undo);
        }
    }

    _run(actions = []) {
        for (const a of actions) if (a.obj && a.action) this.world.act(a.obj, a.action);
    }
}
