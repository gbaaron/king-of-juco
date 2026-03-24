const Airtable = require('airtable');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { name, email, username, password, favoriteTeam, marketingEmails } = JSON.parse(event.body);

        if (!name || !name.trim()) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Please enter your name' }) };
        }
        if (!email || !email.trim()) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Please enter your email' }) };
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Please enter a valid email address' }) };
        }
        if (!username || !username.trim() || username.trim().length < 3) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Username must be at least 3 characters' }) };
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Username can only contain letters, numbers, and underscores' }) };
        }
        if (!password || password.length < 8) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };
        }

        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

        // Check duplicate email
        const existingEmail = await base('Users').select({
            filterByFormula: `{Email} = '${email.trim().toLowerCase().replace(/'/g, "\\'")}'`,
            maxRecords: 1
        }).firstPage();

        if (existingEmail.length > 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'An account with this email already exists' }) };
        }

        // Check duplicate username
        const existingUsername = await base('Users').select({
            filterByFormula: `{Username} = '${username.trim().replace(/'/g, "\\'")}'`,
            maxRecords: 1
        }).firstPage();

        if (existingUsername.length > 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'That username is taken' }) };
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const fields = {
            Email: email.trim().toLowerCase(),
            Name: name.trim(),
            Username: username.trim(),
            PasswordHash: passwordHash,
            MembershipTier: 'free',
            Points: 0,
            MemberSince: new Date().toISOString().split('T')[0],
            IsAdmin: false
        };

        if (favoriteTeam) fields.FavoriteTeam = favoriteTeam.trim();

        const newUser = await base('Users').create([{ fields }]);

        // Auto-subscribe to email list if opted in
        if (marketingEmails !== false) {
            try {
                await base('EmailSubscribers').create([{
                    fields: {
                        Email: email.trim().toLowerCase(),
                        Name: name.trim(),
                        Source: 'signup',
                        SubscribedAt: new Date().toISOString().split('T')[0],
                        IsActive: true
                    }
                }]);
            } catch (e) {
                // Non-critical — don't fail signup if email sub fails
                console.error('Email subscribe error:', e);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                userId: newUser[0].id,
                name: name.trim(),
                message: 'Account created successfully'
            })
        };

    } catch (error) {
        console.error('Signup error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) };
    }
};
