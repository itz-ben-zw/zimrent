const cloudinary = require('cloudinary').v2;

// Only enable Cloudinary when all three credentials are present so local dev
// and the e2e suite (which has no creds) keep working via the disk fallback.
const isConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

// Upload one in-memory multer file buffer to Cloudinary.
// Returns the secure HTTPS URL that we persist in the database.
function uploadBuffer(buffer, folder = 'homify') {
  return new Promise((resolve, reject) => {
    // No public_id is set so Cloudinary always generates a unique id and one
    // upload can never overwrite another.
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// Upload many multer memory files in parallel. Returns an array of URLs.
async function uploadBuffers(files, folder) {
  return Promise.all(files.map((f) => uploadBuffer(f.buffer, folder)));
}

module.exports = { cloudinary, isConfigured, uploadBuffer, uploadBuffers };