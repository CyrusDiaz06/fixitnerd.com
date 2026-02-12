import {
  jsonResponse,
  getSupabaseClient,
  verifyAdmin,
  resolveError
} from './utils.js';

export default async (req) => {
  if (req.method !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  try {
    await verifyAdmin(req);

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const service_type = url.searchParams.get('service_type');
    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end');

    const supabase = getSupabaseClient();
    let query = supabase
      .from('requests')
      .select('id, public_id, service_type, title, urgency, name, email, status, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (service_type) query = query.eq('service_type', service_type);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query;
    if (error) throw error;

    return jsonResponse(200, { ok: true, requests: data || [] });
  } catch (error) {
    console.error('admin-list-requests error', error);
    return resolveError(error, 'Unable to list requests.');
  }
};
