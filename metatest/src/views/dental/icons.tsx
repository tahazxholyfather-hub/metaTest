import type { SVGProps } from "react";

/* ---------- Icons (thin, consistent stroke) ---------- */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const Icon = {
  Tooth: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M8.2 3.5c-2.6 0-4.7 2.1-4.7 4.8 0 2.3 1.1 3.5 1.7 5.6.6 2.3.7 6.6 2.7 6.6 1.6 0 1.7-3.6 2.4-5.1.5-1.1 1-1.1 1.7-1.1s1.2 0 1.7 1.1c.7 1.5.8 5.1 2.4 5.1 2 0 2.1-4.3 2.7-6.6.6-2.1 1.7-3.3 1.7-5.6 0-2.7-2.1-4.8-4.7-4.8-1.5 0-2.6.9-3.8.9s-2.3-.9-3.8-.9Z" />
    </svg>
  ),
  Arrow: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  ArrowUp: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  ),
  ChevronLeft: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  ),
  ChevronRight: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  ChevronDown: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  Play: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p} fill="currentColor" stroke="none">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" />
    </svg>
  ),
  Star: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p} fill="currentColor" stroke="none">
      <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3L2.8 9.5l6.4-.8L12 2.8Z" />
    </svg>
  ),
  Check: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  Shield: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M12 3l7 3v5.5c0 4.6-3 8.3-7 9.5-4-1.2-7-4.9-7-9.5V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  Sparkle: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2" />
    </svg>
  ),
  Implant: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M7.5 3.5h9l-1.2 5.5h-6.6L7.5 3.5Z" />
      <path d="M9.5 9v2.5h5V9" />
      <path d="M9.8 11.5 10.6 20.5h2.8l.8-9" />
      <path d="M10 14h4M10.3 16.5h3.4" />
    </svg>
  ),
  Braces: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M3 12c3-4 6-5 9-5s6 1 9 5" />
      <path d="M3 12c3 4 6 5 9 5s6-1 9-5" />
      <path d="M7.5 9.5v5M12 7v10M16.5 9.5v5" />
    </svg>
  ),
  Root: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M8.2 3.5c-2.6 0-4.7 2.1-4.7 4.8 0 2.3 1.1 3.5 1.7 5.6.6 2.3.7 6.6 2.7 6.6 1.6 0 1.7-3.6 2.4-5.1.5-1.1 1-1.1 1.7-1.1s1.2 0 1.7 1.1c.7 1.5.8 5.1 2.4 5.1 2 0 2.1-4.3 2.7-6.6.6-2.1 1.7-3.3 1.7-5.6 0-2.7-2.1-4.8-4.7-4.8-1.5 0-2.6.9-3.8.9s-2.3-.9-3.8-.9Z" />
      <path d="M12 8v4" />
    </svg>
  ),
  Smile: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 13.5c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4M9 9.5h.01M15 9.5h.01" />
    </svg>
  ),
  Pin: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M12 21s-6-5.3-6-10.5A6 6 0 0 1 18 10.5C18 15.7 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </svg>
  ),
  Phone: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M5 4h4l1.5 4L8.5 9.5a11 11 0 0 0 6 6L16 13.5l4 1.5v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </svg>
  ),
  Mail: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3.5 7.5 12 13l8.5-5.5" />
    </svg>
  ),
  Clock: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  Calendar: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  Users: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 5.5a3 3 0 0 1 0 5.6M17 13.5a5 5 0 0 1 3.5 5" />
    </svg>
  ),
  Award: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5" />
    </svg>
  ),
  Heart: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </svg>
  ),
  Menu: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M4 8h16M4 16h16" />
    </svg>
  ),
  Close: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  Drag: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
    </svg>
  ),
  Rotate: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20 4v4h-4" />
    </svg>
  ),
  Sun: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3.5v1.8M12 18.7v1.8M3.5 12h1.8M18.7 12h1.8M6 6l1.3 1.3M16.7 16.7 18 18M18 6l-1.3 1.3M7.3 16.7 6 18" />
    </svg>
  ),
  Moon: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M16.5 14.2A6.2 6.2 0 0 1 9.8 4.8 6.4 6.4 0 1 0 16.5 14.2Z" />
    </svg>
  ),
  Crown: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M4 16.5 6.2 8l3.3 4.2L12 6.5l2.5 5.7L17.8 8 20 16.5Z" />
      <path d="M5 19h14" />
    </svg>
  ),
  Instagram: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="3.8" />
      <path d="M17.2 6.8h.01" />
    </svg>
  ),
  Facebook: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <path d="M14 8h2.5V4.5H14a3.5 3.5 0 0 0-3.5 3.5v2.5H8v3.5h2.5V21H14v-7h2.5l.5-3.5h-3V8.5c0-.3.2-.5.5-.5Z" />
    </svg>
  ),
  Linkedin: ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8 10.5V17M8 7.5h.01M12 17v-3.5a2 2 0 0 1 4 0V17M12 10.5V17" />
    </svg>
  ),
};
