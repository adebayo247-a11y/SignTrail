const multer = require('multer');

// Accepts files up to 20 MB, stored temporarily in /uploads
const upload = multer({ 
    dest: 'uploads/', 
    limits: { fileSize: 20 * 1024 * 1024 } 
});

module.exports = upload;