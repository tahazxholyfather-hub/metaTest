import { motion } from 'framer-motion';

type ThemeSwitchProps = {
    theme: 'light' | 'dark';
    onToggle: () => void;
};

export const ThemeSwitch = ({ theme, onToggle }: ThemeSwitchProps) => {
    const isDark = theme === 'dark';

    return (
        <button
            onClick={onToggle}
            aria-label={isDark ? 'تغییر به پوسته روشن' : 'تغییر به پوسته تاریک'}
            className="flex items-center w-10 h-4.5 p-[1px] rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-app)] focus-visible:ring-[var(--accent)]"
            style={{
                // Active state uses your theme's accent color, inactive uses neutral element background
                backgroundColor: isDark ? 'var(--accent)' : 'var(--bg-element)',
                // flex-end pushes it to the right/left dynamically based on standard flexbox
                justifyContent: isDark ? 'flex-end' : 'flex-start'
            }}
        >
            <motion.div
                layout
                transition={{ type: "spring", stiffness: 700, damping: 30 }}
                className="w-3.5 h-3.5 rounded-full shadow-sm"
                style={{ backgroundColor: 'var(--bg-card)' }}
            />
        </button>
    );
};
