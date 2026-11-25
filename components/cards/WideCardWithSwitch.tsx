import type { ElementType } from 'react';

type WideCardWithSwitchProps = {
    icon: ElementType;
    label: string;
    desc?: string;
    delay: number;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
};

export const WideCardWithSwitch = ({
                                       icon: Icon,
                                       label,
                                       desc,
                                       delay,
                                       checked,
                                       onCheckedChange
                                   }: WideCardWithSwitchProps) => {
    return (
        <div
            onClick={() => onCheckedChange(!checked)}
            className="group flex items-center gap-4 p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 transition-all duration-300 cursor-pointer h-full"
            style={{ animation: `slideUp 0.5s cubic-bezier(0.8, 0.2, 0.2, 1) ${delay}ms backwards` }}
        >
            {/* باکس آیکن مشابه WideCard اصلی */}
            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-element)] text-[var(--accent)] flex items-center justify-center group-hover:scale-110 group-hover:bg-[var(--accent)] group-hover:text-white transition-all duration-300 shadow-sm shrink-0">
                <Icon size={28} strokeWidth={2} />
            </div>

            {/* متن‌ها */}
            <div className="flex-1 min-w-0 text-right">
                <h3 className="text-base font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                    {label}
                </h3>
                {desc && (
                    <p className="text-sm text-[var(--text-muted)] mt-1 truncate">
                        {desc}
                    </p>
                )}
            </div>

            {/* سوئیچ سفارشی با Tailwind CSS */}
            <div className="shrink-0 flex items-center justify-center pl-1">
                <div
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
                        checked ? 'bg-[var(--accent)]' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                >
                    <div
                        // در حالت RTL برای حرکت دادن دکمه به سمت چپ از مقادیر منفی translate استفاده می‌کنیم
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                            checked ? '-translate-x-5' : 'translate-x-0'
                        }`}
                    />
                </div>
            </div>
        </div>
    );
};
