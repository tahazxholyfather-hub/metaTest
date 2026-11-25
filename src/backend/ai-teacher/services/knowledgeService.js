'use strict';

const { CONTEXT_LIMITS, featureStatus } = require('../config');
const { tokenize, keywordScore, cosineSimilarity, safeParseEmbedding } = require('./ragService');
const aiProvider = require('./aiProvider');

/**
 * Knowledge base retrieval — human-authored teaching material stored in
 * tam24_ai_knowledge (subject, grade, chapter, content, examples, key points).
 *
 *   user question → subject + free text → FULLTEXT candidates (fast, indexed)
 *   → re-rank by keyword overlap (and by embeddings when chunks are embedded)
 *   → top-K items become a KNOWLEDGE block in the system prompt.
 *
 * If nothing relevant exists we return null and Met answers normally — the
 * prompt explicitly forbids pretending knowledge exists when it doesn't.
 */

const MIN_KEYWORD_SCORE = 0.08;

function buildBooleanQuery(tokens) {
    // MariaDB FULLTEXT in BOOLEAN MODE; keep it to the most informative tokens.
    return tokens
        .filter((t) => t.length >= 3)
        .slice(0, 12)
        .map((t) => `${t.replace(/[+\-<>()~*"@]/g, '')}*`)
        .filter((t) => t.length > 1)
        .join(' ');
}

async function fulltextCandidates(db, { subjectKey, tokens, limit = 20 }) {
    const q = buildBooleanQuery(tokens);
    if (!q) return [];
    try {
        const [rows] = await db.query(
            `SELECT id, subject_key, grade, chapter, topic, title, content, examples, key_points, keywords,
                    MATCH(title, topic, chapter, keywords, key_points, content) AGAINST (? IN BOOLEAN MODE) AS ft_score
             FROM tam24_ai_knowledge
             WHERE is_active = 1 AND (subject_key = ? OR ? = 'general')
             HAVING ft_score > 0
             ORDER BY ft_score DESC
             LIMIT ?`,
            [q, subjectKey, subjectKey, limit]
        );
        return rows;
    } catch {
        // FULLTEXT not available (table missing / older engine) — degrade to LIKE on a few tokens.
        try {
            const like = tokens.slice(0, 4).map(() => '(title LIKE ? OR keywords LIKE ? OR topic LIKE ? OR content LIKE ?)').join(' OR ');
            if (!like) return [];
            const params = [subjectKey, subjectKey];
            for (const t of tokens.slice(0, 4)) params.push(`%${t}%`, `%${t}%`, `%${t}%`, `%${t}%`);
            const [rows] = await db.query(
                `SELECT id, subject_key, grade, chapter, topic, title, content, examples, key_points, keywords, 0 AS ft_score
                 FROM tam24_ai_knowledge
                 WHERE is_active = 1 AND (subject_key = ? OR ? = 'general') AND (${like})
                 LIMIT ?`,
                [...params, limit]
            );
            return rows;
        } catch {
            return [];
        }
    }
}

async function embeddedChunksFor(db, knowledgeIds) {
    if (!knowledgeIds.length) return new Map();
    try {
        const [rows] = await db.query(
            `SELECT knowledge_id, embedding FROM tam24_ai_knowledge_chunks
             WHERE knowledge_id IN (${knowledgeIds.map(() => '?').join(',')}) AND embedding IS NOT NULL`,
            knowledgeIds
        );
        const map = new Map();
        for (const r of rows) {
            const vec = safeParseEmbedding(r.embedding);
            if (!vec) continue;
            if (!map.has(r.knowledge_id)) map.set(r.knowledge_id, []);
            map.get(r.knowledge_id).push(vec);
        }
        return map;
    } catch {
        return new Map();
    }
}

function itemText(item) {
    return [item.title, item.topic, item.chapter, item.keywords, item.key_points, item.content].filter(Boolean).join('\n');
}

function renderItem(item, maxChars) {
    const head = [item.title, item.chapter ? `فصل: ${item.chapter}` : null, item.grade ? `پایه: ${item.grade}` : null].filter(Boolean).join(' — ');
    const body = [
        String(item.content || '').trim(),
        item.key_points ? `نکات کلیدی:\n${String(item.key_points).trim()}` : null,
        item.examples ? `مثال:\n${String(item.examples).trim()}` : null,
    ].filter(Boolean).join('\n');
    return `### ${head}\n${body}`.slice(0, maxChars);
}

/**
 * Returns { items: [{id, title, score}], text } or null when nothing relevant.
 */
async function retrieveKnowledge(db, { subjectKey, queryText, topK = CONTEXT_LIMITS.knowledgeTopK } = {}) {
    if (!featureStatus().knowledgeBase || !subjectKey) return null;
    const tokens = tokenize(queryText);
    if (tokens.length < 2) return null;

    const candidates = await fulltextCandidates(db, { subjectKey, tokens });
    if (!candidates.length) return null;

    let scored = candidates.map((c) => ({ item: c, score: keywordScore(itemText(c), tokens) + Number(c.ft_score || 0) * 0.02 }));

    // Embedding re-rank when the KB has vectors and the provider is up.
    if (featureStatus().embeddings) {
        const vectors = await embeddedChunksFor(db, candidates.map((c) => c.id));
        if (vectors.size) {
            try {
                const [qv] = await aiProvider.embed({ input: String(queryText).slice(0, 2000) });
                if (qv) {
                    scored = scored.map((s) => {
                        const vecs = vectors.get(s.item.id) || [];
                        const best = vecs.reduce((m, v) => Math.max(m, cosineSimilarity(qv, v)), 0);
                        return { ...s, score: s.score + best };
                    });
                }
            } catch (err) {
                console.error('[met] knowledge embed re-rank skipped:', err.message);
            }
        }
    }

    const ranked = scored
        .filter((s) => s.score >= MIN_KEYWORD_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    if (!ranked.length) return null;

    const perItem = Math.floor(CONTEXT_LIMITS.knowledgeMaxChars / ranked.length);
    const text = ranked.map((s) => renderItem(s.item, perItem)).join('\n\n').slice(0, CONTEXT_LIMITS.knowledgeMaxChars);
    return {
        items: ranked.map((s) => ({ id: s.item.id, title: s.item.title, chapter: s.item.chapter, score: Math.round(s.score * 1000) / 1000 })),
        text,
    };
}

/** Audit which knowledge items shaped a reply. Never throws. */
async function logKnowledgeUsage(dbOrConn, { items, userId, conversationId = null, messageId = null }) {
    if (!items?.length) return;
    try {
        const values = items.map(() => '(?, ?, ?, ?, ?)').join(',');
        const params = [];
        for (const it of items) params.push(it.id, userId, conversationId, messageId, it.score ?? null);
        await dbOrConn.query(
            `INSERT INTO tam24_ai_knowledge_usage (knowledge_id, user_id, conversation_id, message_id, score) VALUES ${values}`,
            params
        );
    } catch (err) {
        console.error('[met] knowledge usage log skipped:', err.message);
    }
}

module.exports = { retrieveKnowledge, logKnowledgeUsage, buildBooleanQuery };
