"use client";

import React, { CSSProperties, useId } from "react";
import { motion } from "framer-motion";

type SvgEffect = "none" | "grayscale";

interface ShimmerSvgLogoProps {
    width?: number | string;
    height?: number | string;
    color?: string;
    theme?: "light" | "dark";
    enableAnimation?: boolean;
    enableEffect?: boolean;
    effect?: SvgEffect;
    className?: string;
    style?: CSSProperties;
}

const pathD =
    "M415.6 344.6c-15.1 3.7-30.8 16.2-37.9 30.4-7.6 15.4-7.1 5.7-7.1 145.5 0 97.6.3 126.3 1.3 131 2.3 10.9 7.5 20.2 16 28.5 12.3 12.1 24.7 17 43.1 17 11.2 0 19.8-1.9 28.9-6.2 9.2-4.3 21.4-16.7 26-26.2 5.9-12.4 6.1-14.2 6.1-77.4 0-34.1.4-57.2.9-57 .5.1 13 11.4 27.8 24.9 14.7 13.5 30.4 27.8 34.8 31.8 10.7 9.8 16.1 12.5 24.5 12.6 4.7 0 7.7-.6 11-2.2 4.2-2.1 25.6-21.2 58.9-52.6 8-7.5 14.8-13.4 15.3-13.1.4.3.8 26.5.8 58.2 0 64.1 0 63.6 6.6 76.3 7.3 13.8 21.8 25.1 37.4 29 11.5 2.9 28.4 2.4 38-1.2 16.5-6.2 29-18.7 35.3-35.5l2.2-5.9v-262l-2.3-6.6c-5.8-16.8-21-31.9-38.3-38-5.5-2-8.4-2.3-20.4-2.4-12.1 0-15 .3-21 2.3-13.5 4.5-16.2 6.9-70.2 60.1-28.2 27.7-52.2 51-53.3 51.8-1.9 1.3-3.1.4-20.2-15.9-10-9.5-29-27.9-42.2-40.8-48-46.8-48.7-47.4-56.8-51.5-4.2-2-10.5-4.3-14-5.1-8.1-1.7-23.6-1.6-31.2.2m32.9 26.5c5.2 2.7 12.3 9.1 36.3 32.4 86.2 84.1 85.2 83.2 95.7 82.3 8.5-.7 4.9 2.5 74.3-65.8 24.9-24.5 47.2-45.8 49.5-47.3 6.2-4.2 13.7-6 22.6-5.5 13.6.8 25.1 8.2 31 19.9 3.1 6.2 5 17.5 3.5 20.1-.5.8-13.5 13.1-29 27.4-26.7 24.7-39.9 36.9-72.4 67.3-29.1 27.2-73.4 67.7-76.5 69.9-4.8 3.5-4.2 3.9-32.9-22.6-3.3-3-35.5-32.3-71.5-65.1-36.1-32.8-69.5-63.4-74.3-68l-8.8-8.4v-5.2c0-11.8 5.7-22.4 15.8-29.2 7.5-5 12.2-6.3 22.5-5.9 6.6.2 8.7.8 14.2 3.7m-23.2 97.1c15.5 14.5 31.5 29.3 35.5 32.9l7.2 6.7v67.4c0 73 0 73.1-5.5 81.7-5.5 8.9-16.7 15.3-27.6 15.9-20.4 1.2-35.4-9.6-38.8-28.3-1.4-7.6-1.6-202.5-.1-202.5.5 0 13.7 11.8 29.3 26.2M762 542.3c0 80-.3 101.3-1.3 105.4-4.9 18.8-25.4 29.4-45.7 23.7-10-2.8-19.8-12.2-23.2-22.2-.9-2.8-1.3-21.1-1.6-72.3l-.3-68.6 10.3-9.6c5.7-5.2 21.6-20.1 35.3-33 13.8-13 25.3-23.6 25.8-23.6.4-.1.7 45 .7 100.2";

export default function ShimmerSvgLogo({
                                           width = 240,
                                           height,
                                           color = "#6366f1",
                                           theme = "light",
                                           enableAnimation = true,
                                           enableEffect = false,
                                           effect = "none",
                                           className,
                                           style,
                                       }: ShimmerSvgLogoProps) {
    const rawId = useId().replace(/:/g, "");
    const clipId = `logo-clip-${rawId}`;
    const gradientId = `logo-shimmer-${rawId}`;
    const blurId = `logo-blur-${rawId}`;

    const resolvedHeight = height ?? "auto";

    const wrapperStyle: CSSProperties = {
        width,
        height: resolvedHeight,
        display: "inline-block",
        lineHeight: 0,
        ...style,
    };

    const svgStyle: CSSProperties = {
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "visible",
        filter: enableEffect && effect === "grayscale" ? "grayscale(1)" : undefined,
    };

    const baseOpacity = theme === "dark" ? 0.92 : 1;
    const softLayerOpacity = theme === "dark" ? 0.16 : 0.1;
    const glowOpacity = theme === "dark" ? 0.5 : 0.22;

    const shimmerStops =
        theme === "dark"
            ? {
                edge: "rgba(255,255,255,0)",
                midSoft: "rgba(255,255,255,0.14)",
                mid: "rgba(255,255,255,0.9)",
                hot: "rgba(255,255,255,1)",
            }
            : {
                edge: "rgba(255,255,255,0)",
                midSoft: "rgba(255,255,255,0.08)",
                mid: "rgba(255,255,255,0.72)",
                hot: "rgba(255,255,255,0.95)",
            };

    return (
        <div className={className} style={wrapperStyle}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1161 1040"
                preserveAspectRatio="xMidYMid meet"
                style={svgStyle}
                role="img"
                aria-label="Shimmer logo"
            >
                <defs>
                    <clipPath id={clipId}>
                        <path d={pathD} />
                    </clipPath>

                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={shimmerStops.edge} />
                        <stop offset="32%" stopColor={shimmerStops.edge} />
                        <stop offset="42%" stopColor={shimmerStops.midSoft} />
                        <stop offset="50%" stopColor={shimmerStops.hot} />
                        <stop offset="58%" stopColor={shimmerStops.mid} />
                        <stop offset="68%" stopColor={shimmerStops.edge} />
                        <stop offset="100%" stopColor={shimmerStops.edge} />
                    </linearGradient>

                    <filter id={blurId} x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="28" />
                    </filter>
                </defs>

                <g clipPath={`url(#${clipId})`}>
                    {/* base */}
                    <path d={pathD} fill={color} opacity={baseOpacity} />

                    {/* subtle depth */}
                    <path d={pathD} fill="#ffffff" opacity={softLayerOpacity} />

                    {enableAnimation && (
                        <>
                            {/* soft glow sweep */}
                            <motion.rect
                                x={-500}
                                y={-120}
                                width={220}
                                height={1280}
                                rx={120}
                                fill={`url(#${gradientId})`}
                                opacity={glowOpacity}
                                filter={`url(#${blurId})`}
                                transform="rotate(12 580.5 520)"
                                animate={{
                                    x: [-500, 1500],
                                }}
                                transition={{
                                    duration: 2.8,
                                    repeat: Infinity,
                                    ease: [0.22, 1, 0.36, 1],
                                    repeatDelay: 0.35,
                                }}
                            />

                            {/* sharp highlight sweep */}
                            <motion.rect
                                x={-420}
                                y={-80}
                                width={140}
                                height={1200}
                                rx={90}
                                fill={`url(#${gradientId})`}
                                opacity={1}
                                transform="rotate(12 580.5 520)"
                                style={{
                                    mixBlendMode: theme === "dark" ? "screen" : "overlay",
                                }}
                                animate={{
                                    x: [-420, 1450],
                                }}
                                transition={{
                                    duration: 2.8,
                                    repeat: Infinity,
                                    ease: [0.22, 1, 0.36, 1],
                                    repeatDelay: 0.35,
                                }}
                            />
                        </>
                    )}
                </g>
            </svg>
        </div>
    );
}
