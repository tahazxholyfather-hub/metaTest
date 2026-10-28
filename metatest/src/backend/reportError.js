'use strict';

const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'error.log');

function reportError(label, error) {
    const code = error && error.code ? String(error.code) : '';
    const message = error && (error.sqlMessage || error.message)
        ? String(error.sqlMessage || error.message)
        : String(error);
    const stack = error && error.stack ? String(error.stack) : '';
    const line = `${new Date().toISOString()} ${label} ${code} ${message}\n${stack}\n`;

    try {
        fs.appendFileSync(logFile, line);
    } catch (_) {}

    try {
        fs.writeSync(process.stderr.fd, line);
    } catch (_) {}

    return {
        code,
        message: message.slice(0, 300),
    };
}

module.exports = { reportError, logFile };
