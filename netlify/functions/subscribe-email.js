const Airtable = require('airtable');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { email, name, source } = JSON.parse(event.body);

        if (!email || !email.trim()) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Please enter a valid email' }) };
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

        // Check if already subscribed
        const existing = await base('EmailSubscribers').select({
            filterByFormula: `{Email} = '${email.trim().toLowerCase().replace(/'/g, "\\'")}'`,
            maxRecords: 1
        }).firstPage();

        if (existing.length > 0) {
            // If previously unsubscribed, reactivate
            if (!existing[0].get('IsActive')) {
                await base('EmailSubscribers').update(existing[0].id, { IsActive: true });
                return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Welcome back! You\'re resubscribed.' }) };
            }
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'You\'re already subscribed!' }) };
        }

        await base('EmailSubscribers').create([{
            fields: {
                Email: email.trim().toLowerCase(),
                Name: (name || '').trim(),
                Source: source || 'hero_form',
                SubscribedAt: new Date().toISOString().split('T')[0],
                IsActive: true
            }
        }]);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'You\'re in! Welcome to the inner circle.' })
        };

    } catch (error) {
        console.error('Subscribe error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) };
    }
};
