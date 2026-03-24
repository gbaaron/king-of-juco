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
        if (!decoded.isAdmin) return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };

        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        const { action, table, recordId, fields } = JSON.parse(event.body);

        if (!table) return { statusCode: 400, body: JSON.stringify({ error: 'Table is required' }) };

        if (action === 'create') {
            const created = await base(table).create([{ fields }]);
            return { statusCode: 200, body: JSON.stringify({ success: true, id: created[0].id }) };
        }

        if (action === 'update') {
            if (!recordId) return { statusCode: 400, body: JSON.stringify({ error: 'Record ID required' }) };
            await base(table).update(recordId, fields);

            // Special: resolve prediction event -> award points
            if (table === 'PredictionEvents' && fields.Status === 'resolved' && fields.CorrectAnswer) {
                const predictions = [];
                await base('Predictions').select({
                    filterByFormula: `FIND('${recordId}', ARRAYJOIN({EventID}))`
                }).eachPage((page, next) => {
                    page.forEach(r => predictions.push(r));
                    next();
                });

                const evt = await base('PredictionEvents').find(recordId);
                const pointsPerCorrect = evt.get('PointsPerCorrect') || 10;

                for (const pred of predictions) {
                    const isCorrect = pred.get('PredictionValue')?.toLowerCase().trim() === fields.CorrectAnswer.toLowerCase().trim();
                    const updates = { IsCorrect: isCorrect, PointsAwarded: isCorrect ? pointsPerCorrect : 0 };
                    await base('Predictions').update(pred.id, updates);

                    if (isCorrect) {
                        const userId = (pred.get('User') || [''])[0];
                        if (userId) {
                            const user = await base('Users').find(userId);
                            await base('Users').update(userId, { Points: (user.get('Points') || 0) + pointsPerCorrect });
                        }
                    }
                }
            }

            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        if (action === 'delete') {
            if (!recordId) return { statusCode: 400, body: JSON.stringify({ error: 'Record ID required' }) };
            await base(table).destroy(recordId);
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action' }) };
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }
        console.error('Admin update error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
    }
};
