// Word and some typed chemistry leave formulas as \text{H} or a bare \ce.
// \text{H} shows up as the command itself until it is unwrapped. A \ce with
// no {formula} is the yellow "Missing argument for \ce" box.
// A command split across Word runs, such as \cdo + t, is drawn in red.

const INVISIBLE = '\\u200b\\u200c\\u200d\\u200e\\u200f\\u202a\\u202b\\u202c\\u202d\\u202e\\u2060\\u2066\\u2067\\u2068\\u2069\\ufeff\\u00ad\\u180e';
const GAP = `[${INVISIBLE}\\s]+`;
const GAP_RE = new RegExp(GAP);

// Names MathJax actually treats as one command. A fragment is glued back only
// when the completed name is here. `\in` and `\to` are included so `\in t`
// and `\to p` stay two tokens.
const TEX_COMMANDS = new Set([
    'Delta', 'Gamma', 'Lambda', 'Leftarrow', 'Leftrightarrow', 'Omega', 'Phi', 'Pi', 'Psi',
    'Rightarrow', 'Sigma', 'Theta', 'Upsilon', 'Xi', 'alpha', 'angle', 'approx', 'arccos',
    'arcsin', 'arctan', 'ast', 'bar', 'because', 'beta', 'binom', 'boldsymbol', 'bullet',
    'cancel', 'cap', 'cdot', 'cdotp', 'cdots', 'ce', 'celsius', 'chi', 'circ', 'color',
    'cong', 'cos', 'cosh', 'cot', 'csc', 'cup', 'curl', 'dd', 'ddot', 'ddots', 'degree',
    'delta', 'det', 'dfrac', 'dim', 'div', 'dot', 'downarrow', 'dv', 'ell', 'epsilon',
    'equiv', 'eta', 'exists', 'exp', 'forall', 'frac', 'gamma', 'gcd', 'ge', 'geq',
    'gets', 'gg', 'grad', 'hat', 'hbar', 'iff', 'implies', 'in', 'inf', 'infty', 'int',
    'iota', 'kappa', 'lambda', 'land', 'langle', 'lceil', 'ldots', 'le', 'left',
    'leftarrow', 'leftrightarrow', 'leq', 'lfloor', 'lg', 'lim', 'liminf', 'limsup',
    'll', 'ln', 'log', 'longleftarrow', 'longleftrightarrow', 'longrightarrow', 'lor',
    'mapsto', 'mathbf', 'mathcal', 'mathfrak', 'mathit', 'mathrm', 'mathsf', 'max',
    'mbox', 'min', 'mp', 'mu', 'nabla', 'ne', 'neq', 'ni', 'notin', 'nu', 'odot',
    'oint', 'omega', 'ominus', 'oplus', 'operatorname', 'otimes', 'overbrace',
    'overleftarrow', 'overline', 'overrightarrow', 'parallel', 'partial', 'pdv',
    'perp', 'phi', 'pi', 'pm', 'pmod', 'prime', 'prod', 'propto', 'psi', 'pu',
    'qquad', 'quad', 'rangle', 'rceil', 'rho', 'right', 'rightarrow', 'rfloor',
    'rightleftharpoons', 'rvert', 'sec', 'setminus', 'sigma', 'sim', 'simeq', 'sin',
    'sinh', 'sqrt', 'subseteq', 'subset', 'sum', 'supset', 'supseteq', 'tan', 'tanh',
    'tau', 'text', 'textcolor', 'textbf', 'textit', 'textrm', 'tfrac', 'theta',
    'therefore', 'tilde', 'times', 'to', 'underbrace', 'underline', 'uparrow',
    'upsilon', 'varepsilon', 'varphi', 'vartheta', 'vdots', 'vec', 'vee', 'wedge',
    'widehat', 'widetilde', 'xcancel', 'xi', 'xleftarrow', 'xrightarrow', 'zeta',
    'lvert',
]);

function joinRest(pieces, from) {
    let out = '';
    for (let i = from; i < pieces.length; i += 1) out += ` ${pieces[i]}`;
    return out;
}

// Longest completion wins inside one run (`\cdo ts` is `\cdots`, not `\cdot` + s).
// A known command grows only by two or more letters, so `\in t` is not `\int`.
function assemble(pieces) {
    const left = pieces[0];
    if (TEX_COMMANDS.has(left)) {
        const word = pieces[1] || '';
        let best = 0;
        for (let n = 2; n <= word.length; n += 1) {
            if (TEX_COMMANDS.has(left + word.slice(0, n))) best = n;
        }
        if (!best) return left + joinRest(pieces, 1);
        const rest = word.slice(best);
        return left + word.slice(0, best) + (rest ? ` ${rest}` : '') + joinRest(pieces, 2);
    }

    let acc = left;
    for (let i = 1; i < pieces.length; i += 1) {
        const word = pieces[i];
        let best = 0;
        for (let n = 1; n <= word.length; n += 1) {
            if (TEX_COMMANDS.has(acc + word.slice(0, n))) best = n;
        }
        if (!best) {
            acc += word;
            continue;
        }
        const rest = word.slice(best);
        return acc + word.slice(0, best) + (rest ? ` ${rest}` : '') + joinRest(pieces, i + 1);
    }
    return pieces.join(' ');
}

function rejoinSplitCommands(text) {
    const splitCommand = new RegExp(`\\\\[A-Za-z]+(?:${GAP}[A-Za-z]+)+`, 'g');
    return text.replace(splitCommand, (match) => {
        const pieces = match.slice(1).split(GAP_RE);
        if (pieces.some((piece) => !piece)) return match;
        return `\\${assemble(pieces)}`;
    });
}

function flattenWordMacros(text) {
    const pattern = /\\(?:text|mathrm|mbox|operatorname|textbf|textit|textrm)\{([^{}]*)\}/g;
    let out = text;
    let previous = '';
    while (out !== previous) {
        previous = out;
        out = out.replace(pattern, '$1');
    }
    return out;
}

function repairDisplayMath(text) {
    let out = rejoinSplitCommands(String(text || ''));
    // A zero-width mark between a command and its brace is not an argument.
    out = out.replace(
        new RegExp(`(\\\\[A-Za-z]+)[${INVISIBLE}]+(?=[{\\[])`, 'g'),
        '$1',
    );
    out = flattenWordMacros(out);
    // The same mark between _ or ^ and the digit is the red missing-script box.
    out = out.replace(new RegExp(`([_^])[${INVISIBLE}\\s]+`, 'g'), '$1');
    out = out.replace(/(?<!\$)\$\s*\\ce\s*\$(?!\$)/g, '');
    // `\ce` only when it is the whole command. `\celsius` continues with more
    // letters and must stay; a bare `\ce` is what draws the yellow error box.
    out = out.replace(
        new RegExp(`\\\\ce(?![A-Za-z])(?![${INVISIBLE}\\s]*\\{)`, 'g'),
        '',
    );
    out = out.replace(/\\ce\{\s*\}/g, '');
    out = out.replace(/\$\$[\s\S]*?\$\$|(?<!\$)\$(?!\$)([^$]*)\$(?!\$)/g, (all, inner) => {
        if (all.startsWith('$$')) return all;
        return inner && inner.trim() ? all : '';
    });
    return out;
}

export { repairDisplayMath };
