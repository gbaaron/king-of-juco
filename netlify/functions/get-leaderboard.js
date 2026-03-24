const Airtable = require('airtable');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        const limit = parseInt(event.queryStringParameters?.limit) || 50;

        const records = [];
        await base('Users').select({
            sort: [{ field: 'Points', direction: 'desc' }],
            maxRecords: limit,
            fields: ['Username', 'Name', 'Points']
        }).eachPage((page, next) => {
            page.forEach(r => {
                const pts = r.get('Points') || 0;
                if (pts > 0) {
                    records.push({
                        username: r.get('Username') || r.get('Name') || 'Anonymous',
                        points: pts
                    });
                }
            });
            next();
        });

        const leaderboard = records.map((r, i) => ({ rank: i + 1, ...r }));

        return { statusCode: 200, body: JSON.stringify({ leaderboard }) };
    } catch (error) {
        console.error('Get leaderboard error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch leaderboard' }) };
    }
};
