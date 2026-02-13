const statusCard = document.querySelector("#statusCard");
const statusMeta = document.querySelector("#statusMeta");
const estimateList = document.querySelector("#estimateItems");
const payButton = document.querySelector("#payButton");

function formatCents(value) {
  return `$${(value / 100).toFixed(2)}`;
}

async function loadStatus() {
  const params = new URLSearchParams(window.location.search);
  const publicId = params.get("id");
  if (!publicId) {
    statusCard.innerHTML = "<p class=\"notice error\">Missing request ID.</p>";
    return;
  }

  try {
    const response = await fetch(`/.netlify/functions/customer-get-request?public_id=${encodeURIComponent(publicId)}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unable to load request.");
    }

    statusMeta.textContent = `Request ${data.public_id} · ${data.service_type}`;
    statusCard.querySelector("h2").textContent = data.title;
    statusCard.querySelector(".status-text").textContent = data.status;

    if (data.estimate && data.estimate.items && data.estimate.items.length > 0) {
      estimateList.innerHTML = "";
      data.estimate.items.forEach((item) => {
        const row = document.createElement("li");
        row.textContent = `${item.title} × ${item.quantity} — ${formatCents(item.total_cents)}`;
        estimateList.appendChild(row);
      });
      statusCard.querySelector("#estimateTotal").textContent = formatCents(data.estimate.total_cents);
      if (data.estimate.stripe_checkout_url) {
        payButton.href = data.estimate.stripe_checkout_url;
        payButton.classList.remove("hidden");
      }
    }
  } catch (error) {
    statusCard.innerHTML = `<p class="notice error">${error.message}</p>`;
  }
}

loadStatus();
