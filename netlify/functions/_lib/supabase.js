function getEnv(name) {
  return process.env[name] || "";
}

function getSupabaseConfig() {
  const url = getEnv("SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { url, serviceKey };
}

function buildSupabaseHeaders() {
  const { serviceKey } = getSupabaseConfig();
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

async function supabaseFetch(path, options = {}) {
  const { url, serviceKey } = getSupabaseConfig();
  if (!url || !serviceKey) {
    return { ok: false, status: 500, error: "Supabase is not configured." };
  }

  const target = `${url.replace(/\/$/, "")}/rest/v1/${path}`;
  const headers = { ...buildSupabaseHeaders(), ...(options.headers || {}) };
  const response = await fetch(target, {
    method: options.method || "GET",
    headers,
    body: options.body,
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, status: response.status, error: text || "Supabase error." };
  }

  if (response.status === 204) {
    return { ok: true, status: 204, data: null };
  }

  const data = await response.json();
  return { ok: true, status: response.status, data };
}

async function supabaseInsert(table, rows, prefer = "return=representation") {
  return supabaseFetch(table, {
    method: "POST",
    headers: { Prefer: prefer },
    body: JSON.stringify(rows),
  });
}

async function supabaseUpdate(table, filter, values) {
  return supabaseFetch(`${table}?${filter}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(values),
  });
}

async function supabaseDelete(table, filter) {
  return supabaseFetch(`${table}?${filter}`, {
    method: "DELETE",
  });
}

export {
  getEnv,
  supabaseFetch,
  supabaseInsert,
  supabaseUpdate,
  supabaseDelete,
};
