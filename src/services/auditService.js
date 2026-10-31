const { hashSHA256, sortKeys, getUTCTime } = require('../utils/helpers');

const appendAuditEntry = async (tx, signingRequestId, action, data) => {
    const request = await tx.signingRequest.findUnique({ where: { id: signingRequestId } });
    const previousHash = request.chainHeadHash;
    
    const sortedData = sortKeys(data);
    const eventDataString = JSON.stringify(sortedData);
    const newHash = hashSHA256(previousHash + eventDataString);

    const entry = await tx.auditEntry.create({
        data: {
            signingRequestId,
            action,
            eventData: sortedData,
            previousHash,
            hash: newHash,
            createdAt: getUTCTime()
        }
    });

    await tx.signingRequest.update({
        where: { id: signingRequestId },
        data: { chainHeadHash: newHash }
    });

    return entry;
};

module.exports = { appendAuditEntry };