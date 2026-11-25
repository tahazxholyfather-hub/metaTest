const BLOCKED_BLOCK = /<\s*(script|iframe|object|embed|link|meta|base|form|svg)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const BLOCKED_SINGLE = /<\s*\/?\s*(script|iframe|object|embed|link|meta|base|form|svg)\b[^>]*>/gi;
const EVENT_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const STYLE_ATTR = /\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL = /(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi;

/** Strip active content from question HTML without removing math markup. */
export function sanitizeQuestionHtml(input: string): string {
    if (!input) return '';
    return String(input)
        .replace(BLOCKED_BLOCK, '')
        .replace(BLOCKED_SINGLE, '')
        .replace(EVENT_ATTR, '')
        .replace(STYLE_ATTR, '')
        .replace(JS_URL, '$1=$2#$2');
}

const NAMED: Record<string, string> = {
    nbsp: ' ',
    lt: '<',
    gt: '>',
    amp: '&',
    quot: '"',
    apos: "'",
    zwnj: '',
    zwj: '',
    lrm: '',
    rlm: '',
};

/** Decode entities without parsing the string as HTML. */
export function decodeHtmlEntities(text: string): string {
    if (!text) return '';
    return String(text)
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/&([a-z]+);/gi, (match, name: string) => (name.toLowerCase() in NAMED ? NAMED[name.toLowerCase()] : match))
        .replace(/[\u200c\u200d\u200e\u200f\ufeff]/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
}
