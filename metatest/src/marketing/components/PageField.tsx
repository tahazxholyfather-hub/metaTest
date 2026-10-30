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
    <div className="page-root" ref={rootRef}>
      <div className="ambient-veil" />
      <div className="field-clip" aria-hidden="true">
        <div className="depth-world" id="depth-world" />
      </div>
      <div className="page-sheet">
        {children}
      </div>
    </div>
  );
}
