'use strict';

const pool = require('../db');
const { hashPassword } = require('../utils/password');
const { SUPER_ADMIN_ID, publicAdmin } = require('../middleware/adminAuth');

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
        return res.status(500).json({ success: false, message: 'Failed to list admins' });
    }
};

const handleCreateAdmin = async (req, res) => {
    try {
        const username = String(req.body.username || '').trim();
        const password = String(req.body.password || '');
        const fullName = String(req.body.fullName || req.body.full_name || username).trim();
        const role = ROLES.includes(req.body.role) ? req.body.role : 'admin';

        if (!validUsername(username)) {
            return res.json({ success: false, message: 'Username must be 3–50 letters, numbers, dots, underscores or hyphens.' });
        }
        if (password.length < 8) {
            return res.json({ success: false, message: 'Password must be at least 8 characters.' });
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
            return res.json({ success: false, message: 'That username is already taken.' });
        }
        console.error('Create admin error:', error);
        return res.status(500).json({ success: false, message: 'Failed to create admin' });
    }
};

const handleUpdateAdmin = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.json({ success: false, message: 'Invalid admin id' });
        }

        const [[existing]] = await pool.query(`SELECT * FROM tam24_admins WHERE id = ? LIMIT 1`, [id]);
        if (!existing) return res.json({ success: false, message: 'Admin not found' });

        const updates = [];
        const params = [];

        if (req.body.fullName != null || req.body.full_name != null) {
            updates.push('full_name = ?');
            params.push(String(req.body.fullName || req.body.full_name).trim());
        }

        if (req.body.username != null) {
            const username = String(req.body.username).trim();
            if (!validUsername(username)) {
                return res.json({ success: false, message: 'Invalid username' });
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
                return res.json({ success: false, message: 'The main admin cannot be disabled.' });
            }
            updates.push('status = ?');
            params.push(status);
        }

        if (req.body.password) {
            if (String(req.body.password).length < 8) {
                return res.json({ success: false, message: 'Password must be at least 8 characters.' });
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
            return res.json({ success: false, message: 'That username is already taken.' });
        }
        console.error('Update admin error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update admin' });
    }
};

const handleDeleteAdmin = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.json({ success: false, message: 'Invalid admin id' });
        }
        if (id === SUPER_ADMIN_ID) {
            return res.json({ success: false, message: 'The main admin cannot be deleted.' });
        }
        if (id === req.admin.id) {
            return res.json({ success: false, message: 'You cannot delete your own account.' });
        }
        const [result] = await pool.query(`DELETE FROM tam24_admins WHERE id = ?`, [id]);
        if (result.affectedRows === 0) {
            return res.json({ success: false, message: 'Admin not found' });
        }
        return res.json({ success: true });
    } catch (error) {
        console.error('Delete admin error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete admin' });
    }
};

module.exports = {
    handleListAdmins,
    handleCreateAdmin,
    handleUpdateAdmin,
    handleDeleteAdmin,
};
