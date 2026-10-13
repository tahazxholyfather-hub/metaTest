import { motion, AnimatePresence } from "framer-motion";
import { Settings, CreditCard, LogOut, ChevronLeft } from "lucide-react";

export const BottomSheet = ({ isOpen, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm md:hidden"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        drag="y"
                        dragConstraints={{ top: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 100) onClose();
                        }}
                        className="fixed bottom-0 left-0 right-0 z-[70] bg-[var(--bg-card)] rounded-t-[32px] p-6 shadow-2xl md:hidden border-t border-[var(--border)] max-h-[85vh] flex flex-col"
                    >
                        {/* Drag Handle */}
                        <div className="w-full flex justify-center mb-6">
                            <div className="w-12 h-1.5 bg-[var(--border)] rounded-full opacity-50" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[var(--accent)] to-purple-500 p-[2px]">
                                <div className="w-full h-full rounded-full bg-[var(--bg-card)] p-1">
                                    <img
                                        src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                                        alt="User"
                                        className="w-full h-full rounded-full bg-[var(--bg-app)]"
                                    />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-[var(--text-primary)]">الکس مورگان</h3>
                                <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1 rounded-full mt-1 inline-block">
                                  کاربر ویژه
                                </span>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            <div className="p-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] text-center">
                                <div className="text-[var(--text-muted)] text-xs mb-1">مجموع امتیاز</div>
                                <div className="text-xl font-bold text-[var(--text-primary)]">۱۲,۴۵۰</div>
                            </div>
                            <div className="p-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border)] text-center">
                                <div className="text-[var(--text-muted)] text-xs mb-1">رتبه جهانی</div>
                                <div className="text-xl font-bold text-[var(--text-primary)]">#۴۲</div>
                            </div>
                        </div>

                        {/* Menu Options */}
                        <div className="flex-1 space-y-2 overflow-y-auto">
                            <MenuItem icon={Settings} label="تنظیمات برنامه" />
                            <MenuItem icon={CreditCard} label="مدیریت اشتراک" />
                            <MenuItem icon={LogOut} label="خروج از حساب" danger />
                        </div>

                        <button
                            onClick={onClose}
                            className="mt-6 w-full py-3.5 rounded-xl bg-[var(--text-primary)] text-[var(--bg-card)] font-semibold shadow-lg"
                        >
                            بستن منو
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// Menu Item Component
const MenuItem = ({ icon: Icon, label, danger }) => (
    <button className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${danger ? 'hover:bg-red-50 text-red-500' : 'hover:bg-[var(--bg-app)] text-[var(--text-primary)]'}`}>
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${danger ? 'bg-red-100 text-red-500' : 'bg-[var(--bg-app)] text-[var(--text-primary)]'}`}>
                <Icon size={20} />
            </div>
            <span className="font-medium">{label}</span>
        </div>
        <ChevronLeft size={18} className="text-[var(--text-muted)] opacity-50" /> {/* ChevronLeft points Left, which is correct for 'Next' in RTL */}
    </button>
);
