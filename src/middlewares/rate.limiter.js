const rateLimit = require('express-rate-limit');

const verifyLimiter = rateLimit({ 
    windowMs: 60 * 1000, 
    max: 10,
    message: { error: 'Too many requests, please try again later.' }
});

module.exports = { verifyLimiter };