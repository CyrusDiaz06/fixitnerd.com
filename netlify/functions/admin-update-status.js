import {
  jsonResponse,
  getSupabaseClient,
  parseJsonBody,
  verifyAdmin,
  createHttpError,
  resolveError
} from './utils.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  try {
    const { email } = await verifyAdmin(req);
    const body = await parseJsonBody(req);
    const request_id = String(body.request_id || '').trim();
    const status = String(body.status || '').trim();

    if (!request_id || !status) {
      throw createHttpError(400, 'Missing request id or status.');
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('requests')
      .update({ status })
      .eq('id', request_id);

    if (error) throw error;

    await supabase.from('activity_log').insert({
      request_id,
      event_type: 'STATUS_UPDATED',
      message: `Status updated to ${status} by ${email}.`
    });

    return jsonResponse(200, { ok: true, status });
  } catch (error) {
    console.error('admin-update-status error', error);
    return resolveError(error, 'Unable to update status.');
  }
};
