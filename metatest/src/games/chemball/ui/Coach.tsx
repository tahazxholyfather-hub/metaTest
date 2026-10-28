import { useState } from "react";

export interface CoachTarget {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
}

export interface CoachStep {
  id: string;
  title: string;
  text: string;
  target: CoachTarget;
}

/** Dims the screen and lights one control at a time, with a short note beside it. */
export function Coach(props: { steps: CoachStep[]; height: number; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const step = props.steps[index];
  if (!step) return null;
  const last = index === props.steps.length - 1;
  const next = () => (last ? props.onDone() : setIndex(index + 1));
  const { target } = step;
  const below = target.y + target.h / 2 < props.height * 0.45;
  const cardPlace = below ? { top: target.y + target.h + 22 } : { bottom: props.height - target.y + 22 };

  return (
    <div className="coach rtl" role="dialog" aria-label="آموزش" onClick={next}>
      <span
        className="coach-hole"
        style={{ left: target.x, top: target.y, width: target.w, height: target.h, borderRadius: target.radius }}
      />
      <div className={below ? "coach-card below" : "coach-card"} style={cardPlace} key={step.id} onClick={(event) => event.stopPropagation()}>
        <div className="coach-dots" aria-hidden>
          {props.steps.map((item, i) => (
            <span key={item.id} className={i === index ? "on" : i < index ? "done" : ""} />
          ))}
        </div>
        <strong>{step.title}</strong>
        <p>{step.text}</p>
        <div className="coach-actions">
          <button className="coach-next" type="button" onClick={next}>
            {last ? "شروع کن" : "بعدی"}
          </button>
          {!last && (
            <button className="coach-skip" type="button" onClick={props.onDone}>
              رد کردن
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
