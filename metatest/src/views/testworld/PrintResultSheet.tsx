// PrintResultSheet.jsx
import React from 'react';

const MOCK = {
    activeUser: {
        id: 'STU-1402',
        firstName: 'علی',
        lastName: 'محمدی',
        score: 72,
        correct: 9,
        wrong: 4,
        unanswered: 2,
        total: 15,
        time: '18:40',
    },
    quizTitle: 'آزمون ریاضی پایه یازدهم',
    lessonsData: [
        { id: 1, title: 'مشتق', total: 6, correct: 4, wrong: 1, unanswered: 1, progress: 67 },
        { id: 2, title: 'انتگرال', total: 5, correct: 3, wrong: 2, unanswered: 0, progress: 60 },
        { id: 3, title: 'حد و پیوستگی', total: 4, correct: 2, wrong: 1, unanswered: 1, progress: 50 },
    ],
    questions: [
        { id: 1, text: 'مشتق تابع $f(x) = x^3 + 2x$ کدام است؟', status: 'correct', level: 'easy', topic: 'مشتق', time: 45, options: [{ id: 'a', text: '$3x^2 + 2$' }, { id: 'b', text: '$3x^2$' }, { id: 'c', text: '$x^2 + 2$' }, { id: 'd', text: '$2x + 1$' }], selected: 'a', correctAnswer: 'a', description: 'با قاعده توان مشتق هر جمله را حساب می‌کنیم.' },
        { id: 2, text: 'مقدار $\\lim_{x \\to 0} \\frac{\\sin x}{x}$ برابر است با:', status: 'correct', level: 'medium', topic: 'حد و پیوستگی', time: 30, options: [{ id: 'a', text: '$0$' }, { id: 'b', text: '$1$' }, { id: 'c', text: '$\\infty$' }, { id: 'd', text: 'وجود ندارد' }], selected: 'b', correctAnswer: 'b', description: '' },
        { id: 3, text: 'انتگرال $\\int 2x \\, dx$ برابر است با:', status: 'wrong', level: 'easy', topic: 'انتگرال', time: 60, options: [{ id: 'a', text: '$x^2 + C$' }, { id: 'b', text: '$2x^2 + C$' }, { id: 'c', text: '$x + C$' }, { id: 'd', text: '$2 + C$' }], selected: 'b', correctAnswer: 'a', description: 'انتگرال $2x$ برابر $x^2 + C$ است.' },
        { id: 4, text: 'کدام تابع در $x=0$ پیوسته نیست؟', status: 'unanswered', level: 'hard', topic: 'حد و پیوستگی', time: 0, options: [{ id: 'a', text: '$f(x) = x^2$' }, { id: 'b', text: '$f(x) = |x|$' }, { id: 'c', text: '$f(x) = \\frac{1}{x}$' }, { id: 'd', text: '$f(x) = \\sin x$' }], selected: null, correctAnswer: 'c', description: '' },
        { id: 5, text: 'مشتق $\\sin(x)$ برابر است با:', status: 'correct', level: 'easy', topic: 'مشتق', time: 20, options: [{ id: 'a', text: '$-\\cos(x)$' }, { id: 'b', text: '$\\cos(x)$' }, { id: 'c', text: '$\\tan(x)$' }, { id: 'd', text: '$-\\sin(x)$' }], selected: 'b', correctAnswer: 'b', description: '' },
    ],
};

const STATUS_COLOR  = { correct: '#166534', wrong: '#991b1b', unanswered: '#92400e' };
const STATUS_BG     = { correct: '#f0fdf4', wrong: '#fef2f2', unanswered: '#fffbeb' };
const STATUS_BORDER = { correct: '#bbf7d0', wrong: '#fecaca', unanswered: '#fef3c7' };
const STATUS_LABEL  = { correct: 'درست', wrong: 'نادرست', unanswered: 'بی‌پاسخ' };
const LEVEL_LABEL   = { easy: 'آسان', medium: 'متوسط', hard: 'سخت' };

export default function PrintResultSheet({ activeUser, questions, lessonsData, quizTitle }) {
    const u = activeUser ?? MOCK.activeUser;
    const qs = questions ?? MOCK.questions;
    const ld = lessonsData ?? MOCK.lessonsData;
    const title = quizTitle ?? MOCK.quizTitle;
    const total = u.total || qs.length || 1;

    const pct = (n) => Math.round((n / total) * 100);

    return (
        <>
            {/* Import Vazirmatn Font & Setup Print Stylesheet */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700;800&display=swap');
                
                @media print {
                    @page {
                        size: A4;
                        margin: 15mm 12mm 15mm 12mm; /* Consistent page printable boundary */
                    }
                    body {
                        visibility: hidden;
                        background: #fff;
                    }
                    #prs, #prs * {
                        visibility: visible;
                    }
                    #prs {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                }

                #prs {
                    font-family: 'Vazirmatn', Tahoma, sans-serif;
                    direction: rtl;
                    background: #fff;
                    color: #1f2937;
                    max-width: 210mm;
                    margin: 0 auto;
                    font-size: 10.5pt;
                    line-height: 1.6;
                    -webkit-print-color-adjust: exact; /* Force Chrome/Safari colors to print */
                    print-color-adjust: exact;         /* Force Firefox colors to print */
                }

                .prs-avoid {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }

                /* Math Container adjustments to avoid ugly text wraps */
                .math-tex {
                    direction: ltr;
                    display: inline-block;
                    white-space: nowrap;
                }
            `}</style>

            <div id="prs">

                {/* Header */}
                {/*<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1f2937', paddingBottom: 10, marginBottom: 16 }}>*/}
                {/*    <div>*/}
                {/*        <h1 style={{ fontSize: '15pt', fontWeight: 800, color: '#111827', margin: 0 }}>{title}</h1>*/}
                {/*        <p style={{ fontSize: '9pt', color: '#4b5563', margin: '4px 0 0' }}>تاریخ: {new Date().toLocaleDateString('fa-IR')}</p>*/}
                {/*    </div>*/}
                {/*    <div style={{ fontSize: '9.5pt', color: '#374151', textAlign: 'left', fontWeight: 500, lineHeight: 1.5 }}>*/}
                {/*        <div>نام: <strong style={{ color: '#111827' }}>{u.firstName} {u.lastName}</strong></div>*/}
                {/*        <div>کد داوطلب: <span style={{ direction: 'ltr', display: 'inline-block' }}>{u.id}</span></div>*/}
                {/*    </div>*/}
                {/*</div>*/}

                {/* Score boxes */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                    {[
                        { label: 'نمره تراز', value: `${u.score}٪`, sub: 'نمره کل آزمون', bold: true, bg: '#f8fafc', border: '#e2e8f0' },
                        { label: 'پاسخ درست', value: u.correct, sub: `${pct(u.correct)}% کل`, color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
                        { label: 'پاسخ نادرست', value: u.wrong, sub: `${pct(u.wrong)}% کل`, color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
                        { label: 'بی‌پاسخ', value: u.unanswered, sub: `${pct(u.unanswered)}% کل`, color: '#92400e', bg: '#fffbeb', border: '#fef3c7' },
                        { label: 'زمان کل', value: u.time, sub: 'دقیقه', bg: '#f8fafc', border: '#e2e8f0' },
                    ].map(({ label, value, sub, bold, color, bg, border }) => (
                        <div key={label} style={{ flex: 1, border: `1.5px solid ${border || '#e5e7eb'}`, background: bg || '#fff', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
                            <div style={{ fontSize: '8.5pt', color: '#4b5563', fontWeight: 500, marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: bold ? '16pt' : '13pt', fontWeight: 800, color: color || '#111827' }}>{value}</div>
                            <div style={{ fontSize: '8pt', color: '#6b7280' }}>{sub}</div>
                        </div>
                    ))}
                </div>

                {/* Topics table */}
                {ld.length > 0 && (
                    <div style={{ marginBottom: 20 }} className="prs-avoid">
                        <h2 style={{ fontSize: '11pt', fontWeight: 700, borderBottom: '1px solid #d1d5db', paddingBottom: 4, marginBottom: 8, color: '#111827' }}>کارنامه به تفکیک مبحث</h2>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                            <thead>
                            <tr style={{ background: '#f3f4f6' }}>
                                {['نام درس / مبحث', 'تعداد کل', 'درست', 'نادرست', 'بی‌پاسخ', 'درصد پاسخگویی'].map(h => (
                                    <th key={h} style={{ border: '1px solid #d1d5db', padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>{h}</th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {ld.map(l => (
                                <tr key={l.id}>
                                    <td style={{ border: '1px solid #d1d5db', padding: '6px 10px', fontWeight: 500 }}>{l.title}</td>
                                    <td style={{ border: '1px solid #d1d5db', padding: '6px 10px', textAlign: 'center' }}>{l.total}</td>
                                    <td style={{ border: '1px solid #d1d5db', padding: '6px 10px', textAlign: 'center', color: '#166534', fontWeight: 700 }}>{l.correct}</td>
                                    <td style={{ border: '1px solid #d1d5db', padding: '6px 10px', textAlign: 'center', color: '#991b1b', fontWeight: 700 }}>{l.wrong}</td>
                                    <td style={{ border: '1px solid #d1d5db', padding: '6px 10px', textAlign: 'center', color: '#92400e', fontWeight: 700 }}>{l.unanswered}</td>
                                    <td style={{ border: '1px solid #d1d5db', padding: '6px 10px', textAlign: 'center', fontWeight: 800, background: '#f9fafb' }}>{l.progress}%</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Questions Section Title */}
                <h2 style={{ fontSize: '11pt', fontWeight: 700, borderBottom: '1px solid #d1d5db', paddingBottom: 4, marginBottom: 12, color: '#111827' }} className="prs-avoid">جزئیات و تحلیل سوالات</h2>

                {/* Questions Map */}
                {qs.map((q, i) => {
                    const s = ['correct', 'wrong', 'unanswered'].includes(q.status) ? q.status : 'unanswered';
                    return (
                        <div key={q.id} className="prs-avoid" style={{ border: `1px solid #e5e7eb`, borderRight: `5px solid ${STATUS_COLOR[s]}`, borderRadius: 8, padding: '12px 14px', marginBottom: 12, background: '#fff' }}>

                            {/* Question Meta */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px dashed #e5e7eb', paddingBottom: 6 }}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span style={{ fontWeight: 800, fontSize: '10pt', color: '#111827' }}>سوال {i + 1}</span>
                                    {q.topic && <span style={{ fontSize: '8pt', background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>{q.topic}</span>}
                                    <span style={{ fontSize: '8pt', background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>{LEVEL_LABEL[q.level] || q.level}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '8.5pt' }}>
                                    {q.time > 0 && <span style={{ color: '#6b7280', fontWeight: 500 }}>زمان پاسخ: {q.time} ثانیه</span>}
                                    <span style={{ background: STATUS_BG[s], color: STATUS_COLOR[s], border: `1px solid ${STATUS_BORDER[s]}`, padding: '2px 10px', borderRadius: 4, fontWeight: 700 }}>{STATUS_LABEL[s]}</span>
                                </div>
                            </div>

                            {/* Question Body */}
                            <div style={{ fontSize: '10.5pt', fontWeight: 500, marginBottom: 10, color: '#111827', wordWrap: 'break-word' }}>{q.text}</div>

                            {/* Options */}
                            {q.options.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: q.description ? 10 : 0 }}>
                                    {q.options.map((opt, idx) => {
                                        const isCorrect  = opt.id === q.correctAnswer;
                                        const isSelected = opt.id === q.selected;

                                        const bg     = isCorrect ? '#f0fdf4' : isSelected ? '#fef2f2' : '#f9fafb';
                                        const border = isCorrect ? '#bbf7d0' : isSelected ? '#fecaca' : '#e5e7eb';
                                        const color  = isCorrect ? '#15803d' : isSelected ? '#b91c1c' : '#374151';

                                        return (
                                            <div key={opt.id} style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 6, padding: '6px 10px', fontSize: '9.5pt', color, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontWeight: 700, opacity: 0.8 }}>{idx + 1})</span>
                                                <span style={{ flex: 1 }}>{opt.text}</span>
                                                {isCorrect && <span style={{ fontWeight: 900, fontSize: '11pt' }}>✓</span>}
                                                {isSelected && !isCorrect && <span style={{ fontWeight: 900, fontSize: '11pt' }}>✗</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Description */}
                            {q.description && (
                                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '8px 12px', fontSize: '9pt', color: '#1e40af', lineHeight: 1.6 }}>
                                    <strong style={{ fontWeight: 700 }}>پاسخ تشریحی: </strong>{q.description}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Footer page-break-safe spacer */}
                <div className="prs-avoid" style={{ borderTop: '2px solid #111827', marginTop: 16, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '8.5pt', color: '#6b7280', fontWeight: 500 }}>
                    <span>امتیاز نهایی کارنامه: {u.score} از ۱۰۰</span>
                    <span>پشتیبانی سامانه آزمون روان</span>
                    <span>تعداد کل سوالات دفترچه: {total}</span>
                </div>

            </div>
        </>
    );
}
