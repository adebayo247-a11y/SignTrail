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

        const result = await prisma.$transaction(async (tx) => {
            const document = await tx.document.create({
                data: { filename: req.file.originalname, filepath: req.file.path, fileHash }
            });

            const request = await tx.signingRequest.create({
                data: { documentId: document.id }
            });

            const signers = await Promise.all(signersData.map((s, index) => {
                const tokenId = crypto.randomBytes(16).toString('hex');
                return tx.signer.create({
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

            await appendAuditEntry(tx, request.id, 'CREATED', { 
                documentHash: fileHash, 
                signersCount: signers.length 
            });

            return { request, signers };
        });

        const links = result.signers.map(s => {
            const token = jwt.sign({ tokenId: s.tokenId, signerId: s.id }, process.env.JWT_SECRET, { expiresIn: '72h' });
            return { email: s.email, link: `/sign?token=${token}` };
        });

        res.json({ message: 'Request created', links });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};