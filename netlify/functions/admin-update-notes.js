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
    const admin_notes = body.admin_notes !== undefined ? String(body.admin_notes).trim() : null;
    const status = body.status ? String(body.status).trim() : null;

    if (!request_id) {
      throw createHttpError(400, 'Missing request id.');
    }

    const updates = {};
    if (admin_notes !== null) {
      updates.admin_notes = admin_notes;
    }
    if (status) {
      updates.status = status;
    }

    if (!Object.keys(updates).length) {
      throw createHttpError(400, 'No updates provided.');
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('requests')
      .update(updates)
      .eq('id', request_id);

    if (error) throw error;

    await supabase.from('activity_log').insert({
      request_id,
      event_type: 'NOTES_UPDATED',
      message: `Admin notes updated by ${email}.`
    });

    return jsonResponse(200, { ok: true });
  } catch (error) {
    console.error('admin-update-notes error', error);
    return resolveError(error, 'Unable to update notes.');
  }
};
