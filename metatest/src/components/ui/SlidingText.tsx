// یک کامپوننت کمکی برای انیمیشن نرم تغییر اعداد (iOS Style)
const SlidingText = ({ text }: { text: string | number }) => {
    return (
        <div className="relative inline-flex justify-center overflow-hidden h-5 items-center">
            <AnimatePresence mode="popLayout">
                <motion.span
                    key={text}
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    exit={{ y: '-100%', opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="inline-block whitespace-pre"
                >
                    {text}
                </motion.span>
            </AnimatePresence>
        </div>
    );
};
