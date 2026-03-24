const Airtable = require('airtable');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        const category = event.queryStringParameters?.category || null;

        const queryOptions = { sort: [{ field: 'SortOrder', direction: 'asc' }] };
        if (category) {
            queryOptions.filterByFormula = `{Category} = '${category.replace(/'/g, "\\'")}'`;
        }

        const records = [];
        await base('TimelineEvents').select(queryOptions).eachPage((page, next) => {
            page.forEach(r => {
                records.push({
                    id: r.id,
                    title: r.get('Title') || '',
                    date: r.get('Date') || '',
                    year: r.get('Year') || '',
                    description: r.get('Description') || '',
                    imageURL: r.get('ImageURL') || '',
                    videoURL: r.get('VideoURL') || '',
                    category: r.get('Category') || '',
                    isKeyMoment: r.get('IsKeyMoment') || false,
                    sortOrder: r.get('SortOrder') || 0,
                    quoteText: r.get('QuoteText') || ''
                });
            });
            next();
        });

        return { statusCode: 200, body: JSON.stringify({ events: records }) };
    } catch (error) {
        console.error('Get timeline error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch timeline' }) };
    }
};
