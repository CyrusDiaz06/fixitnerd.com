const form = document.getElementById('requestForm');
const statusEl = document.getElementById('requestStatus');
const successPanel = document.getElementById('requestSuccess');
const statusLink = document.getElementById('statusLink');

if (form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        statusEl.textContent = 'Submitting request...';

        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/.netlify/functions/create-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Unable to submit request.');
            }

            const link = `/request-status.html?id=${result.public_id}`;
            statusLink.href = link;
            statusLink.textContent = link;
            successPanel.style.display = 'block';
            statusEl.textContent = 'Request submitted successfully.';
            form.reset();
        } catch (error) {
            statusEl.textContent = error.message;
        }
    });
}
