import { Flame, FlaskConical, Snowflake, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { GADGET_COOLDOWN, isGadget } from "../game/gadgets";
import { faDigits } from "../game/labels";
import type { GadgetHud } from "../game/types";
import { GADGET_COPY } from "./copy";

export const GADGET_ICONS: Record<string, LucideIcon> = {
  nitrogen: Snowflake,
  burner: Flame,
  catalyst: FlaskConical,
};

const RING = 2 * Math.PI * 16;

export function GadgetDock(props: { hud: GadgetHud; style?: CSSProperties; onUse: (id: string) => void }) {
  return (
    <div className="gadget-bar" style={props.style}>
      {GADGET_COPY.map((gadget) => {
        const Icon = GADGET_ICONS[gadget.id] ?? Snowflake;
        const cooldown = props.hud.cooldowns[gadget.id] ?? 0;
        const max = isGadget(gadget.id) ? GADGET_COOLDOWN[gadget.id] : 1;
        const armed =
          (gadget.id === "burner" && props.hud.burnerArmed)
          || (gadget.id === "catalyst" && props.hud.catalystReady)
          || (gadget.id === "nitrogen" && props.hud.chill > 0);
        return (
          <button
            key={gadget.id}
            type="button"
            aria-label={gadget.name}
            className={`gadget-btn${cooldown > 0 ? " cooling" : ""}${armed ? " armed" : ""}`}
            style={{ ["--tint" as string]: gadget.tint }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => props.onUse(gadget.id)}
          >
            <svg className="gadget-ring" viewBox="0 0 44 44" aria-hidden>
              <circle className="track" cx="22" cy="22" r="16" />
              <circle
                className="fill"
                cx="22"
                cy="22"
                r="16"
                strokeDasharray={RING}
                strokeDashoffset={RING * (cooldown / max)}
              />
            </svg>
            <span className="gadget-core">
              <Icon size={18} strokeWidth={2.2} />
            </span>
            {cooldown > 0 && <span className="gadget-count">{faDigits(Math.ceil(cooldown))}</span>}
          </button>
        );
      })}
    </div>
  );
}
