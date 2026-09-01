// src/components/dashboard/StatCard.tsx

import { motion } from "framer-motion";

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

export const StatCard = ({ icon: Icon, value, label, color }) => {
    return (
        <motion.div
            variants={cardVariants}
            className="bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border)] flex items-center gap-4"
        >
            <div className={`w-12 h-12 rounded-xl bg-[var(--bg-element)] flex items-center justify-center ${color}`}>
                <Icon size={28} strokeWidth={2.5} />
            </div>
            <div>
                <p className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">{value}</p>
                <p className="text-xs md:text-sm text-[var(--text-muted)]">{label}</p>
            </div>
        </motion.div>
    );
};
