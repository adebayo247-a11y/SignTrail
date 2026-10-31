const fs = require('fs'); 
const prisma = require('../config/db'); 
const { hashFile, hashSHA256, sortKeys } = require('../utils/helpers'); 

exports.verifyDocument = async (req, res) => {     
    if (!req.file) return res.status(400).json({ error: 'Upload a PDF to verify.' });     
    
    const hash = hashFile(req.file.path);     
    fs.unlinkSync(req.file.path);      
    
    const document = await prisma.document.findFirst({         
        where: { fileHash: hash },         
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
    
    res.json({ status: 'VALID', finalHash: currentHash }); 
};