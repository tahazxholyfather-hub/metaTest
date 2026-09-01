require('dotenv').config();

const extractToken = (req) => {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    const match = authHeader.match(/Bearer\s(\S+)/);
    if (match) return match[1];

    const appToken = req.headers['x-app-token'] || req.headers['X-APP-TOKEN'];
    if (appToken) return appToken;

    if (req.body && req.body.token) return req.body.token;

    return null;
};

const requireToken = (req, res, next) => {
    const token = extractToken(req);
    const serverToken = process.env.APP_TOKEN;

    if (!token) {
        return res.json({ success: false, message: 'Token is required' });
    }

    if (!serverToken) {
        return res.json({ success: false, message: 'Server token not configured' });
    }

    // Equivalent to PHP's hash_equals check
    if (token !== serverToken) {
        return res.json({ success: false, message: 'Invalid token' });
    }

    next();
};

module.exports = { requireToken };
