const Airtable = require('airtable');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        const params = event.queryStringParameters || {};
        const status = params.status || 'approved';
        const targetPlayer = params.targetPlayer || null;
        const sort = params.sort || 'upvotes';
        const limit = parseInt(params.limit) || 50;

        let filter = `{Status} = '${status}'`;
        if (targetPlayer) {
            filter = `AND({Status} = '${status}', FIND('${targetPlayer.replace(/'/g, "\\'")}', {TargetPlayer}))`;
        }

        const records = [];
        await base('Questions').select({
            filterByFormula: filter,
            sort: [{ field: sort === 'upvotes' ? 'UpvoteCount' : 'SubmittedAt', direction: 'desc' }],
            maxRecords: limit
        }).eachPage((page, next) => {
            page.forEach(r => {
                records.push({
                    id: r.id, questionText: r.get('QuestionText') || '',
                    submitterName: r.get('SubmitterName') || 'Anonymous',
                    targetPlayer: r.get('TargetPlayer') || '', status: r.get('Status') || '',
                    upvoteCount: r.get('UpvoteCount') || 0, answerText: r.get('AnswerText') || '',
                    answerVideoURL: r.get('AnswerVideoURL') || '', category: r.get('Category') || '',
                    submittedAt: r.get('SubmittedAt') || ''
                });
            });
            next();
        });

        return { statusCode: 200, body: JSON.stringify({ questions: records }) };
    } catch (error) {
        console.error('Get questions error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch questions' }) };
    }
};
