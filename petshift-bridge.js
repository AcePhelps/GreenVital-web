(function () {
  const appScheme = "com.petshift.app://";
  const path = window.location.pathname;
  const query = window.location.search || "";
  const hash = window.location.hash || "";
  const openButton = document.querySelector("[data-open-app]");
  const titleTarget = document.querySelector("[data-bridge-title]");
  const copyTarget = document.querySelector("[data-bridge-copy]");
  const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

  function inviteDeepLink() {
    const segments = path.split("/").filter(Boolean);

    if (segments.length !== 3 || segments[0] !== "invite") {
      return null;
    }

    const [, inviteType, token] = segments;

    if (!tokenPattern.test(token)) {
      return null;
    }

    if (inviteType === "stay") {
      return appScheme + "invite/" + token;
    }

    if (inviteType === "co-owner") {
      return appScheme + "co-owner/" + token;
    }

    return null;
  }

  let deepLink = null;

  if (path.startsWith("/auth/confirm/")) {
    deepLink = appScheme + "auth/confirm" + query + hash;
  } else if (path.startsWith("/auth/reset/")) {
    deepLink = appScheme + "auth/reset-password" + query + hash;
  } else if (path.startsWith("/invite/")) {
    deepLink = inviteDeepLink();
  }

  if (!deepLink && path.startsWith("/invite/")) {
    if (titleTarget) {
      titleTarget.textContent = "This invite link is invalid";
    }

    if (copyTarget) {
      copyTarget.textContent =
        "Please ask the sender for a fresh PetShift invite link, then try again.";
    }

    if (openButton) {
      openButton.remove();
    }

    return;
  }

  if (!deepLink) {
    if (titleTarget) {
      titleTarget.textContent = "This PetShift link is unavailable";
    }

    if (copyTarget) {
      copyTarget.textContent =
        "Please return to GreenVital or open PetShift from your device.";
    }

    if (openButton) {
      openButton.remove();
    }

    return;
  }

  if (openButton && deepLink) {
    openButton.setAttribute("href", deepLink);
  }

  window.setTimeout(() => {
    window.location.href = deepLink;
  }, 650);
})();
