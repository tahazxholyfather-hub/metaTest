import Hashids from 'hashids';

/** Must stay in sync with `metatest/src/utils/hash.ts` and the main API default. */
export const DEFAULT_HASHIDS_SALT = 'super-secret-salt-change-me-please';

function uniqueSalts(): string[] {
    const configured = process.env.HASHIDS_SALT?.trim();
    const salts = [configured, DEFAULT_HASHIDS_SALT].filter(
        (salt): salt is string => Boolean(salt),
    );
    return [...new Set(salts)];
}

function quizHasher(salt: string): Hashids {
    return new Hashids(`${salt}:quiz`, 12);
}

function resultHasher(salt: string): Hashids {
    return new Hashids(`${salt}:result`, 12);
}

function shareHasher(salt: string): Hashids {
    return new Hashids(`${salt}:share`, 10);
}

function decodeWith(
    hash: string,
    makeHasher: (salt: string) => Hashids,
): number | null {
    for (const salt of uniqueSalts()) {
        try {
            const decoded = makeHasher(salt).decode(hash);
            if (!decoded.length) continue;
            const value = Number(decoded[0]);
            if (Number.isInteger(value) && value > 0) return value;
        } catch {
            // try the next salt
        }
    }
    return null;
}

function parseNumericId(value: string): number | null {
    if (!/^\d+$/.test(value)) return null;
    const num = Number(value);
    return Number.isInteger(num) && num > 0 ? num : null;
}

export function encodeQuizId(id: number | string | null | undefined): string | null {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) return null;
    return quizHasher(DEFAULT_HASHIDS_SALT).encode(num);
}

export function decodeQuizId(hash: string | number | null | undefined): number | null {
    if (hash === null || hash === undefined) return null;
    if (typeof hash === 'number') {
        return Number.isInteger(hash) && hash > 0 ? hash : null;
    }
    const raw = String(hash).trim();
    if (!raw) return null;
    return parseNumericId(raw) ?? decodeWith(raw, quizHasher);
}

export function encodeResultId(id: number | string | null | undefined): string | null {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) return null;
    return resultHasher(DEFAULT_HASHIDS_SALT).encode(num);
}

export function decodeResultId(hash: string | number | null | undefined): number | null {
    if (hash === null || hash === undefined) return null;
    if (typeof hash === 'number') {
        return Number.isInteger(hash) && hash > 0 ? hash : null;
    }
    const raw = String(hash).trim();
    if (!raw) return null;
    return parseNumericId(raw) ?? decodeWith(raw, resultHasher);
}

export function encodeShareCode(id: number | string | null | undefined): string | null {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) return null;
    return shareHasher(DEFAULT_HASHIDS_SALT).encode(num);
}

export function decodeShareCode(hash: string | number | null | undefined): number | null {
    if (hash === null || hash === undefined) return null;
    if (typeof hash === 'number') {
        return Number.isInteger(hash) && hash > 0 ? hash : null;
    }
    const raw = String(hash).trim();
    if (!raw) return null;
    return parseNumericId(raw) ?? decodeWith(raw, shareHasher);
}
