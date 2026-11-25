'use strict';

/**
 * Met — one streaming chat turn (SSE).
 *
 *   validate → resolve conversation/subject → reserve coins → persist user
 *   message → gather context (memory, summary, textbook RAG, curated
 *   knowledge, student PDFs) → optional tool round (question bank, learning
 *   profile, image generation) → stream answer → settle coins → persist
 *   assistant message + usage log → background: memory, title.
 *
 * Events: status, meta, user_message, assistant_start, delta, tool,
 * attachment, done, title, error.
 *
 * Stop: when the client aborts the request, the provider stream is aborted,
 * the partial answer is saved with status='stopped' and only the tokens
 * actually consumed are charged.
 */

const { CONTEXT_LIMITS, MODELS, dailyCoinsForPlan, featureStatus } = require('./config');
const { isValidSubject } = require('./subjects');
const {
    db, loadUserRow, ensureSettings, walletFromBuckets, loadSubjectRow, userMessageForError,
} = require('./shared');
const coinWallet = require('./services/coinWallet');
const pricing = require('./services/pricing');
const aiProvider = require('./services/aiProvider');
const promptBuilder = require('./services/promptBuilder');
const memoryService = require('./services/memoryService');
const conversationService = require('./services/conversationService');
const ragService = require('./services/ragService');
const knowledgeService = require('./services/knowledgeService');
const referencesService = require('./services/referencesService');
const toolsService = require('./services/toolsService');
const fileStorage = require('./services/fileStorage');
const { logUsage } = require('./services/usageLogger');

const DATA_TOOL_TRIGGERS = /(نمره|امتیاز|عملکرد|فعالیت|پیشرفت|چطورم|چطور بودم|رتبه|ضعف|قوی|activity|progress|score|how am i)/i;
const QUESTION_TOOL_TRIGGERS = /(سوال|سؤال|تست|تمرین|نمونه|آزمون|امتحان|کنکور|مسئله|مساله|question|quiz|exercise|practice)/i;
const IMAGE_TOOL_TRIGGERS = /(تصویر|عکس|نقاشی|دیاگرام|نمودار|شکل|رسم|بکش|diagram|illustrat|draw|image|picture|schematic|sketch)/i;

function sse(res) {
    let closed = false;
    res.on('close', () => { closed = true; });
    return {
        isClosed: () => closed,
        send(event, data) {
            if (closed || res.writableEnded) return;
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        },
        end() {
            if (!res.writableEnded) res.end();
        },
    };
}

/** Resolve uploaded file ids into message attachments + vision parts. */
async function resolveImageAttachments(userId, raw) {
    const list = Array.isArray(raw) ? raw.slice(0, CONTEXT_LIMITS.maxAttachmentsPerMessage) : [];
    const out = [];
    for (const a of list) {
        const fileId = Number(a?.fileId);
        if (!fileId) continue;
        const row = await fileStorage.getFileForUser(db, fileId, userId);
        if (!row || row.kind !== 'image') continue;
        out.push({
            type: 'image', fileId: row.id, url: row.public_url, mimeType: row.mime_type, width: row.width, height: row.height,
            // Transient: read from disk for the provider; not persisted.
            dataUrl: await fileStorage.readAsDataUrl('image', row.stored_name, row.mime_type).catch(() => null),
        });
    }
    return out;
}

const stripTransient = (atts) => atts.map(({ dataUrl, ...rest }) => rest);

const streamChat = async (req, res) => {
    const userId = req.user.id;
    const regenerateMessageId = req.body?.regenerateMessageId ? Number(req.body.regenerateMessageId) : null;
    let message = String(req.body?.message || '').trim();
    let conversationId = req.body?.conversationId ? Number(req.body.conversationId) : null;
    const requestedSubject = req.body?.subjectKey ? String(req.body.subjectKey).toLowerCase() : null;
    const inputMode = req.body?.inputMode === 'voice' ? 'voice' : 'text';

    if (!regenerateMessageId && !message && !(Array.isArray(req.body?.attachments) && req.body.attachments.length)) {
        return res.status(400).json({ success: false, code: 'EMPTY_MESSAGE', message: 'پیام نمی‌تواند خالی باشد.' });
    }
    if (message.length > CONTEXT_LIMITS.maxUserMessageChars) {
        return res.status(400).json({ success: false, code: 'MESSAGE_TOO_LONG', message: 'پیام بیش از حد طولانی است.' });
    }
    if (requestedSubject && !isValidSubject(requestedSubject)) {
        return res.status(400).json({ success: false, code: 'INVALID_SUBJECT', message: 'موضوع نامعتبر است.' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    const out = sse(res);

    const abort = new AbortController();
    let generating = false;
    req.on('close', () => { if (generating) abort.abort(); });

    const reservationRef = `msg-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let reservation = null;
    let conn = null;
    let subjectKey = null;
    let userMessageId = null;
    const turnStarted = Date.now();

    try {
        const user = await loadUserRow(userId);
        if (!user) throw Object.assign(new Error('user not found'), { code: 'USER_NOT_FOUND' });

        // ── Conversation & subject ──────────────────────────────────────────
        let conversation = conversationId ? await conversationService.getConversationForUser(db, conversationId, userId) : null;
        if (conversationId && !conversation) throw Object.assign(new Error('conversation not found'), { code: 'CONVERSATION_NOT_FOUND' });

        subjectKey = requestedSubject || conversation?.subject_key || user.ai_last_subject || 'general';
        if (!isValidSubject(subjectKey)) subjectKey = 'general';

        if (!conversation) {
            conversation = await conversationService.createConversation(db, { userId, subjectKey });
        } else if (requestedSubject && requestedSubject !== conversation.subject_key) {
            await conversationService.setConversationSubject(db, conversation.id, requestedSubject);
            conversation.subject_key = requestedSubject;
        }
        conversationId = conversation.id;
        await db.query(`UPDATE tam24_users SET ai_last_subject = ? WHERE id = ?`, [subjectKey, userId]);

        // ── Regenerate: reuse the original user turn ────────────────────────
        let attachments = [];
        let previousAssistant = null;
        if (regenerateMessageId) {
            previousAssistant = await conversationService.getMessageForUser(db, regenerateMessageId, userId);
            if (!previousAssistant || previousAssistant.role !== 'assistant' || previousAssistant.conversation_id !== conversationId) {
                throw Object.assign(new Error('message not found'), { code: 'MESSAGE_NOT_FOUND' });
            }
            const userTurn = await conversationService.getUserTurnBefore(db, conversationId, regenerateMessageId);
            if (!userTurn) throw Object.assign(new Error('no user turn'), { code: 'MESSAGE_NOT_FOUND' });
            userMessageId = userTurn.id;
            message = String(userTurn.content || '');
            attachments = await resolveImageAttachments(userId, userTurn.attachments);
        } else {
            attachments = await resolveImageAttachments(userId, req.body?.attachments);
        }
        const hasImageAttachment = attachments.length > 0;
        if (hasImageAttachment && !featureStatus().vision) {
            throw Object.assign(new Error('vision disabled'), { code: 'VISION_UNAVAILABLE' });
        }

        const subjectRow = await loadSubjectRow(subjectKey);
        const subject = promptBuilder.resolveSubjectPrompts(subjectKey, subjectRow);
        const settings = await ensureSettings(userId);

        // ── Coins: quota, estimate, reserve ─────────────────────────────────
        const grant = await coinWallet.applyDailyGrant(db, userId, user.current_plan);
        const wallet = grant.wallet;
        const dailyQuota = dailyCoinsForPlan(user.current_plan);
        // Fair-use guard: shrink replies quietly when coins run low instead of cutting the student off.
        const lowBalance = wallet.total <= Math.max(15, Math.round(dailyQuota * 0.15));

        const model = promptBuilder.resolveModel(settings, subject, { hasImageAttachment, lowBalance });
        const maxTokens = promptBuilder.resolveMaxOutputTokens(subject, settings, { lowBalance });
        const typical = pricing.estimateTypicalCoins({ model, maxOutputTokens: maxTokens });
        const maxEst = pricing.estimateMaxCoins({ model, maxOutputTokens: maxTokens, allowImage: featureStatus().imageGeneration });

        if (wallet.total < typical.coins) {
            throw Object.assign(new Error('insufficient coins'), {
                code: 'INSUFFICIENT_COINS', balance: wallet.total, needed: typical.coins, wallet: walletFromBuckets(wallet, user.current_plan),
            });
        }
        const reserveAmount = Math.max(typical.coins, Math.min(wallet.total, maxEst.coins));

        conn = await db.getConnection();
        await conn.beginTransaction();
        reservation = await coinWallet.reserveCoins(conn, userId, reserveAmount, reservationRef, { operationType: 'chat', conversationId });
        await conn.commit();
        conn.release();
        conn = null;

        out.send('status', { status: 'thinking' });
        out.send('meta', {
            conversationId, subjectKey, reserved: reservation.reserved, typicalCoins: typical.coins,
            wallet: walletFromBuckets(reservation.wallet, user.current_plan), regenerateMessageId: regenerateMessageId || null,
        });

        const isFirstExchange = Number(conversation.message_count || 0) === 0;

        // ── Persist the user turn ───────────────────────────────────────────
        if (!regenerateMessageId) {
            const [ins] = await db.query(
                `INSERT INTO tam24_ai_messages (conversation_id, role, content, attachments, subject_key) VALUES (?, 'user', ?, ?, ?)`,
                [conversationId, message, attachments.length ? JSON.stringify(stripTransient(attachments)) : null, subjectKey]
            );
            userMessageId = ins.insertId;
            if (attachments.length) {
                await fileStorage.attachFileToMessage(db, attachments.map((a) => a.fileId), { conversationId, messageId: userMessageId });
            }
            out.send('user_message', { id: userMessageId, role: 'user', content: message, attachments: stripTransient(attachments), conversationId, createdAt: new Date().toISOString() });
        }

        // ── Context ─────────────────────────────────────────────────────────
        const f = featureStatus();
        const [memories, summary, recent, ragContext, knowledgeContext, referenceContext] = await Promise.all([
            f.memory && settings.memoryEnabled ? memoryService.getActiveMemories(db, userId, CONTEXT_LIMITS.maxMemoryItems, { subjectKey }).catch(() => []) : [],
            memoryService.maybeSummarizeConversation(db, conversation, { userId }).catch(() => conversation.summary || null),
            conversationService.getRecentMessages(db, conversationId, CONTEXT_LIMITS.recentMessages),
            subjectKey !== 'general' ? ragService.retrieveContext(db, { subjectKey, queryText: message }).catch(() => null) : null,
            f.knowledgeBase && settings.knowledgeEnabled ? knowledgeService.retrieveKnowledge(db, { subjectKey, queryText: message }).catch(() => null) : null,
            f.pdfReferences && settings.pdfReferencesEnabled ? referencesService.retrieveReferenceContext(db, { conversationId, queryText: message }).catch(() => null) : null,
        ]);
        const recentWithoutCurrent = recent.filter((m) => m.id !== userMessageId && m.id !== regenerateMessageId);

        const { systemPrompt } = promptBuilder.buildMetPrompt({
            subjectKey, subjectRow, user, memories, settings, conversationSummary: summary,
            ragContext, knowledgeContext, referenceContext, hasImageAttachment, hasAudioTranscript: inputMode === 'voice', lowBalance,
        });
        let providerMessages = promptBuilder.toProviderMessages({
            systemPrompt, recentMessages: recentWithoutCurrent, currentUserMessage: message, currentAttachments: attachments,
        });

        // ── Optional tool round ─────────────────────────────────────────────
        const collectedAttachments = [];
        const toolCallLog = [];
        let toolCoinSurcharge = 0;
        let retrievedQuestionIds = [];
        const wantsTools = f.tools && !hasImageAttachment
            && (DATA_TOOL_TRIGGERS.test(message) || QUESTION_TOOL_TRIGGERS.test(message) || (f.imageGeneration && IMAGE_TOOL_TRIGGERS.test(message)));

        if (wantsTools) {
            try {
                const availableTools = toolsService.getAvailableTools();
                if (availableTools.length) {
                    out.send('status', { status: 'processing' });
                    const toolPass = await aiProvider.generate({
                        messages: providerMessages, model: MODELS.tools, maxTokens: Math.min(maxTokens, 400), temperature: 0.2, tools: availableTools,
                    });
                    if (Array.isArray(toolPass.toolCalls) && toolPass.toolCalls.length) {
                        providerMessages = [...providerMessages, { role: 'assistant', content: toolPass.content || null, tool_calls: toolPass.toolCalls }];
                        for (const call of toolPass.toolCalls.slice(0, CONTEXT_LIMITS.maxToolCallsPerTurn)) {
                            const name = call?.function?.name;
                            out.send('tool', { name, status: 'running' });
                            const result = await toolsService.executeToolCall(call, { userId, conversationId, messageId: userMessageId });
                            if (result.attachment) { collectedAttachments.push(result.attachment); out.send('attachment', result.attachment); }
                            toolCoinSurcharge += result.coinSurcharge || 0;
                            if (result.questionIds) retrievedQuestionIds = retrievedQuestionIds.concat(result.questionIds);
                            toolCallLog.push({ name, ok: !result.content?.error });
                            out.send('tool', { name, status: result.content?.error ? 'error' : 'done' });
                            providerMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result.content ?? {}) });
                        }
                    }
                    const tu = toolPass.usage || {};
                    await logUsage(db, {
                        userId, conversationId, messageId: userMessageId, operationType: 'tool_call', subjectKey, model: toolPass.model || MODELS.tools,
                        inputTokens: tu.inputTokens, outputTokens: tu.outputTokens, cachedTokens: tu.cachedTokens, toolCalls: toolCallLog,
                    });
                    // Tool-pass tokens are billed with the main answer (same reservation).
                    toolCoinSurcharge += pricing.quoteUsage({ inputTokens: tu.inputTokens, outputTokens: tu.outputTokens, cachedTokens: tu.cachedTokens, model: toolPass.model || MODELS.tools }).coins;
                }
            } catch (err) {
                console.error('[met] tool round skipped (continuing without tools):', err.message);
            }
        }

        // ── Stream the answer ───────────────────────────────────────────────
        out.send('status', { status: 'generating' });
        out.send('assistant_start', { conversationId });

        const startedAt = Date.now();
        let fullText = '';
        let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedTokens: 0 };
        let usedModel = model;
        let stopped = false;
        generating = true;

        try {
            for await (const chunk of aiProvider.stream({
                messages: providerMessages, model, maxTokens, temperature: promptBuilder.resolveTemperature(settings), signal: abort.signal,
            })) {
                if (chunk.type === 'delta') {
                    fullText += chunk.text;
                    out.send('delta', { text: chunk.text });
                } else if (chunk.type === 'done') {
                    fullText = chunk.content || fullText;
                    usage = chunk.usage || usage;
                    usedModel = chunk.model || model;
                    stopped = !!chunk.stopped;
                }
            }
        } catch (err) {
            // Stopped before the first byte: nothing to keep — refund everything.
            if (err.code === 'AI_STOPPED' && !fullText.trim()) throw err;
            if (err.code === 'AI_STOPPED') stopped = true;
            else throw err;
        } finally {
            generating = false;
        }
        if (stopped && !usage.totalTokens) usage = aiProvider.estimateUsage(providerMessages, fullText);

        if (!String(fullText).trim() && !collectedAttachments.length) {
            throw Object.assign(new Error('empty response'), { code: 'EMPTY_RESPONSE' });
        }

        const durationMs = Date.now() - startedAt;
        const quote = pricing.quoteUsage({
            inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cachedTokens: usage.cachedTokens || 0, model: usedModel, extraCoins: toolCoinSurcharge,
        });

        // ── Settle: charge, persist, log — one transaction ──────────────────
        conn = await db.getConnection();
        await conn.beginTransaction();

        const [assistantIns] = await conn.query(
            `INSERT INTO tam24_ai_messages
             (conversation_id, role, content, input_tokens, output_tokens, cached_tokens, total_tokens, coin_cost, cost_usd, cost_irr, exchange_rate_irr,
              model, attachments, subject_key, status, latency_ms, regenerated_from)
             VALUES (?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                conversationId, fullText, usage.inputTokens, usage.outputTokens, usage.cachedTokens || 0, usage.totalTokens, quote.coins,
                quote.usd, quote.irr, quote.exchangeRateIrr, usedModel,
                collectedAttachments.length ? JSON.stringify(collectedAttachments) : null, subjectKey,
                stopped ? 'stopped' : 'complete', durationMs, regenerateMessageId || null,
            ]
        );
        const assistantMsgId = assistantIns.insertId;

        const charge = await coinWallet.finalizeCharge(conn, userId, {
            reserved: reservation.reserved, reservedDaily: reservation.reservedDaily, reservedPurchased: reservation.reservedPurchased,
            finalCost: quote.coins, referenceId: reservationRef, operationType: 'chat', conversationId, messageId: assistantMsgId,
            metadata: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, model: usedModel, usd: quote.usd, stopped },
        });
        reservation = null;

        await conn.query(`UPDATE tam24_ai_messages SET coin_cost = ? WHERE id = ?`, [charge.charged, assistantMsgId]);
        await conversationService.touchConversation(conn, conversationId, { messagesAdded: regenerateMessageId ? 1 : 2, tokens: usage.totalTokens });
        if (collectedAttachments.length) {
            await fileStorage.attachFileToMessage(conn, collectedAttachments.map((a) => a.fileId).filter(Boolean), { conversationId, messageId: assistantMsgId });
        }
        await logUsage(conn, {
            userId, conversationId, messageId: assistantMsgId, operationType: hasImageAttachment ? 'vision' : 'chat', subjectKey, model: usedModel,
            inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cachedTokens: usage.cachedTokens || 0, totalTokens: usage.totalTokens,
            coinCost: charge.charged, costUsd: quote.usd, costIrr: quote.irr, exchangeRateIrr: quote.exchangeRateIrr, durationMs,
            status: stopped ? 'stopped' : 'success',
            retrievedKnowledgeIds: knowledgeContext?.items?.map((k) => k.id) || null,
            retrievedQuestionIds: retrievedQuestionIds.length ? retrievedQuestionIds : null,
            retrievedReferenceIds: referenceContext?.references?.map((r) => r.id) || null,
            toolCalls: toolCallLog.length ? toolCallLog : null,
            attachedFiles: [...attachments.map((a) => a.fileId), ...collectedAttachments.map((a) => a.fileId)].filter(Boolean),
        });
        await conn.commit();
        conn.release();
        conn = null;

        if (knowledgeContext?.items?.length) {
            knowledgeService.logKnowledgeUsage(db, { items: knowledgeContext.items, userId, conversationId, messageId: assistantMsgId }).catch(() => {});
        }

        const walletAfter = walletFromBuckets(charge.wallet, user.current_plan);
        out.send('done', {
            message: {
                id: assistantMsgId, conversationId, role: 'assistant', content: fullText, coinCost: charge.charged,
                inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens, model: usedModel,
                attachments: collectedAttachments, status: stopped ? 'stopped' : 'complete', latencyMs: durationMs,
                regeneratedFrom: regenerateMessageId || null, createdAt: new Date().toISOString(),
            },
            wallet: walletAfter,
            charged: charge.charged,
            refunded: charge.refunded,
            subjectKey,
            durationMs,
            stopped,
        });
        out.send('status', { status: 'ready' });

        // ── Background work ─────────────────────────────────────────────────
        if (!stopped) {
            memoryService.maybeUpdateMemory(db, {
                userId, conversationId, messageCount: (conversation.message_count || 0) + 2, userMessage: message, assistantMessage: fullText,
                subjectKey, sourceMessageId: assistantMsgId, enabled: settings.memoryEnabled,
            }).catch(() => {});
        }

        const needsTitle = !regenerateMessageId && (isFirstExchange || (!conversation.title_generated && conversation.title === conversationService.NEW_TITLE));
        if (needsTitle && !out.isClosed()) {
            const title = await conversationService.generateTitle(db, {
                conversationId, userId, subjectKey, userMessage: message || 'تصویر ارسال شد', assistantMessage: fullText,
            }).catch(() => null);
            if (title) out.send('title', { conversationId, title });
        } else if (needsTitle) {
            conversationService.generateTitle(db, { conversationId, userId, subjectKey, userMessage: message || 'تصویر ارسال شد', assistantMessage: fullText }).catch(() => {});
        }

        return out.end();
    } catch (err) {
        const code = err.code || 'AI_ERROR';
        if (code !== 'INSUFFICIENT_COINS' && code !== 'AI_STOPPED') console.error('[met] streamChat', err);

        if (conn) {
            try { await conn.rollback(); } catch { /* ignore */ }
            try { conn.release(); } catch { /* ignore */ }
            conn = null;
        }

        let refunded = 0;
        let walletAfter = err.wallet || null;
        if (reservation?.reserved > 0) {
            try {
                const refund = await coinWallet.refundReservation(db, userId, reservation, reservationRef, 'بازگشت رزرو به دلیل خطای تولید پاسخ');
                refunded = refund.refunded;
                walletAfter = walletFromBuckets(refund.wallet, null);
            } catch (refundErr) {
                console.error('[met] refund failed', refundErr);
            }
        }

        await logUsage(db, {
            userId, conversationId: conversationId || null, messageId: userMessageId, operationType: 'chat', subjectKey,
            status: code === 'AI_STOPPED' ? 'stopped' : 'error', errorCode: code, errorMessage: err.message, durationMs: Date.now() - turnStarted,
        });

        out.send('error', {
            code,
            message: userMessageForError(code, 'در تولید پاسخ مشکلی پیش آمد.'),
            balance: walletAfter?.total ?? err.balance,
            needed: err.needed,
            wallet: walletAfter,
            refunded,
            conversationId: conversationId || null,
            userMessageId,
        });
        return out.end();
    }
};

module.exports = { streamChat };
