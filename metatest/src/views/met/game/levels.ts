export type Rect = { x: number; y: number; w: number; h: number };

export type Solid = Rect & { id?: string; door?: string };

export type Mover = Rect & {
    id: string;
    axis: 'x' | 'y';
    range: number;
    speed: number;
};

export type ItemKind = 'star' | 'scroll' | 'lantern';

export type ItemDef = {
    id: string;
    x: number;
    y: number;
    kind: ItemKind;
    name: string;
};

export type SecretDef = Rect & { id: string; hint: string };

export type RiddleDef = {
    id: string;
    x: number;
    y: number;
    prompt: string;
    choices: string[];
    answer: number;
    opens?: string;
};

export type PlateDef = {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    order: number;
};

export type TaskDef = { id: string; text: string; needs: string[] };

export type TourStep = {
    id: string;
    title: string;
    body: string;
    advance: 'tap' | 'move' | 'jump' | 'collect' | 'secret' | 'solve' | 'portal';
};

export type LevelDef = {
    id: string;
    name: string;
    blurb: string;
    world: { w: number; h: number };
    spawn: { x: number; y: number };
    solids: Solid[];
    movers: Mover[];
    items: ItemDef[];
    secrets: SecretDef[];
    riddles: RiddleDef[];
    plates: PlateDef[];
    portal: { x: number; y: number };
    tasks: TaskDef[];
    tour: TourStep[];
};

const ground = (x: number, y: number, w: number, h = 140): Solid => ({ x, y, w, h });

export const LEVELS: LevelDef[] = [
    {
        id: 'ivan',
        name: 'ایوان صبح',
        blurb: 'اولین قدم. راه پنهان را پیدا کن و به دروازه برس.',
        world: { w: 3000, h: 640 },
        spawn: { x: 80, y: 460 },
        solids: [
            ground(0, 500, 380),
            { x: 170, y: 336, w: 150, h: 16 },
            ground(520, 500, 260),
            { x: 860, y: 420, w: 160, h: 24 },
            ground(1100, 500, 520),
            { id: 'gate', door: 'gate', x: 1488, y: 390, w: 26, h: 110 },
            { x: 1760, y: 390, w: 150, h: 22 },
            ground(2040, 500, 960),
        ],
        movers: [{ id: 'ferry', x: 390, y: 468, w: 100, h: 18, axis: 'x', range: 130, speed: 46 }],
        items: [
            { id: 'star-ledge', x: 910, y: 372, kind: 'star', name: 'ستاره ایوان' },
            { id: 'star-secret', x: 250, y: 300, kind: 'star', name: 'ستاره پنهان' },
        ],
        secrets: [{ id: 'alcove', x: 180, y: 280, w: 150, h: 36, hint: 'بالای شروع، یک طاقچه پنهان است.' }],
        riddles: [
            {
                id: 'stone',
                x: 1680,
                y: 452,
                prompt: 'بی‌صدا راه را نشان می‌دهم و فقط وقتی نگاه کنی پیدایم. من چیستم؟',
                choices: ['باد', 'ستاره', 'سایه'],
                answer: 1,
                opens: 'gate',
            },
        ],
        plates: [],
        portal: { x: 2760, y: 430 },
        tasks: [
            { id: 'stars', text: 'دو ستاره را پیدا کن', needs: ['star-ledge', 'star-secret'] },
            { id: 'riddle', text: 'معمای سنگ را حل کن', needs: ['stone'] },
            { id: 'door', text: 'از دروازه بگذر', needs: ['gate'] },
        ],
        tour: [
            { id: 'hi', title: 'سلام، من مِت‌ام', body: 'این ایوان صبح است. با هم کاوش می‌کنیم. دکمه‌ها یا کلیدهای جهت را امتحان کن.', advance: 'tap' },
            { id: 'move', title: 'قدم بزن', body: 'به راست برو. روی دسکتاپ از جهت‌ها استفاده کن و روی گوشی دکمه‌های پایین را نگه دار.', advance: 'move' },
            { id: 'jump', title: 'بپر', body: 'فاصله‌ها را با پرش رد کن. اگر افتادی، از آخرین جای امن برمی‌گردی.', advance: 'jump' },
            { id: 'secret', title: 'راه پنهان', body: 'همه‌چیز روی زمین نیست. بالای نقطه شروع یک طاقچه هست. بپر و ستاره را بردار.', advance: 'secret' },
            { id: 'ferry', title: 'سکوهای روان', body: 'سکوی متحرک دشمن نیست؛ زمان‌بندی است. سوارش شو و تا لبه دیگر صبر کن.', advance: 'tap' },
            { id: 'puzzle', title: 'معما', body: 'کنار سنگ بمان و «بررسی» را بزن. جواب درست دروازه را باز می‌کند.', advance: 'solve' },
            { id: 'portal', title: 'دروازه', body: 'وقتی ستاره‌ها جمع شد و معما حل شد، وارد حلقه نور شو تا مرحله بعد باز شود.', advance: 'portal' },
        ],
    },
    {
        id: 'fog',
        name: 'دالان مه',
        blurb: 'مه راه را می‌پوشاند. فانوس و طومار را از مسیرهای جانبی بیاور.',
        world: { w: 3200, h: 860 },
        spawn: { x: 70, y: 680 },
        solids: [
            ground(0, 720, 300),
            { x: 360, y: 640, w: 140, h: 22 },
            { x: 560, y: 540, w: 140, h: 22 },
            { x: 760, y: 440, w: 160, h: 22 },
            ground(980, 720, 280),
            { x: 1320, y: 600, w: 180, h: 22 },
            ground(1680, 720, 400),
            { x: 2140, y: 560, w: 120, h: 22 },
            ground(2360, 720, 840),
            { x: 200, y: 520, w: 90, h: 18 },
        ],
        movers: [
            { id: 'lift', x: 430, y: 680, w: 90, h: 16, axis: 'y', range: 180, speed: 50 },
            { id: 'span', x: 1280, y: 690, w: 110, h: 16, axis: 'x', range: 220, speed: 55 },
        ],
        items: [
            { id: 'lantern', x: 820, y: 392, kind: 'lantern', name: 'فانوس مه' },
            { id: 'scroll', x: 230, y: 472, kind: 'scroll', name: 'طومار دالان' },
        ],
        secrets: [{ id: 'false-wall', x: 168, y: 500, w: 150, h: 80, hint: 'دیوار چپ، بالاتر از زمین، فقط نقش است. از میانش رد شو.' }],
        riddles: [],
        plates: [],
        portal: { x: 2920, y: 648 },
        tasks: [
            { id: 'lantern', text: 'فانوس را از بلندی بیاور', needs: ['lantern'] },
            { id: 'scroll', text: 'طومار پشت دیوار نقش‌دار', needs: ['scroll'] },
            { id: 'cross', text: 'با سکوها از مه عبور کن', needs: ['lantern', 'scroll'] },
        ],
        tour: [
            { id: 'fog-hi', title: 'مه غلیظ است', body: 'این‌جا دشمن نیست. سکو بالا و پایین می‌رود. زمان پرش را با حرکت سکو یکی کن.', advance: 'tap' },
            { id: 'fog-secret', title: 'دیوار دروغین', body: 'بعضی دیوارها فقط نقاشی‌اند. سمت چپ، کمی بالاتر، شکافی هست.', advance: 'secret' },
            { id: 'fog-end', title: 'دروازه مه', body: 'فانوس و طومار را که داشته باشی، حلقه انتهای دالان بیدار می‌شود.', advance: 'portal' },
        ],
    },
    {
        id: 'obs',
        name: 'رصدخانه شب',
        blurb: 'سه صفحه را به ترتیب نشانه‌ها روشن کن و ستاره آخر را از تونل بردار.',
        world: { w: 3400, h: 720 },
        spawn: { x: 80, y: 540 },
        solids: [
            ground(0, 580, 180),
            ground(0, 680, 420, 40),
            { x: 250, y: 630, w: 70, h: 16 },
            { x: 330, y: 580, w: 90, h: 16 },
            ground(620, 580, 700),
            { x: 1380, y: 470, w: 200, h: 22 },
            ground(1680, 580, 360),
            { x: 2100, y: 500, w: 140, h: 20 },
            ground(2320, 580, 1080),
            { x: 2480, y: 430, w: 220, h: 20 },
            ground(40, 680, 520, 40),
        ],
        movers: [
            { id: 'gap', x: 190, y: 548, w: 100, h: 16, axis: 'x', range: 300, speed: 62 },
            { id: 'high', x: 2060, y: 540, w: 88, h: 16, axis: 'y', range: 90, speed: 40 },
        ],
        items: [{ id: 'star-tunnel', x: 180, y: 632, kind: 'star', name: 'ستاره تونل' }],
        secrets: [{ id: 'tunnel', x: 60, y: 620, w: 280, h: 70, hint: 'زیر زمین شروع، تونلی کوتاه پنهان شده.' }],
        riddles: [],
        plates: [
            { id: 'moon', x: 700, y: 556, w: 54, h: 14, order: 0 },
            { id: 'book', x: 860, y: 556, w: 54, h: 14, order: 1 },
            { id: 'starplate', x: 1020, y: 556, w: 54, h: 14, order: 2 },
        ],
        portal: { x: 3080, y: 508 },
        tasks: [
            { id: 'order', text: 'صفحه‌ها را به ترتیب مهتاب، کتاب، ستاره روشن کن', needs: ['sequence'] },
            { id: 'tunnel-star', text: 'ستاره تونل زیرین', needs: ['star-tunnel'] },
        ],
        tour: [
            { id: 'obs-hi', title: 'رصدخانه', body: 'روی زمین نوشته‌ای هست: مهتاب، کتاب، ستاره. صفحه‌ها را به همین ترتیب لمس کن. اشتباه، همه را خاموش می‌کند.', advance: 'tap' },
            { id: 'obs-tunnel', title: 'زیر پا', body: 'کمی برگرد و پایین‌تر از سطح اصلی را ببین. تونل کوتاه است؛ باید از لبه بیفتی داخلش، نه بیرون نقشه.', advance: 'secret' },
            { id: 'obs-portal', title: 'آخرین حلقه', body: 'بعد از ترتیب درست و ستاره، دروازه انتهای بام باز می‌شود.', advance: 'portal' },
        ],
    },
];

export const levelByIndex = (index: number) => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))]!;
