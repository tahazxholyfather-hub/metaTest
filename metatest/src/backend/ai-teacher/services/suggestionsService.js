'use strict';

const { MODELS, SUGGESTIONS, featureStatus } = require('../config');
const { getSubject, SUBJECT_KEYS } = require('../subjects');
const aiProvider = require('./aiProvider');
const { logUsage } = require('./usageLogger');

/**
 * Smart conversation starters. Four are served per subject from a cached
 * pool of ten in tam24_ai_suggestions. The pool is only topped up (with one
 * cheap AI call, in the background) when it runs low, so a new chat never
 * waits on the provider. A curated seed list is the last-resort fallback.
 */

const SEEDS = {
    math: [
        { title: 'حل قدم‌به‌قدم', prompt: 'این معادله را قدم‌به‌قدم حل کن و هر مرحله را توضیح بده: $2x^2 - 5x + 3 = 0$', hint: 'با توضیح هر مرحله', icon: 'calculator' },
        { title: 'شهود تابع', prompt: 'تابع را با یک مثال روزمره برایم توضیح بده و بعد یک تمرین ساده بده.', hint: 'اول درک، بعد تمرین', icon: 'function-square' },
        { title: 'اشتباه رایج', prompt: 'رایج‌ترین اشتباه‌ها در حل معادله‌های درجه دوم چیست و چطور از آن‌ها دوری کنم؟', hint: 'قبل از امتحان', icon: 'alert-circle' },
        { title: 'تمرین کنکوری', prompt: 'یک سؤال کنکوری متوسط از مبحث تابع بده، اول خودم حل کنم بعد چک کن.', hint: 'با بازخورد', icon: 'target' },
        { title: 'مثلثات ساده', prompt: 'روابط مثلثاتی پایه را با یک روش حفظ‌کردن آسان توضیح بده.', hint: 'روش یادگیری', icon: 'triangle' },
    ],
    physics: [
        { title: 'شهود فرمول', prompt: 'قانون دوم نیوتون را با یک مثال ملموس توضیح بده و بعد یک مسئله عددی حل کن.', hint: 'مفهوم + محاسبه', icon: 'atom' },
        { title: 'حل مسئله', prompt: 'این مسئله را با نوشتن داده‌ها، فرمول و جایگذاری حل کن: جسمی با سرعت اولیه ۱۰ متر بر ثانیه پرتاب می‌شود؛ ارتفاع بیشینه چقدر است؟', hint: 'با یکاها', icon: 'calculator' },
        { title: 'یکاها و تبدیل', prompt: 'تبدیل یکاهای پرکاربرد فیزیک را با مثال یادم بده.', hint: 'خطاهای رایج', icon: 'ruler' },
        { title: 'کار و انرژی', prompt: 'رابطه‌ی کار و انرژی جنبشی را با یک مثال توضیح بده.', hint: 'فصل مهم کنکور', icon: 'zap' },
        { title: 'نمودار حرکت', prompt: 'نمودار مکان-زمان و سرعت-زمان را چطور تحلیل کنم؟', hint: 'با مثال', icon: 'line-chart' },
    ],
    chemistry: [
        { title: 'موازنه', prompt: 'روش موازنه‌ی معادله‌های شیمیایی را با یک مثال قدم‌به‌قدم یادم بده.', hint: 'پایه‌ای و مهم', icon: 'flask-conical' },
        { title: 'استوکیومتری', prompt: 'یک مسئله‌ی مول و جرم مولی حل کن و روش کلی را توضیح بده.', hint: 'با فرمول و یکا', icon: 'calculator' },
        { title: 'پیوندها', prompt: 'تفاوت پیوند یونی و کووالانسی را با مثال توضیح بده.', hint: 'مفهومی', icon: 'link' },
        { title: 'جدول تناوبی', prompt: 'روند تغییر شعاع اتمی و انرژی یونش در جدول تناوبی را ساده توضیح بده.', hint: 'روندها', icon: 'grid-3x3' },
        { title: 'محلول‌ها', prompt: 'غلظت مولار چیست؟ یک مسئله حل کن.', hint: 'با مثال عددی', icon: 'beaker' },
    ],
    biology: [
        { title: 'سفر به سلول', prompt: 'اجزای سلول و کار هر کدام را با یک تشبیه ساده توضیح بده، بعد اصطلاح دقیق کتاب را بگو.', hint: 'مفهومی', icon: 'dna' },
        { title: 'مرور فصل', prompt: 'نکات کلیدی فصل گوارش را به‌صورت خلاصه‌ی کنکوری بگو.', hint: 'قبل از امتحان', icon: 'list-checks' },
        { title: 'سؤال تستی', prompt: 'یک سؤال تستی از دستگاه گردش خون بده و بعد از جواب من، توضیح بده.', hint: 'با بازخورد', icon: 'target' },
        { title: 'مقایسه', prompt: 'تفاوت میتوز و میوز را در یک جدول مقایسه‌ای توضیح بده.', hint: 'مقایسه‌ای', icon: 'columns-2' },
        { title: 'شکل کتاب', prompt: 'شکل قلب در کتاب را برایم توضیح بده: هر بخش چه کاری می‌کند؟', hint: 'مبتنی بر کتاب', icon: 'heart' },
    ],
    general: [
        { title: 'برنامه‌ی مطالعه', prompt: 'برای یک هفته‌ی آینده یک برنامه‌ی مطالعه‌ی واقع‌بینانه بساز؛ اول از من چند سؤال بپرس.', hint: 'شخصی‌سازی‌شده', icon: 'calendar' },
        { title: 'تمرکز بهتر', prompt: 'چطور در جلسه‌های مطالعه‌ی طولانی تمرکزم را حفظ کنم؟ روش‌های عملی بگو.', hint: 'روش‌های عملی', icon: 'brain' },
        { title: 'استرس امتحان', prompt: 'قبل از امتحان خیلی مضطرب می‌شوم. چند تکنیک سریع و مؤثر بگو.', hint: 'قابل اجرا', icon: 'heart-pulse' },
        { title: 'مرور هوشمند', prompt: 'روش مرور فاصله‌دار را برای درس‌های حفظی توضیح بده و یک نمونه‌ی زمان‌بندی بده.', hint: 'تکنیک یادگیری', icon: 'repeat' },
        { title: 'کدام درس؟', prompt: 'کمکم کن انتخاب کنم امروز روی کدام درس وقت بگذارم؛ اول از وضعیتم بپرس.', hint: 'مشاوره', icon: 'compass' },
    ],
};

const refilling = new Set();

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function shapeRow(r) {
    return { id: r.id ?? null, title: r.title, prompt: r.prompt, hint: r.hint || null, icon: r.icon || 'sparkles' };
}

async function ensureSeeded(db, subjectKey) {
    const seeds = SEEDS[subjectKey] || SEEDS.general;
    const [[{ cnt }]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM tam24_ai_suggestions WHERE subject_key = ? AND is_active = 1`,
        [subjectKey]
    );
    if (Number(cnt) > 0) return Number(cnt);
    for (const s of seeds) {
        await db.query(
            `INSERT INTO tam24_ai_suggestions (subject_key, title, prompt, hint, icon, source) VALUES (?, ?, ?, ?, ?, 'seed')`,
            [subjectKey, s.title, s.prompt, s.hint, s.icon]
        );
    }
    return seeds.length;
}

/** Top the pool up to SUGGESTIONS.poolPerSubject with one utility-model call. Fire-and-forget. */
async function refillPool(db, subjectKey, missing) {
    if (!featureStatus().suggestions || !featureStatus().chat) return;
    if (refilling.has(subjectKey) || missing <= 0) return;
    refilling.add(subjectKey);
    const started = Date.now();
    try {
        const subject = getSubject(subjectKey);
        const [existing] = await db.query(`SELECT title FROM tam24_ai_suggestions WHERE subject_key = ? AND is_active = 1`, [subjectKey]);
        const avoid = existing.map((r) => r.title).join('، ');
        const result = await aiProvider.generate({
            model: MODELS.utility,
            maxTokens: 700,
            temperature: 0.9,
            messages: [
                {
                    role: 'system',
                    content:
                        `تو «مِت» معلم خصوصی ${subject?.nameFa || 'درس'} در یک اپ آموزشی ایرانی هستی. ${missing} پیشنهاد شروع گفتگو برای دانش‌آموز دبیرستانی بساز که خلاقانه، مفید و متنوع باشند (حل مسئله، مفهوم، مرور، تست، اشتباه رایج). فقط JSON آرایه‌ای برگردان: [{"title":"حداکثر ۳ کلمه","prompt":"پیامی که دانش‌آموز می‌فرستد، یک یا دو جمله","hint":"حداکثر ۴ کلمه","icon":"نام آیکون lucide به انگلیسی"}]. از این عنوان‌ها استفاده نکن: ${avoid || '—'}`,
                },
                { role: 'user', content: 'پیشنهادها را بساز.' },
            ],
        });
        let items = [];
        try {
            const m = String(result.content || '').match(/\[[\s\S]*\]/);
            items = m ? JSON.parse(m[0]) : [];
        } catch { items = []; }
        let inserted = 0;
        for (const it of Array.isArray(items) ? items.slice(0, missing) : []) {
            if (!it?.title || !it?.prompt) continue;
            await db.query(
                `INSERT INTO tam24_ai_suggestions (subject_key, title, prompt, hint, icon, source) VALUES (?, ?, ?, ?, ?, 'generated')`,
                [subjectKey, String(it.title).slice(0, 80), String(it.prompt).slice(0, 600), it.hint ? String(it.hint).slice(0, 160) : null, it.icon ? String(it.icon).slice(0, 40) : null]
            );
            inserted += 1;
        }
        await logUsage(db, {
            userId: 0, operationType: 'suggestions', subjectKey, model: result.model,
            inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens, cachedTokens: result.usage?.cachedTokens,
            durationMs: Date.now() - started, units: inserted,
        });
    } catch (err) {
        console.error('[met] suggestion refill skipped:', err.message);
    } finally {
        refilling.delete(subjectKey);
    }
}

/** Four suggestions for a subject; DB-cached, seeded, and refilled in the background. */
async function getSuggestions(db, subjectKey) {
    const key = SUBJECT_KEYS.includes(subjectKey) ? subjectKey : 'general';
    const fallback = shuffle(SEEDS[key] || SEEDS.general).slice(0, SUGGESTIONS.servePerSubject).map(shapeRow);
    if (!featureStatus().suggestions) return fallback;
    try {
        const count = await ensureSeeded(db, key);
        if (count < SUGGESTIONS.poolPerSubject) void refillPool(db, key, SUGGESTIONS.poolPerSubject - count);
        const [rows] = await db.query(
            `SELECT id, title, prompt, hint, icon FROM tam24_ai_suggestions
             WHERE subject_key = ? AND is_active = 1 ORDER BY RAND() LIMIT ?`,
            [key, SUGGESTIONS.servePerSubject]
        );
        if (!rows.length) return fallback;
        return rows.map(shapeRow);
    } catch {
        return fallback;
    }
}

async function markUsed(db, id) {
    if (!id) return;
    try { await db.query(`UPDATE tam24_ai_suggestions SET use_count = use_count + 1 WHERE id = ?`, [id]); } catch { /* ignore */ }
}

module.exports = { getSuggestions, markUsed, SEEDS };
