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

const { CONTEXT_LIMITS, MODELS, dailyCoinsForPlan, featureStatus, COIN_PRICING } = require('./config');
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
const questionContext = require('./services/questionContext');
const replyQuality = require('./services/replyQuality');
const { logUsage } = require('./services/usageLogger');
const { isPaidPlan } = require('../subscription/limits');
const entitlements = require('../subscription/entitlements');

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

async function sendScriptedReply({
    out, userId, conversationId, subjectKey, message, attachments, regenerateMessageId, text, actions, wallet,
}) {
    let userMessageId = null;
    if (!regenerateMessageId) {
        const [ins] = await db.query(
            `INSERT INTO tam24_ai_messages (conversation_id, role, content, attachments, subject_key) VALUES (?, 'user', ?, ?, ?)`,
            [conversationId, message, attachments.length ? JSON.stringify(stripTransient(attachments)) : null, subjectKey]
        );
        userMessageId = ins.insertId;
        out.send('user_message', {
            id: userMessageId, role: 'user', content: message, attachments: stripTransient(attachments), conversationId, createdAt: new Date().toISOString(),
        });
    }
    const stored = actions?.length ? [{ type: 'ui_actions', actions }] : null;
    const [assistant] = await db.query(
        `INSERT INTO tam24_ai_messages (conversation_id, role, content, attachments, subject_key, status, coin_cost) VALUES (?, 'assistant', ?, ?, ?, 'complete', 0)`,
        [conversationId, text, stored ? JSON.stringify(stored) : null, subjectKey]
    );
    await conversationService.touchConversation(db, conversationId, { messagesAdded: regenerateMessageId ? 1 : 2 });
    const payload = {
        id: assistant.insertId,
        conversationId,
        role: 'assistant',
        content: text,
        attachments: [],
        actions: actions || [],
        status: 'complete',
        coinCost: 0,
        createdAt: new Date().toISOString(),
    };
    out.send('status', { status: 'thinking' });
    out.send('assistant_start', { id: payload.id, conversationId });
    out.send('delta', { text });
    out.send('done', { message: payload, wallet, charged: 0, subjectKey, stopped: false });
    out.send('status', { status: 'ready' });
    return userMessageId;
}

function upgradeActions(kind) {
    if (kind === 'coins') {
        return [{ id: 'buy-coins', label: 'خرید سکه', action: 'open_coins' }];
    }
    return [
        { id: 'upgrade-plan', label: 'اشتراک ویژه', action: 'open_plans' },
        { id: 'buy-coins', label: 'خرید سکه', action: 'open_coins' },
    ];
}

const streamChat = async (req, res) => {
    const userId = req.user.id;
    const regenerateMessageId = req.body?.regenerateMessageId ? Number(req.body.regenerateMessageId) : null;
    const continueMessageId = req.body?.continueMessageId ? Number(req.body.continueMessageId) : null;
    let message = String(req.body?.message || '').trim();
    let conversationId = req.body?.conversationId ? Number(req.body.conversationId) : null;
    const requestedSubject = req.body?.subjectKey ? String(req.body.subjectKey).toLowerCase() : null;
    const inputMode = req.body?.inputMode === 'voice' ? 'voice' : 'text';
    const requestQuestionId = req.body?.questionId ? Number(req.body.questionId) : null;
    const intentKey = req.body?.intent ? String(req.body.intent) : null;

    if (continueMessageId && regenerateMessageId) {
        return res.status(400).json({ success: false, code: 'BAD_REQUEST', message: 'ادامه و ساخت دوباره را با هم نمی‌شود خواست.' });
    }
    if (!regenerateMessageId && !continueMessageId && !message && !(Array.isArray(req.body?.attachments) && req.body.attachments.length)) {
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

        let quizCtx = null;
        if (conversation?.source_type === 'quiz_question' && conversation.question_id) {
            quizCtx = await questionContext.loadQuestionContext(db, { userId, questionId: conversation.question_id });
            if (!quizCtx) throw Object.assign(new Error('question not answered'), { code: 'QUESTION_NOT_ANSWERED' });
        } else if (requestQuestionId && !conversation) {
            quizCtx = await questionContext.loadQuestionContext(db, { userId, questionId: requestQuestionId });
            if (!quizCtx) throw Object.assign(new Error('question not answered'), { code: 'QUESTION_NOT_ANSWERED' });
            conversation = await conversationService.getOrCreateQuizConversation(db, {
                userId,
                questionId: requestQuestionId,
                subjectKey: requestedSubject || quizCtx.subjectKey || 'general',
                title: questionContext.conversationTitle(quizCtx),
                snapshot: questionContext.publicContext(quizCtx),
            });
        }

        subjectKey = requestedSubject || conversation?.subject_key || quizCtx?.subjectKey || user.ai_last_subject || 'general';
        if (!isValidSubject(subjectKey)) subjectKey = 'general';

        if (!conversation) {
            conversation = await conversationService.createConversation(db, { userId, subjectKey });
        } else if (requestedSubject && requestedSubject !== conversation.subject_key && conversation.source_type !== 'quiz_question') {
            await conversationService.setConversationSubject(db, conversation.id, requestedSubject);
            conversation.subject_key = requestedSubject;
        }
        conversationId = conversation.id;
        if (conversation.source_type !== 'quiz_question') {
            await db.query(`UPDATE tam24_users SET ai_last_subject = ? WHERE id = ?`, [subjectKey, userId]);
        }

        // ── Regenerate or continue: reuse the stored turn ──────────────────
        let attachments = [];
        let previousAssistant = null;
        let continueRow = null;
        if (continueMessageId) {
            continueRow = await conversationService.getMessageForUser(db, continueMessageId, userId);
            if (!continueRow || continueRow.role !== 'assistant' || continueRow.conversation_id !== conversationId) {
                throw Object.assign(new Error('message not found'), { code: 'MESSAGE_NOT_FOUND' });
            }
            if (!replyQuality.isContinuableFinish(continueRow.finish_reason, continueRow.content, continueRow.status)) {
                throw Object.assign(new Error('not truncated'), { code: 'NOT_TRUNCATED' });
            }
            const [[newer]] = await db.query(
                `SELECT id FROM tam24_ai_messages WHERE conversation_id = ? AND id > ? AND status <> 'error' LIMIT 1`,
                [conversationId, continueRow.id]
            );
            if (newer) throw Object.assign(new Error('not the latest reply'), { code: 'NOT_LAST_MESSAGE' });
        } else if (regenerateMessageId) {
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
        const paid = isPaidPlan(user.current_plan, user.plan_expires_at);
        const coinPlan = paid ? user.current_plan : 'free';
        const grant = await coinWallet.applyDailyGrant(db, userId, coinPlan);
        const wallet = grant.wallet;
        const dailyQuota = dailyCoinsForPlan(coinPlan);
        // Fair-use guard: shrink replies quietly when coins run low instead of cutting the student off.
        const lowBalance = !wallet.unlimited && wallet.total <= Math.max(15, Math.round(dailyQuota * 0.15));

        const model = promptBuilder.resolveModel(settings, subject, { hasImageAttachment, lowBalance });
        const maxTokens = promptBuilder.resolveMaxOutputTokens(subject, settings, { lowBalance, quizQuestion: !!quizCtx });
        const providerUserText = quizCtx ? (questionContext.expandUserMessage(message, intentKey) || message) : message;
        const typical = pricing.estimateTypicalCoins({ model, maxOutputTokens: maxTokens });
        const maxEst = pricing.estimateMaxCoins({ model, maxOutputTokens: maxTokens, allowImage: featureStatus().imageGeneration });
        const walletView = walletFromBuckets(wallet, coinPlan);

        if (!wallet.unlimited && wallet.total < COIN_PRICING.minBalanceToStart && continueMessageId) {
            throw Object.assign(new Error('insufficient coins'), { code: 'INSUFFICIENT_COINS', balance: wallet.total });
        }

        if (!wallet.unlimited && wallet.total < COIN_PRICING.minBalanceToStart) {
            const text = paid
                ? 'موجودی سکه کافی نیست. یک بسته سکه بگیرید، یا تا شارژ فردا صبر کنید.'
                : 'سکه امروز تمام شد. با اشتراک رایگان، گفتگو تا شارژ فردا محدود است. برای ادامه، اشتراک ویژه را فعال کنید.';
            await sendScriptedReply({
                out, userId, conversationId, subjectKey, message, attachments, regenerateMessageId,
                text,
                actions: upgradeActions(paid ? 'coins' : 'plan'),
                wallet: walletView,
            });
            return out.end();
        }

        if (quizCtx && !paid && !continueMessageId) {
            const askGate = await entitlements.consumeAskMet(null, {
                userId,
                subjectKey: quizCtx.subjectKey,
                subjectTitle: quizCtx.subject,
                subjectId: quizCtx.subjectId,
                questionId: quizCtx.questionId,
            });
            if (!askGate.allowed) {
                const label = askGate.subjectLabel || 'این درس';
                await sendScriptedReply({
                    out, userId, conversationId, subjectKey, message, attachments, regenerateMessageId,
                    text: `سهم رایگان ${label} استفاده شد. با اشتراک ویژه، سؤال‌های ${label} را بدون محدودیت ادامه می‌دهید.`,
                    actions: [{ id: 'upgrade-plan', label: 'اشتراک ویژه', action: 'open_plans' }],
                    wallet: walletView,
                });
                return out.end();
            }
        }

        const reserveAmount = Math.min(
            wallet.total,
            Math.max(COIN_PRICING.minCharge, Math.min(maxEst.coins, Math.max(typical.coins, COIN_PRICING.defaultReservation)))
        );

        conn = await db.getConnection();
        await conn.beginTransaction();
        reservation = await coinWallet.reserveCoins(conn, userId, reserveAmount, reservationRef, { operationType: 'chat', conversationId });
        await conn.commit();
        conn.release();
        conn = null;

        out.send('status', { status: 'thinking' });
        out.send('meta', {
            conversationId, subjectKey, reserved: reservation.reserved, typicalCoins: typical.coins,
            wallet: walletFromBuckets(reservation.wallet, coinPlan), regenerateMessageId: regenerateMessageId || null,
        });

        const isFirstExchange = Number(conversation.message_count || 0) === 0;

        // ── Persist the user turn ───────────────────────────────────────────
        if (!regenerateMessageId && !continueMessageId) {
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
        let retrievalQuery = message;
        if (continueRow && !retrievalQuery) {
            const priorUser = await conversationService.getUserTurnBefore(db, conversationId, continueRow.id);
            retrievalQuery = String(priorUser?.content || continueRow.content || '').slice(0, 500);
        }
        const [memories, summary, recent, ragContext, knowledgeContext, referenceContext] = await Promise.all([
            f.memory && settings.memoryEnabled ? memoryService.getActiveMemories(db, userId, CONTEXT_LIMITS.maxMemoryItems, { subjectKey }).catch(() => []) : [],
            memoryService.maybeSummarizeConversation(db, conversation, { userId }).catch(() => conversation.summary || null),
            conversationService.getRecentMessages(db, conversationId, CONTEXT_LIMITS.recentMessages),
            subjectKey !== 'general' ? ragService.retrieveContext(db, { subjectKey, queryText: retrievalQuery }).catch(() => null) : null,
            f.knowledgeBase && settings.knowledgeEnabled ? knowledgeService.retrieveKnowledge(db, { subjectKey, queryText: retrievalQuery }).catch(() => null) : null,
            f.pdfReferences && settings.pdfReferencesEnabled ? referencesService.retrieveReferenceContext(db, { conversationId, queryText: retrievalQuery }).catch(() => null) : null,
        ]);
        const recentWithoutCurrent = recent.filter((m) => m.id !== userMessageId && m.id !== regenerateMessageId);
        const historyForPrompt = continueRow
            ? recentWithoutCurrent.map((m) => (m.id === continueRow.id ? { ...m, content: replyQuality.rewindForPrompt(m.content) } : m))
            : recentWithoutCurrent;

        const { systemPrompt } = promptBuilder.buildMetPrompt({
            subjectKey, subjectRow, user, memories, settings, conversationSummary: summary,
            ragContext, knowledgeContext, referenceContext,
            questionContext: quizCtx ? { questionId: quizCtx.questionId, promptText: questionContext.formatForPrompt(quizCtx) } : null,
            hasImageAttachment, hasAudioTranscript: inputMode === 'voice', lowBalance,
        });
        const turnUserText = continueRow
            ? replyQuality.continuationInstruction(String(continueRow.content || '').slice(-180))
            : providerUserText;
        let providerMessages = promptBuilder.toProviderMessages({
            systemPrompt, recentMessages: historyForPrompt, currentUserMessage: turnUserText, currentAttachments: continueRow ? [] : attachments,
        });

        // ── Optional tool round ─────────────────────────────────────────────
        const collectedAttachments = [];
        const toolCallLog = [];
        let toolCoinSurcharge = 0;
        let retrievedQuestionIds = [];
        const wantsTools = !continueMessageId && f.tools && !hasImageAttachment
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
        const priorText = continueRow ? String(continueRow.content || '') : '';
        let fullText = priorText;
        let sentText = priorText;
        let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedTokens: 0 };
        let usedModel = model;
        let stopped = false;
        let userAborted = false;
        let finishReason = null;
        generating = true;

        const absorbUsage = (chunk) => {
            if (!chunk.usage) return;
            usage = {
                inputTokens: (usage.inputTokens || 0) + (chunk.usage.inputTokens || 0),
                outputTokens: (usage.outputTokens || 0) + (chunk.usage.outputTokens || 0),
                totalTokens: (usage.totalTokens || 0) + (chunk.usage.totalTokens || 0),
                cachedTokens: (usage.cachedTokens || 0) + (chunk.usage.cachedTokens || 0),
            };
            usedModel = chunk.model || usedModel;
            stopped = stopped || !!chunk.stopped;
            finishReason = chunk.finishReason || finishReason;
        };

        /** @returns {Promise<string>} text produced by this provider call only */
        const readProvider = async (messages, tokenBudget, { emit }) => {
            let local = '';
            for await (const chunk of aiProvider.stream({
                messages, model, maxTokens: tokenBudget, temperature: promptBuilder.resolveTemperature(settings), signal: abort.signal,
            })) {
                if (chunk.type === 'delta') {
                    local += chunk.text;
                    if (emit) {
                        fullText += chunk.text;
                        sentText = fullText;
                        out.send('delta', { text: chunk.text });
                    }
                } else if (chunk.type === 'done') {
                    if (chunk.content && chunk.content.length > local.length) {
                        const extra = chunk.content.slice(local.length);
                        local = chunk.content;
                        if (emit && extra) {
                            fullText += extra;
                            sentText = fullText;
                            out.send('delta', { text: extra });
                        }
                    }
                    absorbUsage(chunk);
                }
            }
            return local;
        };

        const resumeFrom = async (messages) => {
            const beforeReason = finishReason;
            const addition = await readProvider(messages, maxTokens, { emit: false });
            if (!addition.trim()) {
                finishReason = beforeReason || finishReason;
                return;
            }
            fullText = replyQuality.stitchContinuation(fullText, addition);
        };

        try {
            if (!continueRow) await readProvider(providerMessages, maxTokens, { emit: true });
            const cutByLimit = finishReason === 'length' && !stopped && fullText.trim();
            if (continueRow || cutByLimit) {
                const messages = continueRow
                    ? providerMessages
                    : [
                        ...providerMessages,
                        { role: 'assistant', content: replyQuality.rewindForPrompt(fullText) },
                        { role: 'user', content: replyQuality.continuationInstruction(fullText.slice(-180)) },
                    ];
                await resumeFrom(messages);
            }
        } catch (err) {
            if ((err.code === 'AI_STOPPED' || err.code === 'AI_TIMEOUT') && !fullText.trim()) throw err;
            if (err.code === 'AI_STOPPED' || err.code === 'AI_TIMEOUT') {
                stopped = true;
                if (err.code === 'AI_STOPPED') userAborted = true;
                finishReason = err.code === 'AI_TIMEOUT' ? 'timeout' : (finishReason || 'stop');
            } else throw err;
        } finally {
            generating = false;
        }
        fullText = replyQuality.collapseRepeatedParagraphs(replyQuality.normalizeAssistantText(fullText));
        if (fullText !== sentText) {
            if (sentText && fullText.startsWith(sentText)) out.send('delta', { text: fullText.slice(sentText.length) });
            else out.send('revise', { text: fullText });
        }
        if (stopped && !usage.totalTokens) usage = aiProvider.estimateUsage(providerMessages, fullText);
        const assessment = replyQuality.assessReply(fullText, finishReason, {
            outputTokens: usage.outputTokens,
            maxTokens,
            userStopped: userAborted && finishReason !== 'length' && finishReason !== 'timeout',
        });
        const storedReason = replyQuality.storedFinishReason(assessment);
        const truncated = assessment.incomplete;

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

        const messageStatus = stopped ? 'stopped' : 'complete';
        const prevCoins = continueRow ? Number(continueRow.coin_cost || 0) : 0;
        let assistantMsgId;
        if (continueRow) {
            assistantMsgId = continueRow.id;
            await conn.query(
                `UPDATE tam24_ai_messages
                    SET content = ?,
                        input_tokens = input_tokens + ?,
                        output_tokens = output_tokens + ?,
                        cached_tokens = COALESCE(cached_tokens, 0) + ?,
                        total_tokens = total_tokens + ?,
                        coin_cost = coin_cost + ?,
                        cost_usd = COALESCE(cost_usd, 0) + ?,
                        cost_irr = COALESCE(cost_irr, 0) + ?,
                        exchange_rate_irr = ?,
                        model = ?,
                        status = ?,
                        latency_ms = ?,
                        finish_reason = ?
                  WHERE id = ?`,
                [
                    fullText, usage.inputTokens, usage.outputTokens, usage.cachedTokens || 0, usage.totalTokens, quote.coins,
                    quote.usd, quote.irr, quote.exchangeRateIrr, usedModel, messageStatus, durationMs, storedReason, assistantMsgId,
                ]
            );
        } else {
            const [assistantIns] = await conn.query(
                `INSERT INTO tam24_ai_messages
                 (conversation_id, role, content, input_tokens, output_tokens, cached_tokens, total_tokens, coin_cost, cost_usd, cost_irr, exchange_rate_irr,
                  model, attachments, subject_key, status, latency_ms, regenerated_from, finish_reason)
                 VALUES (?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    conversationId, fullText, usage.inputTokens, usage.outputTokens, usage.cachedTokens || 0, usage.totalTokens, quote.coins,
                    quote.usd, quote.irr, quote.exchangeRateIrr, usedModel,
                    collectedAttachments.length ? JSON.stringify(collectedAttachments) : null, subjectKey,
                    messageStatus, durationMs, regenerateMessageId || null, storedReason,
                ]
            );
            assistantMsgId = assistantIns.insertId;
        }

        const charge = await coinWallet.finalizeCharge(conn, userId, {
            reserved: reservation.reserved, reservedDaily: reservation.reservedDaily, reservedPurchased: reservation.reservedPurchased,
            finalCost: quote.coins, referenceId: reservationRef, operationType: 'chat', conversationId, messageId: assistantMsgId,
            metadata: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, model: usedModel, usd: quote.usd, stopped, continued: !!continueRow },
        });
        reservation = null;

        const shownCoins = prevCoins + charge.charged;
        await conn.query(`UPDATE tam24_ai_messages SET coin_cost = ? WHERE id = ?`, [shownCoins, assistantMsgId]);
        await conversationService.touchConversation(conn, conversationId, {
            messagesAdded: continueRow ? 0 : regenerateMessageId ? 1 : 2,
            tokens: usage.totalTokens,
        });
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

        const walletAfter = walletFromBuckets(charge.wallet, coinPlan);
        const shownTokens = {
            inputTokens: (continueRow ? Number(continueRow.input_tokens || 0) : 0) + usage.inputTokens,
            outputTokens: (continueRow ? Number(continueRow.output_tokens || 0) : 0) + usage.outputTokens,
            totalTokens: (continueRow ? Number(continueRow.total_tokens || 0) : 0) + usage.totalTokens,
        };
        const keptAttachments = continueRow
            ? (continueRow.attachments || []).filter((item) => item && item.type !== 'ui_actions')
            : collectedAttachments;
        out.send('done', {
            message: {
                id: assistantMsgId, conversationId, role: 'assistant', content: fullText, coinCost: shownCoins,
                ...shownTokens, model: usedModel,
                attachments: keptAttachments, status: messageStatus, latencyMs: durationMs,
                regeneratedFrom: regenerateMessageId || null,
                createdAt: continueRow?.created_at ? new Date(continueRow.created_at).toISOString() : new Date().toISOString(),
                finishReason: storedReason,
                truncated,
            },
            wallet: walletAfter,
            charged: charge.charged,
            refunded: charge.refunded,
            subjectKey,
            durationMs,
            stopped,
            truncated,
            finishReason: storedReason,
        });
        out.send('status', { status: 'ready' });

        // Title and memory run after the answer is already delivered. A failure
        // here must not turn a finished reply into the rose error bubble.
        try {
            if (!stopped && !continueRow) {
                await memoryService.maybeUpdateMemory(db, {
                    userId, conversationId, messageCount: (conversation.message_count || 0) + 2, userMessage: message, assistantMessage: fullText,
                    subjectKey, sourceMessageId: assistantMsgId, enabled: settings.memoryEnabled,
                }).catch(() => {});
            }

            const needsTitle = conversation.source_type !== 'quiz_question' && !regenerateMessageId && (isFirstExchange || (!conversation.title_generated && conversation.title === conversationService.NEW_TITLE));
            if (needsTitle && !out.isClosed()) {
                const title = await conversationService.generateTitle(db, {
                    conversationId, userId, subjectKey, userMessage: message || 'تصویر ارسال شد', assistantMessage: fullText,
                }).catch(() => null);
                if (title && !out.isClosed()) out.send('title', { conversationId, title });
            } else if (needsTitle) {
                conversationService.generateTitle(db, { conversationId, userId, subjectKey, userMessage: message || 'تصویر ارسال شد', assistantMessage: fullText }).catch(() => {});
            }
        } catch (sideErr) {
            console.error('[met] post-done', sideErr);
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

        const dbWriteFailed = typeof code === 'string' && code.startsWith('ER_');
        out.send('error', {
            code,
            message: dbWriteFailed
                ? 'ذخیره‌ی پاسخ مِت انجام نشد. بک‌اند را یک بار ری‌استارت کن و دوباره بفرست.'
                : userMessageForError(code, 'در تولید پاسخ مشکلی پیش آمد.'),
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
