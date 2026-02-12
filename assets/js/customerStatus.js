const statusMessage = document.getElementById('statusMessage');
const requestSummary = document.getElementById('requestSummary');
const requestTitle = document.getElementById('requestTitle');
const requestStatusBadge = document.getElementById('requestStatusBadge');
const requestDescription = document.getElementById('requestDescription');
const requestMeta = document.getElementById('requestMeta');
const requestService = document.getElementById('requestService');
const estimatePanel = document.getElementById('estimatePanel');
const estimateItems = document.getElementById('estimateItems');
const estimateTotal = document.getElementById('estimateTotal');
const paymentActions = document.getElementById('paymentActions');
const previewPanel = document.getElementById('previewPanel');
const previewGrid = document.getElementById('previewGrid');

function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleString();
}

function buildMeta(label, value) {
    const card = document.createElement('div');
    card.className = 'info-card';
    const title = document.createElement('h4');
    title.textContent = label;
    const content = document.createElement('p');
    content.textContent = value || '—';
    card.appendChild(title);
    card.appendChild(content);
    return card;
}

async function loadRequest() {
    const publicId = getQueryParam('id');
    if (!publicId) {
        statusMessage.textContent = 'Missing request id.';
        return;
    }

    try {
        const response = await fetch(`/.netlify/functions/customer-get-request?id=${encodeURIComponent(publicId)}`);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Unable to load request.');
        }

        const request = data.request;
        requestSummary.style.display = 'block';
        requestTitle.textContent = request.title;
        requestStatusBadge.textContent = request.status;
        requestDescription.textContent = request.description;
        requestService.textContent = request.service_type.replace('_', ' ');
        requestMeta.innerHTML = '';
        requestMeta.appendChild(buildMeta('Submitted', formatDate(request.created_at)));
        requestMeta.appendChild(buildMeta('Urgency', request.urgency));
        requestMeta.appendChild(buildMeta('Contact', request.contact_method));
        requestMeta.appendChild(buildMeta('Budget', request.budget));

        statusMessage.textContent = '';

        if (data.estimate) {
            estimatePanel.style.display = 'block';
            estimateItems.innerHTML = '';
            data.estimate.items.forEach((item) => {
                const row = document.createElement('div');
                row.className = 'info-card';
                row.innerHTML = `<strong>${item.description}</strong><br>${item.qty} x $${(item.unit_price_cents / 100).toFixed(2)}`;
                estimateItems.appendChild(row);
            });
            estimateTotal.textContent = `Total: ${data.estimate.formatted_total}`;

            paymentActions.innerHTML = '';
            if (data.estimate.checkout_url && request.status !== 'PAID') {
                const payBtn = document.createElement('a');
                payBtn.href = data.estimate.checkout_url;
                payBtn.className = 'cta-button';
                payBtn.textContent = 'Pay invoice';
                paymentActions.appendChild(payBtn);
            }
            if (request.status === 'PAID') {
                const paid = document.createElement('p');
                paid.className = 'helper-text';
                paid.textContent = 'Payment received. We will start on your request soon.';
                paymentActions.appendChild(paid);
            }
            if (request.status === 'COMPLETED') {
                const done = document.createElement('p');
                done.className = 'helper-text';
                done.textContent = 'Completed — thanks for working with FixItNerd!';
                paymentActions.appendChild(done);
            }
        }

        if (data.previews && data.previews.length) {
            previewPanel.style.display = 'block';
            previewGrid.innerHTML = '';
            data.previews.forEach((preview) => {
                const card = document.createElement('div');
                card.className = 'service-tile';
                card.innerHTML = `
                    <h3>Option ${preview.option_label || ''}</h3>
                    ${preview.image_url ? `<img src=\"${preview.image_url}\" alt=\"AI preview\" style=\"width:100%; border-radius:12px; margin-bottom:0.8rem;\" />` : ''}
                    <p class=\"helper-text\">${preview.prompt || ''}</p>
                `;
                previewGrid.appendChild(card);
            });
        }
    } catch (error) {
        statusMessage.textContent = error.message;
    }
}

loadRequest();
