import { memo, useEffect, useState } from "react";
import { chemSvg, subscribeChemReady } from "../render/chem";

/** Inline chemistry formula typeset by the app's MathJax 4. Inherits `color` from CSS. */
export const Chem = memo(function Chem(props: { tex: string; size?: number; weight?: number; className?: string }) {
  const [, refresh] = useState(0);
  useEffect(() => subscribeChemReady(() => refresh((n) => n + 1)), []);
  const svg = chemSvg(props.tex, props.weight ?? 0);
  const scale = (props.size ?? 20) / 18;
  const className = props.className ? `chem ${props.className}` : "chem";
  if (!svg) {
    return (
      <span className={className} dir="ltr" style={{ fontSize: (props.size ?? 20) * 0.72, lineHeight: 1 }}>
        {props.tex}
      </span>
    );
  }
  return (
    <span
      className={className}
      dir="ltr"
      style={{ width: svg.width * scale, height: svg.height * scale }}
      dangerouslySetInnerHTML={{ __html: svg.markup }}
    />
  );
});
