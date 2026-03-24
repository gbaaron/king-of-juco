const Airtable = require('airtable');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        const params = event.queryStringParameters || {};
        const season = params.season || '2026';
        const status = params.status || null;

        let filter = `{Season} = '${season}'`;
        if (status) {
            filter = `AND({Season} = '${season}', {Status} = '${status}')`;
        }

        const events = [];
        await base('PredictionEvents').select({
            filterByFormula: filter,
            sort: [{ field: 'OpensAt', direction: 'desc' }]
        }).eachPage((page, next) => {
            page.forEach(r => {
                events.push({
                    id: r.id, eventName: r.get('EventName') || '', description: r.get('Description') || '',
                    season: r.get('Season') || '', eventType: r.get('EventType') || '',
                    status: r.get('Status') || '', opensAt: r.get('OpensAt') || '',
                    locksAt: r.get('LocksAt') || '', correctAnswer: r.get('CorrectAnswer') || '',
                    pointsPerCorrect: r.get('PointsPerCorrect') || 10
                });
            });
            next();
        });

        // If authenticated, get user's predictions too
        let userPredictions = [];
        const token = event.headers.authorization?.replace('Bearer ', '');
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'king-of-juco-secret-change-in-production');
                await base('Predictions').select({
                    filterByFormula: `AND({Season} = '${season}', FIND('${decoded.userId}', ARRAYJOIN({User})))`,
                }).eachPage((page, next) => {
                    page.forEach(r => {
                        userPredictions.push({
                            id: r.id, eventId: (r.get('EventID') || [''])[0],
                            predictionType: r.get('PredictionType') || '',
                            teamOrPlayer: r.get('TeamOrPlayer') || '',
                            predictionValue: r.get('PredictionValue') || '',
                            isCorrect: r.get('IsCorrect') || false,
                            pointsAwarded: r.get('PointsAwarded') || 0,
                            submittedAt: r.get('SubmittedAt') || ''
                        });
                    });
                    next();
                });
            } catch (e) { /* invalid token */ }
        }

        return { statusCode: 200, body: JSON.stringify({ events, userPredictions }) };
    } catch (error) {
        console.error('Get predictions error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch predictions' }) };
    }
};
