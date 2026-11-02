const multer = require('multer');
const path = require('path');

// Absolute path anchored to the project root so the stored filepath
// is always valid regardless of the process working directory.
const upload = multer({ 
    dest: path.join(__dirname, '../../uploads/'),
    limits: { fileSize: 20 * 1024 * 1024 } 
});

module.exports = upload;