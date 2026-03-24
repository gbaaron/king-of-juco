const Airtable = require('airtable');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const token = event.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'king-of-juco-secret-change-in-production');
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        const { name, favoriteTeam, currentPassword, newPassword } = JSON.parse(event.body);

        const updates = {};

        if (name && name.trim()) updates.Name = name.trim();
        if (favoriteTeam !== undefined) updates.FavoriteTeam = favoriteTeam.trim();

        // Password change
        if (newPassword) {
            if (!currentPassword) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Current password is required' }) };
            }
            if (newPassword.length < 8) {
                return { statusCode: 400, body: JSON.stringify({ error: 'New password must be at least 8 characters' }) };
            }

            const user = await base('Users').find(decoded.userId);
            const isValid = await bcrypt.compare(currentPassword, user.get('PasswordHash'));
            if (!isValid) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Current password is incorrect' }) };
            }
            updates.PasswordHash = await bcrypt.hash(newPassword, 10);
        }

        if (Object.keys(updates).length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'No changes to save' }) };
        }

        await base('Users').update(decoded.userId, updates);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Profile updated' })
        };

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired token' }) };
        }
        console.error('Update user error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
};
