import { requireAdminAuth, getAuthToken, setupLogoutButton } from './identity.js';

const requestPanel = document.getElementById('requestPanel');
const adminNotesPanel = document.getElementById('adminNotesPanel');
const adminNotes = document.getElementById('adminNotes');
const statusSelect = document.getElementById('statusSelect');
const saveNotesBtn = document.getElementById('saveNotesBtn');
const notesStatus = document.getElementById('notesStatus');

const estimatePanel = document.getElementById('estimatePanel');
const estimateItemsContainer = document.getElementById('estimateItems');
const addLineItemBtn = document.getElementById('addLineItem');
const saveEstimateBtn = document.getElementById('saveEstimate');
const sendInvoiceBtn = document.getElementById('sendInvoice');
const estimateTotal = document.getElementById('estimateTotal');
const estimateStatus = document.getElementById('estimateStatus');
const suggestedActions = document.getElementById('suggestedActions');

const assetsPanel = document.getElementById('assetsPanel');
const assetsList = document.getElementById('assetsList');
const activityPanel = document.getElementById('activityPanel');
const activityList = document.getElementById('activityList');

const aiPanel = document.getElementById('aiPanel');
const generatePreviewsBtn = document.getElementById('generatePreviews');
const aiStatus = document.getElementById('aiStatus');

const statuses = [
    'NEW',
    'NEEDS_ESTIMATE',
    'SENT_TO_CUSTOMER',
    'APPROVED',
    'PAID',
    'IN_PROGRESS',
    'COMPLETED',
    'ARCHIVED'
];

let requestId = null;
let requestData = null;
let estimateItems = [];

function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function formatDate(value) {
    return value ? new Date(value).toLocaleString() : '';
}

function setStatusOptions(current) {
    statusSelect.innerHTML = '';
    statuses.forEach((status) => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status.replace('_', ' ');
        if (status === current) option.selected = true;
        statusSelect.appendChild(option);
    });
}

function renderRequestSummary() {
    requestPanel.innerHTML = `
        <h2>${requestData.title}</h2>
        <div class="inline-actions">
            <span class="status-badge">${requestData.status}</span>
            <span class="badge">${requestData.service_type.replace('_', ' ')}</span>
            <span class="badge ${requestData.urgency === 'rush' ? 'urgent' : ''}">${requestData.urgency}</span>
        </div>
        <p>${requestData.description}</p>
        <div class="info-grid">
            <div class="info-card"><h4>Customer</h4><p>${requestData.name}</p></div>
            <div class="info-card"><h4>Email</h4><p>${requestData.email}</p></div>
            <div class="info-card"><h4>Phone</h4><p>${requestData.phone || '—'}</p></div>
            <div class="info-card"><h4>Contact</h4><p>${requestData.contact_method}</p></div>
            <div class="info-card"><h4>Location</h4><p>${requestData.location || '—'}</p></div>
            <div class="info-card"><h4>Budget</h4><p>${requestData.budget || '—'}</p></div>
            <div class="info-card"><h4>Created</h4><p>${formatDate(requestData.created_at)}</p></div>
        </div>
        <div class="inline-actions">
            <a class="text-link" href="/request-status.html?id=${requestData.public_id}" target="_blank" rel="noopener">Open customer view</a>
        </div>
    `;
}

function renderAssets(assets) {
    assetsPanel.style.display = 'block';
    if (!assets.length) {
        assetsList.innerHTML = '<p class="helper-text">No assets provided.</p>';
        return;
    }
    assetsList.innerHTML = '';
    assets.forEach((asset) => {
        const row = document.createElement('div');
        row.className = 'info-card';
        row.innerHTML = `<strong>${asset.asset_type || 'link'}</strong><br><a class="text-link" href="${asset.url}" target="_blank" rel="noopener">${asset.url}</a>`;
        assetsList.appendChild(row);
    });
}

function renderActivity(activity) {
    activityPanel.style.display = 'block';
    if (!activity.length) {
        activityList.innerHTML = '<p class="helper-text">No activity yet.</p>';
        return;
    }
    activityList.innerHTML = '';
    activity.forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'info-card';
        row.innerHTML = `<strong>${entry.event_type}</strong><br>${entry.message}<br><span class="helper-text">${formatDate(entry.created_at)}</span>`;
        activityList.appendChild(row);
    });
}

function addItemRow(item = { description: '', qty: 1, unit_price_cents: 0 }) {
    const row = document.createElement('div');
    row.className = 'estimate-row';

    const descriptionInput = document.createElement('input');
    descriptionInput.placeholder = 'Line item description';
    descriptionInput.value = item.description || '';

    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '0';
    qtyInput.step = '1';
    qtyInput.value = item.qty || 1;

    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.min = '0';
    priceInput.step = '0.01';
    priceInput.value = ((item.unit_price_cents || 0) / 100).toFixed(2);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'ghost-button';
    removeBtn.textContent = 'Remove';

    row.appendChild(descriptionInput);
    row.appendChild(qtyInput);
    row.appendChild(priceInput);
    row.appendChild(removeBtn);

    function updateItem() {
        item.description = descriptionInput.value;
        item.qty = Number(qtyInput.value || 0);
        item.unit_price_cents = Math.round(Number(priceInput.value || 0) * 100);
        updateTotals();
    }

    descriptionInput.addEventListener('input', updateItem);
    qtyInput.addEventListener('input', updateItem);
    priceInput.addEventListener('input', updateItem);

    removeBtn.addEventListener('click', (event) => {
        event.preventDefault();
        estimateItems = estimateItems.filter((entry) => entry !== item);
        row.remove();
        updateTotals();
    });

    estimateItemsContainer.appendChild(row);
    estimateItems.push(item);
    updateTotals();
}

function updateTotals() {
    const total = estimateItems.reduce((sum, item) => {
        return sum + Number(item.qty || 0) * Number(item.unit_price_cents || 0);
    }, 0);
    estimateTotal.textContent = `Total: $${(total / 100).toFixed(2)}`;
}

function renderEstimate(existing) {
    estimatePanel.style.display = 'block';
    estimateItemsContainer.innerHTML = '';
    estimateItems = [];
    if (existing?.items?.length) {
        existing.items.forEach((item) => addItemRow({
            description: item.description,
            qty: item.qty,
            unit_price_cents: item.unit_price_cents
        }));
    } else {
        addItemRow();
    }
}

function renderSuggestedActions(serviceType) {
    suggestedActions.innerHTML = '';
    const button = document.createElement('button');
    button.className = 'ghost-button';
    button.textContent = 'Add suggested line items';
    button.addEventListener('click', (event) => {
        event.preventDefault();
        if (serviceType === '3d_printing') {
            addItemRow({ description: 'Print setup + slicing', qty: 1, unit_price_cents: 1500 });
            addItemRow({ description: 'Material usage (grams)', qty: 1, unit_price_cents: 2000 });
            addItemRow({ description: 'Print time (hours)', qty: 1, unit_price_cents: 2500 });
        } else if (serviceType === 'it_support') {
            addItemRow({ description: 'Diagnostics + cleanup', qty: 1, unit_price_cents: 4900 });
            addItemRow({ description: 'Labor (hours)', qty: 1, unit_price_cents: 4000 });
        } else if (serviceType === 'dev') {
            addItemRow({ description: 'Development hours', qty: 5, unit_price_cents: 5000 });
            addItemRow({ description: 'Project management', qty: 1, unit_price_cents: 5000 });
        } else if (serviceType === 'tutoring') {
            addItemRow({ description: 'Tutoring session', qty: 1, unit_price_cents: 2500 });
        }
    });

    suggestedActions.appendChild(button);

    if (serviceType === '3d_printing') {
        const templateBtn = document.createElement('button');
        templateBtn.className = 'ghost-button';
        templateBtn.textContent = 'Suggest estimate template';
        templateBtn.addEventListener('click', (event) => {
            event.preventDefault();
            addItemRow({ description: '3D print starter pack', qty: 1, unit_price_cents: 2500 });
            addItemRow({ description: 'Basic file check', qty: 1, unit_price_cents: 1000 });
        });
        suggestedActions.appendChild(templateBtn);
    }
}

async function fetchRequest() {
    const token = await getAuthToken();
    const response = await fetch(`/.netlify/functions/admin-get-request?id=${requestId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) {
        requestPanel.innerHTML = `<p class="helper-text">${data.error || 'Unable to load request.'}</p>`;
        return;
    }

    requestData = data.request;
    renderRequestSummary();
    adminNotesPanel.style.display = 'block';
    adminNotes.value = requestData.admin_notes || '';
    setStatusOptions(requestData.status);

    renderEstimate({ items: data.items || [] });
    renderSuggestedActions(requestData.service_type);

    renderAssets(data.assets || []);
    renderActivity(data.activity || []);

    if (requestData.service_type === '3d_printing') {
        aiPanel.style.display = 'block';
    }
}

async function saveNotes() {
    notesStatus.textContent = 'Saving...';
    const token = await getAuthToken();
    const response = await fetch('/.netlify/functions/admin-save-estimate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            request_id: requestId,
            items: estimateItems,
            admin_notes: adminNotes.value,
            status: statusSelect.value
        })
    });
    const data = await response.json();
    notesStatus.textContent = response.ok ? 'Saved.' : data.error || 'Unable to save.';
}

async function saveEstimate() {
    estimateStatus.textContent = 'Saving estimate...';
    const token = await getAuthToken();
    const response = await fetch('/.netlify/functions/admin-save-estimate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            request_id: requestId,
            items: estimateItems,
            status: statusSelect.value,
            admin_notes: adminNotes.value
        })
    });
    const data = await response.json();
    estimateStatus.textContent = response.ok ? 'Estimate saved.' : data.error || 'Unable to save estimate.';
}

async function sendInvoice() {
    estimateStatus.textContent = 'Creating Stripe payment link...';
    const token = await getAuthToken();
    const response = await fetch('/.netlify/functions/admin-send-invoice', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ request_id: requestId })
    });
    const data = await response.json();
    if (!response.ok) {
        estimateStatus.textContent = data.error || 'Unable to send invoice.';
        return;
    }
    estimateStatus.innerHTML = `Invoice sent. <a class="text-link" href="${data.checkout_url}" target="_blank" rel="noopener">Open Stripe Checkout</a>`;
}

async function generatePreviews() {
    aiStatus.textContent = 'Requesting AI previews...';
    const token = await getAuthToken();
    const response = await fetch('/.netlify/functions/generate-ai-previews', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ request_id: requestId })
    });
    const data = await response.json();
    if (!response.ok) {
        aiStatus.textContent = data.error || 'Unable to generate previews.';
        return;
    }
    aiStatus.textContent = data.enabled ? data.message || 'AI preview requested.' : 'AI previews are disabled.';
}

async function init() {
    requestId = getQueryParam('id');
    if (!requestId) {
        requestPanel.innerHTML = '<p class="helper-text">Missing request id.</p>';
        return;
    }

    await requireAdminAuth();
    setupLogoutButton();
    await fetchRequest();
}

addLineItemBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    addItemRow();
});

saveEstimateBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    saveEstimate();
});

sendInvoiceBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    sendInvoice();
});

saveNotesBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    saveNotes();
});

generatePreviewsBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    generatePreviews();
});

init();
