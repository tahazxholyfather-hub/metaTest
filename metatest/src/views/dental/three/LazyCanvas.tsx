import { Suspense, lazy, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { CanvasProps } from "@react-three/fiber";

// R3F/three are only downloaded once a canvas is about to scroll into view.
const CanvasImpl = lazy(() => import("@react-three/fiber").then((m) => ({ default: m.Canvas })));

/** Mounts the WebGL canvas lazily and only renders frames while it is on screen. */
export function LazyCanvas({
  children,
  className,
  style,
  ...rest
}: Omit<CanvasProps, "children"> & { children: ReactNode; className?: string; style?: CSSProperties }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) setMounted(true);
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className={className} style={{ position: "absolute", inset: 0, ...style }}>
      {mounted && (
        <Suspense fallback={null}>
          <CanvasImpl
            frameloop={visible ? "always" : "never"}
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            {...rest}
          >
            {children}
          </CanvasImpl>
        </Suspense>
      )}
    </div>
  );
}
