const { createClient } = require('@supabase/supabase-js');

// Only enable Supabase Storage when all required credentials are present so
// local dev and the e2e suite (which has no creds) keep working via the disk
// fallback in lib/images.js.
const isConfigured = !!(
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.SUPABASE_BUCKET
);

// Lazily create the Supabase client only when first needed. Creating it at
// module load time would crash on Node.js < 22 (no native WebSocket), which
// is what Render currently runs. Lazy init avoids that entirely.
let supabase = null;
let supabaseInitError = null;
function getSupabase() {
  if (supabaseInitError) return null;
  if (supabase) return supabase;
  try {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  } catch (err) {
    supabaseInitError = err;
    console.warn('[SUPABASE] Failed to initialize client:', err.message);
    return null;
  }
  return supabase;
}

// Upload one in-memory multer file buffer to Supabase Storage.
// Returns the public HTTPS URL that we persist in the database.
async function uploadBuffer(buffer, folder = 'homify', originalname = 'file') {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase Storage is not configured');
  }

  const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  const safeName = String(originalname || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 50);
  const path = `${folder}/${uniqueSuffix}-${safeName}`;

  const { error } = await client.storage
    .from(process.env.SUPABASE_BUCKET)
    .upload(path, buffer, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data } = client.storage
    .from(process.env.SUPABASE_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

// Upload many multer memory files in parallel. Returns an array of URLs.
async function uploadBuffers(files, folder) {
  return Promise.all(
    files.map((f) => uploadBuffer(f.buffer, folder, f.originalname))
  );
}

module.exports = { supabase: null, isConfigured, uploadBuffer, uploadBuffers };
