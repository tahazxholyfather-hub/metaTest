import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Met, type MetColor, type MetState } from '../../../components/met';
import { faNum } from '../ui';
import { Adventure, PLAYER_H, PLAYER_W, loadSave, writeSave, type Input, type SaveShape } from './engine';
import { LEVELS, levelByIndex, type Rect, type TourStep } from './levels';

type Theme = {
    sky: string;
    skyDeep: string;
    ground: string;
    lip: string;
    accent: string;
    card: string;
    text: string;
    muted: string;
};

const readTheme = (el: HTMLElement): Theme => {
    const s = getComputedStyle(el);
    const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
    return {
        sky: v('--bg-app', '#0B0B10'),
        skyDeep: v('--color-primary-800', '#112845'),
        ground: v('--color-primary-600', '#1C4070'),
        lip: v('--color-primary-300', '#8CB0E1'),
        accent: v('--color-secondary-500', '#8B5CF6'),
        card: v('--bg-card', '#16161C'),
        text: v('--text-primary', '#FAFAFA'),
        muted: v('--text-muted', '#a9a9ad'),
    };
};

const emptyInput = (): Input => ({ left: false, right: false, jump: false, interact: false });

const tourReady = (step: TourStep, gameNow: Adventure) => {
    if (step.advance === 'move') return gameNow.moved;
    if (step.advance === 'jump') return gameNow.jumped;
    if (step.advance === 'collect') return gameNow.found.size > 0;
    if (step.advance === 'secret') return gameNow.sawSecret;
    if (step.advance === 'solve') return gameNow.solved.size > 0;
    if (step.advance === 'portal') return gameNow.portalOpen();
    return false;
};

export function MetAdventure({ metColor, onClose }: { metColor: MetColor; onClose: () => void }) {
    const rootRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<Adventure | null>(null);
    const inputRef = useRef<Input>(emptyInput());
    const [save, setSave] = useState<SaveShape>(() => loadSave());
    const [levelIndex, setLevelIndex] = useState(() => Math.min(loadSave().unlocked, LEVELS.length - 1));
    const [paused, setPaused] = useState(false);
    const [tourOn, setTourOn] = useState(true);
    const [tourStep, setTourStep] = useState(0);
    const [riddleId, setRiddleId] = useState<string | null>(null);
    const [won, setWon] = useState(false);
    const [mapOpen, setMapOpen] = useState(false);
    const [pose, setPose] = useState({ x: 80, y: 200, face: 1, state: 'idle' as MetState });
    const pausedRef = useRef(false);
    const levelIndexRef = useRef(levelIndex);
    const actorRef = useRef<HTMLDivElement>(null);
    const transitioning = useRef(false);
    const poseRef = useRef<MetState>('idle');
    const levelRef = useRef(levelByIndex(0));
    const tourRef = useRef(0);
    const tourFlag = useRef(true);

    const level = levelByIndex(levelIndex);
    const tour = level.tour[tourStep];
    const [progress, setProgress] = useState<{ done: boolean[]; notice: string }>({ done: [], notice: '' });

    const boot = useCallback((index: number, data: SaveShape) => {
        const next = levelByIndex(index);
        const found = data.found[next.id] ?? [];
        const solved = data.solved[next.id] ?? [];
        gameRef.current = new Adventure(next, found, solved);
        transitioning.current = false;
        setTourStep(0);
        setTourOn(true);
        setRiddleId(null);
        setWon(false);
        setPaused(false);
        pausedRef.current = false;
    }, []);

    useEffect(() => {
        levelRef.current = level;
        tourRef.current = tourStep;
        tourFlag.current = tourOn;
    }, [level, tourStep, tourOn]);

    useEffect(() => {
        boot(levelIndex, save);
        // save is captured when the level changes; live progress stays on the sim
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boot, levelIndex]);

    useEffect(() => {
        levelIndexRef.current = levelIndex;
    }, [levelIndex]);

    const persist = useCallback((game: Adventure, index: number) => {
        setSave((prev) => {
            const next: SaveShape = {
                unlocked: Math.max(prev.unlocked, index),
                found: { ...prev.found, [game.level.id]: [...game.found] },
                solved: { ...prev.solved, [game.level.id]: [...game.solved] },
            };
            writeSave(next);
            return next;
        });
    }, []);

    useEffect(() => {
        const root = rootRef.current;
        const canvas = canvasRef.current;
        if (!root || !canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let frame = 0;
        let last = 0;

        const drawRound = (r: Rect, fill: string, lip?: string) => {
            const radius = Math.min(10, r.h / 2, r.w / 2);
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, r.h, radius);
            ctx.fillStyle = fill;
            ctx.fill();
            if (lip) {
                ctx.fillStyle = lip;
                ctx.fillRect(r.x + 4, r.y, Math.max(0, r.w - 8), 4);
            }
        };

        const loop = (now: number) => {
            frame = requestAnimationFrame(loop);
            const dt = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
            last = now;
            const game = gameRef.current;
            const theme = readTheme(root);
            if (!game) return;
            if (!pausedRef.current && !game.pendingRiddle) game.step(dt, inputRef.current);
            if (game.pendingRiddle) {
                setRiddleId(game.pendingRiddle);
                game.pendingRiddle = null;
                pausedRef.current = true;
                setPaused(true);
            }
            if (game.finished) {
                if (!transitioning.current) {
                    transitioning.current = true;
                    const index = levelIndexRef.current;
                    persist(game, index >= LEVELS.length - 1 ? index : index + 1);
                    if (index >= LEVELS.length - 1) setWon(true);
                    else setLevelIndex(index + 1);
                }
                return;
            }

            const width = root.clientWidth;
            const height = root.clientHeight;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
                canvas.width = Math.floor(width * dpr);
                canvas.height = Math.floor(height * dpr);
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const viewW = 480;
            const viewH = 270;
            const scale = Math.min(width / viewW, height / viewH);
            const originX = (width - viewW * scale) / 2;
            const originY = (height - viewH * scale) / 2;
            const camX = Math.max(0, Math.min(game.level.world.w - viewW, game.x - viewW * 0.35));
            const camY = Math.max(0, Math.min(game.level.world.h - viewH, game.y - viewH * 0.62));
            game.camX = camX;
            game.camY = camY;

            ctx.clearRect(0, 0, width, height);
            const sky = ctx.createLinearGradient(0, 0, 0, height);
            sky.addColorStop(0, theme.sky);
            sky.addColorStop(1, theme.skyDeep);
            ctx.fillStyle = sky;
            ctx.fillRect(0, 0, width, height);

            ctx.save();
            ctx.translate(originX, originY);
            ctx.scale(scale, scale);
            ctx.translate(-camX, -camY);

            ctx.fillStyle = theme.accent;
            ctx.globalAlpha = 0.18;
            for (let i = 0; i < 5; i += 1) {
                const hx = ((i * 520 - camX * 0.25) % (game.level.world.w + 400)) - 80;
                ctx.beginPath();
                ctx.ellipse(hx, game.level.world.h * 0.55, 180, 46, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            for (const secret of game.level.secrets) {
                ctx.fillStyle = theme.skyDeep;
                ctx.globalAlpha = 0.55;
                ctx.fillRect(secret.x, secret.y, secret.w, secret.h);
                ctx.globalAlpha = 0.9;
                ctx.strokeStyle = theme.lip;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(secret.x + 2, secret.y + 2, secret.w - 4, secret.h - 4);
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
            }

            const openDoors = new Set(game.level.solids.filter((s) => s.door && game.solved.has(s.door)).map((s) => s.id));
            for (const solid of game.level.solids) {
                if (solid.id && openDoors.has(solid.id)) continue;
                drawRound(solid, solid.door ? theme.accent : theme.ground, theme.lip);
            }
            for (const mover of game.moverFrames()) {
                drawRound(mover.rect, theme.lip, theme.card);
            }

            for (const item of game.level.items) {
                if (game.found.has(item.id)) continue;
                const bob = Math.sin(game.time * 3 + item.x) * 3;
                ctx.beginPath();
                ctx.fillStyle = item.kind === 'star' ? '#f2cc8f' : item.kind === 'lantern' ? '#e07a5f' : theme.accent;
                ctx.arc(item.x + 8, item.y + bob, 7, 0, Math.PI * 2);
                ctx.fill();
            }

            for (const plate of game.level.plates) {
                const on = game.solved.has('sequence') || game.sequence.includes(plate.order);
                ctx.fillStyle = on ? theme.accent : theme.card;
                ctx.fillRect(plate.x, plate.y, plate.w, plate.h);
            }

            const portal = game.level.portal;
            ctx.strokeStyle = game.portalOpen() ? theme.lip : theme.muted;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(portal.x + 24, portal.y + 36, 16, 28, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = game.portalOpen() ? theme.accent : theme.skyDeep;
            ctx.globalAlpha = 0.45;
            ctx.fill();
            ctx.globalAlpha = 1;

            ctx.font = '12px alibaba, sans-serif';
            ctx.fillStyle = theme.text;
            ctx.textAlign = 'center';
            if (game.level.plates.length) ctx.fillText('مهتاب · کتاب · ستاره', 860, 540);

            ctx.restore();

            const sx = originX + (game.x + PLAYER_W / 2 - camX) * scale;
            const sy = originY + (game.y + PLAYER_H / 2 - camY) * scale;
            const actor = actorRef.current;
            if (actor) {
                actor.style.left = `${sx}px`;
                actor.style.top = `${sy}px`;
                actor.style.transform = `translate(-50%, -58%) scaleX(${game.facing})`;
            }
            const metState: MetState = !game.onGround ? 'surprised' : game.nearItem() ? 'curious' : Math.abs(game.vx) > 10 ? 'excited' : 'idle';
            if (metState !== poseRef.current) {
                poseRef.current = metState;
                setPose((p) => ({ ...p, state: metState }));
            }
            const step = levelRef.current.tour[tourRef.current];
            if (tourFlag.current && step && tourReady(step, game)) {
                tourRef.current += 1;
                setTourStep(tourRef.current);
            }
            const done = game.level.tasks.map((task) => game.taskDone(task.needs));
            const notice = game.notice?.text ?? '';
            setProgress((prev) => {
                const same = prev.notice === notice && prev.done.length === done.length && prev.done.every((flag, i) => flag === done[i]);
                return same ? prev : { done, notice };
            });
        };
        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
    }, [persist]);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = true;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = true;
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                inputRef.current.jump = true;
                e.preventDefault();
            }
            if (e.code === 'KeyE' || e.code === 'Enter') inputRef.current.interact = true;
            if (e.code === 'Escape') {
                pausedRef.current = !pausedRef.current;
                setPaused(pausedRef.current);
            }
        };
        const up = (e: KeyboardEvent) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = false;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = false;
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') inputRef.current.jump = false;
            if (e.code === 'KeyE' || e.code === 'Enter') inputRef.current.interact = false;
        };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
        };
    }, []);

    const tasks = level.tasks;
    const hold = (key: keyof Input, value: boolean) => {
        inputRef.current[key] = value;
    };

    const riddle = useMemo(() => level.riddles.find((r) => r.id === riddleId) ?? null, [level, riddleId]);

    const chooseLevel = (index: number) => {
        if (index > save.unlocked) return;
        setLevelIndex(index);
        setMapOpen(false);
    };

    return (
        <div ref={rootRef} className="absolute inset-0 z-40 overflow-hidden bg-[var(--bg-app)]" dir="rtl">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            <div
                ref={actorRef}
                className="pointer-events-none absolute left-0 top-0"
                style={{ width: 52, height: 52, transform: 'translate(-50%, -58%)' }}
            >
                <Met size={52} state={pose.state} color={metColor} lookAt={{ x: pose.face * 0.35, y: 0.05 }} label="مِت" />
            </div>

            <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 pointer-events-none">
                <div className="pointer-events-auto max-w-[70%] rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/90 px-3 py-2 backdrop-blur">
                    <div className="text-[13px] font-extrabold text-[var(--text-primary)]">{level.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{level.blurb}</div>
                    <ul className="mt-1 space-y-0.5">
                        {tasks.map((task, index) => {
                            const done = progress.done[index] ?? false;
                            return (
                                <li key={task.id} className={`text-[11px] ${done ? 'text-[var(--success,#15803D)]' : 'text-[var(--text-secondary)]'}`}>
                                    {done ? '✓' : '○'} {task.text}
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div className="pointer-events-auto flex gap-1.5">
                    <button type="button" className={btn} onClick={() => setMapOpen(true)}>
                        مراحل
                    </button>
                    <button
                        type="button"
                        className={btn}
                        onClick={() => {
                            setTourOn(true);
                            setTourStep(0);
                        }}
                    >
                        راهنما
                    </button>
                    <button type="button" className={btn} onClick={onClose}>
                        بازگشت
                    </button>
                </div>
            </div>

            {progress.notice && (
                <div className="absolute left-1/2 top-28 z-10 -translate-x-1/2 rounded-full bg-[var(--bg-card)]/95 px-3 py-1 text-[12px] font-bold text-[var(--text-primary)] shadow">
                    {progress.notice}
                </div>
            )}

            {tourOn && tour && !paused && (
                <div className="absolute inset-x-3 bottom-24 z-20 mx-auto max-w-md rounded-2xl border border-[var(--color-primary-500)]/40 bg-[var(--bg-card)]/95 p-3 shadow-lg">
                    <div className="text-[12px] font-extrabold text-[var(--color-primary-500)]">
                        راهنما · {faNum(tourStep + 1)} از {faNum(level.tour.length)}
                    </div>
                    <div className="mt-0.5 text-[14px] font-extrabold text-[var(--text-primary)]">{tour.title}</div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{tour.body}</p>
                    <div className="mt-2 flex gap-2">
                        {tour.advance === 'tap' && (
                            <button type="button" className={btnPrimary} onClick={() => setTourStep((n) => n + 1)}>
                                فهمیدم
                            </button>
                        )}
                        <button type="button" className={btn} onClick={() => setTourOn(false)}>
                            بستن راهنما
                        </button>
                    </div>
                </div>
            )}

            <div className="absolute inset-x-0 bottom-3 z-10 flex items-end justify-between px-3 pb-[env(safe-area-inset-bottom)]">
                <div className="flex gap-2">
                    <Hold label="چپ" onChange={(v) => hold('left', v)} />
                    <Hold label="راست" onChange={(v) => hold('right', v)} />
                </div>
                <div className="flex gap-2">
                    <Hold label="بررسی" onChange={(v) => hold('interact', v)} />
                    <Hold label="پرش" onChange={(v) => hold('jump', v)} />
                </div>
            </div>

            {riddle && (
                <div className="absolute inset-0 z-30 grid place-items-center bg-black/45 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-card)] p-4">
                        <div className="text-[14px] font-extrabold text-[var(--text-primary)]">سنگ معما</div>
                        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">{riddle.prompt}</p>
                        <div className="mt-3 flex flex-col gap-2">
                            {riddle.choices.map((choice, index) => (
                                <button
                                    key={choice}
                                    type="button"
                                    className={btn}
                                    onClick={() => {
                                        gameRef.current?.answerRiddle(riddle.id, index);
                                        setRiddleId(null);
                                        pausedRef.current = false;
                                        setPaused(false);
                                    }}
                                >
                                    {choice}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {(paused || mapOpen || won) && (
                <div className="absolute inset-0 z-30 grid place-items-center bg-black/45 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-card)] p-4">
                        <div className="text-[16px] font-extrabold text-[var(--text-primary)]">
                            {won ? 'سفر تمام شد' : mapOpen ? 'مرحله‌ها' : 'توقف'}
                        </div>
                        {won && <p className="mt-2 text-[13px] text-[var(--text-secondary)]">هر سه سرزمین را گشتی. می‌توانی دوباره از ایوان صبح شروع کنی.</p>}
                        <div className="mt-3 flex flex-col gap-2">
                            {LEVELS.map((entry, index) => (
                                <button key={entry.id} type="button" className={btn} disabled={index > save.unlocked} onClick={() => chooseLevel(index)}>
                                    {faNum(index + 1)}. {entry.name}
                                    {index > save.unlocked ? ' · قفل' : ''}
                                </button>
                            ))}
                            {!won && (
                                <button
                                    type="button"
                                    className={btnPrimary}
                                    onClick={() => {
                                        pausedRef.current = false;
                                        setPaused(false);
                                        setMapOpen(false);
                                    }}
                                >
                                    ادامه
                                </button>
                            )}
                            {won && (
                                <button type="button" className={btnPrimary} onClick={() => chooseLevel(0)}>
                                    از نو
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            </div>
    );
}

function Hold({ label, onChange }: { label: string; onChange: (down: boolean) => void }) {
    return (
        <button
            type="button"
            className={pad}
            onPointerDown={(e) => {
                e.preventDefault();
                onChange(true);
            }}
            onPointerUp={() => onChange(false)}
            onPointerLeave={() => onChange(false)}
            onPointerCancel={() => onChange(false)}
        >
            {label}
        </button>
    );
}

const btn = 'rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[12px] font-extrabold text-[var(--text-primary)] disabled:opacity-40';
const btnPrimary = 'rounded-xl bg-[var(--color-primary-600)] px-3 py-2 text-[12px] font-extrabold text-white';
const pad = 'h-14 min-w-14 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/90 px-3 text-[13px] font-extrabold text-[var(--text-primary)] touch-none select-none';
