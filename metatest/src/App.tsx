// src/App.tsx
import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";
import type { View } from "./types";
import { getCookie, setCookie, removeCookie } from "./lib/cookies";
import { useUser } from './context/UserContext';
import { flowApi } from './lib/authApi';
import {
    createBrowserRouter,
    RouterProvider,
    Routes,
    Route,
    useLocation,
    useNavigate,
} from "react-router-dom";



// --- Core Components ---
import SplashScreen from "./components/SplashScreen";
import { SideNav } from "./components/SideNav";
import { BottomNav } from "./components/BottomNav";
import { TopHeader } from "./components/TopHeader";

// --- Views ---
import { DashboardView } from "./views/DashboardView";
import { PracticeView } from "./views/PracticeView";
import { QuizView } from "./views/QuizView";
import { TestWorldView } from "./views/TestWorldView";
import { FavoritesView } from "./views/FavoritesView";
import { ReviewView } from "./views/ReviewView";
import { ReportsView } from "./views/ReportsView";
import { QuizHistoryView } from "./views/Quizhistoryview";
import { NotesView } from "./views/NotesView";
import { ResponsiveModal } from "./components/ResponsiveModal";
import AdminPanel from "./admin/AdminPanel";
import AuthView from "./views/AuthView";
import ProfileView from "./views/ProfileView";
import { LobbyView } from './views/LobbyView';
import QuizPage from "./views/testworld/QuizPage";
import ResultDashboard from "./views/testworld/QuizResultView";
import {PdfLibraryView} from "./views/documents";
import {PlanSelectorView} from "./views/f";
import PaymentResultPage from "./views/paymentResult";
import { MetView } from "./views/met";
const BounceApp = lazy(() => import("./bounce/ui/BounceApp").then((mod) => ({ default: mod.BounceApp })));



const APP_VIEWS: View[] = [
    "dashboard",
    "practice",
    "profile",
    "documents",
    "tests",
    "favorites",
    "notes",
    "reports",
    "reviewbox",
    "History",
    "met",
];


// --- Types ---
export type HeaderState = {
    title: string;
    step?: number;
    maxSteps?: number;
    showBackButton: boolean;
};

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "app-theme";
const AUTH_COOKIE_NAME = "auth_token";
const NETWORK_TOAST_ID = "network-status";
const LAST_VIEW_KEY = "last_visited_view";

const getStoredTheme = (): Theme | null => {
    try {
        const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark") return saved;
    } catch { }
    return null;
};

const getSystemTheme = (): Theme => {
    if (typeof window === "undefined" || !window.matchMedia) return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const getInitialTheme = (): Theme => getStoredTheme() ?? getSystemTheme();

const getInitialView = (): View => {
    try {
        const saved = window.localStorage.getItem(LAST_VIEW_KEY) as View;
        return saved ? saved : "dashboard";
    } catch {
        return "dashboard";
    }
};

const TRACKED_VIEWS = ['practice', 'tests']; // specific views for activity counter
const IDLE_TIMEOUT_MS = 60000; // 1 minute of no mouse/keyboard = idle

function MainApp() {
    // --- State ---
    const [isLoading, setIsLoading] = useState(true);
    const [theme, setTheme] = useState<Theme>(getInitialTheme);
    const [isSystemTheme, setIsSystemTheme] = useState(getStoredTheme() === null);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const [activeView, setActiveView] = useState<View>(getInitialView);
    const [isQuizActive, setIsQuizActive] = useState(false);
    const [quizConfig, setQuizConfig] = useState<any>(null);
    const [quizResumeId, setQuizResumeId] = useState<string | undefined>(undefined);
    const [isHeaderHiddenByChild, setIsHeaderHiddenByChild] = useState(false);

    const [isIdle, setIsIdle] = useState(false);
    const lastInteractionRef = useRef(Date.now());
    const activeSecondsRef = useRef(0);

    const location = useLocation();
    const navigate = useNavigate();
    // Check if the current URL starts with /lobby

    const IsInRegularViews = ['/lobby', '/quiz', '/result'].some((path) =>
        location.pathname.startsWith(path)
    );
    const [pendingView, setPendingView] = useState<View | null>(null);
    const [quizExitRequested, setQuizExitRequested] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);


    // دریافت وضعیت احراز هویت مستقیماً از کانتکست
    const { user, setUser, isAuthenticated, isAuthLoading } = useUser();

    const [headerState, setHeaderState] = useState<HeaderState>({
        title: "داشبورد",
        showBackButton: false,
    });

    const lastNetworkStatus = useRef<boolean | null>(null);
    const viewEntryTime = useRef<number>(Date.now());
    const trackedView = useRef<View>(activeView);

    const calculateMaxXp = (level: number) => {
        return Math.floor(100 * Math.pow(level, 1.5));
    };
    const currentLevel = user?.xp_level || 1;

    // --- Helper: Activity Tracking ---
    const sendActivityData = useCallback((viewName: string) => {
        if (!user?.id || activeSecondsRef.current === 0) return;

        // Grab the accumulated active seconds
        const durationSeconds = activeSecondsRef.current;

        // Reset the accumulator immediately so we don't double-count
        activeSecondsRef.current = 0;

        flowApi.saveUserActivity({
            user_id: user.id,
            page_view: viewName,
            seconds: durationSeconds
        });
    }, [user]);

    // --- Effects ---

    // 0. Idle Detection & Active Timer Accumulator
    useEffect(() => {
        // Reset the idle timer when the user physically does something
        const handleUserInteraction = () => {
            lastInteractionRef.current = Date.now();
            if (isIdle) setIsIdle(false);
        };

        // Detect if they switched to another browser tab
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setIsIdle(true);
            } else {
                handleUserInteraction();
            }
        };

        // Attach listeners
        const interactionEvents = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
        interactionEvents.forEach(event => window.addEventListener(event, handleUserInteraction));
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Periodically check if the user has been inactive longer than IDLE_TIMEOUT_MS
        const idleCheckInterval = setInterval(() => {
            if (Date.now() - lastInteractionRef.current > IDLE_TIMEOUT_MS) {
                setIsIdle(true);
            }
        }, 5000); // Check every 5 seconds

        return () => {
            interactionEvents.forEach(event => window.removeEventListener(event, handleUserInteraction));
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(idleCheckInterval);
        };
    }, [isIdle]);

    // Track active seconds
    useEffect(() => {
        const isInTrackableView = TRACKED_VIEWS.includes(activeView);
        // Only track if they are in a tracked view and not idle (also pausing if they are in a quiz view)
        const shouldTrack = isInTrackableView && !isIdle && !isQuizActive;

        if (!shouldTrack) return;

        // Tick up the active seconds every 1 second
        const trackingInterval = setInterval(() => {
            activeSecondsRef.current += 1;

            // Automatically send data every 60 active seconds to prevent data loss
            if (activeSecondsRef.current >= 60) {
                sendActivityData(activeView);
            }
        }, 1000);

        return () => clearInterval(trackingInterval);
    }, [activeView, isIdle, isQuizActive, sendActivityData]);


    // 1. View Tracking & Persistence
    useEffect(() => {
        if (!isAuthenticated) return;

        try {
            window.localStorage.setItem(LAST_VIEW_KEY, activeView);
        } catch {}

        if (user?.id) {
            flowApi.saveViewsCount({ view: activeView });
        }

        const now = Date.now();
        if (trackedView.current !== activeView) {
            sendActivityData(trackedView.current); // Use updated function
            trackedView.current = activeView;
            viewEntryTime.current = now; // Keeping this purely as a record if needed
        }

    }, [activeView, isAuthenticated, user, sendActivityData]);

    // 2. Resilient Unload Tracking
    useEffect(() => {
        if (!isAuthenticated) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                sendActivityData(trackedView.current);
            }
        };

        const handleBeforeUnload = () => {
            sendActivityData(trackedView.current);
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            sendActivityData(trackedView.current);
        };
    }, [isAuthenticated, sendActivityData]);

    // 3. Theme & Network Effects
    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("dark", theme === "dark");
        if (isSystemTheme) {
            localStorage.removeItem(THEME_STORAGE_KEY);
        } else {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        }
    }, [theme, isSystemTheme]);

    useEffect(() => {
        if (!isSystemTheme) return;
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent | MediaQueryList) => setTheme(e.matches ? "dark" : "light");

        if (mediaQuery.addEventListener) mediaQuery.addEventListener("change", handleChange);
        else mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [isSystemTheme]);

    useEffect(() => {
        const getIsOnline = () => (typeof navigator !== "undefined" ? navigator.onLine : true);
        const handleNetworkChange = () => {
            const isOnline = getIsOnline();
            if (lastNetworkStatus.current === isOnline) return;
            lastNetworkStatus.current = isOnline;
            if (!isOnline) {
                toast.error("اتصال اینترنت قطع شد", { id: NETWORK_TOAST_ID, duration: Infinity });
            } else {
                toast.dismiss(NETWORK_TOAST_ID);
                toast.success("اتصال اینترنت برقرار شد", { id: NETWORK_TOAST_ID, duration: 1800 });
            }
        };
        window.addEventListener("online", handleNetworkChange);
        window.addEventListener("offline", handleNetworkChange);
        return () => {
            window.removeEventListener("online", handleNetworkChange);
            window.removeEventListener("offline", handleNetworkChange);
        };
    }, []);




    useEffect(() => {
        const titles: Record<string, string> = {
            dashboard: "داشبورد",
            profile: "پروفایل کاربری",
            tests: "دنیای آزمون",
            practice: "تمرین",
            documents: "نمونه سوالات",
            favorites: "علاقه مندی ها",
            notes: "یادداشت ها",
            reports: "گزارش ها",
            History: " سوابق آزمون ها",
            reviewbox: "جعبه مرور",
            met: "مِت",
            ai_teacher: "مِت",
            chat: "مِت",
        };

        document.title = `${titles[activeView] ?? "متاتست"} | Metatest`;
    }, [activeView]);



    // --- Handlers ---
    const handleSplashFinish = useCallback(() => setIsLoading(false), []);

    const handleLoginSuccess = useCallback((token: string) => {
        setCookie(AUTH_COOKIE_NAME, token, 7);
        // آپدیت سریع یوزر از سرور بعد از لاگین و نشستن کوکی
        flowApi.getUserInfo()
            .then(response => {
                if (response.success && response.data) {
                    setUser(response.data);
                    setActiveView(getInitialView());
                    toast.success("خوش آمدید!");
                }
            })
            .catch(error => {
                console.error("Failed to fetch user data after login:", error);
                removeCookie(AUTH_COOKIE_NAME);
                toast.error("خطا در دریافت اطلاعات کاربر");
            });
    }, [setUser]);

    const executeLogout = useCallback(() => {
        removeCookie(AUTH_COOKIE_NAME);
        localStorage.removeItem(LAST_VIEW_KEY);
        setUser(null);
        setActiveView("dashboard");
        setShowLogoutModal(false);
        toast.info("با موفقیت خارج شدید");
    }, [setUser]);

    const toggleTheme = useCallback(() => {
        setIsSystemTheme(false);
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    }, []);

    // --- Navigation Logic ---
    const performNavigation = useCallback((view: View, pushToHistory = true) => {
        setIsQuizActive(false);
        setQuizConfig(null);
        setQuizResumeId(undefined);
        setActiveView(view);

        if (view === "dashboard") setHeaderState({ title: "داشبورد", showBackButton: false });
        if (view === "profile") setHeaderState({ title: "پروفایل کاربری", showBackButton: false });
        if (view === "tests") setHeaderState({ title: "دنیای آزمون", showBackButton: false });
        if (view === "practice") setHeaderState({ title: "تمرین", showBackButton: true });
        if (view === "favorites") setHeaderState({ title: "علاقه مندی ها", showBackButton: true });
        if (view === "notes") setHeaderState({ title: "یادداشت ها", showBackButton: true });
        if (view === "reports") setHeaderState({ title: "گزارش ها", showBackButton: true });
        if (view === "reviewbox") setHeaderState({ title: "جعبه مرور", showBackButton: true });
        if (view === "documents") setHeaderState({ title: "نمونه سوالات", showBackButton: true });
        if (view === "History") setHeaderState({ title: "سابقه آزمون ها", showBackButton: true });
        if (view === "met" || view === "ai_teacher" || view === "chat") setHeaderState({ title: "مِت", showBackButton: false });

        if (pushToHistory) {
            if (pushToHistory) {
                navigate(`/${view}`);
            }

        }
    }, []);

    const handleNavigation = useCallback((view: View, pushToHistory = true) => {
        if (isQuizActive) {
            setPendingView(view);
            setQuizExitRequested(true);
            return;
        }

        performNavigation(view, pushToHistory);
    }, [isQuizActive, performNavigation]);

    const handleQuizExitConfirm = useCallback(() => {
        const targetView = pendingView ?? "dashboard";
        setQuizExitRequested(false);
        setPendingView(null);
        setIsQuizActive(false);
        performNavigation(targetView);
    }, [pendingView, performNavigation]);

    const handleQuizExitCancel = useCallback(() => {
        setQuizExitRequested(false);
        setPendingView(null);
    }, []);

    useEffect(() => {
        const pathName = location.pathname.replace(/^\/+/, "") as View;

        // Legacy URLs for the AI tutor now live at /met
        if (pathName === "ai_teacher" || pathName === "chat") {
            setActiveView("met");
            navigate("/met", { replace: true });
            return;
        }

        if (APP_VIEWS.includes(pathName)) {
            setActiveView(pathName);
            return;
        }

        if (location.pathname === "/") {
            setActiveView("dashboard");
        }
    }, [location.pathname, navigate]);



    const handleStartQuiz = useCallback((config: any, resumeId?: string) => {
        setQuizConfig(config);
        setQuizResumeId(resumeId);
        setIsQuizActive(true);
        setQuizExitRequested(false);
        setPendingView(null);


    }, []);


    const handleQuizFinish = useCallback(() => {
        setQuizExitRequested(false);
        setPendingView(null);
        setIsQuizActive(false);
        setQuizConfig(null);
        setQuizResumeId(undefined);
        handleNavigation("dashboard");
    }, [handleNavigation]);



    const handleViewStateChange = useCallback((state: HeaderState) => {
        setHeaderState((prev) =>
            prev.title === state.title &&
            prev.step === state.step &&
            prev.showBackButton === state.showBackButton
                ? prev
                : { ...prev, ...state }
        );
    }, []);

    const handleBack = useCallback(() => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            handleNavigation("dashboard", true);
        }
    }, [navigate, handleNavigation]);

    function useIsMobile() {
        const [isMobile, setIsMobile] = useState(false);

        useEffect(() => {
            const check = () => {
                setIsMobile(window.innerWidth <= 768);
            };

            check();
            window.addEventListener("resize", check);

            return () => window.removeEventListener("resize", check);
        }, []);

        return isMobile;
    }
    const isMobile = useIsMobile();

    // --- Rendering ---
    const renderActiveView = useCallback(() => {
        switch (activeView) {
            case "quiz":
                break;
            case "practice":
                return <PracticeView key="practice" onStartQuiz={handleStartQuiz} onStateChange={handleViewStateChange} />;
            case "documents":
                return <PdfLibraryView key="documents" onBack={handleBack} onStateChange={handleViewStateChange} />;
            case "profile":
                return <ProfileView key="profile" onLogout={() => setShowLogoutModal(true)} onStateChange={handleViewStateChange}/>;
            case "favorites":
                return <FavoritesView key="favorites" onBack={handleBack} onStateChange={handleViewStateChange}/>;
            case "History":
                return <QuizHistoryView key="History" onBack={handleBack} onStateChange={handleViewStateChange}/>;
            case "reviewbox":
                return <ReviewView key="reviewbox" onBack={handleBack} onStateChange={handleViewStateChange}/>;
            case "reports":
                return <ReportsView key="reports" onBack={handleBack} onStateChange={handleViewStateChange}/>;
            case "notes":
                return <NotesView key="notes" onBack={handleBack} onStateChange={handleViewStateChange}/>;
            case "tests":
                return <TestWorldView key="tests" theme={theme} onStateChange={handleViewStateChange} onToggleHeader={setIsHeaderHiddenByChild} isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)}/>;
            case "met":
            case "ai_teacher":
            case "chat":
                return <MetView key="met" onNavigate={handleNavigation} />;
            case "dashboard":
            default:
                return <DashboardView key="dashboard" onNavigateToQuizHistory={() => handleNavigation("History")} onNavigateToFavorites={() => handleNavigation("favorites")} onNavigateToReports={() => handleNavigation("reports")} onNavigateToReview={() => handleNavigation("reviewbox")} onNavigateToNotes={() => handleNavigation("notes")}/>;
        }
    }, [activeView, handleBack, handleNavigation, handleStartQuiz, handleViewStateChange, isCollapsed]);

    // Met (AI tutor) draws its own header; the global TopHeader is hidden but the
    // mobile BottomNav stays so the student can leave without an exit button.
    const isAiTeacherChrome = activeView === "met" || activeView === "ai_teacher" || activeView === "chat";
    const showGlobalHeader = !isHeaderHiddenByChild && !isQuizActive && !isAiTeacherChrome && activeView !== "profile" && activeView !== "tests";
    const showGlobalBottomNav = !isQuizActive && !isHeaderHiddenByChild;
    const mainClassName = useMemo(
        () =>
            `flex-1 flex flex-col relative w-full min-h-0 ${
                isAiTeacherChrome ? 'overflow-hidden' : 'overflow-y-auto scrollbar-hide md:pb-6'
            }`,
        [isAiTeacherChrome]
    );


    if (isLoading || isAuthLoading) return <SplashScreen onFinish={handleSplashFinish} />;

    if (!isAuthenticated) {
        return (
            <div dir="rtl" className="h-[100dvh] bg-[var(--bg-app)] font-sans flex items-center justify-center">
                <AuthView onSuccess={handleLoginSuccess} />
                <Toaster theme={theme} position="top-center" dir="rtl" />
            </div>
        );
    }

    return (
        <div dir="rtl" className="h-[100dvh] overflow-hidden flex bg-[var(--bg-app)] font-sans transition-colors duration-300">
            {!IsInRegularViews && (
                <SideNav activeView={activeView} onLogout={() => setShowLogoutModal(true)} onNavigate={handleNavigation} theme={theme} onToggleTheme={toggleTheme} isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} />
            )}

            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 relative h-full ${
                IsInRegularViews ? 'md:mr-0' : (isCollapsed ? 'md:mr-20' : 'md:mr-64')
            }`}>
                <AnimatePresence>
                    {(showGlobalHeader && !IsInRegularViews) && (
                        <motion.div
                            initial={{ y: -50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -50, opacity: 0, position: "absolute", width: "100%", zIndex: 10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <TopHeader
                                title={headerState.title}
                                step={headerState.step}
                                maxSteps={headerState.maxSteps}
                                showBackButton={headerState.showBackButton}
                                onBack={handleBack}
                                onLogout={() => setShowLogoutModal(true)}
                                activeView={activeView}
                                onNavigate={handleNavigation}
                                theme={theme}
                                onToggleTheme={toggleTheme}
                                coinCount={user?.trophies || 0}
                                level={user?.xp_level || 1}
                                currentXp={user?.xp_points || 0}
                                maxXp={calculateMaxXp(currentLevel)}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.main
                    key={activeView}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className={mainClassName}
                >
                    <Routes>
                        <Route path="/lobby/:shareCode" element={<LobbyView />} />
                        <Route path="/result/:resultId" element={<ResultDashboard />} />
                        <Route path="/quiz/:quizId" element={<QuizPage />} />
                        <Route path="*" element={
                            isQuizActive ? (
                                <QuizView
                                    key={quizResumeId ? `quiz-${quizResumeId}` : "quiz-new"}
                                    config={quizConfig}
                                    resumeId={quizResumeId}
                                    onFinish={handleQuizFinish}
                                    exitRequested={quizExitRequested}
                                    onConfirmExit={handleQuizExitConfirm}
                                    onCancelExit={handleQuizExitCancel}
                                />
                            ) : (
                                renderActiveView()
                            )
                        } />
                    </Routes>
                </motion.main>

                <AnimatePresence>
                    {(showGlobalBottomNav && !IsInRegularViews) && (
                        <motion.div
                            initial={{ y: 100 }}
                            animate={{ y: 0 }}
                            exit={{ y: 100, position: "absolute", bottom: 0, width: "100%", zIndex: 10 }}
                            transition={{ duration: 0.2 }}
                            className="md:hidden z-50 absolute bottom-0 left-0 w-full"
                        >
                            <BottomNav activeView={activeView} onNavigate={handleNavigation} />
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>


            {/* مودال تایید خروج از حساب */}
            <ResponsiveModal
                isOpen={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                title="خروج از حساب"
                className="md:w-[400px]"
            >
                <div className="p-4 text-center md:text-right">
                    <p className="text-[var(--text-secondary)] mb-8 mt-2">
                        آیا مطمئن هستید که می‌خواهید از حساب کاربری خود خارج شوید؟
                    </p>
                    {/* دکمه‌ها هم‌اندازه و مرتب شده‌اند */}
                    <div className="flex items-center justify-center gap-3 w-full">
                        <button
                            onClick={() => setShowLogoutModal(false)}
                            className="flex-1 py-3 bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-xl font-bold transition-colors hover:brightness-95"
                        >
                            انصراف
                        </button>
                        <button
                            onClick={executeLogout}
                            className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold transition-colors hover:bg-red-600"
                        >
                            بله، خارج شو
                        </button>
                    </div>
                </div>
            </ResponsiveModal>

            <Toaster
                theme={theme}
                position={isMobile ? "bottom-center" : "bottom-right"}
                dir="rtl"
                closeButton={false}
                toastOptions={{ duration: 2000 }}
            />
        </div>
    );
}

// ==========================================
// 2. THE NEW ROOT APP (Handles top-level routing)
// ==========================================
const router = createBrowserRouter(
    [
        { path: "/admin/*", element: <AdminPanel /> },
        { path: "/bounce/*", element: <Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "#9fd4f2" }} />}><BounceApp /></Suspense> },
        { path: "/re/*", element: <PlanSelectorView /> },
        { path: "/payment/result/:token", element: <PaymentResultPage /> },
        { path: "/*", element: <MainApp /> },
    ]
);

export default function App() {
    return <RouterProvider router={router} />;
}

// {
//     basename: "/app",   // ← add this
// }