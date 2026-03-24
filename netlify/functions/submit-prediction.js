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
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
        const { eventId, predictionType, teamOrPlayer, predictionValue } = JSON.parse(event.body);

        if (!eventId || !predictionValue) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Event and prediction value are required' }) };
        }

        // Check event is open
        const predEvent = await base('PredictionEvents').find(eventId);
        if (predEvent.get('Status') !== 'open') {
            return { statusCode: 400, body: JSON.stringify({ error: 'This prediction event is no longer open' }) };
        }

        // Check for duplicate
        const existing = await base('Predictions').select({
            filterByFormula: `AND(FIND('${decoded.userId}', ARRAYJOIN({User})), FIND('${eventId}', ARRAYJOIN({EventID})))`,
            maxRecords: 1
        }).firstPage();

        if (existing.length > 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'You already submitted a prediction for this event' }) };
        }

        const user = await base('Users').find(decoded.userId);
        const predictionId = `PRED-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

        await base('Predictions').create([{
            fields: {
                PredictionID: predictionId, User: [decoded.userId],
                UserName: user.get('Username') || user.get('Name'),
                Season: predEvent.get('Season') || '2026',
                PredictionType: predictionType || predEvent.get('EventType') || 'custom',
                TeamOrPlayer: (teamOrPlayer || '').trim(),
                PredictionValue: predictionValue.trim(),
                IsCorrect: false, PointsAwarded: 0,
                SubmittedAt: new Date().toISOString().split('T')[0],
                EventID: [eventId]
            }
        }]);

        await base('Users').update(decoded.userId, { Points: (user.get('Points') || 0) + 5 });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }
        console.error('Submit prediction error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to submit prediction' }) };
    }
};
