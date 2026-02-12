import { requireAdminAuth, getAuthToken, setupLogoutButton } from './identity.js';

const kanbanBoard = document.getElementById('kanbanBoard');
const queueStatus = document.getElementById('queueStatus');
const refreshBtn = document.getElementById('refreshQueue');
const adminEmail = document.getElementById('adminEmail');

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

function formatDate(value) {
    return value ? new Date(value).toLocaleDateString() : '';
}

function buildStatusSelect(current, requestId) {
    const select = document.createElement('select');
    statuses.forEach((status) => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status.replace('_', ' ');
        if (status === current) option.selected = true;
        select.appendChild(option);
    });
    select.addEventListener('change', async () => {
        await updateStatus(requestId, select.value);
    });
    return select;
}

async function updateStatus(requestId, status) {
    const token = await getAuthToken();
    const response = await fetch('/.netlify/functions/admin-update-status', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ request_id: requestId, status })
    });
    const result = await response.json();
    if (!response.ok) {
        alert(result.error || 'Unable to update status.');
    }
}

function renderBoard(requests) {
    kanbanBoard.innerHTML = '';
    statuses.forEach((status) => {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        const title = document.createElement('h3');
        title.textContent = status.replace('_', ' ');
        column.appendChild(title);

        requests
            .filter((request) => request.status === status)
            .forEach((request) => {
                const card = document.createElement('div');
                card.className = 'kanban-card';
                card.innerHTML = `
                    <h4>${request.title}</h4>
                    <p class="helper-text">${request.name} • ${formatDate(request.created_at)}</p>
                    <div class="inline-actions">
                        <span class="badge ${request.urgency === 'rush' ? 'urgent' : ''}">${request.urgency}</span>
                        <span class="badge">${request.service_type.replace('_', ' ')}</span>
                    </div>
                `;

                const link = document.createElement('a');
                link.href = `/admin/request.html?id=${request.id}`;
                link.className = 'text-link';
                link.textContent = 'Open details';
                card.appendChild(link);

                const moveLabel = document.createElement('div');
                moveLabel.className = 'helper-text';
                moveLabel.textContent = 'Move to:';
                card.appendChild(moveLabel);
                card.appendChild(buildStatusSelect(request.status, request.id));

                column.appendChild(card);
            });

        kanbanBoard.appendChild(column);
    });
}

async function loadRequests() {
    queueStatus.textContent = 'Loading requests...';
    const token = await getAuthToken();
    const response = await fetch('/.netlify/functions/admin-list-requests', {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) {
        queueStatus.textContent = data.error || 'Unable to load requests.';
        return;
    }
    renderBoard(data.requests || []);
    queueStatus.textContent = `Loaded ${data.requests.length} requests.`;
}

async function init() {
    const user = await requireAdminAuth();
    if (!user) return;
    adminEmail.textContent = user.email || 'admin';
    setupLogoutButton();
    await loadRequests();
}

refreshBtn?.addEventListener('click', loadRequests);

init();
