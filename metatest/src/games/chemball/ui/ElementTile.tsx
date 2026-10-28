import type { CSSProperties } from "react";
import type { ElementCard } from "./copy";

export function ElementTile(props: { element: ElementCard; className?: string; style?: CSSProperties }) {
  return (
    <span className={props.className ? `element-tile ${props.className}` : "element-tile"} style={props.style} dir="ltr">
      <span className="tile-number">{props.element.number}</span>
      <span className="tile-symbol">{props.element.symbol}</span>
      <span className="tile-mass">{props.element.mass}</span>
    </span>
  );
}
