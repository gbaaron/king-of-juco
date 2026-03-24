const Airtable = require('airtable');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        const params = event.queryStringParameters || {};
        const category = params.category || null;
        const drop = params.drop || null;

        let filter = '{IsActive} = TRUE()';
        if (drop === 'active') {
            filter = 'AND({IsActive} = TRUE(), {IsLimitedDrop} = TRUE())';
        } else if (category) {
            filter = `AND({IsActive} = TRUE(), {Category} = '${category.replace(/'/g, "\\'")}')`;
        }

        const records = [];
        await base('MerchProducts').select({
            filterByFormula: filter,
            sort: [{ field: 'SortOrder', direction: 'asc' }]
        }).eachPage((page, next) => {
            page.forEach(r => {
                records.push({
                    id: r.id, productName: r.get('ProductName') || '', description: r.get('Description') || '',
                    price: r.get('Price') || 0, thumbnailURL: r.get('ThumbnailURL') || '',
                    imageURLs: r.get('ImageURLs') || '', category: r.get('Category') || '',
                    sizes: r.get('Sizes') || [], stockQuantity: r.get('StockQuantity') || 0,
                    isLimitedDrop: r.get('IsLimitedDrop') || false,
                    dropStartTime: r.get('DropStartTime') || '', dropEndTime: r.get('DropEndTime') || '',
                    linkedVideoURL: r.get('LinkedVideoURL') || ''
                });
            });
            next();
        });

        return { statusCode: 200, body: JSON.stringify({ products: records }) };
    } catch (error) {
        console.error('Get merch error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch merch' }) };
    }
};
