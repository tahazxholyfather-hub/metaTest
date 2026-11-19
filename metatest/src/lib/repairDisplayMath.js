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

// Commands typists actually write. A fragment is joined back only when the
// part before the break is not itself one of these, so `\in t` stays put
// while a broken `\cdo t` becomes `\cdot`.
const TEX_COMMANDS = new Set([
    'alpha', 'angle', 'approx', 'beta', 'binom', 'bullet', 'cap', 'cdot', 'cdotp', 'cdots',
    'ce', 'celsius', 'chi', 'circ', 'color', 'cong', 'cos', 'cot', 'csc', 'cup',
    'Delta', 'delta', 'div', 'ddot', 'ddots', 'degree', 'dot', 'epsilon', 'equiv', 'eta',
    'exists', 'exp', 'forall', 'frac', 'Gamma', 'gamma', 'ge', 'geq', 'hat', 'infty',
    'in', 'int', 'iota', 'kappa', 'lambda', 'Lambda', 'ldots', 'left', 'leq', 'lim',
    'ln', 'log', 'mathbf', 'mathit', 'mathrm', 'mathsf', 'mp', 'mu', 'nabla', 'ne',
    'neq', 'ni', 'nu', 'Omega', 'omega', 'operatorname', 'overline', 'partial', 'Phi', 'phi',
    'Pi', 'pi', 'pm', 'prod', 'propto', 'Psi', 'psi', 'pu', 'qquad', 'quad',
    'rho', 'right', 'Rightarrow', 'rightarrow', 'sigma', 'Sigma', 'sim', 'sin', 'sqrt', 'sum',
    'tan', 'tau', 'text', 'textcolor', 'theta', 'Theta', 'times', 'to', 'underline', 'varepsilon',
    'varphi', 'vartheta', 'vdots', 'vec', 'Xi', 'xi', 'zeta',
]);

// Word splits a command across runs. A zero-width mark or a space in the
// middle makes TeX read `\cdo` and paint those letters red, then the leftover
// `t` of `\cdot`.
function rejoinSplitCommands(text) {
    return text.replace(
        /\\([A-Za-z]+)([\u200b\u200c\u200d\u200e\u200f\u2060\ufeff\u00ad \t]+)([A-Za-z]+)/g,
        (match, left, gap, right) => {
            if (TEX_COMMANDS.has(left)) return match;
            for (let n = 1; n <= right.length; n += 1) {
                const joined = left + right.slice(0, n);
                if (!TEX_COMMANDS.has(joined)) continue;
                const rest = right.slice(n);
                const space = rest && /[ \t]/.test(gap) ? ' ' : '';
                return `\\${joined}${space}${rest}`;
            }
            return match;
        },
    );
}

function repairDisplayMath(text) {
    let out = rejoinSplitCommands(flattenWordMacros(String(text || '')));
    out = out.replace(/(?<!\$)\$\s*\\ce\s*\$(?!\$)/g, '');
    // `\ce` only when it is the whole command. `\celsius` continues with more
    // letters and must stay; a bare `\ce` is what draws the yellow error box.
    out = out.replace(/\\ce(?![A-Za-z])(?!\s*\{)/g, '');
    out = out.replace(/\\ce\{\s*\}/g, '');
    out = out.replace(/\$\$[\s\S]*?\$\$|(?<!\$)\$(?!\$)([^$]*)\$(?!\$)/g, (all, inner) => {
        if (all.startsWith('$$')) return all;
        return inner && inner.trim() ? all : '';
    });
    return out;
}

export { repairDisplayMath };
