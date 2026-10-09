'use strict';

/**
 * Authoritative question context for Met-in-quiz.
 * Never trust the client for answers / explanations — load from the DB
 * and only after this student has submitted an answer for the question.
 */

const { subjectKeyFromText } = require('../subjects');

const QUICK_INTENTS = Object.freeze({
    didnt_understand_question: {
        label: 'سوال رو متوجه نشدم',
        prompt:
            'دانش‌آموز همین سوال فعلی را نفهمیده. صورت سوال را با زبان خیلی ساده توضیح بده: سوال دقیقاً چه می‌خواهد، اطلاعات مهم کدام‌اند، و از کجا باید شروع کرد. گزینه‌ها را یکی‌یکی معنی نکن مگر برای فهمیدن صورت لازم باشد.',
    },
    didnt_understand_answer: {
        label: 'جواب رو متوجه نشدم',
        prompt:
            'دانش‌آموز پاسخ صحیح یا توضیح تشریحی همین سوال را نفهمیده. پاسخ درست را قدم‌به‌قدم، با دلیل هر مرحله، توضیح بده و بگو چرا این جواب درست است.',
    },
    why_wrong: {
        label: 'چرا جواب من غلطه؟',
        prompt:
            'دانش‌آموز می‌خواهد بداند چرا گزینه‌ای که انتخاب کرده غلط است. اول بگو انتخاب او چه اشتباه مفهومی‌ای دارد، بعد مسیر درست را کوتاه و روشن نشان بده. اگر جوابش درست بوده، همان را تأیید کن و نکته‌ی تکمیلی بده.',
    },
    simpler: {
        label: 'ساده‌تر توضیح بده',
        prompt:
            'همین سوال و حلّش را با زبان خیلی ساده‌تر، کوتاه‌تر و با یک مثال روزمره توضیح بده. از اصطلاحات سخت پرهیز کن مگر لازم باشد و همان‌جا معنی‌شان را بگو.',
    },
    step_by_step: {
        label: 'مرحله‌به‌مرحله توضیح بده',
        prompt:
            'حل همین سوال را مرحله‌به‌مرحله، شماره‌دار، با فرمول‌های لازم بنویس. هر مرحله یک کار مشخص باشد و در پایان جواب نهایی را مشخص کن.',
    },
    more_example: {
        label: 'مثال بیشتر',
        prompt:
            'یک مثال کاملاً جدید از همان مفهوم همین سوال بساز (اعداد و صورت متفاوت)، حلّش را کوتاه نشان بده، بعد ربطش را به سوال فعلی بگو.',
    },
    similar_question: {
        label: 'یک سوال مشابه بده',
        prompt:
            'با ابزار بانک سؤال، یک سوال واقعی از همین درس/مبحث/فصل پیدا کن و به فارسی مطرح کن. جواب درست را تا وقتی دانش‌آموز تلاش نکرده فاش نکن. اگر ابزاری چیزی برنگرداند، یک سوال هم‌تراز از همان مبحث طرح کن و بگو ساختگی است.',
    },
    harder_question: {
        label: 'یک سوال سخت‌تر بده',
        prompt:
            'با ابزار بانک سؤال یک سوال سخت‌تر از همین مبحث پیدا کن (ترجیحاً سطح «سخت»). جواب را تا وقتی نپرسیده‌اند نگو. اگر چیزی پیدا نشد، یک سوال سخت‌تر از همان مفهوم طرح کن.',
    },
    exam_tip: {
        label: 'نکته کنکوری / امتحانی',
        prompt:
            'برای همین سوال یک نکته‌ی کنکوری/امتحانی فشرده بده: دام رایج، چیزی که باید حفظ شود، و چطور در آزمون سریع تشخیصش بدهند. طولانی نباش.',
    },
});

function resolveIntent(intentKey) {
    if (!intentKey) return null;
    return QUICK_INTENTS[String(intentKey)] || null;
}

function expandUserMessage(visibleText, intentKey) {
    const intent = resolveIntent(intentKey);
    const visible = String(visibleText || '').trim();
    if (!intent) return visible;
    const label = visible || intent.label;
    return `${label}\n\n[درخواست دقیق برای مِت — دانش‌آموز این را نمی‌بیند به عنوان دستور سیستم؛ روی همین سوال فعلی اعمال کن]\n${intent.prompt}`;
}

function stripHtml(value) {
    return String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&zwnj;|&zwj;|&lrm;|&rlm;/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function publicContext(row) {
    if (!row) return null;
    return {
        questionId: row.questionId,
        questionText: row.questionText,
        subjectKey: row.subjectKey,
        subject: row.subject,
        lesson: row.lesson,
        topic: row.topic,
        category: row.category,
        grade: row.grade,
        questionType: row.questionType,
        difficulty: row.difficulty,
        academicYear: row.academicYear,
        book: row.book,
        source: row.source,
        chapter: row.chapter,
        choices: row.choices,
        selectedChoice: row.selectedChoice,
        correctChoice: row.correctChoice,
        isCorrect: row.isCorrect,
        explanation: row.explanation,
        tags: row.tags,
    };
}

function formatForPrompt(ctx) {
    if (!ctx) return '';
    const lines = [
        'CURRENT PRACTICE QUESTION — you are tutoring THIS exact item. The student already submitted an answer. Use these facts; do not invent a different question.',
        `Question id: ${ctx.questionId}`,
        ctx.subject ? `Subject: ${ctx.subject}${ctx.subjectKey ? ` (${ctx.subjectKey})` : ''}` : '',
        ctx.grade ? `Grade: ${ctx.grade}` : '',
        ctx.lesson ? `Lesson / chapter: ${ctx.lesson}` : '',
        ctx.topic ? `Topic: ${ctx.topic}` : '',
        ctx.category ? `Category: ${ctx.category}` : '',
        ctx.difficulty ? `Difficulty: ${ctx.difficulty}` : '',
        ctx.book ? `Book: ${ctx.book}` : '',
        ctx.source ? `Source: ${ctx.source}` : '',
        ctx.academicYear ? `Year: ${ctx.academicYear}` : '',
        ctx.questionType ? `Type: ${ctx.questionType}` : '',
        '',
        'Stem:',
        ctx.questionText || '(empty)',
        '',
        'Choices:',
        ...(ctx.choices || []).map((c) => {
            const marks = [];
            if (c.isCorrect) marks.push('CORRECT');
            if (c.isSelected) marks.push('STUDENT PICKED');
            return `${c.index}) ${c.text}${marks.length ? `  [${marks.join(', ')}]` : ''}`;
        }),
        '',
        ctx.selectedChoice
            ? `Student selected: ${ctx.selectedChoice.index}) ${ctx.selectedChoice.text} — ${ctx.isCorrect ? 'correct' : 'incorrect'}.`
            : 'Student selection: unknown.',
        ctx.correctChoice ? `Correct choice: ${ctx.correctChoice.index}) ${ctx.correctChoice.text}` : '',
        ctx.explanation ? `Official explanation:\n${ctx.explanation}` : '',
        '',
        'When they ask for a similar or harder question, search the real question bank (same subject/topic/chapter) and do not leak the current answer into the new item. Stay in Persian.',
    ];
    return lines.filter((l) => l !== '').join('\n');
}

async function loadQuestionContext(db, { userId, questionId }) {
    const qid = Number(questionId);
    const uid = Number(userId);
    if (!qid || !uid) return null;

    const [[attempt]] = await db.query(
        `SELECT a.option_id, a.status
         FROM tam24_user_answers a
         WHERE a.user_id = ? AND a.question_id = ?
         LIMIT 1`,
        [uid, qid]
    );
    if (!attempt) return null;

    const [[question]] = await db.query(
        `SELECT q.id, q.question_text, q.difficulty_level, q.academic_year, q.chapter, q.book, q.source,
                q.subject_id, q.topic_id, q.chapter_id, q.grade_id, q.major_id,
                s.title AS subject_title, t.title AS topic_title, c.title AS chapter_title, g.title AS grade_title,
                m.title AS major_title
         FROM questions_tam24 q
         LEFT JOIN subjects_tam24 s ON s.id = q.subject_id
         LEFT JOIN topics_tam24 t ON t.id = q.topic_id
         LEFT JOIN chapters_tam24 c ON c.id = q.chapter_id
         LEFT JOIN grades_tam24 g ON g.id = q.grade_id
         LEFT JOIN majors_tam24 m ON m.id = q.major_id
         WHERE q.id = ?
         LIMIT 1`,
        [qid]
    );
    if (!question) return null;

    const [options] = await db.query(
        `SELECT id, option_text, is_correct FROM options_tam24 WHERE question_id = ? ORDER BY id ASC`,
        [qid]
    );
    const [[desc]] = await db.query(
        `SELECT answer_text FROM descriptive_answers_tam24 WHERE question_id = ? LIMIT 1`,
        [qid]
    );

    const parseCorrect = (val) => {
        if (Buffer.isBuffer(val)) return val[0] === 1;
        return Number(val) === 1 || val === true || val === '1';
    };

    const choices = (options || []).map((o, i) => ({
        id: o.id,
        index: i + 1,
        text: stripHtml(o.option_text),
        isCorrect: parseCorrect(o.is_correct),
        isSelected: Number(o.id) === Number(attempt.option_id),
    }));
    const selectedChoice = choices.find((c) => c.isSelected) || null;
    const correctChoice = choices.find((c) => c.isCorrect) || null;
    const subjectKey = subjectKeyFromText(question.subject_title) || 'general';

    const tags = [question.subject_title, question.grade_title, question.chapter_title, question.topic_title, question.difficulty_level]
        .filter(Boolean);

    return {
        questionId: qid,
        questionText: stripHtml(question.question_text),
        subjectKey,
        subjectId: question.subject_id || null,
        subject: question.subject_title || null,
        lesson: question.chapter_title || question.chapter || null,
        topic: question.topic_title || null,
        category: question.major_title || question.topic_title || null,
        grade: question.grade_title || null,
        questionType: choices.length ? 'multiple_choice' : 'unknown',
        difficulty: question.difficulty_level || null,
        academicYear: question.academic_year || null,
        book: question.book || null,
        source: question.source || null,
        chapter: question.chapter_title || question.chapter || null,
        choices,
        selectedChoice,
        correctChoice,
        isCorrect: attempt.status === 'correct',
        explanation: stripHtml(desc?.answer_text || ''),
        tags,
    };
}

function conversationTitle(ctx) {
    const topic = ctx?.topic || ctx?.lesson || ctx?.subject || 'سوال';
    return String(topic).replace(/\s+/g, ' ').trim().slice(0, 80) || 'سوال تمرین';
}

module.exports = {
    QUICK_INTENTS,
    resolveIntent,
    expandUserMessage,
    publicContext,
    formatForPrompt,
    loadQuestionContext,
    conversationTitle,
    stripHtml,
};
