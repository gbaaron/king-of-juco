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
        const { title, description, videoURL, category } = JSON.parse(event.body);

        if (!title || !title.trim()) return { statusCode: 400, body: JSON.stringify({ error: 'Title is required' }) };
        if (!videoURL || !videoURL.trim()) return { statusCode: 400, body: JSON.stringify({ error: 'Video URL is required' }) };

        const user = await base('Users').find(decoded.userId);
        const challenge = await base('Challenges').create([{
            fields: {
                Title: title.trim(),
                Description: (description || '').trim(),
                VideoURL: videoURL.trim(),
                Category: category || 'other',
                SubmittedBy: [decoded.userId],
                SubmitterName: user.get('Username') || user.get('Name'),
                Status: 'pending',
                VoteCount: 0,
                SubmittedAt: new Date().toISOString().split('T')[0]
            }
        }]);

        // Award 10 points
        const currentPoints = user.get('Points') || 0;
        await base('Users').update(decoded.userId, { Points: currentPoints + 10 });

        return { statusCode: 200, body: JSON.stringify({ success: true, challengeId: challenge[0].id }) };
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired token' }) };
        }
        console.error('Submit challenge error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to submit challenge' }) };
    }
};
