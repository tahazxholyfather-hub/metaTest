import Hashids from 'hashids';

const SALT = process.env.HASHIDS_SALT || 'super-secret-salt-change-me-please';

const quizHash = new Hashids(`${SALT}:quiz`, 12);
const resultHash = new Hashids(`${SALT}:result`, 12);
const shareHash = new Hashids(`${SALT}:share`, 10);

export function encodeQuizId(id: number | string | null | undefined): string | null {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) return null;
    return quizHash.encode(num);
}

export function decodeQuizId(hash: string | null | undefined): number | null {
    if (!hash) return null;
    try {
        const decoded = quizHash.decode(hash);
        return decoded.length ? Number(decoded[0]) : null;
    } catch {
        return null;
    }
}

export function encodeResultId(id: number | string | null | undefined): string | null {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) return null;
    return resultHash.encode(num);
}

export function decodeResultId(hash: string | null | undefined): number | null {
    if (!hash) return null;
    try {
        const decoded = resultHash.decode(hash);
        return decoded.length ? Number(decoded[0]) : null;
    } catch {
        return null;
    }
}

export function encodeShareCode(id: number | string | null | undefined): string | null {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) return null;
    return shareHash.encode(num);
}

export function decodeShareCode(hash: string | null | undefined): number | null {
    if (!hash) return null;
    try {
        const decoded = shareHash.decode(hash);
        return decoded.length ? Number(decoded[0]) : null;
    } catch {
        return null;
    }
}
