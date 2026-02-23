const queueEl = document.querySelector("#kanban");
const statusEl = document.querySelector("#queueStatus");
const statuses = ["NEW", "ESTIMATING", "SENT_TO_CUSTOMER", "PAID", "ARCHIVED"];

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `notice ${type}`.trim();
}

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

function waitForIdentityInit() {
  return new Promise((resolve, reject) => {
    if (!window.netlifyIdentity) {
      reject(new Error("Netlify Identity not available."));
      return;
    }
    let resolved = false;
    const finish = (user) => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(user);
    };
    window.netlifyIdentity.on("init", finish);
    window.netlifyIdentity.init();
  });
}

async function adminFetch(url, options = {}) {
  const token = await window.Identity.getToken();
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}

async function readJsonSafe(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

async function updateStatus(id, status) {
  const response = await adminFetch("/.netlify/functions/admin-update-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, status }),
  });
  if (!response.ok) {
    const data = await readJsonSafe(response);
    const message =
      data && typeof data === "object"
        ? data.error || "Unable to update status."
        : data || "Unable to update status.";
    throw new Error(message);
  }
}

function buildColumn(status, items) {
  const column = document.createElement("div");
  column.className = "kanban-column";
  column.innerHTML = `<h3>${status}</h3>`;

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No requests.";
    empty.className = "app-pill";
    column.appendChild(empty);
    return column;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "kanban-card";
    card.innerHTML = `
      <a href="/admin/request.html?id=${item.id}">${item.title}</a>
      <p class="app-pill">${item.service_type} · ${item.urgency || "standard"}</p>
      <p>From ${item.name}</p>
      <p class="app-pill">${formatDate(item.created_at)}</p>
    `;

    const select = document.createElement("select");
    statuses.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option;
      opt.textContent = option.replace(/_/g, " ");
      if (option === item.status) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    select.addEventListener("change", async () => {
      try {
        await updateStatus(item.id, select.value);
        setStatus(`Status updated for ${item.title}.`);
      } catch (error) {
        setStatus(error.message, "error");
      }
    });

    card.appendChild(select);
    column.appendChild(card);
  });

  return column;
}

async function loadQueue() {
  await waitForIdentityInit();
  window.Identity.requireUser();
  setStatus("Loading requests...");

  try {
    const response = await adminFetch("/.netlify/functions/admin-list-requests");
    const data = await readJsonSafe(response);
    if (!response.ok) {
      const message =
        data && typeof data === "object"
          ? data.error || "Unable to load requests."
          : data || "Unable to load requests.";
      throw new Error(message);
    }
    if (!data || typeof data !== "object") {
      throw new Error("Unable to load requests.");
    }

    const grouped = statuses.reduce((acc, status) => {
      acc[status] = [];
      return acc;
    }, {});

    data.requests.forEach((request) => {
      const list = grouped[request.status] || grouped.NEW;
      list.push(request);
    });

    queueEl.innerHTML = "";
    statuses.forEach((status) => {
      queueEl.appendChild(buildColumn(status, grouped[status] || []));
    });

    setStatus(`Loaded ${data.requests.length} requests.`);
  } catch (error) {
    setStatus(error.message || "Unable to load queue.", "error");
  }
}

loadQueue();
