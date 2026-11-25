'use strict';

const crypto = require('crypto');

function isLoopback(req) {
    const addr = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
    return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function keysMatch(provided, expected) {
    if (!provided || !expected) return false;
    const a = Buffer.from(String(provided));
    const b = Buffer.from(String(expected));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/**
 * SEC-015 / SEC-037. The public cPanel vhost proxies /api/internal/ to this
 * process, and that connection arrives from 127.0.0.1, so the loopback check
 * alone is not enough. The env key is required as well. Direct access from
 * any other address is refused even if the key is known.
 */
function requireInternalService(req, res, next) {
    if (!isLoopback(req)) {
        return res.status(403).json({
            success: false,
            error: {
                code: 'INTERNAL_NOT_LOCAL',
                message: 'Unauthorized internal service request'
            }
        });
    }

    const configuredKey = process.env.INTERNAL_SERVICE_KEY || '';
    const providedKey = req.get('x-internal-service-key') || req.get('X-Internal-Service-Key');
    if (configuredKey.length < 16 || !keysMatch(providedKey, configuredKey)) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED_INTERNAL_REQUEST',
                message: 'Unauthorized internal service request'
            }
        });
    }

    next();
}

module.exports = { isLoopback, requireInternalService, keysMatch };
