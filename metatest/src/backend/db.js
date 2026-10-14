//db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// Windows treats host "localhost" as a named pipe. If MySQL is only listening
// on TCP, that pipe hangs until ETIMEDOUT and login/OTP never reach the SMS panel.
function resolveDbHost(raw) {
    const host = String(raw || 'localhost').trim() || 'localhost';
    if (process.platform === 'win32' && (host === 'localhost' || host === '::1')) {
        return '127.0.0.1';
    }
    return host;
}

const dbHost = resolveDbHost(process.env.DB_HOST);
const dbPort = Number(process.env.DB_PORT) || 3306;
const dbName = process.env.DB_NAME;

const pool = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 8000,
});

pool.query('SELECT 1')
    .then(() => {
        console.log(`[db] MySQL ok at ${dbHost}:${dbPort}/${dbName}`);
    })
    .catch((err) => {
        console.error(`[db] MySQL unreachable at ${dbHost}:${dbPort}/${dbName} (${err.code || err.message}).`);
        console.error('[db] ورود پیامکی تا وصل شدن دیتابیس جلو نمی‌رود. سرویس MySQL را روشن کن. اگر روشن است در .env مقدار DB_HOST را 127.0.0.1 بگذار و DB_PORT را با پورت واقعی (معمولاً 3306) یکی کن.');
    });

module.exports = pool;
