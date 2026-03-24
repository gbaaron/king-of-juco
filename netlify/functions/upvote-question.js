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
        const { questionId } = JSON.parse(event.body);

        if (!questionId) return { statusCode: 400, body: JSON.stringify({ error: 'Question ID required' }) };

        const upvoteId = `${decoded.userId}-${questionId}`;
        const existing = await base('QuestionUpvotes').select({
            filterByFormula: `{UpvoteID} = '${upvoteId}'`, maxRecords: 1
        }).firstPage();

        if (existing.length > 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Already upvoted' }) };
        }

        await base('QuestionUpvotes').create([{
            fields: {
                UpvoteID: upvoteId, User: [decoded.userId], Question: [questionId],
                UpvotedAt: new Date().toISOString().split('T')[0]
            }
        }]);

        const question = await base('Questions').find(questionId);
        await base('Questions').update(questionId, { UpvoteCount: (question.get('UpvoteCount') || 0) + 1 });

        const user = await base('Users').find(decoded.userId);
        await base('Users').update(decoded.userId, { Points: (user.get('Points') || 0) + 1 });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }
        console.error('Upvote error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to upvote' }) };
    }
};
