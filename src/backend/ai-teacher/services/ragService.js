'use strict';

const crypto = require('crypto');
const { CONTEXT_LIMITS, MODELS, featureStatus } = require('../config');
const aiProvider = require('./aiProvider');

/**
 * Retrieval for the textbook each subject must "always answer based on".
 *
 * The whole PDF is never sent to the model. Instead:
 *   1. Offline (scripts/ingestBook.js) chunks + embeds the book once.
 *   2. At request time we embed only the student's message, rank the
 *      cached chunk vectors by cosine similarity, and inject the top few
 *      hundred words as "TEXTBOOK REFERENCE" — a few cents of embedding
 *      cost instead of resending tens of thousands of tokens per turn.
 *   3. If embeddings aren't ready yet (book not ingested), we degrade to a
 *      keyword-overlap search over the raw text so answers are still
 *      grounded, never empty-handed.
 *
 * In-memory caches keep this fast; TTLs keep it correct after re-ingestion.
 */

const CHUNK_SIZE = 1100;
const CHUNK_OVERLAP = 150;
const BOOK_TTL_MS = 5 * 60 * 1000;
const CHUNK_TTL_MS = 5 * 60 * 1000;

const bookCache = new Map(); // subjectKey -> { book, expiresAt }
const chunkCache = new Map(); // bookId -> { rows, expiresAt }

function hashOf(text) {
    return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

/** Split long text into overlapping, roughly sentence-aligned chunks. */
function chunkText(text, { chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP } = {}) {
    const clean = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!clean) return [];

    const chunks = [];
    let start = 0;
    while (start < clean.length) {
        let end = Math.min(clean.length, start + chunkSize);
        if (end < clean.length) {
            const softBreak = clean.lastIndexOf('\n', end);
            const periodBreak = Math.max(clean.lastIndexOf('. ', end), clean.lastIndexOf('. ', end));
            const boundary = Math.max(softBreak, periodBreak);
            if (boundary > start + chunkSize * 0.5) end = boundary + 1;
        }
        const piece = clean.slice(start, end).trim();
        if (piece) chunks.push(piece);
        if (end >= clean.length) break;
        start = Math.max(end - overlap, start + 1);
    }
    return chunks;
}

function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (!normA || !normB) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function tokenize(text) {
    return String(text || '')
        .toLowerCase()
        .match(/[\p{L}\p{N}]{2,}/gu) || [];
}

function keywordScore(chunk, queryTokens) {
    if (!queryTokens.length) return 0;
    const chunkTokens = tokenize(chunk);
    if (!chunkTokens.length) return 0;
    const set = new Set(chunkTokens);
    let hits = 0;
    for (const t of queryTokens) if (set.has(t)) hits += 1;
    return hits / Math.sqrt(chunkTokens.length);
}

async function loadBookForSubject(db, subjectKey) {
    const cached = bookCache.get(subjectKey);
    if (cached && cached.expiresAt > Date.now()) return cached.book;

    let book = null;
    try {
        const [[row]] = await db.query(
            `SELECT id, title, subject, subject_key, grade, publisher, pdf_url, content_text, content_summary
             FROM tam24_ai_books
             WHERE subject_key = ? AND is_active = 1
             ORDER BY sort_order ASC, id ASC
             LIMIT 1`,
            [subjectKey]
        );
        book = row || null;
    } catch {
        book = null;
    }

    bookCache.set(subjectKey, { book, expiresAt: Date.now() + BOOK_TTL_MS });
    return book;
}

async function loadChunksForBook(db, bookId) {
    const cached = chunkCache.get(bookId);
    if (cached && cached.expiresAt > Date.now()) return cached.rows;

    let rows = [];
    try {
        const [result] = await db.query(
            `SELECT id, chunk_index, content, embedding
             FROM tam24_ai_book_chunks
             WHERE book_id = ?
             ORDER BY chunk_index ASC`,
            [bookId]
        );
        rows = result.map((r) => ({
            id: r.id,
            index: r.chunk_index,
            content: r.content,
            embedding: r.embedding ? safeParseEmbedding(r.embedding) : null,
        }));
    } catch {
        rows = [];
    }

    chunkCache.set(bookId, { rows, expiresAt: Date.now() + CHUNK_TTL_MS });
    return rows;
}

function safeParseEmbedding(raw) {
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function invalidateBookCache(subjectKey) {
    if (subjectKey) bookCache.delete(subjectKey);
    else bookCache.clear();
}

function invalidateChunkCache(bookId) {
    if (bookId) chunkCache.delete(bookId);
    else chunkCache.clear();
}

/**
 * Main entry point used by promptBuilder: get the best textbook excerpt
 * for this subject given the student's current message.
 */
async function retrieveContext(db, { subjectKey, queryText, topK = CONTEXT_LIMITS.ragTopK } = {}) {
    if (!featureStatus().pdfReferences || !subjectKey || subjectKey === 'general') return null;

    const book = await loadBookForSubject(db, subjectKey);
    if (!book) return null;

    const chunksWithEmbeddings = (await loadChunksForBook(db, book.id)).filter((c) => Array.isArray(c.embedding));

    if (chunksWithEmbeddings.length) {
        try {
            const [queryVector] = await aiProvider.embed({ input: String(queryText || '').slice(0, 2000) });
            if (queryVector) {
                const ranked = chunksWithEmbeddings
                    .map((c) => ({ ...c, score: cosineSimilarity(queryVector, c.embedding) }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, topK);
                const text = joinChunks(ranked.map((c) => c.content));
                return { book, text, method: 'embeddings' };
            }
        } catch (err) {
            console.error('[ai-teacher] rag embed query failed, falling back to keyword search:', err.message);
        }
    }

    // Fallback: on-the-fly keyword search over raw content (no embedding cost).
    const source = book.content_text || book.content_summary;
    if (source) {
        const tokens = tokenize(queryText);
        const chunks = chunkText(source);
        if (chunks.length > topK && tokens.length) {
            const ranked = chunks
                .map((content, index) => ({ content, index, score: keywordScore(content, tokens) }))
                .sort((a, b) => b.score - a.score)
                .slice(0, topK)
                .filter((c) => c.score > 0)
                .sort((a, b) => a.index - b.index);
            if (ranked.length) {
                return { book, text: joinChunks(ranked.map((c) => c.content)), method: 'keyword' };
            }
        }
        return { book, text: source.slice(0, CONTEXT_LIMITS.ragMaxChars), method: 'summary' };
    }

    return null;
}

function joinChunks(pieces) {
    return pieces.join('\n\n---\n\n').slice(0, CONTEXT_LIMITS.ragMaxChars);
}

/**
 * Ingestion primitive used by scripts/ingestBook.js: chunk + embed + upsert.
 * Skips re-embedding chunks whose content hash is unchanged.
 */
async function ingestBookText(db, bookId, subjectKey, fullText) {
    const pieces = chunkText(fullText);
    const existingHashes = new Map();
    try {
        const [rows] = await db.query(
            `SELECT chunk_index, content_hash FROM tam24_ai_book_chunks WHERE book_id = ?`,
            [bookId]
        );
        for (const r of rows) existingHashes.set(r.chunk_index, r.content_hash);
    } catch { /* table may be fresh */ }

    let embedded = 0;
    let skipped = 0;

    for (let i = 0; i < pieces.length; i++) {
        const content = pieces[i];
        const hash = hashOf(content);
        if (existingHashes.get(i) === hash) {
            skipped += 1;
            continue;
        }

        let embedding = null;
        try {
            const [vector] = await aiProvider.embed({ input: content });
            embedding = vector || null;
        } catch (err) {
            console.error(`[ai-teacher] embed failed for chunk ${i}:`, err.message);
        }

        await db.query(
            `INSERT INTO tam24_ai_book_chunks (book_id, subject_key, chunk_index, content, content_hash, token_estimate, embedding_model, embedding)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               content = VALUES(content), content_hash = VALUES(content_hash),
               token_estimate = VALUES(token_estimate), embedding_model = VALUES(embedding_model),
               embedding = VALUES(embedding), updated_at = NOW()`,
            [
                bookId,
                subjectKey,
                i,
                content,
                hash,
                Math.ceil(content.length / 4),
                embedding ? MODELS.embedding : null,
                embedding ? JSON.stringify(embedding) : null,
            ]
        );
        embedded += 1;
    }

    // Drop stale chunks beyond the new chunk count (book got shorter on re-ingest).
    await db.query(
        `DELETE FROM tam24_ai_book_chunks WHERE book_id = ? AND chunk_index >= ?`,
        [bookId, pieces.length]
    );

    invalidateChunkCache(bookId);
    invalidateBookCache(subjectKey);

    return { totalChunks: pieces.length, embedded, skipped };
}

module.exports = {
    chunkText,
    cosineSimilarity,
    tokenize,
    keywordScore,
    hashOf,
    safeParseEmbedding,
    joinChunks,
    retrieveContext,
    ingestBookText,
    invalidateBookCache,
    invalidateChunkCache,
};
