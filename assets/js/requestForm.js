const form = document.querySelector("#requestForm");
const statusEl = document.querySelector("#formStatus");

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `notice ${type}`.trim();
}

function parseAssets(value) {
  if (!value) return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((url) => ({ asset_url: url }));
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Submitting request...");

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      service_type: form.service_type.value,
      urgency: form.urgency.value,
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      assets: parseAssets(form.asset_urls.value),
    };

    try {
      const response = await fetch("/.netlify/functions/create-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request.");
      }

      const link = `/request-status.html?id=${data.public_id}`;
      const warning = data.warning ? `<p class="notice warn">${data.warning}</p>` : "";
      statusEl.innerHTML = `Success! Track your request here: <a href="${link}">${link}</a>. ${warning}`;
      statusEl.className = "notice";
      form.reset();
    } catch (error) {
      setStatus(error.message || "Something went wrong.", "error");
    }
  });
}
