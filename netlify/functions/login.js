const Airtable = require('airtable');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { email, password } = JSON.parse(event.body);

        if (!email || !password) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Email and password are required' }) };
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

        const records = await base('Users').select({
            filterByFormula: `{Email} = '${email.trim().toLowerCase().replace(/'/g, "\\'")}'`,
            maxRecords: 1
        }).firstPage();

        if (records.length === 0) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid email or password' }) };
        }

        const user = records[0];
        const isValid = await bcrypt.compare(password, user.get('PasswordHash'));

        if (!isValid) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid email or password' }) };
        }

        const token = jwt.sign(
            { userId: user.id, email: user.get('Email'), isAdmin: user.get('IsAdmin') || false },
            process.env.JWT_SECRET || 'king-of-juco-secret-change-in-production',
            { expiresIn: '7d' }
        );

        // Update last login
        try {
            await base('Users').update(user.id, { LastLogin: new Date().toISOString().split('T')[0] });
        } catch (e) {
            console.error('Update last login error:', e);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                token,
                userId: user.id,
                name: user.get('Name'),
                email: user.get('Email'),
                username: user.get('Username'),
                points: user.get('Points') || 0,
                tier: user.get('MembershipTier') || 'free',
                isAdmin: user.get('IsAdmin') || false,
                favoriteTeam: user.get('FavoriteTeam') || ''
            })
        };

    } catch (error) {
        console.error('Login error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
};
