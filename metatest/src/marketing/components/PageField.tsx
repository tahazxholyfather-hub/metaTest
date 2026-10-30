import { useEffect, useRef, type ReactNode } from 'react';
import { startScienceField } from '../lib/homeStage';

export function PageField({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    return startScienceField(root);
  }, []);

  return (
    <div ref={rootRef}>
      <div className="ambient-veil" />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <div className="depth-world" id="depth-world" />
          {children}
        </div>
      </div>
    </div>
  );
}
