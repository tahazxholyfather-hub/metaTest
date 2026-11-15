'use strict';

const pool = require('../db');
const { hashPassword } = require('../utils/password');
const { SUPER_ADMIN_ID, publicAdmin, isSuperAdmin } = require('../middleware/adminAuth');

const ROLES = ['admin', 'selector', 'typing'];

function validUsername(v) {
    return /^[a-zA-Z0-9._-]{3,50}$/.test(String(v || '').trim());
}

const handleListAdmins = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, username, full_name, role, status, last_login, last_login_ip, created_at
             FROM tam24_admins ORDER BY id ASC`
        );
        return res.json({ success: true, admins: rows.map(publicAdmin) });
    } catch (error) {
        console.error('List admins error:', error);
        return res.status(500).json({ success: false, message: 'بارگذاری ادمین‌ها ناموفق بود' });
    }
};

const handleCreateAdmin = async (req, res) => {
    try {
        const username = String(req.body.username || '').trim();
        const password = String(req.body.password || '');
        const fullName = String(req.body.fullName || req.body.full_name || username).trim();
        const role = ROLES.includes(req.body.role) ? req.body.role : 'admin';

        if (!validUsername(username)) {
            return res.json({ success: false, message: 'نام کاربری باید ۳ تا ۵۰ حرف، عدد، نقطه، خط زیر یا خط تیره باشد.' });
        }
        if (password.length < 8) {
            return res.json({ success: false, message: 'رمز باید حداقل ۸ کاراکتر باشد.' });
        }

        const hashed = await hashPassword(password);
        const [result] = await pool.query(
            `INSERT INTO tam24_admins (username, password, full_name, role, status, created_by)
             VALUES (?, ?, ?, ?, 'active', ?)`,
            [username, hashed, fullName, role, req.admin.id]
        );
        const created = publicAdmin({
            id: result.insertId, username, full_name: fullName, role, status: 'active',
        });
        return res.json({ success: true, admin: created });
    } catch (error) {
        if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)) {
            return res.json({ success: false, message: 'این نام کاربری قبلاً گرفته شده.' });
        }
        console.error('Create admin error:', error);
        return res.status(500).json({ success: false, message: 'ساخت ادمین ناموفق بود' });
    }
};

const handleUpdateAdmin = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.json({ success: false, message: 'شناسه ادمین نامعتبر است' });
        }

        const [[existing]] = await pool.query(`SELECT * FROM tam24_admins WHERE id = ? LIMIT 1`, [id]);
        if (!existing) return res.json({ success: false, message: 'ادمین پیدا نشد' });
        if (id === SUPER_ADMIN_ID && !isSuperAdmin(req.admin)) {
            return res.status(403).json({ success: false, message: 'فقط مدیر اصلی می‌تواند این حساب را تغییر دهد.' });
        }

        const updates = [];
        const params = [];

        if (req.body.fullName != null || req.body.full_name != null) {
            updates.push('full_name = ?');
            params.push(String(req.body.fullName || req.body.full_name).trim());
        }

        if (req.body.username != null) {
            const username = String(req.body.username).trim();
            if (!validUsername(username)) {
                return res.json({ success: false, message: 'نام کاربری نامعتبر است' });
            }
            updates.push('username = ?');
            params.push(username);
        }

        if (req.body.role != null) {
            if (id === SUPER_ADMIN_ID) {
                // Super admin keeps a super role marker; other labels are allowed as extra.
            }
            const role = String(req.body.role);
            if (id === SUPER_ADMIN_ID) {
                updates.push('role = ?');
                params.push(role === 'super' ? 'super' : 'super');
            } else if (ROLES.includes(role)) {
                updates.push('role = ?');
                params.push(role);
            }
        }

        if (req.body.status != null) {
            const status = req.body.status === 'disabled' ? 'disabled' : 'active';
            if (id === SUPER_ADMIN_ID && status === 'disabled') {
                return res.json({ success: false, message: 'مدیر اصلی را نمی‌توان غیرفعال کرد.' });
            }
            updates.push('status = ?');
            params.push(status);
        }

        if (req.body.password) {
            if (String(req.body.password).length < 8) {
                return res.json({ success: false, message: 'رمز باید حداقل ۸ کاراکتر باشد.' });
            }
            updates.push('password = ?');
            params.push(await hashPassword(String(req.body.password)));
            updates.push('failed_attempts = 0');
            updates.push('locked_until = NULL');
        }

        if (!updates.length) {
            return res.json({ success: true, admin: publicAdmin(existing) });
        }

        params.push(id);
        await pool.query(`UPDATE tam24_admins SET ${updates.join(', ')} WHERE id = ?`, params);
        const [[row]] = await pool.query(`SELECT * FROM tam24_admins WHERE id = ? LIMIT 1`, [id]);
        return res.json({ success: true, admin: publicAdmin(row) });
    } catch (error) {
        if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)) {
            return res.json({ success: false, message: 'این نام کاربری قبلاً گرفته شده.' });
        }
        console.error('Update admin error:', error);
        return res.status(500).json({ success: false, message: 'به‌روزرسانی ادمین ناموفق بود' });
    }
};

const handleDeleteAdmin = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.json({ success: false, message: 'شناسه ادمین نامعتبر است' });
        }
        if (id === SUPER_ADMIN_ID) {
            return res.json({ success: false, message: 'مدیر اصلی را نمی‌توان حذف کرد.' });
        }
        if (id === Number(req.admin.id)) {
            return res.json({ success: false, message: 'نمی‌توانی حساب خودت را حذف کنی.' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await runOptional(connection, `DELETE FROM tam24_admin_section_access WHERE admin_id = ?`, [id]);
            await runOptional(connection, `UPDATE tam24_admin_section_access SET updated_by = NULL WHERE updated_by = ?`, [id]);
            await runOptional(connection, `UPDATE tam24_admins SET created_by = NULL WHERE created_by = ?`, [id]);
            const [result] = await connection.query(`DELETE FROM tam24_admins WHERE id = ?`, [id]);
            await connection.commit();
            if (result.affectedRows === 0) {
                return res.json({ success: false, message: 'ادمین پیدا نشد' });
            }
            return res.json({ success: true });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Delete admin error:', error);
        if (error && (error.errno === 1451 || error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED')) {
            return res.json({ success: false, message: 'این ادمین به داده‌های دیگر وصل است و حذف نشد. حساب را غیرفعال کن.' });
        }
        return res.status(500).json({ success: false, message: 'حذف ادمین ناموفق بود' });
    }
};

async function runOptional(connection, sql, params) {
    try {
        await connection.query(sql, params);
    } catch (error) {
        if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146 || error.code === 'ER_BAD_FIELD_ERROR' || error.errno === 1054)) return;
        throw error;
    }
}

module.exports = {
    handleListAdmins,
    handleCreateAdmin,
    handleUpdateAdmin,
    handleDeleteAdmin,
};
