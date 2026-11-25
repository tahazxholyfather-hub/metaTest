'use strict';

const { PROVIDER } = require('../config');

/**
 * One row in tam24_ai_usage_logs per AI operation — chat, vision, image
 * generation, STT, TTS, embeddings, titles, memory extraction, summaries,
 * suggestions. Never throws: a logging failure must not break the product.
 */

const json = (v) => (v == null ? null : JSON.stringify(v));

async function logUsage(dbOrConn, {
    userId,
    conversationId = null,
    messageId = null,
    operationType = 'chat',
    subjectKey = null,
    model = null,
    provider = PROVIDER.name,
    inputTokens = 0,
    outputTokens = 0,
    cachedTokens = 0,
    totalTokens = null,
    coinCost = 0,
    costUsd = 0,
    costIrr = 0,
    exchangeRateIrr = 0,
    units = null,
    durationMs = null,
    status = 'success',
    errorCode = null,
    errorMessage = null,
    retrievedKnowledgeIds = null,
    retrievedQuestionIds = null,
    retrievedReferenceIds = null,
    toolCalls = null,
    attachedFiles = null,
}) {
    try {
        const [res] = await dbOrConn.query(
            `INSERT INTO tam24_ai_usage_logs
             (user_id, conversation_id, message_id, operation_type, subject_key, model, provider,
              input_tokens, output_tokens, cached_tokens, total_tokens, coin_cost, energy_cost,
              cost_usd, cost_irr, exchange_rate_irr, units, request_duration_ms,
              success, status, error_code, error_message,
              retrieved_knowledge_ids, retrieved_question_ids, retrieved_reference_ids, tool_calls, attached_files)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId, conversationId, messageId, operationType, subjectKey, model, provider,
                inputTokens || 0, outputTokens || 0, cachedTokens || 0,
                totalTokens == null ? (inputTokens || 0) + (outputTokens || 0) : totalTokens,
                coinCost || 0, coinCost || 0,
                costUsd || 0, costIrr || 0, exchangeRateIrr || 0, units, durationMs,
                status === 'success' ? 1 : 0, status, errorCode, errorMessage ? String(errorMessage).slice(0, 500) : null,
                json(retrievedKnowledgeIds), json(retrievedQuestionIds), json(retrievedReferenceIds), json(toolCalls), json(attachedFiles),
            ]
        );
        return res.insertId;
    } catch (err) {
        console.error('[met] usage log skipped:', err.message);
        return null;
    }
}

async function logToolCall(dbOrConn, { userId, conversationId = null, messageId = null, toolName, args = null, resultSummary = null, success = true, errorMessage = null, durationMs = null }) {
    try {
        await dbOrConn.query(
            `INSERT INTO tam24_ai_tool_calls
             (user_id, conversation_id, message_id, tool_name, arguments, result_summary, success, error_message, duration_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, conversationId, messageId, toolName, json(args), resultSummary ? String(resultSummary).slice(0, 500) : null, success ? 1 : 0, errorMessage ? String(errorMessage).slice(0, 300) : null, durationMs]
        );
    } catch (err) {
        console.error('[met] tool-call log skipped:', err.message);
    }
}

module.exports = { logUsage, logToolCall };
