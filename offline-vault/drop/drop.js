(() => {
  "use strict";
  const apiBase = ["localhost", "127.0.0.1"].includes(location.hostname) ? "http://127.0.0.1:8790" : "https://drop.greenvital.app";
  const el = id => document.getElementById(id);
  const states = ["loading", "subscribe", "activation", "input", "progress", "result", "pairing"];
  let config, profile, activationCode, turnstileToken = "", widget, qrURL, timer, activeJob, retries = 0;
  let currentState = "loading", connectedDevices = [], pairingSession;
  const canOpenPhoneApp = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const smallScreen = window.matchMedia("(max-width: 720px)");
  el("setup-guide").open = !smallScreen.matches;
  smallScreen.addEventListener("change", event => { el("setup-guide").open = !event.matches; });
  el("desktop-result-hint").hidden = canOpenPhoneApp;
  el("open-app").hidden = !canOpenPhoneApp;
  const sourceSites = new Map([["youtube.com", "YouTube"], ["vimeo.com", "Vimeo"]]);
  const savedSitesKey = "cloudDropSavedSourceSites";
  let savedSites = [];
  try {
    const stored = JSON.parse(localStorage.getItem(savedSitesKey) || "[]");
    if (Array.isArray(stored)) savedSites = [...new Set(stored.filter(site => sourceSites.has(site)))];
  } catch {
    // The website still works when browser storage is unavailable.
  }
  el("save-source-site").addEventListener("click", () => {
    const site = el("source-site").value;
    if (!sourceSites.has(site)) return;
    if (savedSites.includes(site)) {
      el("source-site-status").textContent = `${sourceSites.get(site)} is already saved.`;
      return;
    }
    saveSourceSites([...savedSites, site], `${sourceSites.get(site)} saved.`);
  });
  renderSourceSites();

  function saveSourceSites(sites, status) {
    try {
      localStorage.setItem(savedSitesKey, JSON.stringify(sites));
    } catch {
      el("source-site-status").textContent = "This browser could not save the website.";
      return;
    }
    savedSites = sites;
    renderSourceSites();
    el("source-site-status").textContent = status;
  }

  function renderSourceSites() {
    const list = el("saved-source-sites");
    list.replaceChildren();
    for (const site of savedSites) {
      const name = sourceSites.get(site);
      const row = document.createElement("li");
      const link = document.createElement("a");
      link.href = `https://${site}/`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = name;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "text-button";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${name}`);
      remove.addEventListener("click", () => {
        saveSourceSites(savedSites.filter(saved => saved !== site), `${name} removed.`);
        el("save-source-site").focus();
      });
      row.append(link, " · ", remove);
      list.append(row);
    }
  }

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
        sitekey: config.turnstileSiteKey, theme: "light", size: "flexible",
        callback: token => { turnstileToken = token; updateAccessButtons(); },
        "expired-callback": () => { turnstileToken = ""; updateAccessButtons(); },
        "error-callback": () => { turnstileToken = ""; updateAccessButtons(); if (!profile && !el("subscribe-state").hidden) message("The security check could not load. Refresh this page and try again."); }
      });
    } catch { message("Cloud Drop could not load. Please try again in a moment."); }
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
  el("start-trial").addEventListener("click", async () => {
    if (el("start-trial").disabled || !el("checkout-email").reportValidity()) return;
    disableAccessButtons();
    try {
      await request("/v1/access/trial", { email: el("checkout-email").value.trim(), turnstileToken });
      message("Check your inbox. Open the Cloud Drop email and tap the sign-in link. Can't find it? Check Spam. If you are new, you can try 2 files free, up to 200 MB in total. No card needed.", true);
    } catch (error) { message(error.message); }
    finally { resetChallenge(); }
  });
  el("checkout-email").addEventListener("input", updateAccessButtons);
  el("view-plan").addEventListener("click", () => { show("subscribe"); resetChallenge(); });
  el("return-to-downloads").addEventListener("click", () => { show("input"); updateJobButton(); });
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
      message("If you have a Cloud Drop account with this email, we have sent you a sign-in link. Open it to continue. If it is not in your inbox, check Spam.", true);
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
      profile = undefined; activeJob = undefined; pairingSession = undefined; connectedDevices = []; clearTimeout(timer);
      el("source-url").value = ""; el("rights").checked = false;
      el("job-list").replaceChildren(); el("claim-qr").removeAttribute("src");
      el("paired-devices").hidden = true; el("device-list").replaceChildren();
      if (qrURL) { URL.revokeObjectURL(qrURL); qrURL = undefined; }
      el("account-controls").hidden = true; el("recent-downloads").hidden = true; el("usage-panel").hidden = true;
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
    if (el("start-job").disabled || !el("source-url").reportValidity()) return;
    el("start-job").disabled = true;
    const output = document.querySelector('input[name="output"]:checked').value;
    try {
      const job = await request("/v1/link-jobs", { url: el("source-url").value.trim(), confirmRights: true, type: output === "audio" ? "audio" : "video", quality: output === "video-1080" ? 1080 : 720 });
      retries = 0;
      await poll(job.id);
    } catch (error) { await refreshUsage(); message(error.message); await loadHistory(); }
    finally { updateJobButton(); }
  });
  for (const id of ["new-job", "back-to-library"]) el(id).addEventListener("click", async () => {
    if (id === "new-job") { el("source-url").value = ""; el("rights").checked = false; }
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
        el("account-controls").hidden = true; el("recent-downloads").hidden = true; el("usage-panel").hidden = true;
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
      profile = undefined; connectedDevices = []; pairingSession = undefined;
      for (const id of ["account-controls", "usage-panel", "paired-devices", "recent-downloads"]) el(id).hidden = true;
      clearBillingReviews(); show("subscribe"); return;
    }
    el("account-controls").hidden = false;
    renderAccount();
    el("manage-billing").hidden = !profile.billingAvailable;
    el("test-billing").hidden = !profile.billingTestAvailable;
    el("connect-app").disabled = !profile.active;
    el("connect-result-app").disabled = !profile.active;
    show("input"); updateJobButton();
    if (!profile.active) message("Your plan is not active. Open Billing to restart it. Files already saved on your phone will still play.");
    else if (!config.downloadsAvailable) message("We cannot prepare files right now. Please come back later.", true);
    await loadHistory();
    await loadBillingReviews();
    await loadDevices();
  }
  function renderAccount() {
    const usage = profile?.usage;
    el("account-status").textContent = profile?.admin ? "Admin · Free" : usage?.kind === "trial" ? "Free trial" : profile?.active ? "Monthly plan" : "Plan not active";
    el("usage-panel").hidden = !usage;
    if (!usage) return;
    el("usage-title").textContent = usage.kind === "admin" ? "Your admin account is free" : usage.kind === "trial" ? "Your free files" : "This month's downloads";
    el("usage-meter").hidden = usage.kind === "admin";
    el("usage-summary").textContent = usage.kind === "admin" ? "No monthly fee" : usage.kind === "trial" ? `${usage.remainingTransfers} of 2 files left` : `${formatBytes(usage.remainingBytes)} of 5 GB left`;
    el("usage-meter").value = Math.min(100, Math.max(usage.byteLimit ? usage.usedBytes / usage.byteLimit * 100 : 0, usage.transferLimit ? usage.usedTransfers / usage.transferLimit * 100 : 0));
    el("usage-details").textContent = usage.kind === "admin" ? "You have no monthly size limit. The limit for each file still applies." : usage.kind === "trial" ? `${formatBytes(usage.remainingBytes)} left out of 200 MB total. ${usage.canPrepare ? "No card needed." : "You have used your free trial. You can still save files that are ready below before they expire."}` : `${usage.canPrepare ? "You get a fresh 5 GB" : "You have used this month's 5 GB. You get more"} ${usage.resetsAt ? `on ${new Date(usage.resetsAt).toLocaleDateString()}` : "when your plan renews"}. Unused space does not carry over. No extra charges. Files on your phone stay there.`;
    el("view-plan").hidden = usage.kind !== "trial";
    updateJobButton();
  }
  async function refreshUsage() {
    if (!profile) return;
    try { profile = await request("/v1/me"); renderAccount(); }
    catch (error) { if (error.status === 401) { profile = undefined; el("usage-panel").hidden = true; } }
  }
  function formatBytes(bytes) {
    if (bytes >= 1000000000) return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(bytes / 1000000000)} GB`;
    if (bytes >= 1000000) return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / 1000000)} MB`;
    if (bytes >= 1000) return `${Math.floor(bytes / 1000)} KB`;
    return `${bytes ?? 0} B`;
  }
  async function showAppPairing() {
    clearTimeout(timer);
    for (const id of ["connect-app", "connect-result-app", "refresh-pairing"]) el(id).disabled = true;
    try {
      // Take a fresh snapshot so an old connection is never shown as proof
      // that the code currently on screen was scanned.
      const before = await request("/v1/app-store/devices");
      const pairing = await request("/v1/app-store/pairing", {});
      pairingSession = { deviceIDs: new Set(before.devices.map(device => device.id)), expiresAt: Date.parse(pairing.expiresAt), connected: false };
      if (qrURL) URL.revokeObjectURL(qrURL);
      qrURL = URL.createObjectURL(new Blob([pairing.qrSVG], { type: "image/svg+xml" }));
      el("claim-qr").src = qrURL;
      el("claim-qr").closest(".qr-wrap").hidden = false;
      el("pairing-guide").hidden = false;
      el("pairing-confirmation").hidden = true;
      el("refresh-pairing").hidden = false;
      el("back-from-pairing").textContent = "Back to my files";
      el("back-from-pairing").className = "secondary";
      el("refresh-pairing").textContent = "Get a new code";
      el("refresh-pairing").className = "secondary";
      el("pairing-expiry").textContent = `Scan this code before ${new Date(pairing.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. It works once.`;
      show("pairing");
      await loadDevices();
      schedulePairingCheck();
    } catch (error) { message(error.message); schedulePairingCheck(); }
    finally { for (const id of ["connect-app", "connect-result-app", "refresh-pairing"]) el(id).disabled = !profile?.active; }
  }
  async function refreshPairingDevices() {
    if (el("pairing-state").hidden || !profile) return;
    await loadDevices();
    schedulePairingCheck();
  }
  function schedulePairingCheck() {
    if (!pairingSession || currentState !== "pairing" || pairingSession.connected) return;
    const remaining = pairingSession.expiresAt - Date.now();
    if (remaining <= 0) {
      el("claim-qr").closest(".qr-wrap").hidden = true;
      el("claim-qr").removeAttribute("src");
      el("pairing-expiry").textContent = "This code has expired. Tap Get a new code to try again.";
      el("refresh-pairing").className = "primary";
      return;
    }
    timer = setTimeout(refreshPairingDevices, Math.min(5000, remaining));
  }
  async function loadDevices() {
    if (!profile) return;
    try {
      const { devices } = await request("/v1/app-store/devices");
      connectedDevices = devices;
      el("open-app").hidden = !canOpenPhoneApp || !devices.length;
      el("connect-result-app").className = devices.length ? "secondary" : "primary";
      el("connect-title").textContent = devices.length ? "Your app is connected" : "Connect your phone";
      el("connection-help").hidden = !!devices.length;
      el("connect-app").closest(".connection-card").classList.toggle("is-connected", !!devices.length);
      el("connection-summary").textContent = devices.length ? "Your ready files will appear in Transfer." : "Connect your phone. Then your ready files will appear in the app.";
      el("connect-app").textContent = devices.length ? "Connect another phone" : "Connect my phone";
      if (currentState === "pairing" && pairingSession && !pairingSession.connected && devices.some(device => !pairingSession.deviceIDs.has(device.id))) {
        pairingSession.connected = true;
        el("pairing-guide").hidden = true;
        el("pairing-confirmation").hidden = false;
        el("refresh-pairing").hidden = true;
        el("claim-qr").removeAttribute("src");
        el("pairing-expiry").textContent = "Connected. You do not need to scan again each time.";
        el("back-from-pairing").textContent = activeJob ? "Continue to my file" : "Continue";
        el("back-from-pairing").className = "primary";
      }
      el("device-list").replaceChildren(); el("paired-devices").hidden = !devices.length;
      for (const device of devices) {
        const row = document.createElement("li"), text = document.createElement("span"), button = document.createElement("button");
        text.textContent = `Connected on ${new Date(device.createdAt).toLocaleDateString()}`;
        button.type = "button"; button.textContent = "Disconnect";
        button.addEventListener("click", async () => {
          button.disabled = true;
          try { await request("/v1/app-store/devices/revoke", { deviceID: device.id }); await loadDevices(); message("Disconnected. Files already saved on the phone will stay in Library.", true); }
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
        const labels = { queued: "Waiting", processing: "Preparing", downloading: "Preparing", uploading: "Almost ready", importing: "Almost ready", ready: "Ready to save", failed: "Try again", expired: "Expired", claimed: "Sent to app", canceled: "Stopped", cancelled: "Stopped" };
        button.type = "button"; title.textContent = job.title || "Untitled file"; status.textContent = labels[job.status] || "Preparing";
        button.append(title, status); li.append(button); el("job-list").append(li);
        button.addEventListener("click", () => { retries = 0; poll(job.id); });
      }
      if (!jobs.length) { const li = document.createElement("li"); li.textContent = "No files yet. Paste a video link above to get started."; el("job-list").append(li); }
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
      el("progress-title").textContent = job.title || "Getting your file ready";
      el("progress-copy").textContent = job.status === "queued" ? (config.processorOnline === false ? "Our download service is offline right now. Your file is waiting and will start when it is back." : "Your file is waiting its turn. You can leave this page and come back later.") : job.status === "importing" || job.status === "uploading" ? "Almost ready. We are finishing your file." : "We are getting your file ready. You can come back later and find it in My files.";
      if (job.status === "ready") {
        el("result-title").textContent = job.title || "Your file is ready";
        el("expiry-copy").textContent = `Save this file to your phone before ${new Date(job.expiresAt).toLocaleString()}. After saving, you can play it without internet.`;
        el("connect-result-app").textContent = connectedDevices.length ? "Connect another phone" : "Connect my phone first";
        show("result"); await refreshUsage(); await loadHistory();
      } else if (["failed", "claimed", "expired", "canceled", "cancelled"].includes(job.status)) {
        activeJob = undefined; show("input"); await refreshUsage();
        message(job.status === "claimed" ? "This file has already been sent to the app. Check Library on your phone." : job.status === "expired" ? "This file is no longer available here. Paste the link again to make a new copy. Files already saved on your phone are unchanged." : job.error || "We could not prepare this file. Check the link and try again.", job.status === "claimed");
        updateJobButton(); await loadHistory();
      } else timer = setTimeout(() => poll(id), 3000);
    } catch (error) {
      if ([401, 403, 404, 410].includes(error.status) || ++retries >= 5) {
        activeJob = undefined; show(profile ? "input" : "subscribe"); message(error.message); return;
      }
      el("progress-copy").textContent = "We lost the connection. Trying again in a few seconds…";
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
    el("start-job").disabled = !(config?.downloadsAvailable && profile?.active && profile?.usage?.canPrepare !== false && valid && el("rights").checked);
    const help = !config?.downloadsAvailable ? "File downloads are not available right now. Please try later." : !profile?.active ? "Sign in to an active account to prepare a file." : profile.usage?.canPrepare === false ? (profile.usage.kind === "trial" ? "You have used your free trial. Your saved files will still play." : "You have used this month's 5 GB. You can prepare more files when your plan renews.") : !valid ? "First, paste a full video link above." : !el("rights").checked ? "Tick the permission box to continue." : "Ready. Tap Prepare my file to start.";
    if (el("job-help")) el("job-help").textContent = help;
  }
  function updateAccessButtons() {
    const emailValid = !!el("checkout-email").value.trim() && el("checkout-email").checkValidity();
    el("start-trial").disabled = !(turnstileToken && config?.trialAvailable && emailValid);
    el("start-checkout").disabled = !(turnstileToken && config?.checkoutAvailable && profile);
    el("restore-access").disabled = !(turnstileToken && config?.recoveryAvailable && emailValid);
    if (el("access-help")) el("access-help").textContent = profile ? (turnstileToken ? "Your account is signed in." : "Please wait for the security check above.") : !emailValid ? "Enter your email above. We will send you a link to sign in." : !turnstileToken ? "Please finish the security check above, then send your email link." : "Ready. Send the link, then check your inbox.";
  }
  function disableAccessButtons() { el("start-trial").disabled = true; el("start-checkout").disabled = true; el("restore-access").disabled = true; }
  function resetChallenge() { turnstileToken = ""; updateAccessButtons(); if (window.turnstile && widget !== undefined) window.turnstile.reset(widget); }
  function show(name) { const previousState = currentState; currentState = name;
    document.body.dataset.signedIn = profile ? "true" : "false";
    states.forEach(state => { el(`${state}-state`).hidden = state !== name; }); el("status-message").hidden = true; el("return-to-downloads").hidden = !(name === "subscribe" && profile);
    el("start-trial").hidden = !!profile; el("trial-offer").hidden = !!profile;
    el("start-checkout").hidden = !config?.checkoutAvailable || !profile;
    if (name === "subscribe") {
      el("subscribe-heading").textContent = profile ? "Your monthly plan" : "Try 2 files free.";
      el("subscribe-intro").textContent = profile ? "Get up to 5 GB of videos and audio each month." : "All you need is your email. No password. No card.";
      for (const id of ["email-entry", "returning-user"]) el(id).hidden = !!profile;
      el("plan-details").open = !!profile;
      el("plan-availability").hidden = !!config?.checkoutAvailable;
      el("turnstile").hidden = !!profile && !config?.checkoutAvailable;
      el("access-help").hidden = !!profile && !config?.checkoutAvailable;
      updateAccessButtons();
      if (config && !config.trialAvailable && !config.checkoutAvailable) message("Cloud Drop is not open yet. Please come back later.", true, false);
    }
    if (previousState !== name && previousState !== "loading") {
      const heading = name === "input" ? el("input-title") : el(`${name}-state`).querySelector("h2");
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: "start", behavior: "auto" }); }
    }
  }
  function message(text, notice = false, bringIntoView = true) {
    const status = el("status-message");
    status.setAttribute("role", notice ? "status" : "alert");
    status.setAttribute("aria-live", notice ? "polite" : "assertive");
    status.textContent = text; status.dataset.kind = notice ? "notice" : "error"; status.hidden = false;
    if (bringIntoView) status.scrollIntoView({ block: "nearest", behavior: "auto" });
  }
  async function request(path, body) {
    let response;
    try { response = await fetch(`${apiBase}${path}`, { credentials: "include", ...(body !== undefined ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) }); }
    catch { throw new Error("We could not connect. Check your internet connection and try again."); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const simpler = {
        "Membership session is missing or expired.": "Please sign in again with your email link.",
        "This activation is unavailable or expired.": "This sign-in link has expired. Get a new link below.",
        "This activation was already used.": "This sign-in link has already been used. Get a new link below.",
        "Enter a supported HTTPS media page link.": "Paste a full video link from YouTube or Vimeo. It should start with https://.",
        "Please complete the verification and try again.": "Finish the security check, then try again.",
        "Your previous download is still running. Open it from recent downloads.": "One file is still being prepared. Open it in My files below.",
        "Your free trial allowance is used up. Subscribe to prepare more files. Saved files remain yours.": "You have used your free trial. Files saved on your phone will still play.",
        "Your monthly allowance is used up. It resets with your next billing period. There are no extra charges.": "You have used this month's 5 GB. You get more when your plan renews. There are no extra charges."
      };
      const error = new Error(simpler[result.error] || result.error || "Cloud Drop is not available right now. Please try again later."); error.status = response.status; throw error;
    }
    return result;
  }
})();
