import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { SideNav } from "./components/SideNav";
import { BottomNav } from "./components/BottomNav";
import { TopHeader } from "./components/TopHeader";
import { Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "app-theme";

const getStoredTheme = (): Theme | null => {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return null;
};

const getSystemTheme = (): Theme => {
    if (!window.matchMedia) return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
};

const getInitialTheme = (): Theme =>
    getStoredTheme() ?? getSystemTheme();

export default function AppLayout() {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);
    const [isSystemTheme, setIsSystemTheme] = useState(
        getStoredTheme() === null
    );
    const [isCollapsed, setIsCollapsed] = useState(false);

    // ✅ Apply theme properly
    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("dark", theme === "dark");

        if (isSystemTheme) {
            localStorage.removeItem(THEME_STORAGE_KEY);
        } else {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        }
    }, [theme, isSystemTheme]);

    const toggleTheme = useCallback(() => {
        setIsSystemTheme(false);
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    }, []);

    return (
        <div
            dir="rtl"
            className="h-[100dvh] overflow-hidden flex bg-[var(--bg-app)] font-sans transition-colors duration-300"
        >
            <SideNav
                activeView={undefined as any}
                onNavigate={() => {}}
                theme={theme}
                onToggleTheme={toggleTheme}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
            />

            <div
                className={`flex-1 flex flex-col min-w-0 transition-all duration-300 relative h-full ${
                    isCollapsed ? "md:mr-20" : "md:mr-64"
                }`}
            >
                <AnimatePresence>
                    <motion.div
                        initial={{ y: -40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -40, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <TopHeader
                            title=""
                            showBackButton={false}
                            theme={theme}
                            onToggleTheme={toggleTheme}
                        />
                    </motion.div>
                </AnimatePresence>

                <main className="flex-1 overflow-y-auto scrollbar-hide">
                    <Outlet context={{ theme, toggleTheme, isCollapsed, setIsCollapsed }} />
                </main>

                <div className="md:hidden z-50 absolute bottom-0 left-0 w-full">
                    <BottomNav activeView={undefined as any} onNavigate={() => {}} />
                </div>
            </div>

            <Toaster theme={theme} position="bottom-right" dir="rtl" />
        </div>
    );
}
