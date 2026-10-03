import {
  Anvil,
  Atom,
  BookOpen,
  ChevronRight,
  CircleOff,
  Crosshair,
  Droplets,
  Flame,
  FlaskConical,
  Gem,
  Magnet,
  Snowflake,
  TriangleAlert,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { REACTIONS } from "../data/reactions";
import { reactionFormula, reactionProductName } from "../game/formula";
import { BEHAVIORS, GADGET_COPY, LESSONS } from "./copy";

const LESSON_ICONS: Record<string, LucideIcon> = {
  aim: Crosshair,
  element: Atom,
  material: Flame,
  water: Droplets,
  salt: Gem,
  acid: FlaskConical,
  gas: Wind,
  rust: Anvil,
  danger: TriangleAlert,
};

const GADGET_ICONS: Record<string, LucideIcon> = {
  frost: Snowflake,
  void: CircleOff,
  magnet: Magnet,
  spark: Zap,
  catalyst: FlaskConical,
};

const BEHAVIOR_ICONS: Record<string, LucideIcon> = {
  water: Droplets,
  fire: Flame,
  steam: Wind,
  acid: FlaskConical,
  ice: Snowflake,
  explosive: Zap,
};

export function GadgetSheet(props: {
  charges: Record<string, number>;
  armed: string;
  sound: boolean;
  onArm: (id: string) => void;
  onSound: () => void;
  onGuide: () => void;
  onClose: () => void;
}) {
  return (
    <div className="overlay">
      <section className="sheet rtl" role="dialog" aria-label="ابزارها">
        <div className="sheet-head">
          <h2>ابزار آزمایش</h2>
          <button className="icon-btn" type="button" onClick={props.onClose} aria-label="بستن">
            <X size={18} />
          </button>
        </div>
        <p className="lead">یکی را انتخاب کن. روی شلیک بعدی اثر می‌گذارد.</p>
        <ul className="gadget-list">
          {GADGET_COPY.map((gadget) => {
            const Icon = GADGET_ICONS[gadget.id] ?? Atom;
            const left = props.charges[gadget.id] ?? 0;
            const armed = props.armed === gadget.id;
            return (
              <li key={gadget.id}>
                <button
                  type="button"
                  className={armed ? "gadget armed" : "gadget"}
                  disabled={left <= 0}
                  onClick={() => props.onArm(gadget.id)}
                >
                  <span className="bubble-icon" style={{ color: gadget.tint }}>
                    <Icon size={20} />
                  </span>
                  <span className="gadget-copy">
                    <strong>
                      {gadget.name}
                      {armed ? " · آماده" : ""}
                    </strong>
                    <em>{gadget.text}</em>
                  </span>
                  <b>{left}</b>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="sheet-actions">
          <button className="text-btn" type="button" onClick={props.onGuide}>
            <BookOpen size={16} />
            راهنما
          </button>
          <button className="text-btn" type="button" onClick={props.onSound}>
            {props.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {props.sound ? "صدا روشن" : "صدا خاموش"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function Guide(props: { discovered: string[]; onBack: () => void }) {
  const known = new Set(props.discovered);
  const found = REACTIONS.filter((reaction) => known.has(reaction.id));
  return (
    <div className="guide rtl">
      <header className="guide-bar">
        <button className="icon-btn" type="button" onClick={props.onBack} aria-label="بازگشت">
          <ChevronRight size={18} />
        </button>
        <h1>راهنمای آزمایش</h1>
      </header>
      <div className="samples" aria-hidden>
        <span className="mini-bubble" style={{ color: "#3d8ec4" }}>
          H
        </span>
        <span className="mini-bubble icon" style={{ color: "#1d6fbf" }}>
          <Droplets size={22} />
        </span>
        <span className="mini-bubble icon" style={{ color: "#c4472a" }}>
          <Flame size={22} />
        </span>
      </div>
      <ol className="lessons">
        {LESSONS.map((lesson) => {
          const Icon = LESSON_ICONS[lesson.id] ?? Atom;
          return (
            <li key={lesson.id}>
              <span className="bubble-icon" style={{ color: lesson.tint }}>
                <Icon size={18} />
              </span>
              <span>
                <strong>{lesson.title}</strong>
                <em>{lesson.text}</em>
              </span>
            </li>
          );
        })}
      </ol>
      <h2>اثر ماده‌ها</h2>
      <ul className="behavior-row">
        {BEHAVIORS.map((item) => {
          const Icon = BEHAVIOR_ICONS[item.id] ?? Atom;
          return (
            <li key={item.id}>
              <Icon size={16} />
              <b>{item.name}</b>
              <span>{item.text}</span>
            </li>
          );
        })}
      </ul>
      <h2>ابزارها</h2>
      <ul className="mini-tools">
        {GADGET_COPY.map((gadget) => {
          const Icon = GADGET_ICONS[gadget.id] ?? Atom;
          return (
            <li key={gadget.id}>
              <Icon size={16} color={gadget.tint} />
              <b>{gadget.name}</b>
              <span>{gadget.text}</span>
            </li>
          );
        })}
      </ul>
      <h2>کشف‌شده‌ها</h2>
      {found.length === 0 && <p className="lead">اولین واکنش اینجا ثبت می‌شود.</p>}
      <ul className="found">
        {found.map((reaction) => (
          <li key={reaction.id}>
            <span dir="ltr">{reactionFormula(reaction)}</span>
            <b>{reactionProductName(reaction)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
