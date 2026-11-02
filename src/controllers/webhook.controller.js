const crypto = require('crypto');
const axios = require('axios');
const prisma = require('../config/db');
const { appendAuditEntry } = require('../services/auditService');

exports.initPayment = async (req, res) => {
    const { signerId } = req.body;
    try {
        const signer = await prisma.signer.findUnique({ where: { id: signerId } });
        
        if (!signer) return res.status(404).json({ error: 'Signer not found' });
        if (signer.feeAmount === 0) return res.status(400).json({ error: 'No fee required for this signer' });

        // Generate a unique transaction reference
        const transactionRef = 'TXN-' + crypto.randomBytes(8).toString('hex');

        // Ping Squad to create a checkout session
        const squadResponse = await axios.post('https://sandbox-api-d.squadco.com/transaction/initiate', {
            amount: signer.feeAmount,
            email: signer.email,
            initiate_type: 'inline',
            transaction_ref: transactionRef,
            callback_url: 'http://localhost:7070' // Placeholder for local testing
        }, {
            headers: { Authorization: `Bearer ${process.env.SQUAD_SECRET_KEY}` }
        });

        // Save the pending payment to MongoDB
        await prisma.payment.create({
            data: {
                transactionRef,
                signerId,
                amount: signer.feeAmount,
                status: 'PENDING'
            }
        });

        res.json({ 
            message: 'Payment initialized', 
            checkoutUrl: squadResponse.data.data.checkout_url, 
            transactionRef 
        });
    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
};

exports.squadWebhook = async (req, res) => {
    const SQUAD_SECRET = process.env.SQUAD_SECRET_KEY;
    const signature = req.headers['x-squad-encrypted-body'];
    const hash = crypto.createHmac('sha512', SQUAD_SECRET).update(req.rawBody).digest('hex');

    if (signature !== hash) {
        return res.status(401).send('Invalid signature');
    }

    const { Event, TransactionRef, Amount } = req.body;
    
    if (Event === 'charge.completed') {
        try {
            await prisma.$transaction(async (tx) => {
                const existing = await tx.webhookEvent.findUnique({ where: { transactionRef: TransactionRef } });
                if (existing) return res.status(200).send('Already processed');

                await tx.webhookEvent.create({ data: { transactionRef: TransactionRef, payload: req.body } });

                const squadVerify = await axios.get(`https://sandbox-api-d.squadco.com/transaction/verify/${TransactionRef}`, {
                    headers: { Authorization: `Bearer ${SQUAD_SECRET}` }
                });

                if (squadVerify.data.data.transaction_amount !== Amount) throw new Error('Amount mismatch');

                const payment = await tx.payment.findUnique({ where: { transactionRef: TransactionRef }, include: { signer: true } });
                if (payment && payment.amount === Amount) {
                    await tx.signer.update({ where: { id: payment.signerId }, data: { status: 'PAID' } });
                    await appendAuditEntry(tx, payment.signer.signingRequestId, 'PAYMENT_CONFIRMED', {
                        transactionRef: TransactionRef,
                        amount: Amount
                    });
                }
            });
        } catch (err) {
            console.error('Webhook processing error:', err);
        }
    }
    res.status(200).send('OK');
};