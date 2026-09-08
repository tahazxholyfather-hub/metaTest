'use strict';

const fs = require('fs');
const { CONTEXT_LIMITS, FILE_LIMITS, MODELS, featureStatus } = require('../config');
const fileStorage = require('./fileStorage');
const { extractPdfText } = require('./pdfText');
const { chunkText, cosineSimilarity, tokenize, keywordScore, safeParseEmbedding } = require('./ragService');
const aiProvider = require('./aiProvider');
const { logUsage } = require('./usageLogger');

/**
 * PDF references a student attaches to a conversation (books, notes, past
 * exams). Up to FILE_LIMITS.maxPdfsPerConversation active per conversation.
 *
 *   upload → validate + store (fileStorage) → tam24_ai_files + reference row
 *   → async: extract text (pdf-parse) → chunk → embed → tam24_ai_reference_chunks
 *   → per turn: rank chunks of all ready references against the question
 *     and inject the best few as "STUDENT REFERENCES" context.
 *
 * Indexing runs in the background so the upload returns immediately; the
 * UI polls the status (pending → indexing → ready | failed).
 */

const EMBED_BATCH = 32;
const MAX_CHUNKS_PER_REFERENCE = 1200;

function shape(row) {
    return {
        id: row.id,
        conversationId: row.conversation_id,
        fileId: row.file_id,
        title: row.title,
        status: row.status,
        chunkCount: row.chunk_count,
        pages: row.pages,
        error: row.error_message || null,
        url: row.public_url || null,
        sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
        createdAt: row.created_at,
    };
}

async function listReferences(db, conversationId, userId) {
    const [rows] = await db.query(
        `SELECT r.*, f.public_url, f.size_bytes
         FROM tam24_ai_conversation_references r
         JOIN tam24_ai_files f ON f.id = r.file_id
         WHERE r.conversation_id = ? AND r.user_id = ? AND r.is_active = 1
         ORDER BY r.id ASC`,
        [conversationId, userId]
    );
    return rows.map(shape);
}

async function countActive(db, conversationId) {
    const [[{ cnt }]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM tam24_ai_conversation_references WHERE conversation_id = ? AND is_active = 1`,
        [conversationId]
    );
    return Number(cnt) || 0;
}

/** Store the PDF, create the reference row, kick off indexing. */
async function addReference(db, { userId, conversationId, buffer, originalName, mimeType }) {
    if (!featureStatus().pdfReferences) {
        throw Object.assign(new Error('قابلیت منابع PDF غیرفعال است.'), { code: 'FEATURE_DISABLED', status: 403 });
    }
    const active = await countActive(db, conversationId);
    if (active >= FILE_LIMITS.maxPdfsPerConversation) {
        throw Object.assign(
            new Error(`حداکثر ${FILE_LIMITS.maxPdfsPerConversation} منبع برای هر گفتگو مجاز است.`),
            { code: 'REFERENCE_LIMIT', status: 409 }
        );
    }

    const stored = await fileStorage.saveBuffer('pdf', buffer, { mime: mimeType, originalName });
    const title = String(originalName || 'منبع PDF').replace(/\.pdf$/i, '').slice(0, 240) || 'منبع PDF';
    const fileId = await fileStorage.recordFile(db, { userId, conversationId, kind: 'pdf', stored, status: 'processing' });
    const [res] = await db.query(
        `INSERT INTO tam24_ai_conversation_references (conversation_id, file_id, user_id, title, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [conversationId, fileId, userId, title]
    );
    const referenceId = res.insertId;

    // Background indexing — never block the upload response on the provider.
    setImmediate(() => {
        indexReference(db, referenceId, { buffer, userId, conversationId }).catch((err) => {
            console.error('[met] reference indexing crashed:', err.message);
        });
    });

    const [[row]] = await db.query(
        `SELECT r.*, f.public_url, f.size_bytes FROM tam24_ai_conversation_references r JOIN tam24_ai_files f ON f.id = r.file_id WHERE r.id = ?`,
        [referenceId]
    );
    return shape(row);
}

async function setStatus(db, referenceId, status, { chunkCount = null, pages = null, error = null } = {}) {
    await db.query(
        `UPDATE tam24_ai_conversation_references
            SET status = ?, chunk_count = COALESCE(?, chunk_count), pages = COALESCE(?, pages), error_message = ?, updated_at = NOW()
          WHERE id = ?`,
        [status, chunkCount, pages, error ? String(error).slice(0, 300) : null, referenceId]
    );
}

async function indexReference(db, referenceId, { buffer = null, userId = null, conversationId = null } = {}) {
    const started = Date.now();
    const [[ref]] = await db.query(
        `SELECT r.*, f.stored_name, f.kind FROM tam24_ai_conversation_references r JOIN tam24_ai_files f ON f.id = r.file_id WHERE r.id = ?`,
        [referenceId]
    );
    if (!ref) return;
    await setStatus(db, referenceId, 'indexing');

    try {
        const data = buffer || await fs.promises.readFile(fileStorage.absolutePathFor('pdf', ref.stored_name));
        const { pages, text, total } = await extractPdfText(data, { maxPages: FILE_LIMITS.maxPdfPages });
        if (!text || text.length < 40) {
            throw Object.assign(new Error('متنی از این PDF استخراج نشد (احتمالاً اسکن تصویری است).'), { code: 'PDF_NO_TEXT' });
        }

        // Chunk per page so each chunk keeps a page hint.
        const chunks = [];
        const source = pages.length ? pages : [{ page: null, text }];
        for (const p of source) {
            for (const piece of chunkText(p.text, { chunkSize: 1000, overlap: 120 })) {
                chunks.push({ content: piece, page: p.page });
                if (chunks.length >= MAX_CHUNKS_PER_REFERENCE) break;
            }
            if (chunks.length >= MAX_CHUNKS_PER_REFERENCE) break;
        }

        await db.query(`DELETE FROM tam24_ai_reference_chunks WHERE reference_id = ?`, [referenceId]);

        const canEmbed = featureStatus().embeddings;
        let embeddedCount = 0;
        let embedTokens = 0;
        for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
            const batch = chunks.slice(i, i + EMBED_BATCH);
            let vectors = [];
            if (canEmbed) {
                try {
                    vectors = await aiProvider.embed({ input: batch.map((c) => c.content) });
                    embeddedCount += vectors.filter(Boolean).length;
                    embedTokens += batch.reduce((n, c) => n + Math.ceil(c.content.length / 3), 0);
                } catch (err) {
                    console.error('[met] reference embed batch failed (keyword fallback will be used):', err.message);
                    vectors = [];
                }
            }
            const values = [];
            const params = [];
            batch.forEach((c, j) => {
                values.push('(?, ?, ?, ?, ?, ?, ?)');
                params.push(
                    referenceId, i + j, c.page, c.content, Math.ceil(c.content.length / 3),
                    vectors[j] ? MODELS.embedding : null, vectors[j] ? JSON.stringify(vectors[j]) : null
                );
            });
            await db.query(
                `INSERT INTO tam24_ai_reference_chunks (reference_id, chunk_index, page_hint, content, token_estimate, embedding_model, embedding) VALUES ${values.join(',')}`,
                params
            );
        }

        await setStatus(db, referenceId, 'ready', { chunkCount: chunks.length, pages: total || pages.length || null });
        await db.query(`UPDATE tam24_ai_files SET status = 'ready', pages = ? WHERE id = ?`, [total || pages.length || null, ref.file_id]);

        await logUsage(db, {
            userId: userId ?? ref.user_id, conversationId: conversationId ?? ref.conversation_id,
            operationType: 'embedding', model: embeddedCount ? MODELS.embedding : null,
            inputTokens: embedTokens, units: chunks.length, durationMs: Date.now() - started,
            retrievedReferenceIds: [referenceId],
        });
    } catch (err) {
        console.error('[met] reference indexing failed:', err.message);
        await setStatus(db, referenceId, 'failed', { error: err.message });
        await db.query(`UPDATE tam24_ai_files SET status = 'failed' WHERE id = ?`, [ref.file_id]).catch(() => {});
        await logUsage(db, {
            userId: userId ?? ref.user_id, conversationId: conversationId ?? ref.conversation_id,
            operationType: 'embedding', status: 'error', errorCode: err.code || 'PDF_INDEX_FAILED', errorMessage: err.message,
            durationMs: Date.now() - started, retrievedReferenceIds: [referenceId],
        });
    }
}

async function removeReference(db, { userId, conversationId, referenceId }) {
    const [res] = await db.query(
        `UPDATE tam24_ai_conversation_references SET is_active = 0, updated_at = NOW()
          WHERE id = ? AND conversation_id = ? AND user_id = ? AND is_active = 1`,
        [referenceId, conversationId, userId]
    );
    if (!res.affectedRows) throw Object.assign(new Error('منبع یافت نشد.'), { code: 'NOT_FOUND', status: 404 });
    // Chunks are only useful for active references; free the space now.
    await db.query(`DELETE FROM tam24_ai_reference_chunks WHERE reference_id = ?`, [referenceId]).catch(() => {});
}

/**
 * Best excerpts across all ready references of this conversation.
 * Returns { text, references: [{id, title}], chunkIds } or null.
 */
async function retrieveReferenceContext(db, { conversationId, queryText, topK = CONTEXT_LIMITS.ragTopK } = {}) {
    if (!featureStatus().pdfReferences || !conversationId) return null;
    const [refs] = await db.query(
        `SELECT id, title FROM tam24_ai_conversation_references WHERE conversation_id = ? AND is_active = 1 AND status = 'ready'`,
        [conversationId]
    );
    if (!refs.length) return null;
    const refIds = refs.map((r) => r.id);
    const [rows] = await db.query(
        `SELECT id, reference_id, chunk_index, page_hint, content, embedding
         FROM tam24_ai_reference_chunks WHERE reference_id IN (${refIds.map(() => '?').join(',')})`,
        refIds
    );
    if (!rows.length) return null;

    const titleOf = new Map(refs.map((r) => [r.id, r.title]));
    let ranked = null;

    const withVectors = rows.map((r) => ({ ...r, vector: r.embedding ? safeParseEmbedding(r.embedding) : null })).filter((r) => r.vector);
    if (withVectors.length && featureStatus().embeddings) {
        try {
            const [qv] = await aiProvider.embed({ input: String(queryText || '').slice(0, 2000) });
            if (qv) {
                ranked = withVectors
                    .map((r) => ({ ...r, score: cosineSimilarity(qv, r.vector) }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, topK);
            }
        } catch (err) {
            console.error('[met] reference embed query failed, keyword fallback:', err.message);
        }
    }
    if (!ranked) {
        const tokens = tokenize(queryText);
        if (!tokens.length) return null;
        ranked = rows
            .map((r) => ({ ...r, score: keywordScore(r.content, tokens) }))
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }
    if (!ranked.length) return null;

    const text = ranked
        .map((r) => `[${titleOf.get(r.reference_id) || 'منبع'}${r.page_hint ? ` — صفحه ${r.page_hint}` : ''}]\n${r.content}`)
        .join('\n\n---\n\n')
        .slice(0, CONTEXT_LIMITS.ragMaxChars);
    const used = [...new Set(ranked.map((r) => r.reference_id))];
    return {
        text,
        references: used.map((id) => ({ id, title: titleOf.get(id) })),
        chunkIds: ranked.map((r) => r.id),
    };
}

module.exports = {
    listReferences,
    addReference,
    removeReference,
    indexReference,
    retrieveReferenceContext,
    countActive,
};
