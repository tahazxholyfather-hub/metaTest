'use strict';

// Question display settings. One sparse document:
//   code defaults for that surface, then `base`, then that surface's overrides.
// An empty document keeps today's practice, exam, and review looks.

const SURFACES = ['practice', 'exam', 'examReview'];
const VERSION = 1;
const WEIGHTS = [500, 600, 700];

const CATALOG = [
    {
        block: 'stem',
        label: 'متن سوال',
        fields: [
            { key: 'fontSizeMobile', label: 'سایز موبایل', min: 14, max: 28, step: 1, unit: 'px' },
            { key: 'fontSizeDesktop', label: 'سایز دسکتاپ', min: 14, max: 28, step: 1, unit: 'px' },
            { key: 'weight', label: 'وزن', kind: 'weight' },
            { key: 'lineHeight', label: 'فاصله خط', min: 1.3, max: 2.6, step: 0.05 },
        ],
    },
    {
        block: 'options',
        label: 'گزینه‌ها',
        fields: [
            { key: 'fontSizeMobile', label: 'سایز موبایل', min: 12, max: 22, step: 1, unit: 'px' },
            { key: 'fontSizeDesktop', label: 'سایز دسکتاپ', min: 12, max: 22, step: 1, unit: 'px' },
            { key: 'weight', label: 'وزن', kind: 'weight' },
            { key: 'lineHeight', label: 'فاصله خط', min: 1.3, max: 2.6, step: 0.05 },
        ],
    },
    {
        block: 'explanation',
        label: 'پاسخ تشریحی',
        fields: [
            { key: 'fontSizeMobile', label: 'سایز موبایل', min: 13, max: 24, step: 1, unit: 'px' },
            { key: 'fontSizeDesktop', label: 'سایز دسکتاپ', min: 13, max: 24, step: 1, unit: 'px' },
            { key: 'weight', label: 'وزن', kind: 'weight' },
            { key: 'lineHeight', label: 'فاصله خط', min: 1.3, max: 2.6, step: 0.05 },
        ],
    },
    {
        block: 'image',
        label: 'تصویر سوال',
        fields: [
            { key: 'maxHeightMobile', label: 'حداکثر ارتفاع موبایل', min: 80, max: 1200, step: 8, unit: 'px' },
            { key: 'maxHeightDesktop', label: 'حداکثر ارتفاع دسکتاپ', min: 80, max: 1200, step: 8, unit: 'px' },
            { key: 'maxWidthMobile', label: 'حداکثر عرض موبایل', min: 80, max: 800, step: 8, unit: 'px' },
            { key: 'maxWidthDesktop', label: 'حداکثر عرض دسکتاپ', min: 80, max: 800, step: 8, unit: 'px' },
        ],
    },
    {
        block: 'layout',
        label: 'چیدمان',
        fields: [
            { key: 'stemGapMobile', label: 'فاصله سوال تا گزینه، موبایل', min: 8, max: 64, step: 2, unit: 'px' },
            { key: 'stemGapDesktop', label: 'فاصله سوال تا گزینه، دسکتاپ', min: 8, max: 64, step: 2, unit: 'px' },
            { key: 'questionGap', label: 'فاصله بین سوال‌ها', min: 16, max: 96, step: 4, unit: 'px' },
            { key: 'optionColumns', label: 'ستون گزینه‌ها در دسکتاپ', kind: 'columns' },
        ],
    },
];

const FIELD_INDEX = new Map();
for (const block of CATALOG) {
    for (const field of block.fields) FIELD_INDEX.set(`${block.block}.${field.key}`, field);
}

// Hidden controls. The values can still be inherited; the screen just has
// nowhere to show them (no explanation during an exam, no list gap in practice).
const HIDDEN = {
    exam: new Set(['explanation']),
    practice: new Set(['layout.questionGap']),
    examReview: new Set(['layout.questionGap']),
};

function textBlock(mobile, desktop, weight, lineHeight) {
    return { fontSizeMobile: mobile, fontSizeDesktop: desktop, weight, lineHeight };
}

function imageBlock(heightMobile, heightDesktop, widthMobile, widthDesktop) {
    return {
        maxHeightMobile: heightMobile,
        maxHeightDesktop: heightDesktop,
        maxWidthMobile: widthMobile,
        maxWidthDesktop: widthDesktop,
    };
}

function layoutBlock(gapMobile, gapDesktop, questionGap, optionColumns) {
    return { stemGapMobile: gapMobile, stemGapDesktop: gapDesktop, questionGap, optionColumns };
}

const SURFACE_DEFAULTS = {
    practice: {
        stem: textBlock(16, 19, 600, 2.1),
        options: textBlock(14, 15, 500, 2.1),
        explanation: textBlock(15, 17, 500, 2.35),
        image: imageBlock(208, 288, 448, 576),
        layout: layoutBlock(24, 32, 48, 2),
    },
    exam: {
        stem: textBlock(18, 20, 700, 1.63),
        options: textBlock(14, 16, 500, 1.63),
        explanation: textBlock(14, 16, 500, 1.75),
        image: imageBlock(1200, 1200, 200, 200),
        layout: layoutBlock(24, 24, 48, 2),
    },
    examReview: {
        stem: textBlock(14, 16, 500, 2),
        options: textBlock(14, 14, 500, 1.7),
        explanation: textBlock(14, 14, 500, 1.75),
        image: imageBlock(320, 320, 720, 720),
        layout: layoutBlock(24, 24, 48, 2),
    },
};

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function roundTo(value, step) {
    const places = String(step).includes('.') ? String(step).split('.')[1].length : 0;
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
}

function pickField(block, key, raw) {
    const field = FIELD_INDEX.get(`${block}.${key}`);
    if (!field) return undefined;
    if (field.kind === 'weight') {
        const weight = Number(raw);
        return WEIGHTS.includes(weight) ? weight : undefined;
    }
    if (field.kind === 'columns') {
        const columns = Number(raw);
        return columns === 1 || columns === 2 ? columns : undefined;
    }
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return undefined;
    const clamped = Math.min(field.max, Math.max(field.min, numeric));
    return roundTo(clamped, field.step || 1);
}

function pickBlock(blockName, input) {
    if (!isPlainObject(input)) return {};
    const out = {};
    for (const field of CATALOG.find((item) => item.block === blockName).fields) {
        if (!Object.prototype.hasOwnProperty.call(input, field.key)) continue;
        const value = pickField(blockName, field.key, input[field.key]);
        if (value !== undefined) out[field.key] = value;
    }
    return out;
}

function allowedBlocks(scope) {
    const hidden = HIDDEN[scope] || new Set();
    return CATALOG
        .filter((block) => !hidden.has(block.block))
        .map((block) => ({
            ...block,
            fields: block.fields.filter((field) => !hidden.has(`${block.block}.${field.key}`)),
        }))
        .filter((block) => block.fields.length > 0);
}

function pickScope(scope, input) {
    const out = {};
    for (const block of allowedBlocks(scope)) {
        const picked = pickBlock(block.block, input?.[block.block]);
        const kept = {};
        for (const field of block.fields) {
            if (Object.prototype.hasOwnProperty.call(picked, field.key)) kept[field.key] = picked[field.key];
        }
        if (Object.keys(kept).length) out[block.block] = kept;
    }
    return out;
}

function emptyDocument() {
    return {
        version: VERSION,
        base: {},
        surfaces: { practice: {}, exam: {}, examReview: {} },
    };
}

function sanitizeDocument(input) {
    const source = isPlainObject(input) ? input : {};
    const surfaces = isPlainObject(source.surfaces) ? source.surfaces : {};
    return {
        version: VERSION,
        base: pickScope('base', source.base),
        surfaces: {
            practice: pickScope('practice', surfaces.practice),
            exam: pickScope('exam', surfaces.exam),
            examReview: pickScope('examReview', surfaces.examReview),
        },
    };
}

function resolveSurface(document, surface) {
    if (!Object.prototype.hasOwnProperty.call(SURFACE_DEFAULTS, surface)) {
        throw new Error(`Unknown question display surface: ${surface}`);
    }
    const clean = sanitizeDocument(document);
    const defaults = SURFACE_DEFAULTS[surface];
    const resolved = {};
    for (const block of CATALOG) {
        resolved[block.block] = {
            ...defaults[block.block],
            ...(clean.base[block.block] || {}),
            ...(clean.surfaces[surface][block.block] || {}),
        };
    }
    return resolved;
}

function px(value) {
    return `${value}px`;
}

function toCssVars(resolved) {
    const stem = resolved.stem;
    const options = resolved.options;
    const explanation = resolved.explanation;
    const image = resolved.image;
    const layout = resolved.layout;
    return {
        '--q-stem-size': px(stem.fontSizeMobile),
        '--q-stem-size-md': px(stem.fontSizeDesktop),
        '--q-stem-weight': String(stem.weight),
        '--q-stem-lh': String(stem.lineHeight),
        '--q-option-size': px(options.fontSizeMobile),
        '--q-option-size-md': px(options.fontSizeDesktop),
        '--q-option-weight': String(options.weight),
        '--q-option-lh': String(options.lineHeight),
        '--q-explain-size': px(explanation.fontSizeMobile),
        '--q-explain-size-md': px(explanation.fontSizeDesktop),
        '--q-explain-weight': String(explanation.weight),
        '--q-explain-lh': String(explanation.lineHeight),
        '--q-image-max-h': px(image.maxHeightMobile),
        '--q-image-max-h-md': px(image.maxHeightDesktop),
        '--q-image-max-w': px(image.maxWidthMobile),
        '--q-image-max-w-md': px(image.maxWidthDesktop),
        '--q-stem-gap': px(layout.stemGapMobile),
        '--q-stem-gap-md': px(layout.stemGapDesktop),
        '--q-question-gap': px(layout.questionGap),
        '--q-option-cols': String(layout.optionColumns),
    };
}

// Preview frames are narrower than the admin window, so the viewport media
// query would show desktop type inside the phone frame. Forcing the active
// variables keeps each frame honest.
function forceDisplayMode(vars, mode) {
    const desktop = mode === 'desktop';
    return {
        ...vars,
        '--q-stem-size-active': desktop ? vars['--q-stem-size-md'] : vars['--q-stem-size'],
        '--q-option-size-active': desktop ? vars['--q-option-size-md'] : vars['--q-option-size'],
        '--q-explain-size-active': desktop ? vars['--q-explain-size-md'] : vars['--q-explain-size'],
        '--q-image-max-h-active': desktop ? vars['--q-image-max-h-md'] : vars['--q-image-max-h'],
        '--q-image-max-w-active': desktop ? vars['--q-image-max-w-md'] : vars['--q-image-max-w'],
        '--q-stem-gap-active': desktop ? vars['--q-stem-gap-md'] : vars['--q-stem-gap'],
        '--q-option-cols-active': desktop ? vars['--q-option-cols'] : '1',
    };
}

function editorBlocks(scope) {
    return allowedBlocks(scope).map((block) => ({
        block: block.block,
        label: block.label,
        fields: block.fields.map((field) => ({ ...field })),
    }));
}

module.exports = {
    CATALOG,
    SURFACES,
    SURFACE_DEFAULTS,
    VERSION,
    WEIGHTS,
    editorBlocks,
    emptyDocument,
    forceDisplayMode,
    resolveSurface,
    sanitizeDocument,
    toCssVars,
};
