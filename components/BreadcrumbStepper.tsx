// src/components/BreadcrumbStepper.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface BreadcrumbStepperProps {
    steps: string[];
    currentStepIndex: number;
    onStepClick: (index: number) => void;
}

const BreadcrumbStepper: React.FC<BreadcrumbStepperProps> = ({ steps, currentStepIndex, onStepClick }) => {
    return (
        <div className="relative w-full max-w-xl mx-auto flex flex-row-reverse items-center justify-between p-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)]">

            {/* The sliding highlight, animated with Framer Motion */}
            {/* It will automatically track the position of the active button */}
            <motion.div
                className="absolute h-[calc(100%-12px)] rounded-full bg-[var(--accent)]"
                // This calculates the width and position for RTL layout
                style={{
                    width: `calc(${100 / steps.length}% - 4px)`,
                    right: `calc(${currentStepIndex * (100 / steps.length)}% + 6px)`
                }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />

            {steps.map((step, idx) => {
                const isCompleted = idx < currentStepIndex;
                const isActive = idx === currentStepIndex;
                const isClickable = idx < currentStepIndex;

                return (
                    <button
                        key={step}
                        onClick={() => isClickable && onStepClick(idx)}
                        disabled={!isClickable}
                        className={`
              relative z-10 flex-1 px-2 py-1 text-center rounded-full outline-none
              transition-colors duration-300
              ${isClickable ? 'cursor-pointer' : 'cursor-default'}
            `}
                    >
                        <div className="flex items-center justify-center gap-2">

                            {/* Step Status Icon */}
                            <div className={`
                w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold transition-all duration-300
                ${isActive ? 'bg-white text-[var(--accent)]'
                                : isCompleted ? 'bg-[var(--success)]/20 text-[var(--success)]'
                                    : 'bg-[var(--border)] text-[var(--text-muted)]'
                            }
              `}>
                                {isCompleted ? <Check size={12} strokeWidth={3} /> : idx + 1}
                            </div>

                            {/* Step Label */}
                            <span className={`
                font-semibold text-sm transition-colors duration-300
                hidden sm:inline
                ${isActive ? 'text-white'
                                : isCompleted ? 'text-[var(--text-primary)]'
                                    : 'text-[var(--text-muted)]'
                            }
              `}>
                {step}
              </span>

                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export default BreadcrumbStepper;
