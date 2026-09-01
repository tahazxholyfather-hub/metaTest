import { useEffect, useState, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SHIMMER_MIN_MS = 1500;
const LOGO_DISPLAY_MS = 1500;
const EXIT_ANIMATION_MS = 700;

// Total splash = shimmer phase + logo phase + exit
const SPLASH_DURATION_MS = SHIMMER_MIN_MS + LOGO_DISPLAY_MS;

interface SplashScreenProps {
    onFinish: () => void;
}

const SplashScreen = memo(function SplashScreen({ onFinish }: SplashScreenProps) {
    const [isVisible, setIsVisible] = useState(true);
    const [logoLoaded, setLogoLoaded] = useState(false);
    // Controls whether we actually SHOW the logo (shimmer min-time gate)
    const [showLogo, setShowLogo] = useState(false);
    const finishedRef = useRef(false);

    const logoLightSrc = "/logo2.png";
    const logoDarkSrc  = "/logo.png";

    // Gate: show logo only after SHIMMER_MIN_MS, AND only if the image loaded
    useEffect(() => {
        const shimmerTimer = setTimeout(() => {
            // Only reveal if image is already loaded; otherwise wait for onLoad
            if (logoLoaded) setShowLogo(true);
        }, SHIMMER_MIN_MS);

        return () => clearTimeout(shimmerTimer);
    }, [logoLoaded]);

    // When the image loads, if the shimmer min-time has already elapsed, reveal immediately
    const shimmerDoneRef = useRef(false);
    useEffect(() => {
        const t = setTimeout(() => { shimmerDoneRef.current = true; }, SHIMMER_MIN_MS);
        return () => clearTimeout(t);
    }, []);

    const handleLogoLoaded = () => {
        setLogoLoaded(true);
        if (shimmerDoneRef.current) {
            setShowLogo(true);
        }
    };

    // Exit sequence
    useEffect(() => {
        const hideTimer = setTimeout(() => {
            setIsVisible(false);
        }, SPLASH_DURATION_MS);

        const finishTimer = setTimeout(() => {
            if (!finishedRef.current) {
                finishedRef.current = true;
                onFinish();
            }
        }, SPLASH_DURATION_MS + EXIT_ANIMATION_MS);

        return () => {
            clearTimeout(hideTimer);
            clearTimeout(finishTimer);
        };
    }, [onFinish]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    key="splash"
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none"
                    style={{ backgroundColor: "var(--bg-app)" }}
                    exit={{ opacity: 0, scale: 1.04, filter: "blur(12px)" }}
                    transition={{ duration: EXIT_ANIMATION_MS / 1000, ease: "easeInOut" }}
                >
                    {/* Ambient glow blob */}
                    <motion.div
                        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
                        style={{
                            backgroundColor: "var(--accent)",
                            filter: "blur(120px)",
                            opacity: 0,
                        }}
                        animate={{ opacity: [0.08, 0.18, 0.08], scale: [1, 1.12, 1] }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                    />

                    <div className="relative z-10 flex flex-col items-center justify-center mb-4">
                        <div className="relative w-48 h-48">

                            {/* SVG Shimmer — hidden once logo is shown */}
                            {/* SVG Shimmer — hidden once logo is shown */}
                            <AnimatePresence>
                                {!showLogo && (
                                    <motion.div
                                        key="shimmer"
                                        className="absolute inset-0"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0, transition: { duration: 0.55 } }}
                                        transition={{ duration: 0.25 }}
                                    >
                                        {/* Base fill + animated shimmer, masked to the logo shape */}
                                        <div
                                            className="w-full h-full"
                                            style={{
                                                WebkitMaskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 964 800'%3E%3Cpath d='M73.7 103c-1.6 1.9-1.7 16.6-1.7 249.2 0 234.1.1 247.1 1.7 248.4 1.4 1.1 11.3 1.3 48.6 1.4H169V409.2c0-148.6.3-193.1 1.2-194s15.5-1.2 59.6-1.2h58.5l26.1 26.3c30.3 30.4 49.6 50.3 105.2 108 35.8 37.1 58.9 59.7 60.9 59.7 2.1 0 13.2-11.2 126.4-127 20.1-20.6 42.7-43.5 50.2-51 7.5-7.4 14.4-15.2 15.4-17.3 1.8-3.9 1.7-8.6-.5-20.7-.5-3-1.2-7.2-1.6-9.3-.3-2-1-4-1.5-4.3s-.9-1.4-.9-2.5c0-1-.4-2.7-.9-3.7-.5-.9-1.3-2.8-1.8-4.2-1.8-4.5-3.7-8.5-5.4-11-9.9-15.1-12.8-19.2-16.8-23.3-4.9-5.1-15.5-13.7-17-13.7-.5 0-1.4-.7-2.1-1.5s-2.4-2.1-3.9-2.8c-1.4-.8-5.7-3-9.4-5-3.8-2.1-7.7-3.7-8.7-3.7s-2.2-.5-2.5-1c-.3-.6-2.1-1-3.9-1-1.7 0-3.6-.4-4.1-.9-.6-.5-3.7-1.2-7-1.6s-119.2-.9-257.5-1.1C75.8 101 75.4 101 73.7 103'/%3E%3Cpath d='M792 362.7v191.8c0 35.8-.1 41.3-1.5 43.2l-1.6 2.3H733c-42.7 0-56.1-.3-56.6-1.2-.4-.7-.9-42.4-1-92.8-.1-83.8-.5-102-2.3-102-1.5.1-35.7 34.7-107.1 108.5-55 56.8-84.4 86.5-85.8 86.5-1.6 0-6.2-4.5-33.6-33.1-7.1-7.4-19.5-20.2-27.5-28.4-8.1-8.3-26.8-27.6-41.6-43-24.8-25.8-38.4-39.8-74.5-76.8-7.4-7.5-13.9-13.7-14.6-13.7-2.1 0-2.4 17.5-2.3 107.2.1 93.4.9 118 4 121.3.5.5.9 1.9.9 3.1 0 1.3.5 2.6 1 2.9.6.3 1 1.5 1 2.6 0 1 .4 2.7.9 3.7.5.9 2.7 5.5 5 10.2 10.1 20.9 27.8 37.9 51.1 49.1 3.6 1.7 7.3 3.5 8.2 4 1 .5 3 .9 4.6.9 1.5 0 3.2.4 3.7.9.6.5 3.7 1.2 7 1.6 10.8 1.3 511.6 1.6 513.1.4 1.9-1.6 2.1-496.8.2-498.7-.9-.9-12.9-1.2-48-1.2H792z'/%3E%3C/svg%3E")`,
                                                maskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 964 800'%3E%3Cpath d='M73.7 103c-1.6 1.9-1.7 16.6-1.7 249.2 0 234.1.1 247.1 1.7 248.4 1.4 1.1 11.3 1.3 48.6 1.4H169V409.2c0-148.6.3-193.1 1.2-194s15.5-1.2 59.6-1.2h58.5l26.1 26.3c30.3 30.4 49.6 50.3 105.2 108 35.8 37.1 58.9 59.7 60.9 59.7 2.1 0 13.2-11.2 126.4-127 20.1-20.6 42.7-43.5 50.2-51 7.5-7.4 14.4-15.2 15.4-17.3 1.8-3.9 1.7-8.6-.5-20.7-.5-3-1.2-7.2-1.6-9.3-.3-2-1-4-1.5-4.3s-.9-1.4-.9-2.5c0-1-.4-2.7-.9-3.7-.5-.9-1.3-2.8-1.8-4.2-1.8-4.5-3.7-8.5-5.4-11-9.9-15.1-12.8-19.2-16.8-23.3-4.9-5.1-15.5-13.7-17-13.7-.5 0-1.4-.7-2.1-1.5s-2.4-2.1-3.9-2.8c-1.4-.8-5.7-3-9.4-5-3.8-2.1-7.7-3.7-8.7-3.7s-2.2-.5-2.5-1c-.3-.6-2.1-1-3.9-1-1.7 0-3.6-.4-4.1-.9-.6-.5-3.7-1.2-7-1.6s-119.2-.9-257.5-1.1C75.8 101 75.4 101 73.7 103'/%3E%3Cpath d='M792 362.7v191.8c0 35.8-.1 41.3-1.5 43.2l-1.6 2.3H733c-42.7 0-56.1-.3-56.6-1.2-.4-.7-.9-42.4-1-92.8-.1-83.8-.5-102-2.3-102-1.5.1-35.7 34.7-107.1 108.5-55 56.8-84.4 86.5-85.8 86.5-1.6 0-6.2-4.5-33.6-33.1-7.1-7.4-19.5-20.2-27.5-28.4-8.1-8.3-26.8-27.6-41.6-43-24.8-25.8-38.4-39.8-74.5-76.8-7.4-7.5-13.9-13.7-14.6-13.7-2.1 0-2.4 17.5-2.3 107.2.1 93.4.9 118 4 121.3.5.5.9 1.9.9 3.1 0 1.3.5 2.6 1 2.9.6.3 1 1.5 1 2.6 0 1 .4 2.7.9 3.7.5.9 2.7 5.5 5 10.2 10.1 20.9 27.8 37.9 51.1 49.1 3.6 1.7 7.3 3.5 8.2 4 1 .5 3 .9 4.6.9 1.5 0 3.2.4 3.7.9.6.5 3.7 1.2 7 1.6 10.8 1.3 511.6 1.6 513.1.4 1.9-1.6 2.1-496.8.2-498.7-.9-.9-12.9-1.2-48-1.2H792z'/%3E%3C/svg%3E")`,
                                                WebkitMaskSize: "contain",
                                                maskSize: "contain",
                                                WebkitMaskRepeat: "no-repeat",
                                                maskRepeat: "no-repeat",
                                                WebkitMaskPosition: "center",
                                                maskPosition: "center",
                                                background: "linear-gradient(90deg, rgba(128,128,128,0.08) 0%, rgba(128,128,128,0.08) 30%, rgba(255,255,255,0.25) 50%, rgba(128,128,128,0.08) 70%, rgba(128,128,128,0.08) 100%)",
                                                backgroundSize: "300% 100%",
                                                animation: "shimmerSweep 2.2s linear infinite",
                                            }}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>


                            {/* Actual logos — fade in when showLogo becomes true */}
                            <motion.div
                                className="absolute inset-0 drop-shadow-2xl"
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={showLogo ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
                                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                            >
                                <img
                                    src={logoLightSrc}
                                    alt="Logo"
                                    loading="eager"
                                    decoding="async"
                                    className="w-full h-full object-contain block dark:hidden"
                                    onLoad={handleLogoLoaded}
                                    onError={handleLogoLoaded}
                                />
                                <img
                                    src={logoDarkSrc}
                                    alt="Logo"
                                    loading="eager"
                                    decoding="async"
                                    className="w-full h-full object-contain hidden dark:block"
                                    onLoad={handleLogoLoaded}
                                    onError={handleLogoLoaded}
                                />
                            </motion.div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <motion.div
                        className="absolute bottom-12 left-1/2 -translate-x-1/2 w-56 h-[3px] rounded-full overflow-hidden z-10"
                        style={{ backgroundColor: "rgba(128,128,128,0.15)" }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <motion.div
                            className="h-full rounded-full relative overflow-hidden"
                            style={{ backgroundColor: "var(--accent)" }}
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{
                                duration: SPLASH_DURATION_MS / 1000,
                                ease: "circInOut",
                            }}
                        >
                            <motion.div
                                className="absolute inset-y-0 w-1/2"
                                style={{
                                    background:
                                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                                    willChange: "transform",
                                }}
                                initial={{ x: "-100%" }}
                                animate={{ x: "300%" }}
                                transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                            />
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
});

export default SplashScreen;
