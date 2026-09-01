import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export interface TourStep {
    selector: string;
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourContextType {
    startTour: (steps: TourStep[]) => void;
    stopTour: () => void;
    nextStep: () => void;
    prevStep: () => void;
    currentStepIndex: number;
    isOpen: boolean;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const useTour = () => {
    const context = useContext(TourContext);
    if (!context) throw new Error('useTour must be used within a TourProvider');
    return context;
};

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [steps, setSteps] = useState<TourStep[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});
    const cardRef = useRef<HTMLDivElement>(null);

    const startTour = (newSteps: TourStep[]) => {
        setSteps(newSteps);
        setCurrentStepIndex(0);
        setIsOpen(true);
    };

    const stopTour = () => {
        setIsOpen(false);
        setCoords(null);
    };

    const nextStep = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
        } else {
            stopTour();
        }
    };

    const prevStep = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex((prev) => prev - 1);
        }
    };

    useEffect(() => {
        if (!isOpen || steps.length === 0) return;

        const updateCoords = () => {
            const step = steps[currentStepIndex];
            const element = document.querySelector(step.selector);

            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                setTimeout(() => {
                    const rect = element.getBoundingClientRect();
                    const padding = 8;
                    const x = rect.left - padding;
                    const y = rect.top - padding;
                    const w = rect.width + padding * 2;
                    const h = rect.height + padding * 2;

                    setCoords({ x, y, w, h });

                    const pos = step.position || 'bottom';
                    const cardWidth = cardRef.current?.offsetWidth || 320;
                    const cardHeight = cardRef.current?.offsetHeight || 150;
                    const gap = 12;

                    let top = 0;
                    let left = 0;

                    switch (pos) {
                        case 'top':
                            top = rect.top - cardHeight - gap;
                            left = rect.left + rect.width / 2 - cardWidth / 2;
                            break;
                        case 'bottom':
                            top = rect.bottom + gap;
                            left = rect.left + rect.width / 2 - cardWidth / 2;
                            break;
                        case 'left':
                            top = rect.left - cardWidth - gap;
                            top = rect.top + rect.height / 2 - cardHeight / 2;
                            break;
                        case 'right':
                            top = rect.top + rect.height / 2 - cardHeight / 2;
                            left = rect.right + gap;
                            break;
                    }

                    const margin = 16;
                    left = Math.max(margin, Math.min(left, window.innerWidth - cardWidth - margin));
                    top = Math.max(margin, Math.min(top, window.innerHeight - cardHeight - margin));

                    setCardStyle({
                        top: `${top}px`,
                        left: `${left}px`,
                    });
                }, 150);
            } else {
                setCoords(null);
                setCardStyle({
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                });
            }
        };

        updateCoords();
        window.addEventListener('resize', updateCoords);
        window.addEventListener('scroll', updateCoords, true);

        return () => {
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [isOpen, currentStepIndex, steps]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') stopTour();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const currentStep = steps[currentStepIndex];

    return (
        <TourContext.Provider value={{ startTour, stopTour, nextStep, prevStep, currentStepIndex, isOpen }}>
            {children}
            {isOpen && (
                <div className="fixed inset-0 z-[999] overflow-hidden pointer-events-none">
                    {/* Glassy backdrop using your design parameters */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-auto transition-all duration-300">
                        <defs>
                            <mask id="tour-mask">
                                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                {coords && (
                                    <rect
                                        x={coords.x}
                                        y={coords.y}
                                        width={coords.w}
                                        height={coords.h}
                                        rx="12"
                                        fill="black"
                                        className="transition-all duration-300"
                                        style={{ transitionTimingFunction: 'var(--motion-ease)' }}
                                    />
                                )}
                            </mask>
                        </defs>
                        <rect
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            fill="rgba(11, 11, 16, 0.45)"
                            mask="url(#tour-mask)"
                            className="backdrop-blur-[8px] transition-all duration-300"
                        />
                    </svg>

                    {/* Glowing border outline for the highlighted element */}
                    {coords && (
                        <div
                            className="absolute pointer-events-auto border-2 border-indigo-500/50 dark:border-violet-500/50 rounded-xl shadow-[0_0_0_4px_rgba(99,102,241,0.15)] transition-all duration-300"
                            style={{
                                left: `${coords.x}px`,
                                top: `${coords.y}px`,
                                width: `${coords.w}px`,
                                height: `${coords.h}px`,
                                transitionTimingFunction: 'var(--motion-ease)'
                            }}
                        />
                    )}

                    {/* Dialog Card Container */}
                    {currentStep && (
                        <div
                            ref={cardRef}
                            style={{
                                ...cardStyle,
                                transitionTimingFunction: 'var(--motion-ease)',
                                backgroundColor: 'var(--bg-card)',
                                borderColor: 'var(--border)',
                                color: 'var(--text-primary)',
                                boxShadow: 'var(--shadow-2)'
                            }}
                            className="absolute pointer-events-auto w-80 max-w-[calc(100vw-32px)] border rounded-2xl p-5 backdrop-blur-md transition-all duration-300"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold tracking-wider uppercase text-indigo-600 dark:text-violet-400">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
                                <button
                                    onClick={stopTour}
                                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs transition-colors cursor-pointer"
                                >
                                    Skip
                                </button>
                            </div>

                            {/* Text Area utilizing your pre-defined fade animation */}
                            <div key={currentStepIndex} className="animate-fade-in space-y-1.5">
                                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                                    {currentStep.title}
                                </h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    {currentStep.content}
                                </p>
                            </div>

                            {/* Actions Footer */}
                            <div className="flex items-center justify-between mt-5 pt-3 border-t border-zinc-150/60 dark:border-zinc-800/80">
                                <button
                                    onClick={prevStep}
                                    disabled={currentStepIndex === 0}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                                        currentStepIndex === 0
                                            ? 'text-zinc-300 dark:text-zinc-700 pointer-events-none'
                                            : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900'
                                    }`}
                                >
                                    Back
                                </button>
                                <button
                                    onClick={nextStep}
                                    className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 dark:bg-violet-600 hover:bg-indigo-500 dark:hover:bg-violet-500 active:scale-95 transition-all rounded-lg shadow-sm cursor-pointer"
                                >
                                    {currentStepIndex === steps.length - 1 ? 'Understood' : 'Next'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </TourContext.Provider>
    );
};
