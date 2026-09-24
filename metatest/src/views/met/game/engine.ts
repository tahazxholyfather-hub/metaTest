import type { ItemDef, LevelDef, Mover, Rect, Solid } from './levels';

export const GRAVITY = 1650;
export const MOVE_SPEED = 220;
export const JUMP_SPEED = -560;
export const PLAYER_W = 34;
export const PLAYER_H = 40;
const COYOTE = 0.12;
const BUFFER = 0.12;

export type Input = {
    left: boolean;
    right: boolean;
    jump: boolean;
    interact: boolean;
};

export type SaveShape = {
    unlocked: number;
    found: Record<string, string[]>;
    solved: Record<string, string[]>;
};

export const emptySave = (): SaveShape => ({ unlocked: 0, found: {}, solved: {} });

const SAVE_KEY = 'met-adventure-v1';

export const loadSave = (): SaveShape => {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return emptySave();
        const parsed = JSON.parse(raw) as SaveShape;
        return {
            unlocked: parsed.unlocked ?? 0,
            found: parsed.found ?? {},
            solved: parsed.solved ?? {},
        };
    } catch {
        return emptySave();
    }
};

export const writeSave = (save: SaveShape) => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
};

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const moverRect = (m: Mover, t: number): Rect => {
    const wave = (Math.sin(t * m.speed * 0.02) + 1) / 2;
    if (m.axis === 'x') return { x: m.x + wave * m.range, y: m.y, w: m.w, h: m.h };
    return { x: m.x, y: m.y - wave * m.range, w: m.w, h: m.h };
};

export type Notice = { text: string; until: number };

export class Adventure {
    level: LevelDef;
    x: number;
    y: number;
    vx = 0;
    vy = 0;
    onGround = false;
    coyote = 0;
    buffer = 0;
    facing = 1;
    found: Set<string>;
    solved: Set<string>;
    sequence: number[] = [];
    riding: string | null = null;
    camX = 0;
    camY = 0;
    time = 0;
    moved = false;
    jumped = false;
    sawSecret = false;
    notice: Notice | null = null;
    interactLatch = false;
    pendingRiddle: string | null = null;
    finished = false;
    fell = false;
    checkpoint = { x: 0, y: 0 };
    private prevMovers = new Map<string, Rect>();

    constructor(level: LevelDef, found: string[], solved: string[]) {
        this.level = level;
        this.x = level.spawn.x;
        this.y = level.spawn.y;
        this.checkpoint = { ...level.spawn };
        this.found = new Set(found);
        this.solved = new Set(solved);
        level.movers.forEach((m) => this.prevMovers.set(m.id, moverRect(m, 0)));
    }

    private resolve(horizontal: boolean, solids: Rect[]): boolean {
        let landed = false;
        const body = this.body();
        for (const solid of solids) {
            if (!overlap(body, solid)) continue;
            if (horizontal) {
                this.x = this.vx > 0 || (this.vx === 0 && body.x < solid.x) ? solid.x - PLAYER_W : solid.x + solid.w;
                this.vx = 0;
            } else if (this.vy >= 0) {
                this.y = solid.y - PLAYER_H;
                this.vy = 0;
                landed = true;
            } else {
                this.y = solid.y + solid.h;
                this.vy = 0;
            }
            body.x = this.x;
            body.y = this.y;
        }
        return landed;
    }

    private solids(): Solid[] {
        return this.level.solids.filter((s) => !s.door || !this.solved.has(s.door));
    }

    private body(): Rect {
        return { x: this.x, y: this.y, w: PLAYER_W, h: PLAYER_H };
    }

    private say(text: string) {
        this.notice = { text, until: this.time + 2.4 };
    }

    step(dt: number, input: Input) {
        const stepDt = Math.min(dt, 0.033);
        this.time += stepDt;
        if (this.notice && this.time > this.notice.until) this.notice = null;

        const movers = this.level.movers.map((m) => ({ id: m.id, rect: moverRect(m, this.time) }));
        if (this.riding) {
            const prev = this.prevMovers.get(this.riding);
            const next = movers.find((m) => m.id === this.riding)?.rect;
            if (prev && next) {
                this.x += next.x - prev.x;
                this.y += next.y - prev.y;
            }
        }

        const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        if (dir !== 0) {
            this.facing = dir;
            this.moved = true;
        }
        this.vx = dir * MOVE_SPEED;
        if (input.jump) this.buffer = BUFFER;
        else this.buffer = Math.max(0, this.buffer - stepDt);

        if (this.buffer > 0 && (this.onGround || this.coyote > 0)) {
            this.vy = JUMP_SPEED;
            this.onGround = false;
            this.coyote = 0;
            this.buffer = 0;
            this.jumped = true;
            this.riding = null;
        }
        this.vy += GRAVITY * stepDt;

        this.x += this.vx * stepDt;
        this.resolve(true, this.solids());
        this.y += this.vy * stepDt;
        const landed = this.resolve(false, this.solids());
        this.onGround = landed;
        this.coyote = landed ? COYOTE : Math.max(0, this.coyote - stepDt);

        this.riding = null;
        const feet = { x: this.x + 4, y: this.y + PLAYER_H, w: PLAYER_W - 8, h: 6 };
        for (const m of movers) {
            if (this.vy >= 0 && overlap(feet, { ...m.rect, y: m.rect.y - 2, h: m.rect.h + 4 }) && this.y + PLAYER_H <= m.rect.y + 12) {
                this.y = m.rect.y - PLAYER_H;
                this.vy = 0;
                this.onGround = true;
                this.riding = m.id;
            }
        }
        movers.forEach((m) => this.prevMovers.set(m.id, m.rect));

        if (this.onGround && !this.riding && this.vy === 0) {
            this.checkpoint = { x: this.x, y: this.y };
        }

        if (this.y > this.level.world.h + 30) {
            this.fell = true;
            this.x = this.checkpoint.x;
            this.y = this.checkpoint.y;
            this.vx = 0;
            this.vy = 0;
            this.say('افتادی. از آخرین جای امن ادامه بده.');
        }

        const body = this.body();
        for (const item of this.level.items) {
            if (this.found.has(item.id)) continue;
            if (overlap(body, { x: item.x - 10, y: item.y - 10, w: 36, h: 36 })) {
                this.found.add(item.id);
                this.say(`${item.name} را برداشتی.`);
            }
        }
        for (const secret of this.level.secrets) {
            if (overlap(body, secret)) this.sawSecret = true;
        }

        this.touchPlates(body);

        if (input.interact && !this.interactLatch) {
            this.tryInteract(body);
        }
        this.interactLatch = input.interact;

        const portal = { x: this.level.portal.x, y: this.level.portal.y, w: 48, h: 70 };
        if (overlap(body, portal)) {
            if (this.portalOpen()) this.finished = true;
            else this.say('دروازه هنوز خاموش است. کارها را تمام کن.');
        }
    }

    private touchPlates(body: Rect) {
        if (!this.level.plates.length || this.solved.has('sequence')) return;
        for (const plate of this.level.plates) {
            const zone = { x: plate.x, y: plate.y - 28, w: plate.w, h: 36 };
            if (!overlap(body, zone) || this.sequence.includes(plate.order)) continue;
            const expect = this.sequence.length;
            if (plate.order === expect) {
                this.sequence.push(plate.order);
                this.say(['مهتاب', 'کتاب', 'ستاره'][plate.order] ?? 'روشن شد');
                if (this.sequence.length === this.level.plates.length) {
                    this.solved.add('sequence');
                    this.say('ترتیب درست بود. رصدخانه بیدار شد.');
                }
            } else {
                this.sequence = [];
                this.say('ترتیب به‌هم ریخت. از اول: مهتاب، کتاب، ستاره.');
            }
        }
    }

    private tryInteract(body: Rect) {
        for (const riddle of this.level.riddles) {
            if (this.solved.has(riddle.id)) continue;
            const zone = { x: riddle.x - 28, y: riddle.y - 48, w: 80, h: 70 };
            if (overlap(body, zone)) {
                this.pendingRiddle = riddle.id;
                return;
            }
        }
        this.say('این‌جا چیزی برای بررسی نیست.');
    }

    answerRiddle(id: string, choice: number) {
        const riddle = this.level.riddles.find((r) => r.id === id);
        this.pendingRiddle = null;
        if (!riddle) return;
        if (choice === riddle.answer) {
            this.solved.add(riddle.id);
            if (riddle.opens) this.solved.add(riddle.opens);
            this.say('درست بود. راه باز شد.');
        } else {
            this.say('نه، این یکی نیست. دوباره فکر کن.');
        }
    }

    portalOpen() {
        return this.level.tasks.every((task) => task.needs.every((id) => this.found.has(id) || this.solved.has(id)));
    }

    taskDone(needs: string[]) {
        return needs.every((id) => this.found.has(id) || this.solved.has(id));
    }

    nearItem(): ItemDef | null {
        const body = this.body();
        return this.level.items.find((item) => !this.found.has(item.id) && overlap(body, { x: item.x - 40, y: item.y - 40, w: 90, h: 90 })) ?? null;
    }

    moverFrames(t = this.time) {
        return this.level.movers.map((m) => ({ id: m.id, rect: moverRect(m, t) }));
    }
}
