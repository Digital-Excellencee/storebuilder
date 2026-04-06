const multer = require('multer');
const config = require('../config');

const { ALLOWED_MIMES } = config;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, WEBP, and GIF files are allowed.'));
      return;
    }
    cb(null, true);
  }
});

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || name.endsWith('.csv')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only CSV files are allowed.'));
  }
});

module.exports = { upload, csvUpload };
