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
        const { productId, size, quantity, shippingName, shippingAddress, shippingEmail } = JSON.parse(event.body);

        if (!productId || !size || !shippingName || !shippingAddress || !shippingEmail) {
            return { statusCode: 400, body: JSON.stringify({ error: 'All shipping fields are required' }) };
        }

        const product = await base('MerchProducts').find(productId);
        if (!product.get('IsActive')) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Product is no longer available' }) };
        }

        const stock = product.get('StockQuantity') || 0;
        const qty = parseInt(quantity) || 1;
        if (stock < qty) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Not enough stock' }) };
        }

        const orderId = `KOJ-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const price = product.get('Price') || 0;

        await base('MerchOrders').create([{
            fields: {
                OrderID: orderId, User: [decoded.userId], Product: [productId],
                Size: size, Quantity: qty, TotalPrice: price * qty,
                Status: 'pending', ShippingName: shippingName.trim(),
                ShippingAddress: shippingAddress.trim(), ShippingEmail: shippingEmail.trim(),
                OrderedAt: new Date().toISOString().split('T')[0]
            }
        }]);

        await base('MerchProducts').update(productId, { StockQuantity: stock - qty });

        const user = await base('Users').find(decoded.userId);
        await base('Users').update(decoded.userId, { Points: (user.get('Points') || 0) + 5 });

        return { statusCode: 200, body: JSON.stringify({ success: true, orderId }) };
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
        }
        console.error('Create order error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create order' }) };
    }
};
