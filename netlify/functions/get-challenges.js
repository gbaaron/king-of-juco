const Airtable = require('airtable');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        const params = event.queryStringParameters || {};
        const status = params.status || 'approved';
        const category = params.category || null;
        const sort = params.sort || 'votes';
        const limit = parseInt(params.limit) || 50;

        let filter = `{Status} = '${status}'`;
        if (category) {
            filter = `AND({Status} = '${status}', {Category} = '${category.replace(/'/g, "\\'")}')`;
        }

        const records = [];
        await base('Challenges').select({
            filterByFormula: filter,
            sort: [{ field: sort === 'votes' ? 'VoteCount' : 'SubmittedAt', direction: 'desc' }],
            maxRecords: limit
        }).eachPage((page, next) => {
            page.forEach(r => {
                records.push({
                    id: r.id, title: r.get('Title') || '', description: r.get('Description') || '',
                    videoURL: r.get('VideoURL') || '', thumbnailURL: r.get('ThumbnailURL') || '',
                    submitterName: r.get('SubmitterName') || 'Anonymous', status: r.get('Status') || '',
                    category: r.get('Category') || '', voteCount: r.get('VoteCount') || 0,
                    submittedAt: r.get('SubmittedAt') || ''
                });
            });
            next();
        });

        return { statusCode: 200, body: JSON.stringify({ challenges: records }) };
    } catch (error) {
        console.error('Get challenges error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch challenges' }) };
    }
};
