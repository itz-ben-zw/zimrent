const { isConfigured, uploadBuffer } = require('./cloudinary');
const { saveBufferToDisk } = require('../middleware/upload');

// Persist one uploaded image and return the URL/path to store in the DB.
// Uses Cloudinary when configured; otherwise falls back to the local uploads
// directory so local dev and the e2e suite keep working without credentials.
//
// In production disk is ephemeral: refuse the local fallback with a loud 503
// so the misconfiguration (missing Cloudinary env vars) is visible instead
// of silently writing images that vanish on the next deploy.
async function storeImage(file, folder = 'homify') {
  if (isConfigured) {
    return uploadBuffer(file.buffer, folder);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Image storage is not configured: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'
    );
  }
  return saveBufferToDisk(file.buffer, file.originalname);
}

// Persist many images, returning an array of URLs/paths in input order.
async function storeImages(files, folder = 'homify') {
  if (!files || !files.length) return [];
  return Promise.all(files.map((f) => storeImage(f, folder)));
}

module.exports = { storeImage, storeImages };