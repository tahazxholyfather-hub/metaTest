import { Flame, FlaskConical, Snowflake, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import { GADGET_COOLDOWN, isGadget } from "../game/gadgets";
import { faDigits } from "../game/labels";
import type { GadgetHud } from "../game/types";
import { GADGET_COPY } from "./copy";

export const GADGET_ICONS: Record<string, LucideIcon> = {
  nitrogen: Snowflake,
  burner: Flame,
  catalyst: FlaskConical,
};

const HOLD_MS = 380;
const RING = 2 * Math.PI * 30;

export function GadgetButton(props: {
  hud: GadgetHud;
  style: CSSProperties;
  picking: boolean;
  onUse: () => void;
  onHold: () => void;
}) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const id = props.hud.selected;
  const copy = GADGET_COPY.find((item) => item.id === id) ?? GADGET_COPY[0]!;
  const Icon = GADGET_ICONS[id] ?? Snowflake;
  const cooldown = props.hud.cooldowns[id] ?? 0;
  const max = isGadget(id) ? GADGET_COOLDOWN[id] : 1;
  const armed = (id === "burner" && props.hud.burnerArmed) || (id === "catalyst" && props.hud.catalystReady) || (id === "nitrogen" && props.hud.chill > 0);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <div className="gadget-dock" style={props.style}>
      <button
        type="button"
        aria-label={`ابزار: ${copy.name}`}
        className={`gadget-btn${cooldown > 0 ? " cooling" : ""}${armed ? " armed" : ""}${props.picking ? " picking" : ""}`}
        style={{ ["--tint" as string]: copy.tint }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          held.current = false;
          cancel();
          timer.current = window.setTimeout(() => {
            held.current = true;
            props.onHold();
          }, HOLD_MS);
        }}
        onPointerUp={() => {
          cancel();
          if (!held.current) props.onUse();
        }}
        onPointerCancel={cancel}
      >
        <svg className="gadget-ring" viewBox="0 0 68 68" aria-hidden>
          <circle className="track" cx="34" cy="34" r="30" />
          <circle
            className="fill"
            cx="34"
            cy="34"
            r="30"
            strokeDasharray={RING}
            strokeDashoffset={RING * (cooldown / max)}
          />
        </svg>
        <span className="gadget-core">
          <Icon size={24} strokeWidth={2.2} />
        </span>
        {cooldown > 0 && <span className="gadget-count">{Math.ceil(cooldown)}</span>}
      </button>
      <span className="gadget-name">{copy.name}</span>
    </div>
  );
}

export function GadgetPicker(props: { hud: GadgetHud; style: CSSProperties; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div className="picker-layer" onPointerDown={props.onClose}>
      <div className="picker rtl" style={props.style} onPointerDown={(event) => event.stopPropagation()}>
        <p className="picker-title">ابزار را انتخاب کن</p>
        {GADGET_COPY.map((gadget, index) => {
          const Icon = GADGET_ICONS[gadget.id] ?? Snowflake;
          const left = props.hud.cooldowns[gadget.id] ?? 0;
          const active = props.hud.selected === gadget.id;
          return (
            <button
              key={gadget.id}
              type="button"
              className={active ? "pick active" : "pick"}
              style={{ ["--tint" as string]: gadget.tint, animationDelay: `${index * 50}ms` }}
              onClick={() => props.onPick(gadget.id)}
            >
              <span className="pick-icon">
                <Icon size={20} strokeWidth={2.2} />
              </span>
              <span className="pick-copy">
                <strong>{gadget.name}</strong>
                <em>{gadget.text}</em>
              </span>
              <span className={left > 0 ? "pick-state wait" : "pick-state"}>
                {left > 0 ? `${faDigits(Math.ceil(left))} ث` : "آماده"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
