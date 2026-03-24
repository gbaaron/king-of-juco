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
        const { challengeId } = JSON.parse(event.body);

        if (!challengeId) return { statusCode: 400, body: JSON.stringify({ error: 'Challenge ID required' }) };

        const voteId = `${decoded.userId}-${challengeId}`;
        const existing = await base('ChallengeVotes').select({
            filterByFormula: `{VoteID} = '${voteId}'`, maxRecords: 1
        }).firstPage();

        if (existing.length > 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Already voted' }) };
        }

        await base('ChallengeVotes').create([{
            fields: {
                VoteID: voteId, User: [decoded.userId], Challenge: [challengeId],
                VotedAt: new Date().toISOString().split('T')[0]
            }
        }]);

        const challenge = await base('Challenges').find(challengeId);
        await base('Challenges').update(challengeId, { VoteCount: (challenge.get('VoteCount') || 0) + 1 });

        const user = await base('Users').find(decoded.userId);
        await base('Users').update(decoded.userId, { Points: (user.get('Points') || 0) + 1 });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }
        console.error('Vote error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to vote' }) };
    }
};
