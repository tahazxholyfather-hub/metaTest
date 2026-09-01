// src/components/GridCard.tsx

export const GridCard = ({ icon: Icon, label, delay = 0 }) => {
    return (
        <div
            className="group flex flex-col pb-2 items-center justify-center p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] transition-all duration-300 cursor-pointer active:scale-95 animate-slide-up aspect-square shadow-sm"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="mb-2 p-3 rounded-2xl bg-[var(--icon-bg)]  group-hover:border-[var(--accent)] transition-colors duration-300">
                <Icon
                    size={28}
                    className="text-[var(--icon-color)] transition-transform duration-300 group-hover:scale-110"
                    strokeWidth={2}
                />
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-[var(--text-primary)] text-center leading-tight line-clamp-2">
                {label}
            </span>
        </div>
    );
};

export const GridCardSkeleton = () => {
    return (
        <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] animate-pulse aspect-square">
            <div className="w-10 h-10 rounded-2xl bg-[var(--border)] mb-2 opacity-50"></div>
            <div className="h-2 w-12 bg-[var(--border)] rounded opacity-50"></div>
        </div>
    );
};
