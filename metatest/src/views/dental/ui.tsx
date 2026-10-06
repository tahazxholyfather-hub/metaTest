import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { Icon } from "./icons";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "./data";



/* ---------- Image with graceful placeholder ---------- */
export function Img({
  src,
  alt,
  className,
  style,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={className}
        style={{
          ...style,
          background: "linear-gradient(145deg, #e6edfb 0%, #f2eefe 100%)",
        }}
        role="img"
        aria-label={alt}
      />
    );
  }
  return <img src={src} alt={alt} className={className} style={style} loading={loading} decoding="async" onError={() => setFailed(true)} />;
}

/* ---------- Scroll reveal ---------- */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
  style,
  amount = 0.25,
  blur = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "header" | "p" | "h2" | "li";
  style?: CSSProperties;
  amount?: number;
  blur?: boolean;
}) {
  const reduced = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      className={className}
      style={style}
      initial={reduced ? false : blur ? { opacity: 0, y: 32, filter: "blur(6px)" } : { opacity: 0, y: 32 }}
      whileInView={blur ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 1, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}

export function SectionHead({
  eyebrow,
  title,
  lead,
  align = "left",
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <Reveal className={className} style={align === "center" ? { textAlign: "center", marginInline: "auto", maxWidth: 760 } : undefined}>
      <span className="dl-eyebrow">{eyebrow}</span>
      <h2 className="dl-h2">{title}</h2>
      {lead && <p className="dl-lead" style={align === "center" ? { marginInline: "auto" } : undefined}>{lead}</p>}
    </Reveal>
  );
}

/* ---------- Magnetic button ---------- */
export function Magnetic({ children, strength = 0.25, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ display: "inline-block" }}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: "spring", stiffness: 180, damping: 16, mass: 0.6 }}
      onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
        if (reduced || !ref.current || e.pointerType !== "mouse") return;
        const r = ref.current.getBoundingClientRect();
        setPos({ x: (e.clientX - (r.left + r.width / 2)) * strength, y: (e.clientY - (r.top + r.height / 2)) * strength });
      }}
      onPointerLeave={() => setPos({ x: 0, y: 0 })}
    >
      {children}
    </motion.div>
  );
}

export function Stars({ n = 5, size = 14 }: { n?: number; size?: number }) {
  return (
    <span className="dl-stars" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: n }).map((_, i) => (
        <Icon.Star key={i} size={size} />
      ))}
    </span>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="dl-logo-mark" style={{ width: size, height: size }}>
      <Icon.Tooth size={size * 0.56} strokeWidth={1.8} />
    </span>
  );
}
