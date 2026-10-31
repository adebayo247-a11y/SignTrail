const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { hashFile, isActualPDF } = require('../utils/helpers');
const { appendAuditEntry } = require('../services/auditService');

exports.createRequest = async (req, res) => {
    try {
        if (!req.file || !isActualPDF(req.file.path)) {
            return res.status(400).json({ error: 'Invalid file. Must be a PDF.' });
        }

        const fileHash = hashFile(req.file.path);
        const signersData = JSON.parse(req.body.signers);

        // --- no $transaction: sequential writes ---
        const document = await prisma.document.create({
            data: { filename: req.file.originalname, filepath: req.file.path, fileHash }
        });

        const request = await prisma.signingRequest.create({
            data: { documentId: document.id }
        });

        const signers = await Promise.all(signersData.map((s, index) => {
            const tokenId = crypto.randomBytes(16).toString('hex');
            return prisma.signer.create({
                data: {
                    signingRequestId: request.id,
                    name: s.name,
                    email: s.email,
                    orderIndex: index,
                    feeAmount: s.feeAmount || 0,
                    tokenId
                }
            });
        }));

        // pass prisma directly instead of tx
        await appendAuditEntry(prisma, request.id, 'CREATED', {
            documentHash: fileHash,
            signersCount: signers.length
        });

        const links = signers.map(s => {
            const token = jwt.sign(
                { tokenId: s.tokenId, signerId: s.id },
                process.env.JWT_SECRET_KEY,
                { expiresIn: '72h' }
            );
            return { email: s.email, link: `/sign?token=${token}` };
        });

        res.json({ message: 'Request created', links });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};