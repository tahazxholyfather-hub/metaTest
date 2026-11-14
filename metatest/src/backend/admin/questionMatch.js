'use strict';

const { parseDateRange } = require('./dateRange');

const STEM_AMBIGUOUS_MIN = 48;
const MAX_AMBIGUOUS = 5;
const MAX_PURGE_IDS = 5000;

function normalizeQuestionText(value) {
    let text = String(value ?? '');
    text = text
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/p>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&zwnj;|&#8204;|&#x200c;/gi, '')
        .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
        .replace(/&laquo;|&#171;/gi, '«')
        .replace(/&raquo;|&#187;/gi, '»')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;|&#34;/gi, '"')
        .replace(/&apos;|&#39;/gi, "'")
        .replace(/&#(\d+);/g, (_, code) => safeCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => safeCodePoint(parseInt(code, 16)))
        .replace(/&amp;/gi, '&');

    text = text
        .replace(/[\u200c\u200d\u200e\u200f\ufeff\u00ad]/g, '')
        .replace(/[يى]/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
        .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
        .replace(/ـ/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    return text;
}

function safeCodePoint(code) {
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
    try {
        return String.fromCodePoint(code);
    } catch {
        return '';
    }
}

function questionFingerprint(text, options) {
    const stem = normalizeQuestionText(text);
    const normalized = (Array.isArray(options) ? options : []).map((option) => normalizeQuestionText(option));
    return `${stem}\n${normalized.join('\n')}`;
}

function clip(value, max) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max)}…`;
}

function sqlDateTime(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'string') {
        const text = value.trim().replace('T', ' ');
        if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 19);
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (part) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parsePurgeFilters(input = {}) {
    const range = parseDateRange(input || {});
    if (range.error) return { error: range.error };

    const adminRaw = input.admin_id;
    const adminBlank = adminRaw === undefined || adminRaw === null || String(adminRaw).trim() === '';
    const adminId = adminBlank ? null : Number(adminRaw);
    if (adminId !== null && (!Number.isInteger(adminId) || adminId <= 0)) {
        return { error: 'ادمین نامعتبر است.' };
    }

    let insertType = 'اتوماتیک';
    const requested = input.insert_type;
    if (requested === 'all' || requested === 'همه') insertType = null;
    else if (requested === 'دستی' || requested === 'اتوماتیک') insertType = requested;
    else if (requested) return { error: 'نوع ورود نامعتبر است.' };

    return {
        error: null,
        range,
        admin_id: adminId,
        insert_type: insertType,
        scoped: Boolean(range.active || adminId),
    };
}

function createdInRange(createdAt, range) {
    if (!range || !range.active) return true;
    const stamp = sqlDateTime(createdAt);
    if (!stamp) return false;
    if (range.from && stamp < `${range.from} 00:00:00`) return false;
    if (range.toExclusive && stamp >= `${range.toExclusive} 00:00:00`) return false;
    return true;
}

function rowInScope(row, filters) {
    if (!filters || !filters.scoped) return false;
    if (filters.insert_type && row.insert_type !== filters.insert_type) return false;
    if (filters.admin_id && Number(row.admin_id) !== filters.admin_id) return false;
    if (!createdInRange(row.created_at, filters.range)) return false;
    return true;
}

function emptyHistory() {
    return {
        answers: 0,
        favorites: 0,
        notes: 0,
        reports: 0,
        review_later: 0,
        sessions: 0,
        quizzes: 0,
        ai: 0,
    };
}

function hasHistory(history) {
    if (!history) return false;
    return Object.values(history).some((count) => Number(count) > 0);
}

function pushMap(map, key, value) {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
}

function buildIndex(rows) {
    const byFingerprint = new Map();
    const byStem = new Map();
    const byOptions = new Map();
    for (const row of rows) {
        const stem = normalizeQuestionText(row.question_text);
        const options = (Array.isArray(row.options) ? row.options : []).map((option) => normalizeQuestionText(option));
        const fp = `${stem}\n${options.join('\n')}`;
        const indexed = { ...row, fp, stem, optionKey: options.join('\n') };
        pushMap(byFingerprint, fp, indexed);
        if (stem.length >= STEM_AMBIGUOUS_MIN) pushMap(byStem, stem, indexed);
        if (options.length === 4 && options.every(Boolean)) pushMap(byOptions, indexed.optionKey, indexed);
    }
    return { byFingerprint, byStem, byOptions };
}

function publicCopy(row, filters) {
    return {
        id: Number(row.id),
        status: row.status || '',
        insert_type: row.insert_type || '',
        created_at: sqlDateTime(row.created_at),
        admin_id: row.admin_id == null ? null : Number(row.admin_id),
        edit_status: row.edit_status || '',
        subject_id: row.subject_id == null ? null : Number(row.subject_id),
        grade_id: row.grade_id == null ? null : Number(row.grade_id),
        topic_id: row.topic_id == null ? null : Number(row.topic_id),
        chapter_id: row.chapter_id == null ? null : Number(row.chapter_id),
        difficulty_level: row.difficulty_level || '',
        in_scope: rowInScope(row, filters),
        has_history: Boolean(row.has_history) || hasHistory(row.history),
        history: row.history || emptyHistory(),
    };
}

function candidateOf(row, reason) {
    return {
        id: Number(row.id),
        status: row.status || '',
        insert_type: row.insert_type || '',
        created_at: sqlDateTime(row.created_at),
        admin_id: row.admin_id == null ? null : Number(row.admin_id),
        reason,
    };
}

function ambiguousCandidates(index, stem, options) {
    const found = new Map();
    if (stem.length >= STEM_AMBIGUOUS_MIN) {
        for (const row of index.byStem.get(stem) || []) {
            found.set(row.id, candidateOf(row, 'متن سوال یکی است و گزینه‌ها فرق دارد'));
        }
    }
    if (options.length === 4 && options.every(Boolean)) {
        const optionKey = options.join('\n');
        for (const row of index.byOptions.get(optionKey) || []) {
            if (found.has(row.id)) continue;
            found.set(row.id, candidateOf(row, 'گزینه‌ها یکی است و متن سوال فرق دارد'));
        }
    }
    return [...found.values()].slice(0, MAX_AMBIGUOUS);
}

function cleanUploadQuestion(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const text = String(raw.text || '').trim();
    if (!Array.isArray(raw.options)) return null;
    const options = raw.options.slice(0, 4).map((option) => String(option ?? '').trim());
    if (!text || options.length !== 4 || options.some((option) => !option)) return null;
    return { text, options };
}

function classifyUploads(files, dbRows, filters) {
    const index = buildIndex(dbRows);
    const groupsByFp = new Map();
    const unmatched = [];
    const ambiguous = [];
    const fileStats = [];

    (files || []).forEach((file) => {
        const name = String(file?.name || 'file.docx');
        const stat = {
            name,
            parsed: 0,
            matched: 0,
            unmatched: 0,
            ambiguous: 0,
            invalid: Number(file?.invalid) || 0,
        };
        const questions = Array.isArray(file?.questions) ? file.questions : [];
        questions.forEach((raw, questionIndex) => {
            const question = cleanUploadQuestion(raw);
            if (!question) {
                stat.invalid += 1;
                return;
            }
            stat.parsed += 1;
            const stem = normalizeQuestionText(question.text);
            const options = question.options.map((option) => normalizeQuestionText(option));
            const fp = `${stem}\n${options.join('\n')}`;
            const exact = index.byFingerprint.get(fp) || [];
            if (exact.length) {
                stat.matched += 1;
                let group = groupsByFp.get(fp);
                if (!group) {
                    group = {
                        text: clip(question.text, 280),
                        options: question.options.map((option) => clip(option, 140)),
                        file_names: [],
                        occurrences: 0,
                        copies: exact.map((row) => publicCopy(row, filters)),
                    };
                    groupsByFp.set(fp, group);
                }
                group.occurrences += 1;
                if (!group.file_names.includes(name)) group.file_names.push(name);
                return;
            }

            const candidates = ambiguousCandidates(index, stem, options);
            if (candidates.length) {
                stat.ambiguous += 1;
                ambiguous.push({
                    file_name: name,
                    index: questionIndex + 1,
                    text: clip(question.text, 280),
                    candidates,
                });
                return;
            }

            stat.unmatched += 1;
            unmatched.push({
                file_name: name,
                index: questionIndex + 1,
                text: clip(question.text, 280),
            });
        });
        fileStats.push(stat);
    });

    const groups = [...groupsByFp.values()].sort((left, right) => {
        const leftScope = left.copies.some((copy) => copy.in_scope) ? 0 : 1;
        const rightScope = right.copies.some((copy) => copy.in_scope) ? 0 : 1;
        if (leftScope !== rightScope) return leftScope - rightScope;
        return right.copies.length - left.copies.length;
    });

    return summarize({
        files: fileStats,
        groups,
        unmatched,
        ambiguous,
    }, filters);
}

function summarize(report, filters) {
    let parsed = 0;
    let dbRows = 0;
    let inScope = 0;
    let withHistory = 0;
    for (const file of report.files) parsed += file.parsed;
    for (const group of report.groups) {
        dbRows += group.copies.length;
        for (const copy of group.copies) {
            if (copy.in_scope) inScope += 1;
            if (copy.has_history) withHistory += 1;
        }
    }
    report.summary = {
        files: report.files.length,
        parsed,
        matched_groups: report.groups.length,
        db_rows: dbRows,
        in_scope: inScope,
        unmatched: report.unmatched.length,
        ambiguous: report.ambiguous.length,
        with_history: withHistory,
        scoped: Boolean(filters && filters.scoped),
    };
    return report;
}

function attachHistory(report, historyById) {
    for (const group of report.groups) {
        for (const copy of group.copies) {
            const history = historyById.get(copy.id) || emptyHistory();
            copy.history = history;
            copy.has_history = hasHistory(history);
        }
    }
    return summarize(report, { scoped: report.summary?.scoped });
}

function planPurge(rows, mode) {
    if (mode !== 'delete' && mode !== 'deactivate') {
        return { error: 'نوع پاکسازی نامعتبر است.' };
    }
    return {
        error: null,
        plan: rows.map((row) => ({
            id: Number(row.id),
            action: mode === 'deactivate' || row.has_history ? 'deactivate' : 'delete',
        })),
    };
}

function parseQuestionIds(value) {
    if (!Array.isArray(value)) return { error: 'سوالی انتخاب نشده.' };
    const ids = [];
    const seen = new Set();
    for (const raw of value) {
        const id = Number(raw);
        if (!Number.isInteger(id) || id <= 0) return { error: 'شناسه سوال نامعتبر است.' };
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
    }
    if (!ids.length) return { error: 'سوالی انتخاب نشده.' };
    if (ids.length > MAX_PURGE_IDS) return { error: `بیش از ${MAX_PURGE_IDS} سوال را یکجا پاک نکن.` };
    return { error: null, ids };
}

module.exports = {
    STEM_AMBIGUOUS_MIN,
    MAX_PURGE_IDS,
    normalizeQuestionText,
    questionFingerprint,
    clip,
    sqlDateTime,
    parsePurgeFilters,
    rowInScope,
    emptyHistory,
    hasHistory,
    cleanUploadQuestion,
    classifyUploads,
    attachHistory,
    summarize,
    planPurge,
    parseQuestionIds,
};
