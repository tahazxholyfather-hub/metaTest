import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Check, Users, Lock, Clock, Target, Play } from 'lucide-react';

// ============================================================================
// MOCK DATA (Replace with your API data)
// ============================================================================
const GRADES = [{ id: 'g1', name: 'دهم' }, { id: 'g2', name: 'یازدهم' }, { id: 'g3', name: 'دوازدهم' }];
const CHAPTERS = [{ id: 'c1', name: 'فصل اول: کیهان' }, { id: 'c2', name: 'فصل دوم: گازها' }, { id: 'c3', name: 'فصل سوم: آب' }];
const MABAHES = [{ id: 'm1', name: 'آرایش الکترونی' }, { id: 'm2', name: 'استوکیومتری' }, { id: 'm3', name: 'محلول‌ها' }];

// ============================================================================
// COMPONENTS
// ============================================================================
const Switch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <div
        onClick={onChange}
        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${checked ? 'bg-[var(--theme-color,#7C3AED)]' : 'bg-gray-300 dark:bg-gray-700'}`}
    >
        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${checked ? '-translate-x-6' : 'translate-x-0'}`} />
    </div>
);

// ============================================================================
// MAIN VIEW
// ============================================================================
export default function QuizConfigurator({ lessonName = 'شیمی', onBack, onComplete }: any) {
    const [step, setStep] = useState(1);

    // State
    const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
    const [quizType, setQuizType] = useState<'chapter' | 'mabhas' | null>(null);
    const [selectedChapters, setSelectedChapters] = useState<Record<string, number>>({});
    const [selectedMabahes, setSelectedMabahes] = useState<Record<string, number>>({});
    const [settings, setSettings] = useState({
        time: null as number | null,
        difficulty: null as number | null,
        type: null as 'public' | 'private' | null,
        limit: null as number | null
    });

    // Flow Logic
    const flowSteps = useMemo(() => {
        const steps = [
            { id: 1, title: 'انتخاب پایه', desc: 'پایه‌های مورد نظر را انتخاب کنید' },
            { id: 2, title: 'نوع آزمون', desc: 'مبنای آزمون را مشخص کنید' },
            { id: 3, title: 'انتخاب فصل‌ها', desc: 'فصل‌ها و تعداد سوال را مشخص کنید' },
        ];
        if (quizType === 'mabhas') {
            steps.push({ id: 4, title: 'انتخاب مباحث', desc: 'مباحث دقیق را انتخاب کنید' });
        }
        steps.push({ id: 5, title: 'تنظیمات آزمون', desc: 'زمان، سختی و نوع دسترسی' });
        steps.push({ id: 6, title: 'خلاصه و شروع', desc: 'مرور نهایی اطلاعات' });
        return steps;
    }, [quizType]);

    const currentStepIndex = flowSteps.findIndex(s => s.id === step);
    const activeStepData = flowSteps[currentStepIndex];

    const next = () => {
        if (currentStepIndex < flowSteps.length - 1) setStep(flowSteps[currentStepIndex + 1].id);
    };
    const prev = () => {
        if (currentStepIndex > 0) setStep(flowSteps[currentStepIndex - 1].id);
        else onBack();
    };

    // Toggles
    const toggleGrade = (id: string) => setSelectedGrades(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

    const toggleItemWithCount = (id: string, stateObj: Record<string, number>, setter: any) => {
        const newState = { ...stateObj };
        if (newState[id]) delete newState[id]; else newState[id] = 10; // Default 10 questions
        setter(newState);
    };

    const updateCount = (id: string, val: number, stateObj: Record<string, number>, setter: any) => {
        setter({ ...stateObj, [id]: val });
    };

    // Render Steps
    const renderStep = () => {
        if (step === 1) {
            return (
                <div className="space-y-3">
                    {GRADES.map(g => (
                        <div key={g.id} className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
                            <span className="font-bold">{g.name}</span>
                            <Switch checked={selectedGrades.includes(g.id)} onChange={() => toggleGrade(g.id)} />
                        </div>
                    ))}
                </div>
            );
        }

        if (step === 2) {
            return (
                <div className="space-y-3">
                    <div onClick={() => setQuizType('chapter')} className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${quizType === 'chapter' ? 'border-[var(--theme-color,#7C3AED)] bg-[var(--theme-color,#7C3AED)]/10' : 'border-transparent bg-black/5 dark:bg-white/5'}`}>
                        <h3 className="font-bold text-lg mb-1">بر اساس فصل</h3>
                        <p className="text-sm text-[var(--text-muted)]">انتخاب یک یا چند فصل برای آزمون جامع</p>
                    </div>
                    <div onClick={() => setQuizType('mabhas')} className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${quizType === 'mabhas' ? 'border-[var(--theme-color,#7C3AED)] bg-[var(--theme-color,#7C3AED)]/10' : 'border-transparent bg-black/5 dark:bg-white/5'}`}>
                        <h3 className="font-bold text-lg mb-1">بر اساس مبحث</h3>
                        <p className="text-sm text-[var(--text-muted)]">انتخاب جزئی‌تر مباحث از داخل فصل‌ها</p>
                    </div>
                </div>
            );
        }

        if (step === 3 || step === 4) {
            const isChapter = step === 3;
            const items = isChapter ? CHAPTERS : MABAHES;
            const selectedState = isChapter ? selectedChapters : selectedMabahes;
            const setter = isChapter ? setSelectedChapters : setSelectedMabahes;

            return (
                <div className="space-y-4">
                    {items.map(item => {
                        const isSelected = !!selectedState[item.id];
                        return (
                            <div key={item.id} className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 transition-all">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-sm md:text-base">{item.name}</span>
                                    <Switch checked={isSelected} onChange={() => toggleItemWithCount(item.id, selectedState, setter)} />
                                </div>
                                {isSelected && (
                                    <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10">
                                        <div className="flex justify-between text-sm mb-2 text-[var(--text-muted)]">
                                            <span>تعداد سوال مورد نیاز:</span>
                                            <span className="font-bold text-[var(--theme-color,#7C3AED)]">{selectedState[item.id]} سوال</span>
                                        </div>
                                        <input
                                            type="range" min="1" max={isChapter ? 50 : 20} value={selectedState[item.id]}
                                            onChange={(e) => updateCount(item.id, parseInt(e.target.value), selectedState, setter)}
                                            className="w-full accent-[var(--theme-color,#7C3AED)]"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (step === 5) {
            return (
                <div className="space-y-6">
                    {/* Time */}
                    <div>
                        <label className="block text-sm font-bold mb-3 text-[var(--text-muted)]">زمان آزمون (دقیقه)</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[10, 20, 30, 60].map(t => (
                                <button key={t} onClick={() => setSettings({...settings, time: t})} className={`py-2 rounded-xl text-sm font-bold transition-all ${settings.time === t ? 'bg-[var(--theme-color,#7C3AED)] text-white' : 'bg-black/5 dark:bg-white/5'}`}>{t}</button>
                            ))}
                        </div>
                    </div>

                    {/* Difficulty */}
                    <div>
                        <label className="block text-sm font-bold mb-3 text-[var(--text-muted)]">سطح سختی</label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(d => (
                                <button key={d} onClick={() => setSettings({...settings, difficulty: d})} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${settings.difficulty === d ? 'bg-orange-500 text-white' : 'bg-black/5 dark:bg-white/5'}`}>{d}</button>
                            ))}
                        </div>
                    </div>

                    {/* Visibility */}
                    <div>
                        <label className="block text-sm font-bold mb-3 text-[var(--text-muted)]">نوع دسترسی</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setSettings({...settings, type: 'private'})} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border-2 ${settings.type === 'private' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-transparent bg-black/5 dark:bg-white/5'}`}>
                                <Lock size={16}/> خصوصی
                            </button>
                            <button onClick={() => setSettings({...settings, type: 'public'})} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border-2 ${settings.type === 'public' ? 'border-green-500 bg-green-500/10 text-green-500' : 'border-transparent bg-black/5 dark:bg-white/5'}`}>
                                <Users size={16}/> عمومی
                            </button>
                        </div>
                    </div>

                    {/* Limit (Only if Public) */}
                    {settings.type === 'public' && (
                        <div className="animate-fade-in">
                            <label className="block text-sm font-bold mb-3 text-[var(--text-muted)]">ظرفیت شرکت‌کنندگان</label>
                            <div className="grid grid-cols-5 gap-2">
                                {[5, 10, 20, 30, 50].map(l => (
                                    <button key={l} onClick={() => setSettings({...settings, limit: l})} className={`py-2 rounded-xl text-sm font-bold transition-all ${settings.limit === l ? 'bg-green-500 text-white' : 'bg-black/5 dark:bg-white/5'}`}>{l}</button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (step === 6) {
            const totalQuestions = Object.values(quizType === 'mabhas' ? selectedMabahes : selectedChapters).reduce((a, b) => a + b, 0);
            return (
                <div className="bg-black/5 dark:bg-white/5 rounded-3xl p-6 text-center">
                    <div className="w-16 h-16 mx-auto bg-green-500 text-white rounded-full flex items-center justify-center mb-4">
                        <Check size={32} />
                    </div>
                    <h2 className="text-xl font-bold mb-6">تنظیمات نهایی آزمون</h2>

                    <div className="grid grid-cols-2 gap-3 text-right text-sm">
                        <div className="bg-white dark:bg-[#1C202A] p-3 rounded-xl">
                            <span className="text-[var(--text-muted)] block text-xs">درس / پایه</span>
                            <span className="font-bold">{lessonName} / {selectedGrades.length} پایه</span>
                        </div>
                        <div className="bg-white dark:bg-[#1C202A] p-3 rounded-xl">
                            <span className="text-[var(--text-muted)] block text-xs">نوع آزمون</span>
                            <span className="font-bold">{quizType === 'mabhas' ? 'مبحثی' : 'فصلی'}</span>
                        </div>
                        <div className="bg-white dark:bg-[#1C202A] p-3 rounded-xl">
                            <span className="text-[var(--text-muted)] block text-xs">زمان / سختی</span>
                            <span className="font-bold">{settings.time || '-'} دقیقه / سطح {settings.difficulty || '-'}</span>
                        </div>
                        <div className="bg-white dark:bg-[#1C202A] p-3 rounded-xl">
                            <span className="text-[var(--text-muted)] block text-xs">تعداد سوالات</span>
                            <span className="font-bold text-[var(--theme-color,#7C3AED)]">{totalQuestions} سوال</span>
                        </div>
                    </div>
                </div>
            );
        }
    };

    return (
        <div className="max-w-2xl mx-auto w-full min-h-screen flex flex-col p-4">

            {/* Header & Breadcrumb summary */}
            <div className="flex items-center justify-between mb-6">
                <button onClick={prev} className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-colors">
                    <ChevronRight size={24} />
                </button>
                <div className="text-center">
                    <h1 className="text-lg font-bold">{activeStepData.title}</h1>
                    <div className="text-xs text-[var(--text-muted)] mt-1">مرحله {currentStepIndex + 1} از {flowSteps.length}</div>
                </div>
                <div className="w-10"></div> {/* Spacer */}
            </div>

            {/* Quick Summary Strip */}
            <div className="flex flex-wrap gap-2 mb-6 px-1">
                {selectedGrades.length > 0 && <span className="text-[10px] bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">{selectedGrades.length} پایه</span>}
                {quizType && <span className="text-[10px] bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">{quizType === 'chapter' ? 'فصلی' : 'مبحثی'}</span>}
            </div>

            {/* Content Body */}
            <div className="flex-1">
                {renderStep()}
            </div>

            {/* Footer Buttons */}
            <div className="mt-8 pb-8">
                {step === 6 ? (
                    <button
                        onClick={() => onComplete({ grades: selectedGrades, type: quizType, chapters: selectedChapters, mabahes: selectedMabahes, settings })}
                        className="w-full flex items-center justify-center gap-2 bg-[var(--theme-color,#7C3AED)] text-white p-4 rounded-2xl font-bold text-lg shadow-lg"
                    >
                        <Play fill="currentColor" size={20} /> شروع آزمون
                    </button>
                ) : (
                    <button
                        onClick={next}
                        className="w-full flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black p-4 rounded-2xl font-bold text-lg"
                    >
                        تایید و ادامه <ChevronLeft size={20} />
                    </button>
                )}
            </div>
        </div>
    );
}
