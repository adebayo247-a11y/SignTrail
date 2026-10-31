require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api.routes');

const app = express();
const PORT = process.env.PORT || 7070;

app.use(cors());

// Global JSON middleware configured to retain the raw body buffer for webhook signature validation
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// Mount API routes
app.use('/api', apiRoutes);

app.listen(PORT, () => {
    console.log(`SignTrail API running securely on port ${PORT}`);
});