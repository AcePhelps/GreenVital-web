(() => {
  "use strict";
  const apiBase = ["localhost", "127.0.0.1"].includes(location.hostname) ? "http://127.0.0.1:8790" : "https://drop.greenvital.app";
  const el = id => document.getElementById(id);
  const states = ["loading", "subscribe", "activation", "input", "progress", "result", "pairing"];
  let config, profile, activationCode, turnstileToken = "", widget, qrURL, timer, activeJob, retries = 0;
  const proofKey = "cloudDropCheckoutProof";
  // Earlier development versions stored bearer sessions here. The server now
  // keeps the session in a host-only HttpOnly cookie.
  localStorage.removeItem("offlineVaultCloudDropSession");
  sessionStorage.removeItem("offlineVaultCloudDropJob");
  const configPromise = request("/v1/config").then(value => { config = value; return value; });

  window.turnstileLoaded = async () => {
    try {
      await configPromise;
      widget = window.turnstile.render("#turnstile", {
        sitekey: config.turnstileSiteKey, theme: "dark", size: "flexible",
        callback: token => { turnstileToken = token; updateAccessButtons(); },
        "expired-callback": () => { turnstileToken = ""; updateAccessButtons(); },
        "error-callback": () => { turnstileToken = ""; updateAccessButtons(); message("Verification could not load. Refresh and try again."); }
      });
    } catch { message("Cloud Drop is not connected yet. Please return later."); }
  };

  el("start-checkout").addEventListener("click", async () => {
    if (el("start-checkout").disabled) return;
    disableAccessButtons();
    try {
      const result = await request("/v1/billing/checkout", { email: el("checkout-email").value.trim(), turnstileToken });
      sessionStorage.setItem(proofKey, result.proof);
      location.assign(result.url);
    } catch (error) { message(error.message); resetChallenge(); }
  });
  el("test-billing").addEventListener("click", async () => {
    el("test-billing").disabled = true;
    try {
      const result = await request("/v1/admin/billing-test-checkout", {});
      sessionStorage.setItem(proofKey, result.proof);
      location.assign(result.url);
    } catch (error) { message(error.message); }
    finally { el("test-billing").disabled = false; }
  });
  el("restore-access").addEventListener("click", async () => {
    if (el("restore-access").disabled) return;
    disableAccessButtons();
    try {
      await request("/v1/access/recover", { email: el("checkout-email").value.trim(), turnstileToken });
      message("If that email belongs to a Cloud Drop account, a fresh access link is on its way. Approved admins have free access.", true);
    } catch (error) { message(error.message); }
    finally { resetChallenge(); }
  });
  el("activate-here").addEventListener("click", async () => {
    el("activate-here").disabled = true;
    try {
      await request("/v1/access/activate", { code: activationCode });
      activationCode = undefined;
      await loadAccount();
    } catch (error) { message(error.message); }
    finally { el("activate-here").disabled = false; }
  });
  el("back-to-access").addEventListener("click", () => { show("subscribe"); resetChallenge(); });
  el("forget-access").addEventListener("click", async () => {
    try {
      await request("/v1/access/logout", {});
      profile = undefined; activeJob = undefined; clearTimeout(timer);
      el("source-url").value = ""; el("rights").checked = false;
      el("job-list").replaceChildren(); el("claim-qr").removeAttribute("src");
      el("paired-devices").hidden = true; el("device-list").replaceChildren();
      if (qrURL) { URL.revokeObjectURL(qrURL); qrURL = undefined; }
      el("account-controls").hidden = true; el("recent-downloads").hidden = true;
      clearBillingReviews();
      show("subscribe");
    } catch (error) { message(error.message); }
  });
  el("manage-billing").addEventListener("click", async () => {
    try { location.assign((await request("/v1/billing/portal", {})).url); }
    catch (error) { message(error.message); }
  });
  for (const id of ["connect-app", "connect-result-app", "refresh-pairing"]) el(id).addEventListener("click", showAppPairing);
  el("back-from-pairing").addEventListener("click", async () => {
    clearTimeout(timer);
    if (activeJob) await poll(activeJob);
    else { show("input"); updateJobButton(); }
    await loadDevices();
  });
  el("source-url").addEventListener("input", updateJobButton);
  el("rights").addEventListener("change", updateJobButton);
  el("start-job").addEventListener("click", async () => {
    if (el("start-job").disabled) return;
    el("start-job").disabled = true;
    const output = document.querySelector('input[name="output"]:checked').value;
    try {
      const job = await request("/v1/link-jobs", { url: el("source-url").value.trim(), confirmRights: true, type: output === "audio" ? "audio" : "video", quality: output === "video-1080" ? 1080 : 720 });
      retries = 0;
      await poll(job.id);
    } catch (error) { message(error.message); await loadHistory(); }
    finally { updateJobButton(); }
  });
  for (const id of ["new-job", "back-to-library"]) el(id).addEventListener("click", async () => {
    activeJob = undefined; clearTimeout(timer); show("input"); updateJobButton(); await loadHistory();
  });
  addEventListener("pagehide", () => clearTimeout(timer));
  addEventListener("pageshow", event => { if (event.persisted) loadAccount().catch(error => message(error.message)); });
  addEventListener("hashchange", () => {
    if (new URLSearchParams(location.hash.slice(1)).has("activate")) initialize();
  });

  initialize();
  async function initialize() {
    clearTimeout(timer); activeJob = undefined;
    // Fragments stay out of server access logs; confirmation avoids email link
    // preview scanners consuming a one-time sign-in before the user opens it.
    const query = new URLSearchParams(location.search);
    activationCode = new URLSearchParams(location.hash.slice(1)).get("activate") || query.get("activate");
    const checkout = query.get("checkout");
    history.replaceState({}, "", location.pathname);
    try {
      await configPromise;
      if (activationCode) {
        el("account-controls").hidden = true; el("recent-downloads").hidden = true;
        show("activation"); return;
      }
      if (checkout) {
        const result = await request("/v1/billing/exchange", { sessionId: checkout, proof: sessionStorage.getItem(proofKey) });
        sessionStorage.removeItem(proofKey);
        activationCode = new URLSearchParams(new URL(result.activationUrl).hash.slice(1)).get("activate");
        await renderQR("/v1/access-qr", { activationUrl: result.activationUrl }, "activation-qr");
        el("activation-qr-wrap").hidden = false;
        show("activation"); return;
      }
      await loadAccount();
    } catch (error) { show("subscribe"); message(error.message); }
  }
  async function loadAccount() {
    try { profile = await request("/v1/me"); }
    catch (error) {
      if (error.status !== 401) throw error;
      profile = undefined; clearBillingReviews(); show("subscribe"); return;
    }
    el("account-controls").hidden = false;
    el("account-status").textContent = profile.admin ? "Administrator · Free" : profile.active ? "Membership active" : "Membership inactive";
    el("manage-billing").hidden = !profile.billingAvailable;
    el("test-billing").hidden = !profile.billingTestAvailable;
    el("connect-app").disabled = !profile.active;
    el("connect-result-app").disabled = !profile.active;
    show("input"); updateJobButton();
    if (!profile.active) message("Your membership is inactive. Manage your subscription to resume new downloads. Existing downloads are still listed below.");
    else if (!config.downloadsAvailable) message("Downloads are being set up. Please return later.", true);
    await loadHistory();
    await loadBillingReviews();
    await loadDevices();
  }
  async function showAppPairing() {
    clearTimeout(timer);
    for (const id of ["connect-app", "connect-result-app", "refresh-pairing"]) el(id).disabled = true;
    try {
      const pairing = await request("/v1/app-store/pairing", {});
      if (qrURL) URL.revokeObjectURL(qrURL);
      qrURL = URL.createObjectURL(new Blob([pairing.qrSVG], { type: "image/svg+xml" }));
      el("claim-qr").src = qrURL;
      el("pairing-expiry").textContent = `Scan before ${new Date(pairing.expiresAt).toLocaleTimeString()}. This code expires in five minutes.`;
      show("pairing");
      await loadDevices();
      timer = setTimeout(refreshPairingDevices, 5000);
    } catch (error) { message(error.message); }
    finally { for (const id of ["connect-app", "connect-result-app", "refresh-pairing"]) el(id).disabled = !profile?.active; }
  }
  async function refreshPairingDevices() {
    if (el("pairing-state").hidden || !profile) return;
    await loadDevices();
    timer = setTimeout(refreshPairingDevices, 5000);
  }
  async function loadDevices() {
    if (!profile) return;
    try {
      const { devices } = await request("/v1/app-store/devices");
      el("device-list").replaceChildren(); el("paired-devices").hidden = !devices.length;
      for (const device of devices) {
        const row = document.createElement("li"), text = document.createElement("span"), button = document.createElement("button");
        text.textContent = `App connected ${new Date(device.createdAt).toLocaleString()}`;
        button.type = "button"; button.textContent = "Disconnect";
        button.addEventListener("click", async () => {
          button.disabled = true;
          try { await request("/v1/app-store/devices/revoke", { deviceID: device.id }); await loadDevices(); message("This app’s Cloud Drop connection was removed. Files already saved on the phone stay in its Library.", true); }
          catch (error) { message(error.message); button.disabled = false; }
        });
        row.append(text, button); el("device-list").append(row);
      }
    } catch (error) { message(error.message); }
  }
  function clearBillingReviews() { el("billing-reviews").hidden = true; el("billing-review-list").replaceChildren(); }
  async function loadBillingReviews() {
    clearBillingReviews();
    if (!profile?.admin || !profile.active) return;
    try {
      const { reviews } = await request("/v1/admin/billing-reviews");
      el("billing-reviews").hidden = false;
      const labels = { "charge.refunded": "Refund", "charge.dispute.created": "Payment dispute", "radar.early_fraud_warning.created": "Fraud alert" };
      for (const review of reviews) {
        const li = document.createElement("li"), text = document.createElement("p"), button = document.createElement("button");
        text.textContent = `${labels[review.event_type] || "Billing alert"} · ${new Date(review.created_at * 1000).toLocaleDateString()} · ${review.event_id}`;
        button.type = "button"; button.textContent = "Mark reviewed";
        button.addEventListener("click", async () => {
          button.disabled = true;
          try { await request("/v1/admin/billing-reviews/acknowledge", { eventId: review.event_id, subscriptionId: review.subscription_id }); await loadBillingReviews(); }
          catch (error) { message(error.message); button.disabled = false; }
        });
        li.append(text, button); el("billing-review-list").append(li);
      }
      if (!reviews.length) { const li = document.createElement("li"); li.textContent = "No billing alerts need review."; el("billing-review-list").append(li); }
    } catch (error) { message(error.message); }
  }
  async function loadHistory() {
    if (!profile) return;
    try {
      const { jobs } = await request("/v1/link-jobs");
      el("job-list").replaceChildren();
      el("recent-downloads").hidden = false;
      for (const job of jobs) {
        const li = document.createElement("li"), button = document.createElement("button"), title = document.createElement("span"), status = document.createElement("small");
        button.type = "button"; title.textContent = job.title || "Media download"; status.textContent = job.status;
        button.append(title, status); li.append(button); el("job-list").append(li);
        button.addEventListener("click", () => { retries = 0; poll(job.id); });
      }
      if (!jobs.length) { const li = document.createElement("li"); li.textContent = "Your downloads will appear here."; el("job-list").append(li); }
    } catch (error) { message(error.message); }
  }
  async function poll(id) {
    activeJob = id; clearTimeout(timer); show("progress");
    try {
      const job = await request(`/v1/link-jobs/${encodeURIComponent(id)}`);
      if (activeJob !== id) return;
      retries = 0;
      const percent = Math.max(0, Math.min(100, Math.round((Number(job.progress) || 0) * 100)));
      el("job-progress").value = percent; el("progress-value").textContent = `${percent}%`;
      el("progress-title").textContent = job.title || "Preparing your media";
      el("progress-copy").textContent = job.message || (job.status === "importing" ? "Preparing the file for your phone…" : "You can return later. Your download will appear under Recent downloads.");
      if (job.status === "ready") {
        el("result-title").textContent = job.title || "Your file is ready";
        el("expiry-copy").textContent = `Available in your paired app until ${new Date(job.expiresAt).toLocaleString()}.`;
        show("result"); await loadHistory();
      } else if (["failed", "claimed", "expired", "canceled", "cancelled"].includes(job.status)) {
        activeJob = undefined; show("input");
        message(job.status === "claimed" ? "This file has already been claimed by a device." : job.status === "expired" ? "This delivery has expired. Submit the link again to prepare another copy." : job.error || "This download did not finish.", job.status === "claimed");
        updateJobButton(); await loadHistory();
      } else timer = setTimeout(() => poll(id), 3000);
    } catch (error) {
      if ([401, 403, 404, 410].includes(error.status) || ++retries >= 5) {
        activeJob = undefined; show(profile ? "input" : "subscribe"); message(error.message); return;
      }
      el("progress-copy").textContent = "Connection interrupted. Retrying shortly…";
      timer = setTimeout(() => poll(id), 5000);
    }
  }
  async function renderQR(path, body, target) {
    const response = await fetch(`${apiBase}${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error("The QR code could not be created. Please try again.");
    if (qrURL) URL.revokeObjectURL(qrURL);
    qrURL = URL.createObjectURL(await response.blob()); el(target).src = qrURL;
  }
  function updateJobButton() {
    let valid = false; try { valid = new URL(el("source-url").value.trim()).protocol === "https:"; } catch {}
    el("start-job").disabled = !(config?.downloadsAvailable && profile?.active && valid && el("rights").checked);
  }
  function updateAccessButtons() { el("start-checkout").disabled = !(turnstileToken && config?.checkoutAvailable); el("restore-access").disabled = !(turnstileToken && config?.recoveryAvailable); }
  function disableAccessButtons() { el("start-checkout").disabled = true; el("restore-access").disabled = true; }
  function resetChallenge() { turnstileToken = ""; updateAccessButtons(); if (window.turnstile && widget !== undefined) window.turnstile.reset(widget); }
  function show(name) { states.forEach(state => { el(`${state}-state`).hidden = state !== name; }); el("status-message").hidden = true; if (name === "subscribe" && config && !config.checkoutAvailable) message("Cloud Drop is being set up. Paid subscriptions are not open yet.", true); }
  function message(text, notice = false) { el("status-message").textContent = text; el("status-message").dataset.kind = notice ? "notice" : "error"; el("status-message").hidden = false; }
  async function request(path, body) {
    const response = await fetch(`${apiBase}${path}`, { credentials: "include", ...(body !== undefined ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(result.error || "Cloud Drop is temporarily unavailable."); error.status = response.status; throw error; }
    return result;
  }
})();
