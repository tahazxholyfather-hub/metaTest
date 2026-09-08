'use strict';

const { RATE_LIMITS, featureStatus, unavailableReason } = require('./config');

/**
 * Per-user sliding-window rate limiter (in-process). Enough for a single
 * Node instance; swap the store for Redis if the API is ever scaled out.
 */
function rateLimit(name, perMinute) {
    const windowMs = 60 * 1000;
    const hits = new Map(); // key → [timestamps]
    let sweepAt = Date.now() + windowMs;

    return (req, res, next) => {
        const now = Date.now();
        if (now > sweepAt) {
            for (const [k, arr] of hits) {
                const kept = arr.filter((t) => now - t < windowMs);
                if (kept.length) hits.set(k, kept); else hits.delete(k);
            }
            sweepAt = now + windowMs;
        }
        const key = `${name}:${req.user?.id || req.ip}`;
        const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
        if (arr.length >= perMinute) {
            const retryAfter = Math.ceil((windowMs - (now - arr[0])) / 1000);
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({
                success: false,
                code: 'RATE_LIMITED',
                message: 'درخواست‌ها زیاد شد؛ چند لحظه صبر کن و دوباره تلاش کن.',
                retryAfterSeconds: retryAfter,
            });
        }
        arr.push(now);
        hits.set(key, arr);
        next();
    };
}

const chatLimiter = rateLimit('chat', RATE_LIMITS.chatPerMinute);
const uploadLimiter = rateLimit('upload', RATE_LIMITS.uploadsPerMinute);
const voiceLimiter = rateLimit('voice', RATE_LIMITS.voicePerMinute);

/** Blocks AI-powered endpoints when the subsystem is switched off or unconfigured. */
function requireAi(req, res, next) {
    if (featureStatus().aiAvailable) return next();
    return res.status(503).json({
        success: false,
        code: unavailableReason() || 'AI_UNAVAILABLE',
        message: 'مِت فعلاً در دسترس نیست. بقیه‌ی امکانات متاتست بدون مشکل کار می‌کنند.',
    });
}

/** Blocks a specific optional capability (vision, stt, tts, …) when disabled. */
function requireFeature(feature, message) {
    return (req, res, next) => {
        const f = featureStatus();
        if (!f.aiAvailable) return requireAi(req, res, next);
        if (f[feature]) return next();
        return res.status(403).json({ success: false, code: 'FEATURE_DISABLED', feature, message });
    };
}

module.exports = { rateLimit, chatLimiter, uploadLimiter, voiceLimiter, requireAi, requireFeature };
