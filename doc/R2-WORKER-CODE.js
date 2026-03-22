/**
 * Cloudflare Worker: laundryboss-r2
 *
 * R2 upload/delete for LaundryBoss. Bind your R2 bucket as BUCKET.
 * Add Secret: R2_PUBLIC_URL = your bucket public URL (e.g. https://pub-xxx.r2.dev)
 *
 * Routes:
 *   POST /upload  - multipart/form-data: file, shopId, folder  → { key, publicUrl }
 *   POST /delete  - JSON: { key }  → 204
 */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (url.pathname === '/upload' && request.method === 'POST') {
      try {
        const formData = await request.formData();
        const file = formData.get('file');
        const shopId = formData.get('shopId');
        const folder = formData.get('folder');

        if (!file || file === 'undefined' || !shopId || !folder) {
          return json({ error: 'Missing file, shopId, or folder' }, 400);
        }

        const name = file.name || 'file';
        const ext = name.includes('.') ? name.split('.').pop() : 'jpg';
        const key = `${shopId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

        await env.BUCKET.put(key, file.stream(), {
          httpMetadata: { contentType: file.type || 'image/jpeg' },
        });

        const baseUrl = env.R2_PUBLIC_URL || 'https://pub-4b5be0a466f24a92b1dd773c9a0006c8.r2.dev';
        const publicUrl = baseUrl.replace(/\/$/, '') + '/' + key;

        return json({ key, publicUrl });
      } catch (e) {
        console.error('Upload error:', e);
        return json({ error: e.message || 'Upload failed' }, 500);
      }
    }

    if (url.pathname === '/delete' && request.method === 'POST') {
      try {
        const body = await request.json();
        const key = body?.key;

        if (!key) {
          return json({ error: 'Missing key' }, 400);
        }

        await env.BUCKET.delete(key);
        return new Response(null, { status: 204, headers: corsHeaders() });
      } catch (e) {
        console.error('Delete error:', e);
        return json({ error: e.message || 'Delete failed' }, 500);
      }
    }

    return new Response('LaundryBoss R2 Worker. Use POST /upload or POST /delete.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain', ...corsHeaders() },
    });
  },
};
