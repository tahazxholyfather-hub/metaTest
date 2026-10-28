'use strict';

const { packageSeed } = require('./notifications');

let ready = null;

async function ensureCoinPackages(db) {
    await db.query(`
        CREATE TABLE IF NOT EXISTS tam24_coin_packages (
            id VARCHAR(40) NOT NULL,
            coins INT NOT NULL,
            price_toman INT NOT NULL,
            title VARCHAR(80) NOT NULL,
            subtitle VARCHAR(120) NULL,
            popular TINYINT(1) NOT NULL DEFAULT 0,
            active TINYINT(1) NOT NULL DEFAULT 1,
            sort_order INT NOT NULL DEFAULT 0,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    const [[count]] = await db.query(`SELECT COUNT(*) AS total FROM tam24_coin_packages`);
    if (Number(count?.total) > 0) return;
    for (const pack of packageSeed()) {
        await db.query(
            `INSERT INTO tam24_coin_packages (id, coins, price_toman, title, subtitle, popular, active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [pack.id, pack.coins, pack.priceToman, pack.title, pack.subtitle, pack.popular, pack.active, pack.sortOrder]
        );
    }
}

function whenReady(db) {
    if (!ready) {
        ready = ensureCoinPackages(db).catch((err) => {
            ready = null;
            throw err;
        });
    }
    return ready;
}

function mapPack(row) {
    return {
        id: row.id,
        coins: Number(row.coins) || 0,
        priceToman: Number(row.price_toman) || 0,
        title: row.title,
        subtitle: row.subtitle || '',
        popular: Number(row.popular) === 1,
        active: Number(row.active) === 1,
        sortOrder: Number(row.sort_order) || 0,
    };
}

async function listCoinPackages(db, { activeOnly = false } = {}) {
    await whenReady(db);
    const [rows] = await db.query(
        `SELECT id, coins, price_toman, title, subtitle, popular, active, sort_order
         FROM tam24_coin_packages
         ${activeOnly ? 'WHERE active = 1' : ''}
         ORDER BY sort_order ASC, coins ASC`
    );
    return rows.map(mapPack);
}

async function findCoinPackage(db, id) {
    const packs = await listCoinPackages(db, { activeOnly: true });
    return packs.find((pack) => pack.id === String(id || '')) || null;
}

function validPackageId(id) {
    return /^[a-z][a-z0-9-]{1,39}$/.test(String(id || ''));
}

async function saveCoinPackages(db, packages) {
    if (!Array.isArray(packages) || !packages.length) {
        return { ok: false, message: 'حداقل یک بسته لازم است.' };
    }
    if (packages.length > 12) return { ok: false, message: 'حداکثر ۱۲ بسته می‌توان تعریف کرد.' };
    await whenReady(db);
    const seen = new Set();
    const clean = [];
    for (const raw of packages) {
        const id = String(raw.id || '').trim().toLowerCase();
        const coins = Math.floor(Number(raw.coins));
        const priceToman = Math.floor(Number(raw.priceToman ?? raw.price_toman));
        const title = String(raw.title || '').trim().slice(0, 80);
        const subtitle = String(raw.subtitle || '').trim().slice(0, 120);
        if (!validPackageId(id)) return { ok: false, message: 'شناسه بسته باید با حرف انگلیسی شروع شود.' };
        if (seen.has(id)) return { ok: false, message: 'شناسه بسته‌ها تکراری است.' };
        seen.add(id);
        if (!Number.isInteger(coins) || coins < 1 || coins > 1000000) return { ok: false, message: 'تعداد سکه نامعتبر است.' };
        if (!Number.isInteger(priceToman) || priceToman < 1000) return { ok: false, message: 'قیمت هر بسته حداقل ۱۰۰۰ تومان است.' };
        if (!title) return { ok: false, message: 'عنوان بسته لازم است.' };
        clean.push({
            id, coins, priceToman, title, subtitle,
            popular: raw.popular ? 1 : 0,
            active: raw.active === false ? 0 : 1,
            sortOrder: clean.length + 1,
        });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const ids = clean.map((pack) => pack.id);
        await connection.query(
            `DELETE FROM tam24_coin_packages WHERE id NOT IN (${ids.map(() => '?').join(',')})`,
            ids
        );
        for (const pack of clean) {
            await connection.query(
                `INSERT INTO tam24_coin_packages (id, coins, price_toman, title, subtitle, popular, active, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE coins = VALUES(coins), price_toman = VALUES(price_toman), title = VALUES(title),
                    subtitle = VALUES(subtitle), popular = VALUES(popular), active = VALUES(active), sort_order = VALUES(sort_order)`,
                [pack.id, pack.coins, pack.priceToman, pack.title, pack.subtitle, pack.popular, pack.active, pack.sortOrder]
            );
        }
        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
    return { ok: true, packages: await listCoinPackages(db) };
}

module.exports = {
    listCoinPackages,
    findCoinPackage,
    saveCoinPackages,
    validPackageId,
};
