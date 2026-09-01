// TourProvider.tsx
import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { flowApi } from "../lib/authApi";

export interface TourStep {
    selector: string;
    mobileSelector?: string;
    title: string;
    description: string;
}

interface TourContextType {
    startTour: (key: string, steps: TourStep[]) => Promise<void>;
    endTour: () => void;
    checkTour: (tourKey: string) => Promise<boolean>;
    submitTour: (tourKey: string) => Promise<boolean>;
}

const TourContext = createContext<TourContextType>({
    startTour: async () => {},
    endTour: () => {},
    checkTour: async () => false,
    submitTour: async () => false,
});

export const useTour = () => useContext(TourContext);

const PADDING = 10;

function getRect(selector: string): DOMRect | null {
    const el = document.querySelector(selector);
    if (!el) return null;
    return el.getBoundingClientRect();
}

function Overlay({ rect }: { rect: DOMRect }) {
    const vw = window.innerWidth;

    const top = rect.top - PADDING;
    const left = rect.left - PADDING;
    const width = rect.width + PADDING * 2;
    const height = rect.height + PADDING * 2;

    const base =
        "fixed bg-black/80 z-[9998] transition-all duration-500 ease-out";

    return (
        <>
            <div
                className={base}
                style={{ top: 0, left: 0, right: 0, height: Math.max(0, top) }}
            />
            <div
                className={base}
                style={{ top: top + height, left: 0, right: 0, bottom: 0 }}
            />
            <div
                className={base}
                style={{ top, left: 0, width: Math.max(0, left), height }}
            />
            <div
                className={base}
                style={{
                    top,
                    left: left + width,
                    right: 0,
                    width: Math.max(0, vw - left - width),
                    height,
                }}
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="fixed z-[9999] pointer-events-none rounded-xl"
                style={{ top, left, width, height }}
            />

            <div
                className="fixed inset-0 z-[9997]"
                style={{ pointerEvents: "auto", cursor: "not-allowed" }}
            />
        </>
    );
}

function Tooltip({
                     rect,
                     step,
                     index,
                     onNext,
                 }: {
    rect: DOMRect;
    step: TourStep;
    index: number;
    onNext: () => void | Promise<void>;
}) {
    const TOOLTIP_WIDTH = 340;
    const OFFSET = 28;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const elBottom = rect.bottom + PADDING + OFFSET;
    const elTop = rect.top - PADDING - OFFSET;
    const elCenterX = rect.left + rect.width / 2;

    let top: number;
    if (elBottom + 180 < vh) {
        top = elBottom;
    } else {
        top = elTop - 180;
    }
    top = Math.max(24, top);

    let left = elCenterX - TOOLTIP_WIDTH / 2;
    left = Math.max(24, Math.min(left, vw - TOOLTIP_WIDTH - 24));

    const isDark = document.documentElement.classList.contains("dark");
    const themeColor = isDark ? "#8b5cf6" : "#1c4070";

    return (
        <motion.div
            key={index}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-[10000]"
            style={{ top, left, width: TOOLTIP_WIDTH, pointerEvents: "auto" }}
            dir="rtl"
        >
            <motion.h3
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    delay: 0.12,
                    duration: 0.45,
                    ease: [0.16, 1, 0.3, 1],
                }}
                className="text-2xl font-black mb-3 leading-snug"
                style={{ color: themeColor }}
            >
                {step.title}
            </motion.h3>

            <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    delay: 0.2,
                    duration: 0.45,
                    ease: [0.16, 1, 0.3, 1],
                }}
                className="text-base font-medium text-white/90 leading-relaxed"
                style={{ marginBottom: "2rem" }}
            >
                {step.description}
            </motion.p>

            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    delay: 0.28,
                    duration: 0.45,
                    ease: [0.16, 1, 0.3, 1],
                }}
                className="flex justify-end"
            >
                <motion.button
                    onClick={() => void onNext()}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="px-7 py-2.5 text-sm font-bold rounded-xl transition-all duration-300"
                    style={{
                        color: themeColor,
                        border: `2px solid ${themeColor}`,
                        background: "transparent",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = themeColor;
                        e.currentTarget.style.color = "#fff";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = themeColor;
                    }}
                >
                    فهمیدم
                </motion.button>
            </motion.div>
        </motion.div>
    );
}

export function TourProvider({ children }: { children: React.ReactNode }) {
    const [active, setActive] = useState(false);
    const [steps, setSteps] = useState<TourStep[]>([]);
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [tourKey, setTourKey] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setIsMobile(window.innerWidth < 768);

        const onResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const checkTour = useCallback(async (tourKey: string): Promise<boolean> => {
        try {
            const res = await flowApi.getTourStatus(tourKey);
            return !!res.completed;
        } catch (error) {
            console.error("checkTour error:", error);
            return false;
        }
    }, []);

    const submitTour = useCallback(async (tourKey: string): Promise<boolean> => {
        try {
            const res = await flowApi.completeTour(tourKey);
            return !!res.success;
        } catch (error) {
            console.error("submitTour error:", error);
            return false;
        }
    }, []);

    const updateRect = useCallback(() => {
        if (!active || !steps[index]) return;

        const step = steps[index];
        const selector =
            isMobile && step.mobileSelector ? step.mobileSelector : step.selector;

        const r = getRect(selector);
        if (r) {
            setRect(r);
        }
    }, [active, steps, index, isMobile]);

    useEffect(() => {
        if (!active || !steps[index]) return;

        const step = steps[index];
        const selector =
            isMobile && step.mobileSelector ? step.mobileSelector : step.selector;

        const el = document.querySelector(selector);

        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(updateRect, 450);
        } else {
            setRect(null);
        }

        document.body.style.overflow = "hidden";
        window.addEventListener("resize", updateRect);

        return () => {
            window.removeEventListener("resize", updateRect);
            document.body.style.overflow = "";
        };
    }, [active, index, steps, isMobile, updateRect]);

    const endTour = useCallback(() => {
        setActive(false);
        setSteps([]);
        setIndex(0);
        setRect(null);
        setTourKey(null);
        setIsSubmitting(false);
        document.body.style.overflow = "";
    }, []);

    const startTour = useCallback(
        async (key: string, tourSteps: TourStep[]) => {
            if (!key || !tourSteps.length) return;

            const completed = await checkTour(key);
            if (completed) return;

            setTourKey(key);
            setSteps(tourSteps);
            setIndex(0);
            setRect(null);
            setActive(true);
        },
        [checkTour]
    );

    const handleNext = useCallback(async () => {
        if (isSubmitting) return;

        if (index >= steps.length - 1) {
            if (tourKey) {
                try {
                    setIsSubmitting(true);
                    await submitTour(tourKey);
                } finally {
                    endTour();
                }
            } else {
                endTour();
            }
            return;
        }

        setIndex((prev) => prev + 1);
    }, [index, steps.length, tourKey, submitTour, endTour, isSubmitting]);

    return (
        <TourContext.Provider
            value={{
                startTour,
                endTour,
                checkTour,
                submitTour,
            }}
        >
            {children}

            <AnimatePresence mode="wait">
                {active && rect && steps[index] && (
                    <>
                        <Overlay rect={rect} />
                        <Tooltip
                            rect={rect}
                            step={steps[index]}
                            index={index}
                            onNext={handleNext}
                        />
                    </>
                )}
            </AnimatePresence>
        </TourContext.Provider>
    );
}