const { randomUUID } = require('crypto');
const path = require('path');
const { isConfigured: cloudinaryConfigured, uploadBuffer: uploadToCloudinary } = require('./cloudinary');
const { saveBufferToDisk } = require('../middleware/upload');

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseBucket = process.env.SUPABASE_STORAGE_BUCKET || 'property-images';
const supabaseConfigured = !!(supabaseUrl && supabaseKey);

function getContentType(file) {
  if (file.mimetype && /^image\/(jpeg|jpg|png|gif|webp|avif)$/i.test(file.mimetype)) {
    return file.mimetype.toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.mimetype;
  }
  const ext = path.extname(file.originalname || '').toLowerCase();
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif'
  };
  return types[ext] || 'application/octet-stream';
}

async function uploadToSupabase(file, folder) {
  const contentType = getContentType(file);
  if (!contentType.startsWith('image/')) {
    throw new Error('Unsupported image type for Supabase Storage.');
  }

  const extensionByType = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/avif': '.avif'
  };
  const ext = extensionByType[contentType] || path.extname(file.originalname || '').toLowerCase() || '.img';
  const safeFolder = String(folder || 'properties')
    .split('/')
    .filter(Boolean)
    .map(part => part.replace(/[^a-zA-Z0-9_-]/g, '_'))
    .join('/');
  const objectPath = [safeFolder, randomUUID() + ext].filter(Boolean).join('/');
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(supabaseBucket)}/${encodedPath}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
      'x-upsert': 'false'
    },
    body: file.buffer
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error('Supabase Storage upload failed:', response.status, details.slice(0, 500));
    throw new Error(`Supabase Storage upload failed (HTTP ${response.status}). Check the storage bucket and server credentials.`);
  }

  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(supabaseBucket)}/${encodedPath}`;
}

// Persist one uploaded image and return a durable URL/path for the database.
// Supabase Storage is preferred when configured; Cloudinary remains supported.
// Local disk is only a development fallback because Render's filesystem is ephemeral.
async function storeImage(file, folder = 'homify') {
  if (supabaseConfigured) {
    return uploadToSupabase(file, folder);
  }
  if (cloudinaryConfigured) {
    return uploadToCloudinary(file.buffer, folder);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Image storage is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (with a public storage bucket), or configure all three CLOUDINARY_* variables.'
    );
  }
  return saveBufferToDisk(file.buffer, file.originalname);
}

async function storeImages(files, folder = 'homify') {
  if (!files || !files.length) return [];
  return Promise.all(files.map(file => storeImage(file, folder)));
}

module.exports = { storeImage, storeImages };
