import { memo } from "react";
import { chemSvg } from "../render/chem";

/** Inline chemistry formula typeset by MathJax mhchem. Inherits `color` from CSS. */
export const Chem = memo(function Chem(props: { tex: string; size?: number; weight?: number; className?: string }) {
  const svg = chemSvg(props.tex, props.weight ?? 0);
  const scale = (props.size ?? 20) / 18;
  return (
    <span
      className={props.className ? `chem ${props.className}` : "chem"}
      dir="ltr"
      style={{ width: svg.width * scale, height: svg.height * scale }}
      dangerouslySetInnerHTML={{ __html: svg.markup }}
    />
  );
});
