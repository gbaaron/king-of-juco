const Airtable = require('airtable');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const token = event.headers.authorization?.replace('Bearer ', '');
        if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'king-of-juco-secret-change-in-production');
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        const { questionText, targetPlayer, category } = JSON.parse(event.body);

        if (!questionText || !questionText.trim()) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Question is required' }) };
        }

        const user = await base('Users').find(decoded.userId);
        await base('Questions').create([{
            fields: {
                QuestionText: questionText.trim(),
                TargetPlayer: (targetPlayer || '').trim(),
                Category: category || 'career',
                SubmittedBy: [decoded.userId],
                SubmitterName: user.get('Username') || user.get('Name'),
                Status: 'pending',
                UpvoteCount: 0,
                SubmittedAt: new Date().toISOString().split('T')[0]
            }
        }]);

        await base('Users').update(decoded.userId, { Points: (user.get('Points') || 0) + 5 });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }
        console.error('Submit question error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to submit question' }) };
    }
};
