import {
  ArrowRight,
  BookOpen,
  Crown,
  Droplets,
  Flame,
  FlaskConical,
  Hand,
  Home,
  Play,
  RotateCcw,
  Send,
  Snowflake,
  Sparkles,
  TriangleAlert,
  Volume2,
  VolumeX,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { REACTIONS } from "../data/reactions";
import { reactionProductName, reactionTex } from "../game/formula";
import { faDigits } from "../game/labels";
import { formatNumber } from "../game/score";
import type { LeaderboardEntry } from "../save/models";
import { Chem } from "./Chem";
import { BEHAVIORS, GADGET_COPY, RECIPES, STEPS } from "./copy";
import { GADGET_ICONS } from "./GadgetButton";
import { GADGET_COOLDOWN, isGadget } from "../game/gadgets";

const STEP_ICONS: Record<string, LucideIcon> = { drag: Hand, release: Send, react: Sparkles };
const BEHAVIOR_ICONS: Record<string, LucideIcon> = {
  water: Droplets,
  fire: Flame,
  steam: Wind,
  acid: FlaskConical,
  ice: Snowflake,
  explosive: Zap,
};

function Page(props: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="page rtl">
      <header className="page-bar">
        <button className="round-btn" type="button" onClick={props.onBack} aria-label="بازگشت">
          <ArrowRight size={18} />
        </button>
        <h1>{props.title}</h1>
        <span className="page-spacer" />
      </header>
      <div className="page-body">{props.children}</div>
    </div>
  );
}

export function Avatar(props: { name: string; size?: number }) {
  const letter = props.name.trim().slice(0, 1) || "ر";
  return (
    <span className="avatar" style={{ width: props.size ?? 32, height: props.size ?? 32 }} aria-hidden>
      {letter}
    </span>
  );
}

export function SettingsPage(props: {
  name: string;
  sound: boolean;
  onRename: (name: string) => void;
  onSound: () => void;
  onResetTips: () => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState(props.name);
  const [tipsReset, setTipsReset] = useState(false);
  return (
    <Page title="تنظیمات" onBack={props.onBack}>
      <section className="card">
        <label className="field-label" htmlFor="player-name">
          نام بازیکن
        </label>
        <div className="name-edit">
          <Avatar name={draft} size={44} />
          <input
            id="player-name"
            value={draft}
            maxLength={16}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => props.onRename(draft)}
          />
        </div>
      </section>
      <section className="card list">
        <button className="row-btn" type="button" onClick={props.onSound}>
          <span className="row-icon">{props.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</span>
          <span className="row-text">صدای بازی</span>
          <span className={props.sound ? "switch on" : "switch"} />
        </button>
        <button
          className="row-btn"
          type="button"
          onClick={() => {
            props.onResetTips();
            setTipsReset(true);
          }}
        >
          <span className="row-icon">
            <RotateCcw size={18} />
          </span>
          <span className="row-text">نمایش دوبارهٔ نکته‌ها</span>
          <span className="row-hint">{tipsReset ? "انجام شد" : ""}</span>
        </button>
      </section>
      <p className="credit">ساخته‌شده برای کلاس شیمی</p>
    </Page>
  );
}

export function LeaderboardPage(props: { entries: LeaderboardEntry[]; onBack: () => void }) {
  return (
    <Page title="رتبه‌بندی" onBack={props.onBack}>
      <ol className="ranks">
        {props.entries.map((entry, index) => (
          <li key={entry.id} className={`${entry.you ? "you" : ""} ${index < 3 ? `top top-${index + 1}` : ""}`}>
            <span className="rank">{index < 3 ? <Crown size={16} /> : faDigits(index + 1)}</span>
            <Avatar name={entry.name} size={34} />
            <span className="rank-name">
              {entry.name}
              {entry.you && <small>شما</small>}
            </span>
            <b className="num">{formatNumber(entry.score)}</b>
          </li>
        ))}
      </ol>
    </Page>
  );
}

export function GuidePage(props: { discovered: string[]; onBack: () => void }) {
  const known = new Set(props.discovered);
  const found = REACTIONS.filter((reaction) => known.has(reaction.id));
  return (
    <Page title="راهنمای بازی" onBack={props.onBack}>
      <section>
        <h2 className="section-title">در سه حرکت</h2>
        <div className="steps">
          {STEPS.map((step, index) => {
            const Icon = STEP_ICONS[step.id] ?? Sparkles;
            return (
              <div className="step" key={step.id}>
                <span className="step-no">{faDigits(index + 1)}</span>
                <Icon size={22} />
                <strong>{step.title}</strong>
                <em>{step.text}</em>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <h2 className="section-title">واکنش‌های کلاس</h2>
        <div className="recipes">
          {RECIPES.map((recipe) => (
            <div className="recipe" key={recipe.tex} style={{ ["--tint" as string]: recipe.tint }}>
              <Chem tex={recipe.tex} size={19} weight={12} className="recipe-eq" />
              <span className="recipe-copy">
                <strong>{recipe.name}</strong>
                <em>{recipe.note}</em>
              </span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="section-title">ماده‌ها زنجیره می‌سازند</h2>
        <p className="section-lead">سه مادهٔ همسان که به هم برسند، اثرشان آزاد می‌شود.</p>
        <div className="behaviors">
          {BEHAVIORS.map((item) => {
            const Icon = BEHAVIOR_ICONS[item.id] ?? Sparkles;
            return (
              <div className="behavior" key={item.id}>
                <Icon size={18} />
                <strong>{item.name}</strong>
                <em>{item.text}</em>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <h2 className="section-title">ابزارها</h2>
        <p className="section-lead">دکمهٔ ابزار را بزن تا استفاده شود؛ نگه دار تا ابزار دیگری برداری.</p>
        <div className="tools">
          {GADGET_COPY.map((gadget) => {
            const Icon = GADGET_ICONS[gadget.id] ?? Sparkles;
            const seconds = isGadget(gadget.id) ? GADGET_COOLDOWN[gadget.id] : 0;
            return (
              <div className="tool" key={gadget.id} style={{ ["--tint" as string]: gadget.tint }}>
                <span className="tool-icon">
                  <Icon size={20} />
                </span>
                <span className="tool-copy">
                  <strong>{gadget.name}</strong>
                  <em>{gadget.text}</em>
                </span>
                <span className="tool-cd">{faDigits(seconds)} ث</span>
              </div>
            );
          })}
        </div>
      </section>
      <section className="danger-card">
        <TriangleAlert size={20} />
        <span>
          <strong>خط قرمز</strong>
          <em>اگر گوی‌ها به خط پایین برسند، آزمایش تمام می‌شود.</em>
        </span>
      </section>
      <section>
        <h2 className="section-title">کشف‌شده‌ها · {faDigits(found.length)} از {faDigits(REACTIONS.length)}</h2>
        {found.length === 0 && <p className="section-lead">اولین واکنشی که بسازی، اینجا ثبت می‌شود.</p>}
        <div className="found">
          {found.map((reaction) => {
            const tex = reactionTex(reaction);
            return (
              <div className="found-row" key={reaction.id}>
                {tex.startsWith("|") ? <span className="found-words">{tex.slice(1)}</span> : <Chem tex={tex} size={16} weight={10} />}
                <b>{reactionProductName(reaction)}</b>
              </div>
            );
          })}
        </div>
      </section>
    </Page>
  );
}

export function PauseSheet(props: { sound: boolean; onResume: () => void; onGuide: () => void; onSound: () => void; onHome: () => void }) {
  return (
    <div className="overlay">
      <section className="pause rtl" role="dialog" aria-label="توقف">
        <h2>بازی متوقف شد</h2>
        <button className="cta" type="button" onClick={props.onResume}>
          <Play size={18} />
          ادامه
        </button>
        <div className="pause-row">
          <button className="soft" type="button" onClick={props.onGuide}>
            <BookOpen size={18} />
            راهنما
          </button>
          <button className="soft" type="button" onClick={props.onSound}>
            {props.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {props.sound ? "صدا" : "بی‌صدا"}
          </button>
          <button className="soft" type="button" onClick={props.onHome}>
            <Home size={18} />
            خانه
          </button>
        </div>
      </section>
    </div>
  );
}
