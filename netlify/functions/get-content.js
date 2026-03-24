const Airtable = require('airtable');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        const params = event.queryStringParameters || {};
        const category = params.category || null;
        const limit = parseInt(params.limit) || 50;

        let userTier = 'free';
        const token = event.headers.authorization?.replace('Bearer ', '');
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'king-of-juco-secret-change-in-production');
                const user = await base('Users').find(decoded.userId);
                userTier = user.get('MembershipTier') || 'free';
            } catch (e) { /* treat as free */ }
        }

        let filter = '{IsPublished} = TRUE()';
        if (category) {
            filter = `AND({IsPublished} = TRUE(), {Category} = '${category.replace(/'/g, "\\'")}')`;
        }

        const records = [];
        await base('MembershipContent').select({
            filterByFormula: filter,
            sort: [{ field: 'PublishedAt', direction: 'desc' }],
            maxRecords: limit
        }).eachPage((page, next) => {
            page.forEach(r => {
                const item = {
                    id: r.id, title: r.get('Title') || '', slug: r.get('Slug') || '',
                    contentType: r.get('ContentType') || '', description: r.get('Description') || '',
                    thumbnailURL: r.get('ThumbnailURL') || '', accessTier: r.get('AccessTier') || 'free',
                    category: r.get('Category') || '', publishedAt: r.get('PublishedAt') || ''
                };
                if (item.accessTier === 'free' || userTier === 'mvp') {
                    item.contentURL = r.get('ContentURL') || '';
                    item.embedCode = r.get('EmbedCode') || '';
                }
                records.push(item);
            });
            next();
        });

        return { statusCode: 200, body: JSON.stringify({ content: records, userTier }) };
    } catch (error) {
        console.error('Get content error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch content' }) };
    }
};
