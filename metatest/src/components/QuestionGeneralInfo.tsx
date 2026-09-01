import React, { useEffect, useRef } from 'react';
import {
    BookOpen,
    BookMarked,
    Layers,
    FileText,
    BarChart,
    Calendar,
} from 'lucide-react';

interface QuestionGeneralInfoProps {
    isLoading: boolean;
    grade?: string;
    subject?: string;
    chapter?: string;
    lesson?: string;
    level?: string;
}

export const QuestionGeneralInfo: React.FC<QuestionGeneralInfoProps> = ({
                                                                            isLoading,
                                                                            grade,
                                                                            subject,
                                                                            chapter,
                                                                            lesson,
                                                                            level
                                                                        }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to center on mobile by default
    useEffect(() => {
        if (!isLoading && scrollContainerRef.current) {
            requestAnimationFrame(() => {
                const el = scrollContainerRef.current;
                if (!el) return;
                const maxScroll = el.scrollWidth - el.clientWidth;
                if (maxScroll > 0) {
                    const center = maxScroll / 2;
                    el.scrollLeft = -10;
                    if (el.scrollLeft < 0) {
                        el.scrollLeft = -center;
                    } else {
                        el.scrollLeft = center;
                    }
                }
            });
        }
    }, [isLoading]);

    const infoItems = [
        { label: 'پایه', value: grade, icon: BookOpen },
        { label: 'درس', value: subject, icon: BookMarked },
        { label: 'فصل', value: chapter, icon: Layers },
        { label: 'مبحث', value: lesson, icon: FileText },
        { label: 'سطح', value: level, icon: BarChart },

    ];

    if (isLoading) {
        return (
            <div className="w-full px-2 md:px-0 mb-6 fade-mask-both md:![-webkit-mask:none] md:![mask:none]" dir="rtl">
                <div className="flex items-center justify-start md:justify-center md:flex-wrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-2 gap-4">
                    <div className="w-4 md:w-0 flex-shrink-0" />
                    {Array.from({ length: 5 }).map((_, idx) => (
                        <div key={idx} className="flex items-center gap-2 flex-shrink-0 animate-pulse">
                            <div className="w-3.5 h-3.5 rounded bg-[var(--bg-element)]" />
                            <div className="h-3 w-8 bg-[var(--bg-element)] rounded" />
                            <div className="h-4 w-12 bg-[var(--border)] rounded" />
                        </div>
                    ))}
                    <div className="w-4 md:w-0 flex-shrink-0" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full mb-6 px-2 md:px-0 fade-mask-both md:![-webkit-mask:none] md:![mask:none] transition-all duration-300" dir="rtl">
            <div
                ref={scrollContainerRef}
                className="flex items-center justify-start md:justify-center md:flex-wrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-2 gap-4 md:gap-5 cursor-grab active:cursor-grabbing"
            >
                <div className="w-4 md:w-0 flex-shrink-0" />

                {infoItems.map((item, idx) => (
                    <React.Fragment key={idx}>
                        <div className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap group/item">
                            <item.icon
                                size={14}
                                className="text-[var(--accent)] transition-colors duration-300"
                                strokeWidth={2.5}
                            />
                            <span className="text-[11px] font-medium text-[var(--text-muted)]">
                                {item.label}:
                            </span>
                            <span className="text-sm font-semibold text-[var(--text-primary)]">
                                {item.value || '---'}
                            </span>
                        </div>

                        {idx < infoItems.length - 1 && (
                            <div className="w-1 h-1 rounded-full bg-[var(--border)] flex-shrink-0" />
                        )}
                    </React.Fragment>
                ))}

                <div className="w-4 md:w-0 flex-shrink-0" />
            </div>
        </div>
    );
};
