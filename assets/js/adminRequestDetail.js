const detailEl = document.querySelector("#requestDetail");
const estimateBody = document.querySelector("#estimateBody");
const estimateTotal = document.querySelector("#estimateTotal");
const saveEstimateBtn = document.querySelector("#saveEstimate");
const sendInvoiceBtn = document.querySelector("#sendInvoice");
const notesForm = document.querySelector("#notesForm");
const statusSelect = document.querySelector("#statusSelect");
const activityList = document.querySelector("#activityList");
const previewBtn = document.querySelector("#generatePreview");

function formatCents(value) {
  return `$${(value / 100).toFixed(2)}`;
}

function addRow(item = {}) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><input type="text" value="${item.title || ""}" placeholder="Line item"></td>
    <td><input type="text" value="${item.description || ""}" placeholder="Details"></td>
    <td><input type="number" min="1" value="${item.quantity || 1}"></td>
    <td><input type="number" min="0" value="${item.unit_cents || 0}"></td>
    <td class="line-total">${formatCents(item.total_cents || 0)}</td>
    <td><button class="app-button secondary" type="button">Remove</button></td>
  `;

  row.querySelector("button").addEventListener("click", () => row.remove());
  estimateBody.appendChild(row);
}

function collectItems() {
  const rows = Array.from(estimateBody.querySelectorAll("tr"));
  return rows.map((row) => {
    const inputs = row.querySelectorAll("input");
    const title = inputs[0].value.trim();
    const description = inputs[1].value.trim();
    const quantity = Number(inputs[2].value || 1);
    const unit_cents = Number(inputs[3].value || 0);
    return { title, description, quantity, unit_cents };
  }).filter((item) => item.title);
}

function updateTotals() {
  const rows = Array.from(estimateBody.querySelectorAll("tr"));
  let total = 0;
  rows.forEach((row) => {
    const inputs = row.querySelectorAll("input");
    const quantity = Number(inputs[2].value || 1);
    const unit = Number(inputs[3].value || 0);
    const lineTotal = quantity * unit;
    total += lineTotal;
    row.querySelector(".line-total").textContent = formatCents(lineTotal);
  });
  estimateTotal.textContent = formatCents(total);
}

function bindTotals() {
  estimateBody.addEventListener("input", updateTotals);
}

async function fetchRequest(id) {
  const token = await window.Identity.getToken();
  const response = await fetch(`/.netlify/functions/admin-get-request?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Unable to load request.");
  }
  return data;
}

async function saveEstimate(requestId) {
  const token = await window.Identity.getToken();
  const items = collectItems();
  const response = await fetch("/.netlify/functions/admin-save-estimate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ request_id: requestId, items }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Unable to save estimate.");
  }
  return data;
}

async function sendInvoice(requestId) {
  const token = await window.Identity.getToken();
  const response = await fetch("/.netlify/functions/admin-send-invoice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ request_id: requestId }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Unable to send invoice.");
  }
  return data;
}

async function updateNotes(requestId, notes, status) {
  const token = await window.Identity.getToken();
  const response = await fetch("/.netlify/functions/admin-update-notes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id: requestId, admin_notes: notes, status }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Unable to update notes.");
  }
  return data;
}

async function updateStatus(requestId, status) {
  const token = await window.Identity.getToken();
  const response = await fetch("/.netlify/functions/admin-update-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id: requestId, status }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Unable to update status.");
  }
}

async function generatePreview(requestId) {
  const token = await window.Identity.getToken();
  const response = await fetch("/.netlify/functions/generate-ai-previews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ request_id: requestId }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Unable to create preview.");
  }
  return data;
}

async function loadDetail() {
  window.Identity.requireUser();
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    detailEl.innerHTML = "<p class=\"notice error\">Missing request ID.</p>";
    return;
  }

  try {
    const data = await fetchRequest(id);
    const request = data.request;

    detailEl.querySelector("h2").textContent = request.title;
    detailEl.querySelector("#requestMeta").textContent = `${request.service_type} · ${request.urgency || "standard"}`;
    detailEl.querySelector("#requestCustomer").textContent = `${request.name} · ${request.email} · ${request.phone || ""}`;
    detailEl.querySelector("#requestDescription").textContent = request.description;
    statusSelect.value = request.status;
    detailEl.querySelector("#adminNotes").value = request.admin_notes || "";

    const assetsList = detailEl.querySelector("#assetList");
    assetsList.innerHTML = "";
    if (data.assets && data.assets.length > 0) {
      data.assets.forEach((asset) => {
        const li = document.createElement("li");
        li.innerHTML = `<a href="${asset.asset_url}" target="_blank" rel="noopener">${asset.file_name || asset.asset_url}</a>`;
        assetsList.appendChild(li);
      });
    } else {
      assetsList.innerHTML = "<li>No assets uploaded.</li>";
    }

    estimateBody.innerHTML = "";
    if (data.estimate && data.estimate.items) {
      data.estimate.items.forEach((item) => addRow(item));
    }

    if (estimateBody.children.length === 0) {
      addRow();
    }

    if (data.activity && data.activity.length > 0) {
      activityList.innerHTML = "";
      data.activity.forEach((entry) => {
        const li = document.createElement("li");
        li.textContent = `${new Date(entry.created_at).toLocaleString()} · ${entry.event_type} · ${entry.message || ""}`;
        activityList.appendChild(li);
      });
    }

    bindTotals();
    updateTotals();

    saveEstimateBtn.addEventListener("click", async () => {
      await saveEstimate(request.id);
      updateTotals();
      alert("Estimate saved.");
    });

    sendInvoiceBtn.addEventListener("click", async () => {
      const result = await sendInvoice(request.id);
      alert(`Invoice sent. Checkout URL: ${result.checkout_url}`);
    });

    notesForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await updateNotes(request.id, detailEl.querySelector("#adminNotes").value, statusSelect.value);
      alert("Notes updated.");
    });

    statusSelect.addEventListener("change", async () => {
      await updateStatus(request.id, statusSelect.value);
    });

    if (previewBtn) {
      if (!data.feature_ai_previews) {
        previewBtn.classList.add("hidden");
      } else {
        previewBtn.addEventListener("click", async () => {
          const result = await generatePreview(request.id);
          alert(result.message || "Preview requested.");
        });
      }
    }
  } catch (error) {
    detailEl.innerHTML = `<p class="notice error">${error.message}</p>`;
  }
}

loadDetail();
