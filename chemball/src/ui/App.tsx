import { useEffect, useRef, useState, type PointerEvent } from "react";
import { AudioBus } from "../audio/sfx";
import { REACTIONS } from "../data/reactions";
import { GameEngine } from "../game/engine";
import { reactionFormula, reactionProductName } from "../game/formula";
import { makeLayout } from "../game/hex";
import { formatNumber } from "../game/score";
import type { DiscoveryNotice, HudSnapshot, RunSummary } from "../game/types";
import { renderFrame } from "../render/draw";
import type { LeaderboardEntry } from "../save/models";
import { LocalPlayerRepository } from "../save/localRepository";

const EMPTY_HUD: HudSnapshot = {
  status: "playing",
  score: 0,
  combo: 1,
  name: "Reza",
  avatar: "R",
  level: 1,
  xp: 0,
  bestScore: 0,
  hint: true,
  sound: true,
  discovered: [],
};

export function App() {
  const phoneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const repoRef = useRef(new LocalPlayerRepository());
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [menu, setMenu] = useState(false);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryNotice | null>(null);
  const [draftName, setDraftName] = useState("Reza");

  useEffect(() => {
    const canvas = canvasRef.current;
    const phone = phoneRef.current;
    if (!canvas || !phone) return;
    const engine = new GameEngine(repoRef.current, new AudioBus());
    engineRef.current = engine;
    engine.onHud = (next) => {
      setHud(next);
    };
    engine.onDiscovery = (notice) => {
      setDiscovery(notice);
      window.setTimeout(() => {
        setDiscovery((current) => (current?.id === notice.id ? null : current));
      }, 1700);
    };
    engine.onSummary = (next) => {
      setSummary(next);
      setMenu(false);
    };

    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      engine.update(dt);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        renderFrame(ctx, engine.snapshot(), dpr);
      }
      frame = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = phone.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      engine.setLayout(makeLayout(rect.width, rect.height));
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(phone);
    void engine.init().then(() => {
      resize();
      last = performance.now();
      frame = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      engine.dispose();
    };
  }, []);

  const aim = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    engineRef.current?.pointer(event.clientX - rect.left, event.clientY - rect.top);
  };

  const openMenu = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.pause(true);
    setDraftName(hud.name);
    setMenu(true);
    setLeaders(await engine.leaderboard());
  };

  const closeMenu = () => {
    engineRef.current?.pause(false);
    setMenu(false);
  };

  const known = new Set(hud.discovered);
  const discovered = REACTIONS.filter((reaction) => known.has(reaction.id));

  return (
    <div className="stage">
      <div className="phone" ref={phoneRef}>
        <canvas
          ref={canvasRef}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            engineRef.current?.unlockAudio();
            aim(event);
          }}
          onPointerMove={aim}
          onPointerUp={() => engineRef.current?.shoot()}
        />
        <header className="hud">
          <div className="who">
            <div className="avatar" aria-hidden>
              {hud.avatar}
            </div>
            <span>{hud.name}</span>
          </div>
          <div className="score">{formatNumber(hud.score)}</div>
          <button className="menu-btn" type="button" aria-label="Menu" onClick={() => void openMenu()}>
            ☰
          </button>
        </header>
        {hud.hint && !summary && <div className="hint">Drag to aim · release to shoot</div>}
        {discovery && (
          <div className="toast" role="status">
            <p className="kicker">NEW REACTION</p>
            <strong>{discovery.formula}</strong>
            <em>{discovery.product}</em>
          </div>
        )}
        {summary && (
          <div className="overlay">
            <section className="endcard">
              <p className="wordmark">CHEMBALL</p>
              <p className="record-label">RECORD</p>
              <p className="record">{formatNumber(summary.score)}</p>
              <p className="xp">+{formatNumber(summary.xpEarned)} XP</p>
              {summary.isRecord && <div className="badge">NEW RECORD!</div>}
              <p className="best">BEST {formatNumber(summary.bestScore)}</p>
              <p className="stats">
                {summary.reactionsCreated} reactions · {summary.materialsMatched} matches · chain {summary.highestChain}
              </p>
              <button
                className="primary"
                type="button"
                onClick={() => {
                  setSummary(null);
                  engineRef.current?.restart();
                }}
              >
                PLAY AGAIN
              </button>
            </section>
          </div>
        )}
        {menu && !summary && (
          <div className="overlay">
            <section className="sheet">
              <div className="sheet-head">
                <p className="level">
                  Level {hud.level} · {formatNumber(hud.xp)} XP
                </p>
                <button className="close" type="button" onClick={closeMenu} aria-label="Close">
                  ×
                </button>
              </div>
              <form
                className="name-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void engineRef.current?.rename(draftName);
                }}
              >
                <input
                  aria-label="Player name"
                  value={draftName}
                  maxLength={16}
                  onChange={(event) => setDraftName(event.target.value)}
                />
                <button type="submit">Save</button>
              </form>
              <button className="sound" type="button" onClick={() => void engineRef.current?.setSound(!hud.sound)}>
                Sound {hud.sound ? "on" : "off"}
              </button>
              <h2>HOW TO PLAY</h2>
              <p className="help">Shoot an element into a neighbor to create a material. Color is only an identity.</p>
              <p className="help">Match 3 connected copies of that material. Elements never match on their own.</p>
              <p className="help">Water falls, fire spreads, steam rises, acid dissolves, explosives detonate, ice locks a row.</p>
              <h2>RECORD BOARD</h2>
              {leaders.map((entry, index) => (
                <div className={entry.you ? "row you" : "row"} key={entry.id}>
                  <span>
                    {index + 1}. {entry.name}
                  </span>
                  <b>{formatNumber(entry.score)}</b>
                </div>
              ))}
              <h2>DISCOVERED</h2>
              {discovered.length === 0 && <p className="help">Reactions appear here the first time you create them.</p>}
              {discovered.map((reaction) => (
                <div className="row" key={reaction.id}>
                  <span>{reactionFormula(reaction)}</span>
                  <b>{reactionProductName(reaction)}</b>
                </div>
              ))}
              <p className="help">
                {REACTIONS.length - discovered.length} reactions still hidden. Best {formatNumber(hud.bestScore)}.
              </p>
              <button className="ghost" type="button" onClick={closeMenu}>
                BACK TO LAB
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
