const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Sanitize filename: keep only safe chars, limit length
function sanitizeFilename(name) {
  const base = path.basename(name);
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50);
  return safe || 'file';
}

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed'));
  }
};

// Memory-backed multer: files are buffered in RAM and forwarded to cloud
// storage (Cloudinary) by the route handlers via lib/images.js.
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB per file
});

// Fallback for when cloud storage is not configured (local dev / e2e): write
// the buffered file to the local uploads dir and return its public path.
function saveBufferToDisk(buffer, originalname) {
  const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
  const baseName = sanitizeFilename(originalname);
  const filename = uniqueSuffix + '-' + baseName;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

module.exports = { memoryUpload, saveBufferToDisk };