const fs = require('fs');
const prisma = require('../config/db');
const { hashFile, hashSHA256, sortKeys } = require('../utils/helpers');

exports.verifyDocument = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Upload a PDF to verify.' });

    const hash = hashFile(req.file.path);
    fs.unlinkSync(req.file.path);

    // UPDATE: Specifically filter for a document that has a COMPLETED request
    const document = await prisma.document.findFirst({
        where: {
            fileHash: hash,
            requests: { some: { status: 'COMPLETED' } }
        },
        include: { requests: { include: { certificate: true }, where: { status: 'COMPLETED' } } }
    });

    if (document && document.requests.length > 0) {
        const reqData = document.requests[0];
        res.json({
            status: 'match',
            completionDate: reqData.certificate.createdAt,
            certificateId: reqData.certificate.id
        });
    } else {
        res.json({ status: 'no match' });
    }
};

exports.verifyChain = async (req, res) => {
    // 1. Fetch the request to get the TRUE final hash
    const request = await prisma.signingRequest.findUnique({
        where: { id: req.params.requestId }
    });
    if (!request) return res.status(404).json({ error: "Request not found" });

    const entries = await prisma.auditEntry.findMany({
        where: { signingRequestId: req.params.requestId },
        orderBy: { createdAt: 'asc' }
    });

    let currentHash = '0000000000000000000000000000000000000000000000000000000000000000';

    for (const entry of entries) {
        const computedHash = hashSHA256(currentHash + JSON.stringify(sortKeys(entry.eventData)));
        if (computedHash !== entry.hash) {
            return res.json({ status: 'INVALID', brokenAt: entry.id, expectedHash: entry.hash, computedHash });
        }
        currentHash = entry.hash;
    }

    // 2. THE CATCH: If the loop finishes but doesn't match the master head hash, a row was deleted!
    if (currentHash !== request.chainHeadHash) {
        return res.json({
            status: 'INVALID',
            reason: 'Tail deletion detected. The chain is missing entries at the end.',
            expectedFinalHash: request.chainHeadHash,
            computedFinalHash: currentHash
        });
    }

    res.json({ status: 'VALID', finalHash: currentHash });
};