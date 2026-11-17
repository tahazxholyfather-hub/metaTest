// Word and some typed chemistry leave formulas as \text{H} or a bare \ce.
// \text{H} shows up as the command itself until it is unwrapped. A \ce with
// no {formula} is the yellow "Missing argument for \ce" box.

function flattenWordMacros(text) {
    const pattern = /\\(?:text|mathrm|mbox|operatorname)\{([^{}]*)\}/g;
    let out = text;
    let previous = '';
    while (out !== previous) {
        previous = out;
        out = out.replace(pattern, '$1');
    }
    return out;
}

function repairDisplayMath(text) {
    let out = flattenWordMacros(String(text || ''));
    out = out.replace(/(?<!\$)\$\s*\\ce\s*\$(?!\$)/g, '');
    out = out.replace(/\\ce(?!\s*\{)/g, '');
    out = out.replace(/\\ce\{\s*\}/g, '');
    out = out.replace(/\$\$[\s\S]*?\$\$|(?<!\$)\$(?!\$)([^$]*)\$(?!\$)/g, (all, inner) => {
        if (all.startsWith('$$')) return all;
        return inner && inner.trim() ? all : '';
    });
    return out;
}

export { repairDisplayMath };
