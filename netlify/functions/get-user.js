const Airtable = require('airtable');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const token = event.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'king-of-juco-secret-change-in-production');
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

        const user = await base('Users').find(decoded.userId);

        return {
            statusCode: 200,
            body: JSON.stringify({
                userId: user.id,
                name: user.get('Name'),
                email: user.get('Email'),
                username: user.get('Username'),
                membershipTier: user.get('MembershipTier') || 'free',
                favoriteTeam: user.get('FavoriteTeam') || '',
                points: user.get('Points') || 0,
                memberSince: user.get('MemberSince') || '',
                isAdmin: user.get('IsAdmin') || false
            })
        };

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired token' }) };
        }
        console.error('Get user error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
};
