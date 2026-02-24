// /assets/js/adminQueue.js
(function () {
  const statusEl = document.getElementById("queueStatus");
  const kanbanEl = document.getElementById("kanban");

  function setStatus(msg, type = "notice") {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = type; // uses your existing .notice style, but you can add .error if you want
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function getIdentityToken() {
    // Works with identity widget + many custom wrappers
    // 1) your identity.js wrapper (preferred)
    if (window.Identity && typeof window.Identity.getToken === "function") {
      return await window.Identity.getToken();
    }

    // 2) netlifyIdentity global (fallback)
    if (window.netlifyIdentity && typeof window.netlifyIdentity.currentUser === "function") {
      const user = window.netlifyIdentity.currentUser();
      if (!user) return null;
      const jwt = await user.jwt();
      return jwt;
    }

    return null;
  }

  async function fetchRequests() {
    const token = await getIdentityToken();
    if (!token) {
      // Send them back to login if not logged in
      window.location.href = "/admin/login.html";
      return [];
    }

    const res = await fetch("/.netlify/functions/admin-list-requests", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    // If the function returns a plain-text error, this will still work.
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // Non-JSON response (common when a function throws)
      throw new Error(text || `Request failed (${res.status})`);
    }

    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }

    // Normalize shapes:
    // - { ok:true, requests:[...] }
    // - { data:[...] }
    // - { ok:true }  -> empty
    const arr =
      (Array.isArray(data.requests) && data.requests) ||
      (Array.isArray(data.data) && data.data) ||
      [];

    return arr;
  }

  function groupByStatus(requests) {
    const buckets = {
      NEW: [],
      ESTIMATING: [],
      INVOICED: [],
      PAID: [],
      IN_PROGRESS: [],
      DONE: [],
    };

    for (const r of requests) {
      const key = (r.status || "NEW").toUpperCase();
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(r);
    }

    return buckets;
  }

  function renderKanban(groups) {
    if (!kanbanEl) return;

    const columns = Object.entries(groups);

    kanbanEl.innerHTML = columns
      .map(([status, items]) => {
        const cards = items
          .map((r) => {
            const title = escapeHtml(r.title || "(No title)");
            const name = escapeHtml(r.name || "");
            const service = escapeHtml(r.service_type || "");
            const created = escapeHtml(r.created_at || "");
            const publicId = escapeHtml(r.public_id || "");
            return `
              <div class="kanban-card">
                <div class="kanban-card__title">${title}</div>
                <div class="kanban-card__meta">
                  <div><strong>Name:</strong> ${name}</div>
                  <div><strong>Service:</strong> ${service}</div>
                  ${publicId ? `<div><strong>ID:</strong> ${publicId}</div>` : ""}
                  ${created ? `<div><strong>Created:</strong> ${created}</div>` : ""}
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <section class="kanban-col">
            <header class="kanban-col__header">
              <h3>${escapeHtml(status)}</h3>
              <span class="kanban-col__count">${items.length}</span>
            </header>
            <div class="kanban-col__body">
              ${cards || `<div class="kanban-empty">No requests</div>`}
            </div>
          </section>
        `;
      })
      .join("");
  }

  async function init() {
    try {
      setStatus("Loading...", "notice");

      const requests = await fetchRequests();
      const groups = groupByStatus(requests);
      renderKanban(groups);

      const total = requests.length;
      setStatus(total ? `Loaded ${total} request(s).` : "No requests yet.", "notice");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Failed to load queue.", "error");
      // If you're getting random auth failures, bounce to login:
      // window.location.href = "/admin/login.html";
    }
  }

  init();
})();
