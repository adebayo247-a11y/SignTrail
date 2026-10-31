const crypto = require('crypto');
const fs = require('fs');

const hashSHA256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

const hashFile = (filepath) => {
    const fileBuffer = fs.readFileSync(filepath);
    return hashSHA256(fileBuffer);
};

const isActualPDF = (filepath) => {
    const buffer = Buffer.alloc(5);
    const fd = fs.openSync(filepath, 'r');
    fs.readSync(fd, buffer, 0, 5, 0);
    fs.closeSync(fd);
    return buffer.toString('hex') === '255044462d'; 
};

const sortKeys = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);
    return Object.keys(obj).sort().reduce((result, key) => {
        result[key] = sortKeys(obj[key]);
        return result;
    }, {});
};

const getUTCTime = () => new Date().toISOString();

module.exports = { hashSHA256, hashFile, isActualPDF, sortKeys, getUTCTime };