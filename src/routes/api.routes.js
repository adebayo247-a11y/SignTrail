const express = require('express');
const router = express.Router();

const upload = require('../middlewares/upload.middleware');
const { verifyLimiter } = require('../middlewares/rate.limiter');

const { createRequest } = require('../controllers/request.controller');
const { signDocument } = require('../controllers/sign.controller');
const { squadWebhook } = require('../controllers/webhook.controller');
const { verifyDocument, verifyChain } = require('../controllers/verify.controller');

router.post('/request', upload.single('document'), createRequest);
router.post('/sign', signDocument);
router.post('/webhooks/squad', squadWebhook);

router.post('/verify-document', verifyLimiter, upload.single('document'), verifyDocument);
router.get('/verify-chain/:requestId', verifyChain);

module.exports = router;