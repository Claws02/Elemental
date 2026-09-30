// ============================================================
// WHEN — the `showWhen` conditions on scene objects (schema.js)
// ============================================================
//
// "seal.earth, !veyra.rebuilt, state:Veyra_Barn=burned" → all must hold.
// `lookup(name)` answers a story flag; `state(id)` a remembered world state.
// Pure: the loader, the validator and the editor all use it.
// ============================================================

export function parseWhen(expr) {
    return String(expr || '').split(',').map(t => t.trim()).filter(Boolean).map(t => {
        const not = t.startsWith('!');
        const body = not ? t.slice(1).trim() : t;
        const m = body.match(/^(state:)?([\w.-]+)(?:=(.+))?$/);
        if (!m) return { bad: t };
        return { not, state: !!m[1], name: m[2], value: m[3] === undefined ? undefined : m[3].trim() };
    });
}

export function whenHolds(expr, { flag = () => undefined, state = () => null } = {}) {
    for (const c of parseWhen(expr)) {
        if (c.bad) return false;
        const v = c.state ? state(c.name) : flag(c.name);
        const ok = c.value === undefined ? !!v : String(v) === c.value;
        if (ok === c.not) return false;
    }
    return true;
}
