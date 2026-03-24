const Airtable = require('airtable');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const token = event.headers.authorization?.replace('Bearer ', '');
        if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'king-of-juco-secret-change-in-production');
        if (!decoded.isAdmin) return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };

        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        const type = event.queryStringParameters?.type || 'challenges';
        const records = [];

        const tableMap = {
            challenges: { table: 'Challenges', filter: `{Status} = 'pending'` },
            questions: { table: 'Questions', filter: `{Status} = 'pending'` },
            orders: { table: 'MerchOrders', filter: '' },
            subscribers: { table: 'EmailSubscribers', filter: '{IsActive} = TRUE()' },
            content: { table: 'MembershipContent', filter: '' },
            predictions: { table: 'PredictionEvents', filter: '' },
            timeline: { table: 'TimelineEvents', filter: '' }
        };

        const config = tableMap[type];
        if (!config) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid type' }) };

        const opts = {};
        if (config.filter) opts.filterByFormula = config.filter;

        await base(config.table).select(opts).eachPage((page, next) => {
            page.forEach(r => {
                const fields = {};
                Object.keys(r.fields).forEach(k => { fields[k] = r.fields[k]; });
                records.push({ id: r.id, fields });
            });
            next();
        });

        return { statusCode: 200, body: JSON.stringify({ records, type }) };
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }
        console.error('Admin get error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
};
