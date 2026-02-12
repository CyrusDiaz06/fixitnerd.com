import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export function getSupabaseClient() {
    const url = window.SUPABASE_URL;
    const anonKey = window.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        return null;
    }
    return createClient(url, anonKey, { auth: { persistSession: false } });
}
