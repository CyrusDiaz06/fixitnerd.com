import {
  jsonResponse,
  getSupabaseClient,
  parseJsonBody,
  verifyAdmin,
  getOptionalEnv,
  createHttpError,
  resolveError
} from './utils.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  try {
    await verifyAdmin(req);
    const enabled = String(getOptionalEnv('FEATURE_AI_PREVIEWS') || 'false').toLowerCase() === 'true';
    if (!enabled) {
      return jsonResponse(200, { ok: true, enabled: false });
    }

    const body = await parseJsonBody(req);
    const request_id = String(body.request_id || '').trim();
    if (!request_id) {
      throw createHttpError(400, 'Missing request id.');
    }

    const supabase = getSupabaseClient();
    await supabase.from('activity_log').insert({
      request_id,
      event_type: 'AI_PREVIEWS_REQUESTED',
      message: 'AI preview generation requested.'
    });

    return jsonResponse(200, {
      ok: true,
      enabled: true,
      generated: false,
      message: 'AI previews are enabled but generation is not configured. See README for setup.'
    });
  } catch (error) {
    console.error('generate-ai-previews error', error);
    return resolveError(error, 'Unable to generate previews.');
  }
};
