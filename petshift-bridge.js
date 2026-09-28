(function () {
  const appScheme = "petshift://";
  const path = window.location.pathname;
  const query = window.location.search || "";
  const hash = window.location.hash || "";
  const normalizedPath = path.replace(/^\/+/, "");
  const deepLink = appScheme + normalizedPath + query + hash;
  const openButton = document.querySelector("[data-open-app]");
  const currentUrlTarget = document.querySelector("[data-current-url]");

  if (openButton) {
    openButton.setAttribute("href", deepLink);
  }

  if (currentUrlTarget) {
    currentUrlTarget.textContent = window.location.href;
  }

  window.setTimeout(() => {
    window.location.href = deepLink;
  }, 650);
})();
