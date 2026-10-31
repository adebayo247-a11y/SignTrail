const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { hashFile, getUTCTime } = require('../utils/helpers');
const { appendAuditEntry } = require('../services/auditService');

exports.signDocument = async (req, res) => {
    const { token, typedName } = req.body;
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        await prisma.$transaction(async (tx) => {
            const signer = await tx.signer.findUnique({ 
                where: { id: decoded.signerId }, 
                include: { request: { include: { document: true, signers: true } } }
            });

            if (!signer || signer.tokenUsed) {
                await appendAuditEntry(tx, signer.signingRequestId, 'REJECTED_ATTEMPT', { reason: 'Used or invalid token' });
                throw new Error('Link already used or invalid.');
            }

            const previousSigners = signer.request.signers.filter(s => s.orderIndex < signer.orderIndex);
            if (previousSigners.some(s => s.status !== 'SIGNED')) {
                await appendAuditEntry(tx, signer.signingRequestId, 'REJECTED_ATTEMPT', { reason: 'Signed out of order' });
                throw new Error('Previous signers must sign first.');
            }

            const currentHash = hashFile(signer.request.document.filepath);
            if (currentHash !== signer.request.document.fileHash) {
                await appendAuditEntry(tx, signer.signingRequestId, 'REJECTED_ATTEMPT', { reason: 'Document hash mismatch' });
                throw new Error('Document has been tampered with.');
            }

            if (signer.feeAmount > 0 && signer.status !== 'PAID') {
                await appendAuditEntry(tx, signer.signingRequestId, 'REJECTED_ATTEMPT', { reason: 'Fee not paid' });
                throw new Error('Payment required before signing.');
            }

            const ipAddress = req.ip || req.connection.remoteAddress;
            const userAgent = req.headers['user-agent'];
            const timestamp = getUTCTime();

            await tx.signer.update({
                where: { id: signer.id },
                data: { status: 'SIGNED', tokenUsed: true, signedAt: timestamp, ipAddress, userAgent }
            });

            await appendAuditEntry(tx, signer.signingRequestId, 'SIGNED', {
                signerName: typedName,
                ipAddress,
                userAgent,
                timestamp,
                documentHash: currentHash
            });

            const allSigners = await tx.signer.findMany({ where: { signingRequestId: signer.signingRequestId } });
            if (allSigners.every(s => s.status === 'SIGNED')) {
                await tx.signingRequest.update({ where: { id: signer.signingRequestId }, data: { status: 'COMPLETED' } });
                
                const certData = {
                    documentHash: currentHash,
                    signers: allSigners.map(s => ({ name: s.name, time: s.signedAt, ip: s.ipAddress })),
                    finalChainHash: signer.request.chainHeadHash
                };

                await tx.certificate.create({ data: { signingRequestId: signer.signingRequestId, certificateData: certData } });
                await appendAuditEntry(tx, signer.signingRequestId, 'COMPLETED', certData);
            }
        });

        res.json({ message: 'Successfully signed' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};