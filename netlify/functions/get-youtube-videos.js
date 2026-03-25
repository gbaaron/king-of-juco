const Airtable = require('airtable');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        const limit = parseInt(event.queryStringParameters?.limit) || 3;

        const records = [];
        await base('YouTubeVideos').select({
            filterByFormula: '{IsActive} = TRUE()',
            sort: [{ field: 'SortOrder', direction: 'asc' }],
            maxRecords: limit
        }).eachPage((page, next) => {
            page.forEach(r => {
                records.push({
                    id: r.id,
                    title: r.get('Title') || '',
                    youtubeId: r.get('YouTubeID') || '',
                    sortOrder: r.get('SortOrder') || 0
                });
            });
            next();
        });

        return { statusCode: 200, body: JSON.stringify({ videos: records }) };
    } catch (error) {
        console.error('Get youtube videos error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch videos' }) };
    }
};
