'use strict';

const pool = require('../db');
const {
    applyRuntimeOverlay, snapshotRuntimeSettings, featureStatus, unavailableReason,
} = require('../ai-teacher/config');
const { SUBJECT_LIST, isValidSubject } = require('../ai-teacher/subjects');
const coinWallet = require('../ai-teacher/services/coinWallet');
const { invalidatePricingCache } = require('../ai-teacher/services/pricing');
const ragService = require('../ai-teacher/services/ragService');
const { extractPdfText } = require('../ai-teacher/services/pdfText');

function parseJson(value, fallback = {}) {
    if (value == null) return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return fallback; }
}

async function loadRuntimeOverlayFromDb() {
    try {
        const [[row]] = await pool.query(`SELECT settings_json FROM tam24_ai_admin_settings WHERE id = 1`);
        applyRuntimeOverlay(parseJson(row?.settings_json, {}));
    } catch {
        applyRuntimeOverlay({});
    }
}

function clampNum(v, fallback, { min = -Infinity, max = Infinity, integer = false } = {}) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    const x = Math.min(max, Math.max(min, n));
    return integer ? Math.round(x) : x;
}

function sanitizeSettings(input) {
    const src = input && typeof input === 'object' ? input : {};
    const out = {};

    if (src.flags && typeof src.flags === 'object') {
        const flags = {};
        for (const key of ['aiEnabled', 'chat', 'vision', 'imageGeneration', 'stt', 'tts', 'pdfReferences', 'memory', 'knowledgeBase', 'tools', 'suggestions']) {
            if (typeof src.flags[key] === 'boolean') flags[key] = src.flags[key];
        }
        if (Object.keys(flags).length) out.flags = flags;
    }

    if (src.models && typeof src.models === 'object') {
        const models = {};
        for (const key of ['text', 'textFast', 'textDeep', 'utility', 'vision', 'tools', 'embedding', 'image', 'stt', 'tts', 'ttsVoice']) {
            if (src.models[key] != null && String(src.models[key]).trim()) {
                models[key] = String(src.models[key]).trim().slice(0, 80);
            }
        }
        if (Object.keys(models).length) out.models = models;
    }

    if (src.dailyCoins && typeof src.dailyCoins === 'object') {
        const dailyCoins = {};
        for (const key of ['free', 'bronze', 'silver', 'golden', 'diamond', 'epic', 'premium']) {
            if (src.dailyCoins[key] != null) dailyCoins[key] = clampNum(src.dailyCoins[key], 0, { min: 0, max: 1_000_000, integer: true });
        }
        if (Object.keys(dailyCoins).length) out.dailyCoins = dailyCoins;
    }

    if (src.coinPricing && typeof src.coinPricing === 'object') {
        const coinPricing = {};
        if (src.coinPricing.usdToIrr != null) coinPricing.usdToIrr = clampNum(src.coinPricing.usdToIrr, 1_000_000, { min: 1, integer: true });
        if (src.coinPricing.irrPerCoin != null) coinPricing.irrPerCoin = clampNum(src.coinPricing.irrPerCoin, 100, { min: 1, integer: true });
        if (src.coinPricing.minCharge != null) coinPricing.minCharge = clampNum(src.coinPricing.minCharge, 1, { min: 0, integer: true });
        if (src.coinPricing.minBalanceToStart != null) coinPricing.minBalanceToStart = clampNum(src.coinPricing.minBalanceToStart, 1, { min: 0, integer: true });
        if (src.coinPricing.defaultReservation != null) coinPricing.defaultReservation = clampNum(src.coinPricing.defaultReservation, 20, { min: 1, integer: true });
        if (Object.keys(coinPricing).length) out.coinPricing = coinPricing;
    }

    if (src.flatCosts && typeof src.flatCosts === 'object') {
        const flatCosts = {};
        for (const key of ['image', 'stt', 'tts', 'pdfIndex']) {
            if (src.flatCosts[key] != null) flatCosts[key] = clampNum(src.flatCosts[key], 0, { min: 0, max: 100000, integer: true });
        }
        if (Object.keys(flatCosts).length) out.flatCosts = flatCosts;
    }

    if (src.contextLimits && typeof src.contextLimits === 'object') {
        const contextLimits = {};
        const bounds = {
            recentMessages: [1, 40], maxMemoryItems: [0, 30], summarizeAfterMessages: [4, 200],
            maxUserMessageChars: [200, 20000], titleMaxChars: [10, 200], ragTopK: [1, 12],
            ragMaxChars: [200, 20000], knowledgeTopK: [1, 10], knowledgeMaxChars: [200, 20000],
            maxAttachmentsPerMessage: [1, 8], maxToolCallsPerTurn: [0, 8],
        };
        for (const [key, [min, max]] of Object.entries(bounds)) {
            if (src.contextLimits[key] != null) contextLimits[key] = clampNum(src.contextLimits[key], min, { min, max, integer: true });
        }
        if (Object.keys(contextLimits).length) out.contextLimits = contextLimits;
    }

    if (src.fileLimits && typeof src.fileLimits === 'object') {
        const fileLimits = {};
        if (src.fileLimits.imageMb != null) fileLimits.imageMb = clampNum(src.fileLimits.imageMb, 8, { min: 1, max: 50, integer: true });
        if (src.fileLimits.audioMb != null) fileLimits.audioMb = clampNum(src.fileLimits.audioMb, 15, { min: 1, max: 100, integer: true });
        if (src.fileLimits.pdfMb != null) fileLimits.pdfMb = clampNum(src.fileLimits.pdfMb, 30, { min: 1, max: 200, integer: true });
        if (src.fileLimits.maxPdfsPerConversation != null) fileLimits.maxPdfsPerConversation = clampNum(src.fileLimits.maxPdfsPerConversation, 4, { min: 1, max: 10, integer: true });
        if (src.fileLimits.maxPdfPages != null) fileLimits.maxPdfPages = clampNum(src.fileLimits.maxPdfPages, 600, { min: 10, max: 5000, integer: true });
        if (Object.keys(fileLimits).length) out.fileLimits = fileLimits;
    }

    if (src.rateLimits && typeof src.rateLimits === 'object') {
        const rateLimits = {};
        for (const key of ['chatPerMinute', 'uploadsPerMinute', 'voicePerMinute']) {
            if (src.rateLimits[key] != null) rateLimits[key] = clampNum(src.rateLimits[key], 10, { min: 1, max: 200, integer: true });
        }
        if (Object.keys(rateLimits).length) out.rateLimits = rateLimits;
    }

    return out;
}

function fail(res, status, message) {
    return res.status(status).json({ success: false, message });
}

const handleGetSettings = async (_req, res) => {
    await loadRuntimeOverlayFromDb();
    const snap = snapshotRuntimeSettings();
    if (snap.fileLimits) delete snap.fileLimits.uploadRoot;
    if (snap.defaults?.fileLimits) delete snap.defaults.fileLimits.uploadRoot;
    return res.json({
        success: true,
        settings: snap,
        features: featureStatus(),
        unavailableReason: unavailableReason(),
    });
};

const handleSaveSettings = async (req, res) => {
    try {
        const clean = sanitizeSettings(req.body.settings || req.body);
        const [[existing]] = await pool.query(`SELECT settings_json FROM tam24_ai_admin_settings WHERE id = 1`);
        const prev = parseJson(existing?.settings_json, {});
        const merged = {
            flags: { ...(prev.flags || {}), ...(clean.flags || {}) },
            models: { ...(prev.models || {}), ...(clean.models || {}) },
            dailyCoins: { ...(prev.dailyCoins || {}), ...(clean.dailyCoins || {}) },
            coinPricing: { ...(prev.coinPricing || {}), ...(clean.coinPricing || {}) },
            flatCosts: { ...(prev.flatCosts || {}), ...(clean.flatCosts || {}) },
            contextLimits: { ...(prev.contextLimits || {}), ...(clean.contextLimits || {}) },
            fileLimits: { ...(prev.fileLimits || {}), ...(clean.fileLimits || {}) },
            rateLimits: { ...(prev.rateLimits || {}), ...(clean.rateLimits || {}) },
        };
        await pool.query(
            `INSERT INTO tam24_ai_admin_settings (id, settings_json, updated_by)
             VALUES (1, ?, ?)
             ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json), updated_by = VALUES(updated_by)`,
            [JSON.stringify(merged), req.admin.id]
        );
        applyRuntimeOverlay(merged);
        const snap = snapshotRuntimeSettings();
        if (snap.fileLimits) delete snap.fileLimits.uploadRoot;
        return res.json({ success: true, settings: snap, features: featureStatus() });
    } catch (error) {
        console.error('Save AI settings error:', error);
        return fail(res, 500, 'Failed to save AI settings');
    }
};

const handleListSubjects = async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM tam24_ai_subjects ORDER BY sort_order ASC, \`key\` ASC`);
        const byKey = new Map(rows.map((r) => [r.key, r]));
        for (const s of SUBJECT_LIST) {
            if (!byKey.has(s.key)) {
                rows.push({
                    key: s.key, name_fa: s.nameFa, name_en: s.nameEn, icon: s.icon, color: s.color,
                    general_prompt: s.generalPrompt, reference_instructions: s.referenceInstructions,
                    model: null, max_output_tokens: 700, is_active: 1, sort_order: s.sortOrder,
                    fromCode: true,
                });
            }
        }
        return res.json({ success: true, subjects: rows });
    } catch (error) {
        console.error('List AI subjects error:', error);
        return res.json({
            success: true,
            subjects: SUBJECT_LIST.map((s) => ({
                key: s.key, name_fa: s.nameFa, name_en: s.nameEn, icon: s.icon, color: s.color,
                general_prompt: s.generalPrompt, reference_instructions: s.referenceInstructions,
                model: null, max_output_tokens: 700, is_active: 1, sort_order: s.sortOrder, fromCode: true,
            })),
        });
    }
};

const handleSaveSubject = async (req, res) => {
    try {
        const key = String(req.body.key || req.params.key || '').toLowerCase().trim();
        if (!isValidSubject(key)) return fail(res, 400, 'Invalid subject key');

        const nameFa = String(req.body.name_fa || req.body.nameFa || key).trim();
        const nameEn = String(req.body.name_en || req.body.nameEn || key).trim();
        const icon = String(req.body.icon || 'sparkles').trim().slice(0, 40);
        const color = String(req.body.color || '#A78BFA').trim().slice(0, 16);
        const generalPrompt = req.body.general_prompt ?? req.body.generalPrompt ?? null;
        const referenceInstructions = req.body.reference_instructions ?? req.body.referenceInstructions ?? null;
        const model = req.body.model ? String(req.body.model).trim().slice(0, 80) : null;
        const maxOutputTokens = clampNum(req.body.max_output_tokens ?? req.body.maxOutputTokens, 700, { min: 160, max: 4000, integer: true });
        const isActive = req.body.is_active === false || req.body.is_active === 0 ? 0 : 1;
        const sortOrder = clampNum(req.body.sort_order ?? req.body.sortOrder, 100, { min: 0, max: 10000, integer: true });

        await pool.query(
            `INSERT INTO tam24_ai_subjects
                (\`key\`, name_fa, name_en, icon, color, general_prompt, reference_instructions, model, max_output_tokens, is_active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                name_fa = VALUES(name_fa), name_en = VALUES(name_en), icon = VALUES(icon), color = VALUES(color),
                general_prompt = VALUES(general_prompt), reference_instructions = VALUES(reference_instructions),
                model = VALUES(model), max_output_tokens = VALUES(max_output_tokens), is_active = VALUES(is_active),
                sort_order = VALUES(sort_order)`,
            [key, nameFa, nameEn, icon, color, generalPrompt, referenceInstructions, model, maxOutputTokens, isActive, sortOrder]
        );
        const [[row]] = await pool.query(`SELECT * FROM tam24_ai_subjects WHERE \`key\` = ?`, [key]);
        return res.json({ success: true, subject: row });
    } catch (error) {
        console.error('Save AI subject error:', error);
        return fail(res, 500, 'Failed to save subject');
    }
};

const handleResetSubjectPrompts = async (req, res) => {
    try {
        const key = String(req.params.key || '').toLowerCase();
        const code = SUBJECT_LIST.find((s) => s.key === key);
        if (!code) return fail(res, 404, 'No code defaults for this subject');
        await pool.query(
            `UPDATE tam24_ai_subjects SET general_prompt = NULL, reference_instructions = NULL WHERE \`key\` = ?`,
            [key]
        );
        return res.json({
            success: true,
            general_prompt: code.generalPrompt,
            reference_instructions: code.referenceInstructions,
        });
    } catch (error) {
        return fail(res, 500, 'Failed to reset prompts');
    }
};

const handleListKnowledge = async (req, res) => {
    try {
        const subject = req.query.subject ? String(req.query.subject) : null;
        const q = req.query.q ? `%${String(req.query.q).trim()}%` : null;
        const params = [];
        let sql = `SELECT id, subject_key, grade, chapter, topic, title, source, is_active, created_at, updated_at,
                          LEFT(content, 180) AS excerpt
                   FROM tam24_ai_knowledge WHERE 1=1`;
        if (subject) { sql += ` AND subject_key = ?`; params.push(subject); }
        if (q) { sql += ` AND (title LIKE ? OR topic LIKE ? OR chapter LIKE ? OR keywords LIKE ?)`; params.push(q, q, q, q); }
        sql += ` ORDER BY id DESC LIMIT 200`;
        const [rows] = await pool.query(sql, params);
        return res.json({ success: true, items: rows });
    } catch (error) {
        console.error('List knowledge error:', error);
        return fail(res, 500, 'Failed to list knowledge');
    }
};

const handleGetKnowledge = async (req, res) => {
    const id = Number(req.params.id);
    const [[row]] = await pool.query(`SELECT * FROM tam24_ai_knowledge WHERE id = ?`, [id]);
    if (!row) return fail(res, 404, 'Not found');
    return res.json({ success: true, item: row });
};

const handleSaveKnowledge = async (req, res) => {
    try {
        const id = req.params.id ? Number(req.params.id) : null;
        const subjectKey = String(req.body.subject_key || req.body.subjectKey || '').toLowerCase();
        if (!isValidSubject(subjectKey)) return fail(res, 400, 'Invalid subject');
        const title = String(req.body.title || '').trim();
        const content = String(req.body.content || '').trim();
        if (!title || !content) return fail(res, 400, 'Title and content are required');

        const fields = [
            subjectKey,
            req.body.grade || null,
            req.body.chapter || null,
            req.body.topic || null,
            title,
            content,
            req.body.examples || null,
            req.body.key_points || req.body.keyPoints || null,
            req.body.keywords || null,
            req.body.source || null,
            req.body.is_active === false || req.body.is_active === 0 ? 0 : 1,
            req.admin.id,
        ];

        if (id) {
            await pool.query(
                `UPDATE tam24_ai_knowledge
                    SET subject_key=?, grade=?, chapter=?, topic=?, title=?, content=?, examples=?, key_points=?, keywords=?, source=?, is_active=?
                  WHERE id=?`,
                [...fields.slice(0, 11), id]
            );
            return res.json({ success: true, id });
        }

        const [result] = await pool.query(
            `INSERT INTO tam24_ai_knowledge
                (subject_key, grade, chapter, topic, title, content, examples, key_points, keywords, source, is_active, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            fields
        );
        return res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Save knowledge error:', error);
        return fail(res, 500, 'Failed to save knowledge item');
    }
};

const handleDeleteKnowledge = async (req, res) => {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM tam24_ai_knowledge WHERE id = ?`, [id]);
    return res.json({ success: true });
};

const handleListSuggestions = async (req, res) => {
    try {
        const subject = req.query.subject ? String(req.query.subject) : null;
        const params = [];
        let sql = `SELECT * FROM tam24_ai_suggestions WHERE 1=1`;
        if (subject) { sql += ` AND subject_key = ?`; params.push(subject); }
        sql += ` ORDER BY id DESC LIMIT 300`;
        const [rows] = await pool.query(sql, params);
        return res.json({ success: true, items: rows });
    } catch (error) {
        return fail(res, 500, 'Failed to list suggestions');
    }
};

const handleSaveSuggestion = async (req, res) => {
    try {
        const id = req.params.id ? Number(req.params.id) : null;
        const subjectKey = String(req.body.subject_key || req.body.subjectKey || '').toLowerCase();
        if (!isValidSubject(subjectKey)) return fail(res, 400, 'Invalid subject');
        const title = String(req.body.title || '').trim();
        const prompt = String(req.body.prompt || '').trim();
        if (!title || !prompt) return fail(res, 400, 'Title and prompt are required');
        const hint = req.body.hint || null;
        const icon = req.body.icon || 'sparkles';
        const isActive = req.body.is_active === false || req.body.is_active === 0 ? 0 : 1;
        const source = req.body.source === 'seed' ? 'seed' : 'generated';

        if (id) {
            await pool.query(
                `UPDATE tam24_ai_suggestions SET subject_key=?, title=?, prompt=?, hint=?, icon=?, is_active=?, source=? WHERE id=?`,
                [subjectKey, title, prompt, hint, icon, isActive, source, id]
            );
            return res.json({ success: true, id });
        }
        const [result] = await pool.query(
            `INSERT INTO tam24_ai_suggestions (subject_key, title, prompt, hint, icon, source, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [subjectKey, title, prompt, hint, icon, source, isActive]
        );
        return res.json({ success: true, id: result.insertId });
    } catch (error) {
        return fail(res, 500, 'Failed to save suggestion');
    }
};

const handleDeleteSuggestion = async (req, res) => {
    await pool.query(`DELETE FROM tam24_ai_suggestions WHERE id = ?`, [Number(req.params.id)]);
    return res.json({ success: true });
};

const handleListBooks = async (_req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT b.id, b.title, b.subject, b.subject_key, b.grade, b.publisher, b.pdf_url,
                    b.content_summary, b.is_active, b.sort_order, b.created_at, b.updated_at,
                    CHAR_LENGTH(b.content_text) AS content_chars,
                    (SELECT COUNT(*) FROM tam24_ai_book_chunks c WHERE c.book_id = b.id) AS chunk_count
             FROM tam24_ai_books b ORDER BY b.sort_order ASC, b.id ASC`
        );
        return res.json({ success: true, items: rows });
    } catch (error) {
        return fail(res, 500, 'Failed to list books');
    }
};

const handleSaveBook = async (req, res) => {
    try {
        const id = req.params.id ? Number(req.params.id) : null;
        const title = String(req.body.title || '').trim();
        if (!title) return fail(res, 400, 'Title is required');
        const subjectKey = req.body.subject_key || req.body.subjectKey || null;
        const payload = [
            title,
            req.body.subject || null,
            subjectKey,
            req.body.grade || null,
            req.body.publisher || null,
            req.body.pdf_url || req.body.pdfUrl || null,
            req.body.content_summary || req.body.contentSummary || null,
            req.body.is_active === false || req.body.is_active === 0 ? 0 : 1,
            clampNum(req.body.sort_order ?? req.body.sortOrder, 100, { min: 0, integer: true }),
        ];
        if (id) {
            await pool.query(
                `UPDATE tam24_ai_books
                    SET title=?, subject=?, subject_key=?, grade=?, publisher=?, pdf_url=?, content_summary=?, is_active=?, sort_order=?
                  WHERE id=?`,
                [...payload, id]
            );
            ragService.invalidateBookCache(subjectKey);
            return res.json({ success: true, id });
        }
        const [result] = await pool.query(
            `INSERT INTO tam24_ai_books (title, subject, subject_key, grade, publisher, pdf_url, content_summary, is_active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            payload
        );
        return res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Save book error:', error);
        return fail(res, 500, 'Failed to save book');
    }
};

const handleDeleteBook = async (req, res) => {
    const id = Number(req.params.id);
    const [[book]] = await pool.query(`SELECT subject_key FROM tam24_ai_books WHERE id = ?`, [id]);
    await pool.query(`DELETE FROM tam24_ai_books WHERE id = ?`, [id]);
    if (book?.subject_key) ragService.invalidateBookCache(book.subject_key);
    ragService.invalidateChunkCache(id);
    return res.json({ success: true });
};

const handleIngestBook = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const [[book]] = await pool.query(`SELECT id, title, subject_key FROM tam24_ai_books WHERE id = ?`, [id]);
        if (!book) return fail(res, 404, 'Book not found');
        if (!book.subject_key) return fail(res, 400, 'Set a subject_key on the book before ingesting');

        let text = String(req.body.content_text || req.body.contentText || '').trim();
        const fileData = req.body.file_data || req.body.fileData;
        if (!text && fileData) {
            const raw = String(fileData).replace(/^data:[^;]+;base64,/, '');
            const buf = Buffer.from(raw, 'base64');
            const extracted = await extractPdfText(buf, { maxPages: 2000 });
            text = extracted.text || '';
        }
        if (!text) {
            const [[row]] = await pool.query(`SELECT content_text FROM tam24_ai_books WHERE id = ?`, [id]);
            text = row?.content_text || '';
        }
        if (!text.trim()) return fail(res, 400, 'No text to ingest. Upload a PDF or paste extracted text.');

        await pool.query(`UPDATE tam24_ai_books SET content_text = ? WHERE id = ?`, [text, id]);
        const result = await ragService.ingestBookText(pool, id, book.subject_key, text);
        return res.json({ success: true, ...result, chars: text.length });
    } catch (error) {
        console.error('Ingest book error:', error);
        return fail(res, 500, error.message || 'Failed to ingest book');
    }
};

const handleListPricing = async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM tam24_ai_model_pricing ORDER BY provider, model`);
        return res.json({ success: true, items: rows });
    } catch (error) {
        return fail(res, 500, 'Failed to list pricing');
    }
};

const handleSavePricing = async (req, res) => {
    try {
        const id = req.params.id ? Number(req.params.id) : null;
        const provider = String(req.body.provider || 'gapgpt').trim().slice(0, 40);
        const model = String(req.body.model || '').trim().slice(0, 80);
        if (!model) return fail(res, 400, 'Model is required');
        const operationType = String(req.body.operation_type || req.body.operationType || 'chat').trim().slice(0, 40);
        const payload = [
            provider, model, operationType,
            Number(req.body.input_usd_per_1m ?? req.body.inputUsdPer1m) || 0,
            Number(req.body.cached_usd_per_1m ?? req.body.cachedUsdPer1m) || 0,
            Number(req.body.output_usd_per_1m ?? req.body.outputUsdPer1m) || 0,
            Number(req.body.unit_usd ?? req.body.unitUsd) || 0,
            req.body.flat_coin_cost == null && req.body.flatCoinCost == null ? null : Number(req.body.flat_coin_cost ?? req.body.flatCoinCost),
            req.body.is_active === false || req.body.is_active === 0 ? 0 : 1,
        ];
        if (id) {
            await pool.query(
                `UPDATE tam24_ai_model_pricing
                    SET provider=?, model=?, operation_type=?, input_usd_per_1m=?, cached_usd_per_1m=?, output_usd_per_1m=?, unit_usd=?, flat_coin_cost=?, is_active=?
                  WHERE id=?`,
                [...payload, id]
            );
            invalidatePricingCache();
            return res.json({ success: true, id });
        }
        const [result] = await pool.query(
            `INSERT INTO tam24_ai_model_pricing
                (provider, model, operation_type, input_usd_per_1m, cached_usd_per_1m, output_usd_per_1m, unit_usd, flat_coin_cost, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                input_usd_per_1m=VALUES(input_usd_per_1m), cached_usd_per_1m=VALUES(cached_usd_per_1m),
                output_usd_per_1m=VALUES(output_usd_per_1m), unit_usd=VALUES(unit_usd),
                flat_coin_cost=VALUES(flat_coin_cost), is_active=VALUES(is_active)`,
            payload
        );
        invalidatePricingCache();
        return res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Save pricing error:', error);
        return fail(res, 500, 'Failed to save pricing');
    }
};

const handleDeletePricing = async (req, res) => {
    await pool.query(`DELETE FROM tam24_ai_model_pricing WHERE id = ?`, [Number(req.params.id)]);
    invalidatePricingCache();
    return res.json({ success: true });
};

const handleAiStats = async (_req, res) => {
    const q = async (sql, fallback = []) => {
        try { const [rows] = await pool.query(sql); return rows; } catch { return fallback; }
    };
    const overviewRows = await q(`
        SELECT
          (SELECT COUNT(*) FROM tam24_ai_conversations) AS conversations,
          (SELECT COUNT(*) FROM tam24_ai_messages) AS messages,
          (SELECT COUNT(DISTINCT user_id) FROM tam24_ai_conversations) AS users,
          (SELECT COALESCE(SUM(lifetime_spent),0) FROM tam24_ai_wallets) AS coins_spent,
          (SELECT COALESCE(SUM(lifetime_earned),0) FROM tam24_ai_wallets) AS coins_earned,
          (SELECT COALESCE(SUM(cost_irr),0) FROM tam24_ai_usage_logs) AS cost_irr,
          (SELECT COALESCE(SUM(cost_usd),0) FROM tam24_ai_usage_logs) AS cost_usd,
          (SELECT COUNT(*) FROM tam24_ai_knowledge WHERE is_active=1) AS knowledge_items,
          (SELECT COUNT(*) FROM tam24_ai_suggestions WHERE is_active=1) AS suggestions,
          (SELECT COUNT(*) FROM tam24_ai_books WHERE is_active=1) AS books
    `, [{}]);
    const overview = overviewRows[0] || {};
    const bySubject = await q(`
        SELECT subject_key, COUNT(*) AS conversations, COALESCE(SUM(message_count),0) AS messages
        FROM tam24_ai_conversations GROUP BY subject_key
    `);
    const byOp = await q(`
        SELECT operation_type, COUNT(*) AS count, COALESCE(SUM(coin_cost),0) AS coins, COALESCE(SUM(cost_irr),0) AS irr
        FROM tam24_ai_usage_logs GROUP BY operation_type ORDER BY count DESC
    `);
    const daily = await q(`
        SELECT DATE(created_at) AS day, COUNT(*) AS count, COALESCE(SUM(coin_cost),0) AS coins
        FROM tam24_ai_usage_logs
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        GROUP BY DATE(created_at) ORDER BY day
    `);
    return res.json({ success: true, overview: overview || {}, bySubject, byOp, daily });
};

const handleSearchWallets = async (req, res) => {
    try {
        const qtext = String(req.query.q || '').trim();
        const params = [];
        let sql = `
            SELECT u.id, u.username, u.first_name, u.last_name, u.phone, u.current_plan, u.status,
                   w.daily_balance, w.purchased_balance, w.balance, w.lifetime_earned, w.lifetime_spent, w.daily_granted_on
            FROM tam24_users u
            LEFT JOIN tam24_ai_wallets w ON w.user_id = u.id
            WHERE 1=1
        `;
        if (qtext) {
            sql += ` AND (u.username LIKE ? OR u.phone LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.id = ?)`;
            const like = `%${qtext}%`;
            params.push(like, like, like, like, Number(qtext) || 0);
        }
        sql += ` ORDER BY u.id DESC LIMIT 40`;
        const [rows] = await pool.query(sql, params);
        return res.json({ success: true, items: rows });
    } catch (error) {
        return fail(res, 500, 'Failed to search wallets');
    }
};

const handleAdjustWallet = async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const delta = Math.trunc(Number(req.body.delta));
        const reason = String(req.body.reason || '').trim().slice(0, 255);
        if (!Number.isInteger(userId) || userId <= 0) return fail(res, 400, 'Invalid user');
        if (!delta) return fail(res, 400, 'Delta must be a non-zero integer');
        const [[user]] = await pool.query(`SELECT id FROM tam24_users WHERE id = ?`, [userId]);
        if (!user) return fail(res, 404, 'User not found');
        const result = await coinWallet.adminAdjust(pool, userId, delta, {
            reason: reason || (delta > 0 ? 'شارژ توسط ادمین' : 'کسر توسط ادمین'),
            adminId: req.admin.id,
        });
        return res.json({ success: true, wallet: result.wallet, balance: result.balance });
    } catch (error) {
        if (error.code === 'INSUFFICIENT_COINS') {
            return fail(res, 400, 'Not enough coins to debit');
        }
        console.error('Adjust wallet error:', error);
        return fail(res, 500, 'Failed to adjust wallet');
    }
};

const MEMORY_TYPES = ['weakness', 'strength', 'preference', 'goal', 'learning_behavior', 'important_fact', 'progress'];

const handleListMemory = async (req, res) => {
    try {
        const qtext = String(req.query.q || '').trim();
        const params = [];
        let sql = `
            SELECT m.id, m.user_id, m.memory_type, m.content, m.importance, m.confidence, m.subject_key,
                   m.source, m.is_active, m.created_at, m.updated_at, u.username
            FROM tam24_ai_student_memory m
            LEFT JOIN tam24_users u ON u.id = m.user_id
            WHERE 1=1
        `;
        if (qtext) {
            sql += ` AND (u.username LIKE ? OR m.content LIKE ? OR m.subject_key LIKE ? OR m.user_id = ?)`;
            const like = `%${qtext}%`;
            params.push(like, like, like, Number(qtext) || 0);
        }
        sql += ` ORDER BY m.id DESC LIMIT 200`;
        const [rows] = await pool.query(sql, params);
        return res.json({ success: true, items: rows });
    } catch (error) {
        return fail(res, 500, 'Failed to list memory');
    }
};

const handleSaveMemory = async (req, res) => {
    try {
        const id = req.params.id ? Number(req.params.id) : null;
        const userId = Number(req.body.user_id || req.body.userId);
        const content = String(req.body.content || '').trim();
        if (!Number.isInteger(userId) || userId <= 0) return fail(res, 400, 'user_id is required');
        if (!content) return fail(res, 400, 'content is required');
        const memoryType = MEMORY_TYPES.includes(req.body.memory_type) ? req.body.memory_type : 'important_fact';
        const subjectKey = req.body.subject_key ? String(req.body.subject_key).toLowerCase() : null;
        const importance = clampNum(req.body.importance, 5, { min: 1, max: 10, integer: true });
        const confidence = clampNum(req.body.confidence, 70, { min: 0, max: 100, integer: true });
        const isActive = req.body.is_active === false || req.body.is_active === 0 ? 0 : 1;
        if (id) {
            await pool.query(
                `UPDATE tam24_ai_student_memory
                    SET user_id=?, memory_type=?, content=?, importance=?, confidence=?, subject_key=?, source=?, is_active=?
                  WHERE id=?`,
                [userId, memoryType, content, importance, confidence, subjectKey, req.body.source || 'admin', isActive, id]
            );
            return res.json({ success: true, id });
        }
        const [result] = await pool.query(
            `INSERT INTO tam24_ai_student_memory
                (user_id, memory_type, content, importance, confidence, subject_key, source, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, memoryType, content, importance, confidence, subjectKey, req.body.source || 'admin', isActive]
        );
        return res.json({ success: true, id: result.insertId });
    } catch (error) {
        return fail(res, 500, 'Failed to save memory');
    }
};

const handleDeleteMemory = async (req, res) => {
    await pool.query(`DELETE FROM tam24_ai_student_memory WHERE id = ?`, [Number(req.params.id)]);
    return res.json({ success: true });
};

const handleListConversations = async (req, res) => {
    try {
        const qtext = String(req.query.q || '').trim();
        const params = [];
        let sql = `
            SELECT c.id, c.user_id, c.title, c.subject_key, c.message_count, c.total_tokens,
                   c.last_message_at, c.archived_at, c.created_at, u.username
            FROM tam24_ai_conversations c
            LEFT JOIN tam24_users u ON u.id = c.user_id
            WHERE 1=1
        `;
        if (qtext) {
            sql += ` AND (u.username LIKE ? OR c.title LIKE ? OR c.subject_key LIKE ? OR c.user_id = ? OR c.id = ?)`;
            const like = `%${qtext}%`;
            params.push(like, like, like, Number(qtext) || 0, Number(qtext) || 0);
        }
        sql += ` ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC LIMIT 80`;
        const [rows] = await pool.query(sql, params);
        return res.json({ success: true, items: rows });
    } catch (error) {
        return fail(res, 500, 'Failed to list conversations');
    }
};

const handleGetConversation = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const [[conv]] = await pool.query(
            `SELECT c.*, u.username FROM tam24_ai_conversations c
             LEFT JOIN tam24_users u ON u.id = c.user_id WHERE c.id = ?`,
            [id]
        );
        if (!conv) return fail(res, 404, 'Not found');
        const [messages] = await pool.query(
            `SELECT id, role, content, created_at, status, input_tokens, output_tokens
             FROM tam24_ai_messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 200`,
            [id]
        );
        return res.json({ success: true, conversation: conv, messages });
    } catch (error) {
        return fail(res, 500, 'Failed to load conversation');
    }
};

const handleDeleteConversation = async (req, res) => {
    const id = Number(req.params.id);
    try { await pool.query(`DELETE FROM tam24_ai_conversation_references WHERE conversation_id = ?`, [id]); } catch { /* optional table */ }
    try { await pool.query(`UPDATE tam24_ai_files SET conversation_id = NULL WHERE conversation_id = ?`, [id]); } catch { /* optional */ }
    await pool.query(`DELETE FROM tam24_ai_messages WHERE conversation_id = ?`, [id]);
    await pool.query(`DELETE FROM tam24_ai_conversations WHERE id = ?`, [id]);
    return res.json({ success: true });
};

const handleGetUserSettings = async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const [[user]] = await pool.query(`SELECT id, username FROM tam24_users WHERE id = ?`, [userId]);
        if (!user) return fail(res, 404, 'User not found');
        const [[settings]] = await pool.query(`SELECT * FROM tam24_ai_user_settings WHERE user_id = ?`, [userId]);
        return res.json({ success: true, user, settings: settings || null });
    } catch (error) {
        return fail(res, 500, 'Failed to load user settings');
    }
};

const handleSaveUserSettings = async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const [[user]] = await pool.query(`SELECT id FROM tam24_users WHERE id = ?`, [userId]);
        if (!user) return fail(res, 404, 'User not found');
        const b = req.body || {};
        const tone = ['friendly', 'formal', 'playful'].includes(b.tone) ? b.tone : 'friendly';
        const reasoning = ['fast', 'balanced', 'deep'].includes(b.reasoning_level) ? b.reasoning_level : 'balanced';
        const verbosity = ['short', 'normal', 'detailed'].includes(b.verbosity) ? b.verbosity : 'normal';
        const creativity = clampNum(b.creativity, 50, { min: 0, max: 100, integer: true });
        const flag = (v, fallback = 1) => (v === false || v === 0 ? 0 : (v === true || v === 1 ? 1 : fallback));
        await pool.query(
            `INSERT INTO tam24_ai_user_settings
                (user_id, low_coin_mode, always_examples, concise_responses, step_by_step, voice_replies,
                 tone, reasoning_level, verbosity, creativity, memory_enabled, knowledge_enabled, pdf_references_enabled)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                low_coin_mode=VALUES(low_coin_mode), always_examples=VALUES(always_examples),
                concise_responses=VALUES(concise_responses), step_by_step=VALUES(step_by_step),
                voice_replies=VALUES(voice_replies), tone=VALUES(tone), reasoning_level=VALUES(reasoning_level),
                verbosity=VALUES(verbosity), creativity=VALUES(creativity), memory_enabled=VALUES(memory_enabled),
                knowledge_enabled=VALUES(knowledge_enabled), pdf_references_enabled=VALUES(pdf_references_enabled)`,
            [
                userId, flag(b.low_coin_mode, 0), flag(b.always_examples, 1), flag(b.concise_responses, 0),
                flag(b.step_by_step, 1), flag(b.voice_replies, 1), tone, reasoning, verbosity, creativity,
                flag(b.memory_enabled, 1), flag(b.knowledge_enabled, 1), flag(b.pdf_references_enabled, 1),
            ]
        );
        const [[settings]] = await pool.query(`SELECT * FROM tam24_ai_user_settings WHERE user_id = ?`, [userId]);
        return res.json({ success: true, settings });
    } catch (error) {
        console.error('Save user AI settings error:', error);
        return fail(res, 500, 'Failed to save user settings');
    }
};

const handleUsageLogs = async (req, res) => {
    try {
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
        const [rows] = await pool.query(
            `SELECT id, user_id, conversation_id, operation_type, model, input_tokens, output_tokens,
                    coin_cost, cost_usd, cost_irr, status, subject_key, created_at
             FROM tam24_ai_usage_logs ORDER BY id DESC LIMIT ?`,
            [limit]
        );
        return res.json({ success: true, items: rows });
    } catch (error) {
        return fail(res, 500, 'Failed to load usage logs');
    }
};

module.exports = {
    loadRuntimeOverlayFromDb,
    handleGetSettings,
    handleSaveSettings,
    handleListSubjects,
    handleSaveSubject,
    handleResetSubjectPrompts,
    handleListKnowledge,
    handleGetKnowledge,
    handleSaveKnowledge,
    handleDeleteKnowledge,
    handleListSuggestions,
    handleSaveSuggestion,
    handleDeleteSuggestion,
    handleListBooks,
    handleSaveBook,
    handleDeleteBook,
    handleIngestBook,
    handleListPricing,
    handleSavePricing,
    handleDeletePricing,
    handleAiStats,
    handleSearchWallets,
    handleAdjustWallet,
    handleUsageLogs,
    handleListMemory,
    handleSaveMemory,
    handleDeleteMemory,
    handleListConversations,
    handleGetConversation,
    handleDeleteConversation,
    handleGetUserSettings,
    handleSaveUserSettings,
};
