import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award } from 'lucide-react';

interface FlyingAwardsProps {
    count: number;
    targetRef: React.RefObject<HTMLElement>;
}

interface AwardItem {
    id: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

const FlyingAwards: React.FC<FlyingAwardsProps> = ({ count, targetRef }) => {
    const [awards, setAwards] = useState<AwardItem[]>([]);
    const [prevCount, setPrevCount] = useState(count);

    useEffect(() => {
        // Only trigger if count increases
        if (count > prevCount && targetRef.current) {
            const rect = targetRef.current.getBoundingClientRect();

            // Start at the center of the screen
            const startX = window.innerWidth / 2;
            const startY = window.innerHeight / 2;

            // End at the center of the target element
            const endX = rect.left + rect.width / 2;
            const endY = rect.top + rect.height / 2;

            const newAwardsAmount = count - prevCount;

            const newAwards = Array.from({ length: newAwardsAmount }).map(() => ({
                id: Math.random().toString(36).substr(2, 9),
                startX,
                startY,
                endX,
                endY,
            }));

            setAwards((prev) => [...prev, ...newAwards]);
        }
        setPrevCount(count);
    }, [count, prevCount, targetRef]);

    return (
        // Fixed overlay that covers the screen but lets clicks pass through
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
            <AnimatePresence>
                {awards.map((award) => {
                    // Slight random scatter around the target so they don't land exactly on top of each other
                    const randomOffsetX = (Math.random() - 0.5) * 40;
                    const randomOffsetY = (Math.random() - 0.5) * 40;
                    const randomDelay = Math.random() * 0.3;

                    return (
                        <motion.div
                            key={award.id}
                            initial={{
                                x: award.startX,
                                y: award.startY,
                                scale: 0.2,
                                opacity: 0
                            }}
                            animate={{
                                x: award.endX + randomOffsetX,
                                y: award.endY + randomOffsetY,
                                scale: 1,
                                opacity: [0, 1, 1, 0] // Fade in, hold, fade out on arrival
                            }}
                            transition={{
                                duration: 1.2,
                                delay: randomDelay,
                                ease: "easeInOut"
                            }}
                            style={{ position: 'absolute', pointerEvents: 'none' }}
                            // Transform to truly center the icon on the coordinates
                            className="-translate-x-1/2 -translate-y-1/2"
                            onAnimationComplete={() => {
                                // Remove from DOM when done
                                setAwards((prev) => prev.filter((item) => item.id !== award.id));
                            }}
                        >
                            <Award className="text-yellow-500 drop-shadow-md" size={40} fill="currentColor" />
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

export default FlyingAwards;
